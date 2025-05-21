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
from langgraph.checkpoint.sqlite.aio import AsyncSqliteSaver
from typing import (
    List,
    AsyncIterator,
)
from .config import LLM, TAVILY_TOOL
import os
import re
import json
from rapidfuzz.fuzz import partial_ratio
from .custom_types import (
    GraphState,
    BoundingBox,
    HighlightArea,
    ChatSourceComment,
    DocSearchRetrievedNode,
    TavilyToolRetrievedWebsite,
    DocSearchNodeMetadata,
)
import uuid
from llama_index.core.schema import NodeWithScore
from langchain_tavily import TavilySearch
import fitz

from langgraph.config import get_stream_writer


class BasicToolNode:
    """
    Runs the tools requested in the last AIMessage.

    Updates the state with the retrieved nodes from the tool calls.

    """

    def __init__(self, tools: list, tool_name_to_metadata: dict) -> None:

        self.tools_by_name = {tool.name: tool for tool in tools}
        self.tool_name_to_metadata = tool_name_to_metadata

    async def __call__(self, state: dict) -> AsyncIterator[dict | AIMessageChunk]:

        # TODO: test if this interferes when using multiple simultaneous calls
        writer = get_stream_writer()

        if messages := state.get("messages", []):
            message = messages[-1]
        else:
            raise ValueError("No message found in input")
        outputs = []

        for tool_call in message.tool_calls:

            tool = self.tools_by_name[tool_call["name"]]
            sources_list = []

            if self.tool_name_to_metadata[tool_call["name"]]["type"] == "doc_search":
                print("- executing doc search tool call: ", tool_call["name"])

                tool_friendly_name = self.tool_name_to_metadata[tool_call["name"]][
                    "friendly_name"
                ]

                writer({"reading_message": f"Reading {tool_friendly_name} ... "})

                tool_result = await tool.ainvoke(tool_call["args"])

                for retrieved_node in tool_result.raw_output.source_nodes:

                    # assert that the retrieved node is a NodeWithScore
                    assert isinstance(
                        retrieved_node, NodeWithScore
                    ), "[Harlus_chat] Retreived node is not a NodeWithScore"

                    # convert from NodeWithScore to DocSearchRetrievedNode
                    page_nb = 0
                    bounding_boxes = []
                    doc_items = retrieved_node.metadata.get("doc_items", [])
                    for doc_item in doc_items:
                        positions = doc_item.get("prov", [])
                        for position in positions:
                            page_nb = position.get("page_no", 0)
                            bbox = position.get("bbox", None)
                            if bbox is not None:
                                bounding_boxes.append(
                                    {
                                        "left": bbox["l"],
                                        "top": bbox["t"],
                                        "width": bbox["r"] - bbox["l"],
                                        "height": bbox["t"] - bbox["b"],
                                        "page": page_nb,
                                        "type": "absolute",
                                    }
                                )

                    metadata = DocSearchNodeMetadata(
                        raw_metadata=retrieved_node.metadata,
                        page_nb=page_nb,
                        file_id=retrieved_node.metadata.get("file_id", None),
                        bounding_boxes=bounding_boxes,
                    )
                    sources_list.append(
                        DocSearchRetrievedNode(
                            metadata=metadata,
                            text=retrieved_node.text,
                        )
                    )
                content = json.dumps(tool_result.content)
                outputs.append(
                    ToolMessage(
                        content=content,
                        name=tool_call["name"],
                        tool_call_id=tool_call["id"],
                    )
                )

            # Tool is TavilySearchTool
            elif tool_call.get("name", "") == "tavily_search":
                print("- executing tavily search tool call: ", tool_call["name"])
                tool_friendly_name = self.tool_name_to_metadata[tool_call["name"]][
                    "friendly_name"
                ]
                writer({"tool": f"Searching {tool_friendly_name} ... "})
                tool_result = await tool.ainvoke(tool_call["args"])
                content = json.dumps(tool_result)
                for result in tool_result.get("results", []):
                    tavily_tool_metadata = TavilyToolRetrievedWebsite(
                        title=result.get("title", ""),
                        url=result.get("url", ""),
                        content=result.get("content", ""),
                    )
                    sources_list.append(tavily_tool_metadata)
                outputs.append(
                    ToolMessage(
                        content=content,
                        name=tool_call["name"],
                        tool_call_id=tool_call["id"],
                    )
                )

        yield {
            "messages": outputs,
            "sources": state.get("sources", []) + sources_list,
            "full_answer": state.get("full_answer", ""),
        }


def sanitize_tool_name(name):
    return re.sub(r"[^a-zA-Z0-9_-]", "_", name)


