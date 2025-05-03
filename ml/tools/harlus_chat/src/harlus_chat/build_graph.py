from langchain_core.messages import (
    ToolMessage,
    SystemMessage,
    AIMessage,
    HumanMessage,
    AIMessageChunk,
)
from langgraph.graph import StateGraph, END, START
from langgraph.checkpoint.memory import MemorySaver
from langchain_core.tools import BaseTool
from langgraph.graph.message import add_messages
from llama_index.core.tools import QueryEngineTool
from typing import Annotated, TypedDict, List, Iterator, AsyncIterator
from .config import LLM, TAVILY_TOOL
import re
import json 
from rapidfuzz.fuzz import partial_ratio
from harlus_chat.boundig_boxes import get_standard_rects_from_pdf, prune_overlapping_rects
from pydantic import BaseModel
import uuid


class ToolRetrievedNode(BaseModel):
    metadata: dict
    text: str

class BasicToolNode:
    """A node that runs the tools requested in the last AIMessage."""

    def __init__(self, tools: list) -> None:
        self.tools_by_name = {tool.name: tool for tool in tools}

    def __call__(self, inputs: dict):

        # Get the last message
        if messages := inputs.get("messages", []):
            message = messages[-1]
        else:
            raise ValueError("No message found in input")
        outputs = []

        # Get the tool calls
        for tool_call in message.tool_calls:

            # Invoke the tool
            tool_result = self.tools_by_name[tool_call["name"]].invoke(tool_call["args"])

            # Try to get sources from the tool result
            has_retrieved_nodes = False
            try:
                retrieved_nodes_list = []
                for retrieved_node in tool_result.raw_output.source_nodes:
                    retrieved_nodes_list.append(ToolRetrievedNode(
                        metadata=retrieved_node.metadata,
                        text=retrieved_node.text
                    ))
                content = json.dumps(tool_result.content)
                has_retrieved_nodes = True
            except:
                content = json.dumps(tool_result)

            # Add the tool message to the outputs
            outputs.append(ToolMessage(
                content=content,
                name=tool_call["name"],
                tool_call_id=tool_call["id"],
            ))
        
        # if there are retrieved nodes, add them to the state
        if has_retrieved_nodes:
            return {
                "messages": outputs,
                "retrieved_nodes": retrieved_nodes_list,
                "execution_plan_steps": inputs.get("execution_plan_steps", []),
                "current_step": inputs.get("current_step", "")
            }
        return {
            "messages": outputs,
            "retrieved_nodes": inputs.get("retrieved_nodes", []),
            "execution_plan_steps": inputs.get("execution_plan_steps", []),
            "current_step": inputs.get("current_step", "")
        }


class GraphState(TypedDict):
    messages: Annotated[list, add_messages]
    retrieved_nodes: list[list[any]]
    full_answer: str


class AsyncToolNode:
    def __init__(self, tools):
        self.tools = BasicToolNode(tools)

    async def __call__(self, state: GraphState) -> dict:
        return self.tools(state)

def sanitize_tool_name(name):
    return re.sub(r"[^a-zA-Z0-9_-]", "_", name)


class BoundingBox(BaseModel):
    left: float
    top: float
    width: float
    height: float
    page: int

class HighlightArea(BaseModel):
    bounding_boxes: list[BoundingBox]
    jump_to_page_number: int

class ChatSourceComment(BaseModel):
    id: str
    file_id: str
    thread_id: str
    message_id: str
    text: str
    highlight_area: HighlightArea
    next_chat_comment_id: str

