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
from .boundig_boxes import get_standard_rects_from_pdf, prune_overlapping_rects, get_llamaparse_rects
from .custom_types import GraphState, ToolRetrievedNode, BoundingBox, HighlightArea, ChatSourceComment
import uuid


class BasicToolNode:
    """
    Runs the tools requested in the last AIMessage.

    Updates the state with the retrieved nodes from the tool calls.
    
    """

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





class AsyncToolNode:
    def __init__(self, tools):
        self.tools = BasicToolNode(tools)

    async def __call__(self, state: GraphState) -> dict:
        return self.tools(state)

def sanitize_tool_name(name):
    return re.sub(r"[^a-zA-Z0-9_-]", "_", name)




class ChatAgentGraph:
    """
    ChatAgentGraph represents the agent behind the chat interface.
    
    This agent can be instantiated with a list of tools. After instantiating the agent, you must call the `build()` method.

    ```
    agent = ChatAgentGraph(tools=[tool1, tool2, tool3])
    agent.build()
    ```

    After building the agent, you can use the `stream()` method to start the chat. This method requires two arguments:
    - `user_message`: The message to send to the agent.
    - `thread_id`: The id of the thread to use. This is used to identify the thread in the database.

    ```
    async for message_chunk in agent.stream(user_message="Hello, how are you?", thread_id="1"):
        print(message_chunk)
    ```

    The `stream()` method acts as an EventSource stream. It outputs events with the following format:

    ```
    data: {"text": "Hello, how are you?"}
    event: "message"


    ```

    Currently, the stream supports the following events:
    - "message": A message from the agent. Data will have the following format:
    ```
    data: {"text": "Hello, how are you?"}
    event: "message"
    ```
    - "sources": A list of source annotations. Data will have the following format:
    ```
    data: [ChatSourceComment.model_dump(), ChatSourceComment.model_dump(), ...]
    event: "sources"
    ```
    - "complete": The stream is complete. Data will have the following format:
    ```
    data: "n.a."
    event: "complete"
    ```


    """
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

    async def _communicate_plan(self, state: GraphState) -> AsyncIterator[dict]:
        prompt = [
            SystemMessage(content=f"""
            You are an autonomous AI agent solving a task step-by-step using tools.
            Decide what to do next. YOU MUST BASE YOUR ANSWER ON THE TOOLS PROVIDED BELOW. DO NOT RELY ON PRIOR KNOWLEDGE.
                        
            WRITE A SHORT AND CONCISE PLAN BASED ON THE TOOLS PROVIDED. FOLLOW THE EXAMPLES BELOW.
                                  
            "Reading Apple's 2024 Annual 10K report to find information on ..."
            "Reading Applied Materials 2024 Earnings call transcript from Q1 to find information on ..."
            "Searching the web for information on ..."
                        
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
            "full_answer": state.get("full_answer", ""),
        }
        


    async def _call_tools(self, state: GraphState) -> AsyncIterator[dict]:
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
    def _custom_tools_condition(state: GraphState) -> str:
        last_msg = state["messages"][-1]
        if hasattr(last_msg, "tool_calls") and last_msg.tool_calls:
            return "tools"
        else:
            return "no_tools"


    async def _communicate_output(self, state: GraphState) -> AsyncIterator[dict]:
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


    def build(self):

        # graph builder
        graph_builder = StateGraph(GraphState)

        # nodes
        graph_builder.add_node("communicate_plan", self._communicate_plan, metadata={"name": "communicate_plan"})
        graph_builder.add_node("call_tools", self._call_tools, metadata={"name": "call_tools"})
        graph_builder.add_node("tools", AsyncToolNode(tools=self.tools), metadata={"name": "tools"})

        # fixed edges
        graph_builder.add_edge(START, "communicate_plan")
        graph_builder.add_edge("communicate_plan", "call_tools")
        graph_builder.add_edge("tools", "call_tools")

        # conditional edges
        graph_builder.add_conditional_edges(
            "call_tools",
            self._custom_tools_condition,
            {"tools":"tools", "no_tools":END}
        )

        # compile
        graph = graph_builder.compile(checkpointer=MemorySaver())
        self.graph = graph

        return graph
    

    def _get_retrieved_nodes(self):

        # extract nodes which were retrieved during the last run through the graph
        retrieved_nodes = self.graph.get_state(self.config).values.get("retrieved_nodes", [])

        # prune nodes which have similar text
        pruned_retrieved_nodes = []
        for retrieved_node in retrieved_nodes:
            retrieved_node_text = retrieved_node.text.strip().lower()
            for pruned_retrieved_node in pruned_retrieved_nodes:
                pruned_retrieved_node_text = pruned_retrieved_node.text.strip().lower()
                if partial_ratio(retrieved_node_text, pruned_retrieved_node_text) > 90:
                    break
            else:
                pruned_retrieved_nodes.append(retrieved_node)
        
        return pruned_retrieved_nodes

    def _get_chat_source_comments(self):

        chat_source_comments = []

        # get the retrieved nodes from the graph
        retrieved_nodes = self._get_retrieved_nodes()
        nb_messages = len(self.graph.get_state(self.config).values.get("messages", []))

        # convert the retrieved nodes to source annotations
        last_unique_id = ""
        for retrieved_node in retrieved_nodes:
            file_path = retrieved_node.metadata.get("file_path")
            text = retrieved_node.text
            page_nb = retrieved_node.metadata.get("page_nb")

            # get the rects from the llama parse tool (course)
            backup_standard_rects = get_llamaparse_rects(file_path, retrieved_node, page_nb)

            # get the rects based on text from the pdf (fine-grained)
            standard_rects = get_standard_rects_from_pdf(file_path, text, page_nb)
            standard_rects = prune_overlapping_rects(standard_rects)

            # if no fine-grained rects are found, use the course rects
            if len(standard_rects) == 0:
                print("[harlus_chat] No fine-grained rects found, using course rects")
                standard_rects = backup_standard_rects

            # convert to ChatSourceComment framework
            unique_id = str(uuid.uuid4())
            bboxes = [BoundingBox(**rect) for rect in standard_rects]
            highlight_area = HighlightArea(bounding_boxes=bboxes, jump_to_page_number=page_nb)
            chat_source_comment = ChatSourceComment(
                highlight_area=highlight_area,
                id=unique_id,
                file_id=file_path,
                thread_id=self.config["configurable"].get("thread_id"),
                message_id=str(nb_messages),
                text="Response source",
                next_chat_comment_id=last_unique_id
            )
            last_unique_id = unique_id
            chat_source_comments.append(chat_source_comment)

        return chat_source_comments
    

    async def stream(self, user_message: str, thread_id: str = "1"):

        input_state = {
            "messages": [("user", user_message)], 
            "retrieved_nodes": [], 
            "full_answer": ""
        }

        self.config["configurable"]["thread_id"] = thread_id

        # 1. stream the answer 
        print("[harlus_chat] Streaming answer...")
        async for message_chunk, metadata in self.graph.astream(
            input_state,
            stream_mode="messages",
            config = self.config
        ):
            try:
                # stream only message chunks
                if isinstance(message_chunk, AIMessageChunk):
                    # stream reading message
                    if metadata.get("langgraph_node") == "communicate_plan":
                        response = '\n'.join([
                            f'data: {json.dumps({"text": message_chunk.content})}',
                            f'event: {"reading_message"}',
                            '\n\n'
                        ])
                    # stream answer message
                    elif metadata.get("langgraph_node") == "call_tools":
                        response = '\n'.join([
                            f'data: {json.dumps({"text": message_chunk.content})}',
                            f'event: {"answer_message"}',
                            '\n\n'
                        ])
                    else:
                        print(f"[harlus_chat] Ignoring stream from unknown node: {metadata.get('langgraph_node')}")
                
                    yield response
            except Exception as e:
                print(f"Streaming error: {e}")
            
        # 2. stream the source annotations
        print("[harlus_chat] Streaming source annotations...")
        try:
            data = self._get_chat_source_comments()
            data = [d.model_dump() for d in data]
            response = '\n'.join([
                    f'data: {json.dumps(data)}',
                    f'event: {"sources"}',
                    '\n\n'
            ])
            print(f"[harlus_chat] Sent {len(data)} source annotations")
            yield response
        except Exception as e:
            print(f"[harlus_chat] Error sending source annotations: {e}")

        # 3. stream the completion
        response = '\n'.join([
                    f'data: ',
                    f'event: {"complete"}',
                    '\n\n'
            ])
        yield response
    
    