# TODO: summarize long-term memorys
# https://langchain-ai.github.io/langgraph/concepts/memory/#writing-memories-in-the-background
class ChatAgentGraph:

    def __init__(self, file_id_to_path: dict[str, str], persist_dir: str):

        self.file_id_to_path = file_id_to_path
        self.LLM = LLM

        self.config = {
            "configurable": {"thread_id": "n.a.", "user_id": "n.a."},
            "stream_events": True,
        }

        self.persist_dir = persist_dir
        os.makedirs(self.persist_dir, exist_ok=True)

        self.db_path = os.path.join(self.persist_dir, "langgraph.db")

        self.memory = None

        self.tool_node = BasicToolNode(tools=[], tool_name_to_metadata={})

        self.graph = None
        self.build()

    def update_tools(self, tools: List[any]):

        self.tools = []
        self.tool_name_to_metadata = {}
        print("[harlus_chat] adding tools")
        for tool in tools:

            if isinstance(tool, TavilySearch):
                print(" - adding tavily search tool")
                self.tools.append(tool)
                self.tool_name_to_metadata.update(
                    {
                        sanitize_tool_name(tool.name): {
                            "type": "tavily_search",
                            "friendly_name": "the web",
                        }
                    }
                )

            elif (
                hasattr(tool, "tool_class")
                and tool.tool_class == "DocSearchToolWrapper"
            ):
                print(" - adding doc search tool")
                lctool = tool.semantic_query_engine_tool.to_langchain_tool()
                self.tools.append(lctool)
                self.tool_name_to_metadata.update(
                    {
                        sanitize_tool_name(lctool.name): {
                            "type": "doc_search",
                            "friendly_name": tool.metadata.friendly_name,
                        }
                    }
                )

            else:
                raise ValueError(f" - {tool} is not a recognized tool.")

        for tool in self.tools:
            tool.name = sanitize_tool_name(tool.name)

        self.tools_descriptions_string = "\n - " + "\n -".join(
            [f"{tool.name}: {tool.description}" for tool in tools]
        )

        self.TOOL_LLM = LLM.bind_tools(self.tools)

        self.tool_node = BasicToolNode(
            tools=self.tools, tool_name_to_metadata=self.tool_name_to_metadata
        )

        self.build()

    def get_current_thread_id(self):
        return self.config["configurable"].get("thread_id")

    def set_thread(self, thread_id: str):
        self.config["configurable"]["thread_id"] = thread_id

    async def _communicate_plan(self, state: GraphState) -> AsyncIterator[dict]:
        prompt = [
            SystemMessage(
                content=f"""
            Provide a plan to answer the last Human Message, make sure the plan involves using the tools described below. DO NOT USE THE TOOLS.

            Each part of the plan should be a new line. NO ADDITIONAL INFORMATION IS NEEDED.                                          
            {self.tools_descriptions_string}
            """
            ),
            *state["messages"],
            HumanMessage(content="Provide a plan for your next step."),
        ]
        writer = get_stream_writer()
        final = ""
        async for chunk in self.LLM.astream(prompt):
            delta = chunk.content or ""
            writer({"planning_message": delta})
            final += delta
        yield {
            "messages": state["messages"] + [AIMessage(content=final)],
            "sources": [],  # reset sources
            "full_answer": state.get("full_answer", ""),
        }

    async def _call_tools(self, state: GraphState) -> AsyncIterator[dict]:
        prompt = [
            SystemMessage(
                content=f"""
            Only use the tools you have been provided with. 
            Base yourself on the plan provided by the user.
            If the plan does not require you to use any tools. Don't do anything.
                          
            ONLY USE THE TOOLS YOU HAVE BEEN PROVIDED WITH.
            """
            ),
            *state["messages"],
        ]

        assistant_msg = await self.TOOL_LLM.ainvoke(prompt)

        yield {
            "messages": [assistant_msg],
            "sources": state["sources"],
            "full_answer": state["full_answer"],
        }

    async def _communicate_result(self, state: GraphState) -> AsyncIterator[dict]:
        prompt = [
            SystemMessage(
                content=f"""
            Answer the latest user-message based on the information given from the previous nodes. 
            """
            ),
            *state["messages"],
        ]

        writer = get_stream_writer()
        final = ""
        async for chunk in self.LLM.astream(prompt):
            delta = chunk.content or ""
            writer({"answer_message": delta})
            final += delta

        yield {
            "messages": state["messages"] + [AIMessage(content=final)],
            "sources": state["sources"],
            "full_answer": state["full_answer"],
        }

    @staticmethod
    def _custom_tools_condition(state: GraphState) -> str:
        print("[harlus_chat] checking if tools are needed")
        last_msg = state["messages"][-1]
        if hasattr(last_msg, "tool_calls") and last_msg.tool_calls:
            return "tools"
        else:
            return "no_tools"

    def build(self):

        graph_builder = StateGraph(GraphState)

        graph_builder.add_node(
            "communicate_plan",
            self._communicate_plan,
            metadata={"name": "communicate_plan"},
        )
        graph_builder.add_node(
            "call_tools", self._call_tools, metadata={"name": "call_tools"}
        )
        graph_builder.add_node(
            "communicate_result",
            self._communicate_result,
            metadata={"name": "communicate_result"},
        )
        graph_builder.add_node("tools", self.tool_node, metadata={"name": "tools"})

        graph_builder.add_edge(START, "communicate_plan")
        graph_builder.add_edge("communicate_plan", "call_tools")
        graph_builder.add_edge("tools", "communicate_result")
        graph_builder.add_edge("communicate_result", END)

        graph_builder.add_conditional_edges(
            "call_tools",
            self._custom_tools_condition,
            {"tools": "tools", "no_tools": "communicate_result"},
        )

        self.graph_builder = graph_builder

        return self.graph_builder

    async def _get_sources(self, graph):
        state = await graph.aget_state(self.config)
        return state.values.get("sources", [])

    async def _get_retrieved_nodes(self, graph):
        # extract nodes which were retrieved during the last run through the graph
        sources = await self._get_sources(graph)
        retrieved_nodes = [
            source for source in sources if isinstance(source, DocSearchRetrievedNode)
        ]

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

    async def _get_chat_source_comments(self, graph):
        chat_source_comments = []

        # get the retrieved nodes from the graph
        retrieved_nodes = await self._get_retrieved_nodes(graph)

        # Get the graph state to access its values
        state = await graph.aget_state(self.config)
        nb_messages = len(state.values.get("messages", []))

        # convert the retrieved nodes to source annotations
        last_unique_id = ""
        for retrieved_node in retrieved_nodes:

            file_id = retrieved_node.metadata.file_id
            page_nb = retrieved_node.metadata.page_nb
            doc = fitz.open(self.file_id_to_path[file_id])
            page = doc[page_nb]
            page_width = page.rect.width
            page_height = page.rect.height

            bounding_boxes = retrieved_node.metadata.bounding_boxes

            standardized_bounding_boxes = []
            for bbox in bounding_boxes:
                standardized_bounding_boxes.append(
                    {
                        "left": float(bbox.left / page_width) * 100,
                        "top": float((page_height - bbox.top) / page_height) * 100,
                        "width": float(bbox.width / page_width) * 100,
                        "height": float((bbox.height / page_height) * 100),
                        "page": page_nb - 1,
                        "type": "relative",
                    }
                )

            # convert to ChatSourceComment framework
            unique_id = str(uuid.uuid4())
            bboxes = [BoundingBox(**bbox) for bbox in standardized_bounding_boxes]
            highlight_area = HighlightArea(
                bounding_boxes=bboxes, jump_to_page_number=page_nb
            )
            chat_source_comment = ChatSourceComment(
                highlight_area=highlight_area,
                id=unique_id,
                file_id=file_id,
                thread_id=self.config["configurable"].get("thread_id"),
                message_id=str(nb_messages),
                text="Response source",
                next_chat_comment_id=last_unique_id,
            )
            last_unique_id = unique_id
            chat_source_comments.append(chat_source_comment)

        return chat_source_comments

    async def stream(self, user_message: str):
        """
        Stream output in EventSource format.
        Current events are:
        - planning_message
        - answer_message
        - reading_message
        - sources
        - complete

        """
        input_state = {
            "messages": [("user", user_message)],
            "retrieved_nodes": [],
            "full_answer": "",
        }

        # Use the database path from persist_dir
        async with AsyncSqliteSaver.from_conn_string(self.db_path) as memory:
            graph = self.graph_builder.compile(checkpointer=memory)

            # 1. stream the answer
            print("[harlus_chat] Streaming answer...")
            async for message_chunk in graph.astream(
                input_state, stream_mode="custom", config=self.config
            ):
                for key, value in message_chunk.items():
                    response = "\n".join(
                        [
                            f'data: {json.dumps({"text": value})}',
                            f"event: {key}",
                            "\n\n",
                        ]
                    )
                    yield response

            # 2. stream the source annotations
            print("[harlus_chat] Streaming source annotations...")
            data = await self._get_chat_source_comments(graph)
            data = [d.model_dump() for d in data]
            response = "\n".join(
                [f"data: {json.dumps(data)}", f'event: {"sources"}', "\n\n"]
            )
            print(f"[harlus_chat] Sent {len(data)} source annotations")
            yield response

            # 3. stream the completion
            response = "\n".join([f"data: ", f'event: {"complete"}', "\n\n"])
            yield response
