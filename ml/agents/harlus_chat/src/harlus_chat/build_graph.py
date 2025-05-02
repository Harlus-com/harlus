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

import json 
import orjson
from harlus_chat.boundig_boxes import get_vertices, vertices_to_rects, rects_to_reactpdf


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
                    retrieved_nodes_list.append({
                        "metadata": retrieved_node.metadata,
                        "text": retrieved_node.text
                    })
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
                        
            WRITE A SHORT AND CONCISE PLAN LIKE. "I will read the [Document Source] on [Company] from [date] to verify ..."
                        
            {self.tools_descriptions_string}
            """),
            *state["messages"], 
            HumanMessage(content="Provide a plan for your next step.")
        ]

        final = ""
        async for chunk in self.LLM.astream(prompt):
            delta = chunk.content or ""
            final += delta
            #yield {
            #    "messages": [AIMessageChunk(content=delta)],
            #    "retrieved_nodes": state.get("retrieved_nodes", []),
            #    "full_answer": state.get("full_answer", ""),
            #}

        yield {
            "messages": state["messages"] + [AIMessage(content=final)],
            "retrieved_nodes": state.get("retrieved_nodes", []),
            "full_answer": state.get("full_answer", "") + final,
        }


    async def call_tools(self, state: GraphState) -> AsyncIterator[dict]:
        prompt = [
            SystemMessage(content=f"""
             Only use the toools you have been provided with. 
            Base yourself on the plan provided by the user.
            If the plan does not require you to use any tools. Don't do anything.
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
            #yield {
            #    "messages": [AIMessageChunk(content=delta)],
            #    "retrieved_nodes": state.get("retrieved_nodes", []),
            #    "full_answer": state.get("full_answer", ""),
            #}

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
    
    async def stream_core(self, user_message: str, mode: str = "messages"):
        
        input_state = {
            "messages": [("user", user_message)], 
            "retrieved_nodes": [], 
            "full_answer": ""
        }
        seen = ()
        async for message_chunk, metadata in self.graph.astream(
            input_state,
            stream_mode=mode,
            config = self.config
        ):
            if isinstance(message_chunk, AIMessageChunk):
                yield message_chunk.content


    def get_retrieved_nodes(self):
        retrieved_nodes = self.graph.get_state(self.config).values.get("retrieved_nodes")
        source_annotations = []
        for retrieved_node in retrieved_nodes:
            file_path = retrieved_node["metadata"]["file_path"]
            text = retrieved_node["text"]
            vertices = get_vertices(file_path, text)
            rects = vertices_to_rects(vertices)
            bboxes = rects_to_reactpdf(rects)
            page_nb = retrieved_node["metadata"]["page_nb"]
            source_annotations.append({
                "file_path": file_path,
                "page_nb": page_nb,
                "bboxes": bboxes
            })
        return source_annotations
    

    async def event_stream_generator(self, user_message: str, mode: str = "messages"):
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
                response = '\n'.join([
                    f'data: {json.dumps({"text": message_chunk.content})}',
                    f'event: {"message"}',
                    '\n\n'
                ])
            
                yield response
        
        data = self.get_retrieved_nodes()
        response = '\n'.join([
                    f'data: {json.dumps(data)}',
                    f'event: {"source_annotations"}',
                    '\n\n'
        ])
        yield response
    
    
    
    