class GraphPipeline:
    def __init__(self, tools: List[any]):
        self.tools = []
        for tool in tools:
            if isinstance(tool, BaseTool):
                self.tools.append(tool)
            elif isinstance(tool, QueryEngineTool):
                self.tools.append(tool.to_langchain_tool())
            else:
                try:
                    self.tools.append(tool.to_langchain_tool())
                except:
                    raise ValueError(f"Tool {tool} is not a recognized tool.")
        for tool in self.tools:
            tool.name = sanitize_tool_name(tool.name)
        self.tools_descriptions_string = "\n - " + "\n -".join([f"{tool.name}: {tool.description}" for tool in tools])
        self.LLM = LLM
        self.TOOL_LLM = LLM.bind_tools(self.tools)
        self.graph = None
        self.config = {"configurable": {"thread_id": "1"}}

    async def communicate_plan(self, state: GraphState) -> AsyncIterator[dict]:
        prompt = [
            SystemMessage(content=f"""
            You are an autonomous AI agent solving a task step-by-step using tools.
            Decide what to do next. YOU MUST BASE YOUR ANSWER ON THE TOOLS PROVIDED BELOW. DO NOT RELY ON PRIOR KNOWLEDGE.
                        
            WRITE A SHORT AND CONCISE PLAN LIKE. "Reading [Document Source] on [Company] from [date] to verify [Claim]..."
                        
            {self.tools_descriptions_string}
            """),
            *state["messages"], 
            HumanMessage(content="Provide a plan for your next step.")
        ]

        final = ""
        async for chunk in self.LLM.astream(prompt):
            delta = chunk.content or ""
            final += delta
        yield {
            "messages": state["messages"] + [AIMessage(content=final)],
            "retrieved_nodes": state.get("retrieved_nodes", []),
            "full_answer": state.get("full_answer", "") + final,
        }


    async def call_tools(self, state: GraphState) -> AsyncIterator[dict]:
        prompt = [
            SystemMessage(content=f"""
            Only use the tools you have been provided with. 
            Base yourself on the plan provided by the user.
            If the plan does not require you to use any tools. Don't do anything.
                          
            ONLY USE THE TOOLS YOU HAVE BEEN PROVIDED WITH.
            """),
            *state["messages"],
        ]
        return {
            "messages": [await self.TOOL_LLM.ainvoke(prompt)],
            "retrieved_nodes": state["retrieved_nodes"],
            "full_answer": state["full_answer"],
        }

    @staticmethod
    def custom_tools_condition(state: GraphState) -> str:
        last_msg = state["messages"][-1]
        if hasattr(last_msg, "tool_calls") and last_msg.tool_calls:
            return "tools"
        else:
            return "no_tools"


    async def communicate_output(self, state: GraphState) -> AsyncIterator[dict]:
        prompt = [
            SystemMessage(content=f"""
            You will summarize an answer to the last Human Message based on the subsequent tool calls and AI messages
            """),
            *state["messages"]
        ]
        final = ""
        async for chunk in self.LLM.astream(prompt):
            delta = chunk.content or ""
            final += delta

        yield {
            "messages": state["messages"] + [AIMessage(content=final)],
            "retrieved_nodes": state.get("retrieved_nodes", []),
            "full_answer": state.get("full_answer", "") + final,
        }


    def build_graph(self):

        # graph builder
        graph_builder = StateGraph(GraphState)

        # nodes
        graph_builder.add_node("communicate_plan", self.communicate_plan)
        graph_builder.add_node("call_tools", self.call_tools)
        graph_builder.add_node("tools", AsyncToolNode(tools=self.tools))

        # fixed edges
        graph_builder.add_edge(START, "communicate_plan")
        graph_builder.add_edge("communicate_plan", "call_tools")
        graph_builder.add_edge("tools", "call_tools")

        # conditional edges
        graph_builder.add_conditional_edges(
            "call_tools",
            self.custom_tools_condition,
            {"tools":"tools", "no_tools":END}
        )

        # compile
        graph = graph_builder.compile(checkpointer=MemorySaver())
        self.graph = graph

        return graph
    
    async def stream_dev(self, user_message: str, mode: str = "messages"):
        
        input_state = {
            "messages": [("user", user_message)], 
            "retrieved_nodes": [], 
            "full_answer": ""
        }
        async for message_chunk, metadata in self.graph.astream(
            input_state,
            stream_mode=mode,
            config = self.config
        ):
            if isinstance(message_chunk, AIMessageChunk):
                yield message_chunk.content

    def get_retrieved_nodes(self):
        retrieved_nodes = self.graph.get_state(self.config).values.get("retrieved_nodes", [])
        pruned_retrieved_nodes = []
        for retrieved_node in retrieved_nodes:
            retrieved_node_text = retrieved_node.text.strip().lower()
            for pruned_retrieved_node in pruned_retrieved_nodes:
                pruned_retrieved_node_text = pruned_retrieved_node.text.strip().lower()
                if partial_ratio(retrieved_node_text, pruned_retrieved_node_text) > 90:
                    break
            else:
                pruned_retrieved_nodes.append(retrieved_node)
        print("pruned_retrieved_nodes: ", pruned_retrieved_nodes)
        return pruned_retrieved_nodes

    def get_chat_source_comments(self):

        chat_source_comments = []

        # get the retrieved nodes from the graph
        retrieved_nodes = self.get_retrieved_nodes()
        nb_messages = len(self.graph.get_state(self.config).values.get("messages", []))
        print(" ** checkpoint 1 ** ")

        # convert the retrieved nodes to source annotations
        last_unique_id = ""
        for retrieved_node in retrieved_nodes:
            print(" ** checkpoint 2 ** ")
            file_path = retrieved_node.metadata.get("file_path")
            text = retrieved_node.text
            page_nb = retrieved_node.metadata.get("page_nb")
            print(" ** checkpoint 3 ** ")
            standard_rects = get_standard_rects_from_pdf(file_path, text, page_nb)
            print(" ** checkpoint 4 ** ")
            standard_rects = prune_overlapping_rects(standard_rects)
            print(" ** checkpoint 5 ** ")

            unique_id = str(uuid.uuid4())
            print(" ** checkpoint 6 ** ")
            bboxes = [BoundingBox(**rect) for rect in standard_rects]
            print(" ** checkpoint 7 ** ")
            highlight_area = HighlightArea(bounding_boxes=bboxes, jump_to_page_number=page_nb)
            print(" ** checkpoint 8 ** ")
            chat_source_comment = ChatSourceComment(
                highlight_area=highlight_area,
                id=unique_id,
                file_id=file_path,
                thread_id=self.config["configurable"].get("thread_id"),
                message_id=str(nb_messages),
                text="Response source",
                next_chat_comment_id=last_unique_id
            )
            print(" ** checkpoint 9 ** ")
            last_unique_id = unique_id
            print(" ** checkpoint 10 ** ")
            chat_source_comments.append(chat_source_comment)
            print(" ** checkpoint 11 ** ")

        return chat_source_comments
    

    async def event_stream_generator(self, user_message: str, mode: str = "messages"):
        input_state = {
            "messages": [("user", user_message)], 
            "retrieved_nodes": [], 
            "full_answer": ""
        }

        # 1. stream the answer 
        async for message_chunk, metadata in self.graph.astream(
            input_state,
            stream_mode=mode,
            config = self.config
        ):
            try:
                if isinstance(message_chunk, AIMessageChunk):
                    response = '\n'.join([
                        f'data: {json.dumps({"text": message_chunk.content})}',
                        f'event: {"message"}',
                        '\n\n'
                    ])
                
                    yield response
            except Exception as e:
                print(f"Streaming error: {e}")
            
        # 2. stream the source annotations
        try:
            data = self.get_chat_source_comments()
            data = [d.model_dump() for d in data]
            response = '\n'.join([
                    f'data: {json.dumps(data)}',
                    f'event: {"sources"}',
                    '\n\n'
            ])
            yield response
        except Exception as e:
            print(f"Error sending source annotations: {e}")

        # 3. stream the completion
        response = '\n'.join([
                    f'data: ',
                    f'event: {"complete"}',
                    '\n\n'
            ])
        yield response
    
    
