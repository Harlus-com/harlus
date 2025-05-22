from langchain_core.messages import (
    SystemMessage,
    AIMessage,
    HumanMessage,
)
from langgraph.graph import StateGraph, END, START
from langgraph.checkpoint.memory import MemorySaver
from langgraph.checkpoint.sqlite.aio import AsyncSqliteSaver
from typing import (
    AsyncIterator,
)
from .config import LLM, TAVILY_TOOL
import os
import json
from rapidfuzz.fuzz import partial_ratio
from .custom_types import (
    ChatGraphState,
    DocSearchRetrievedNode,
)
from harlus_doc_search.loader import DocSearchToolWrapper

import uuid
from langchain_tavily import TavilySearch
from .tool_executor import ToolExecutorNode
from .chat_source_comments import (
    get_chat_source_comments_from_retrieved_nodes,
    get_chat_source_comments_from_citations
)
from langgraph.config import get_stream_writer
from .utils import (
    sanitize_tool_name,
    parse_tool_class,
    TargetSplitter,
    parse_evidence
)




class ChatAgentGraph:

    def __init__(self, file_id_to_path: dict[str, str], persist_dir: str):

        self.file_id_to_path = file_id_to_path
        self.LLM = LLM

        self.config = {
            "configurable": {"thread_id": "n.a.", "user_id": "n.a."},
            "stream_events": True,
        }

        # TODO: summarize long-term memories
        # https://langchain-ai.github.io/langgraph/concepts/memory/#writing-memories-in-the-background
        self.persist_dir = persist_dir
        os.makedirs(self.persist_dir, exist_ok=True)
        self.db_path = os.path.join(self.persist_dir, "chat_agent_graph.db")
        self.memory = None

        # TODO: get this cirectly from the state type (ChatGraphState)
        self.state_message_key = "messages"
        self.state_retrieved_nodes_key = "retrieved_nodes"

        
        self.tool_node = ToolExecutorNode(
            tools=[], 
            tool_name_to_metadata={},
            message_state_key=self.state_message_key,
            retrieved_items_state_key=self.state_retrieved_nodes_key,
            file_id_to_path=self.file_id_to_path
        )
        self.tools_descriptions = {}

        self.graph = None
        
        self.build()

    def _add_tool(self, tool, metadata_dict, doc_type: str, tool_type: str):

        # add tool to tools dict
        if doc_type not in self.tools:
            self.tools[doc_type] = {}
        if tool_type not in self.tools[doc_type]:
            self.tools[doc_type][tool_type] = []
        self.tools[doc_type][tool_type].append(tool)

        # add tool to tool_name_to_metadata dict
        if doc_type not in self.tool_name_to_metadata:
            self.tool_name_to_metadata[doc_type] = {}
        if tool_type not in self.tool_name_to_metadata[doc_type]:
            self.tool_name_to_metadata[doc_type][tool_type] = {}
        sanitized_name = sanitize_tool_name(tool.name)
        self.tool_name_to_metadata[doc_type][tool_type][sanitized_name] = metadata_dict
    
    def _add_tools(self, tools: list[any], doc_type: str):

        # parse tool to right class for adding it to the graph
        for tool in tools:
            tool_class = parse_tool_class(tool)
            if tool_class == "tavily_search":
                metadata_dict = {
                    "type": "tavily_search",
                    "friendly_name": "the web"
                }
                self._add_tool(tool, metadata_dict, doc_type, tool_class)
            
            # only add the doc_search_semantic_retriever for now.
            elif tool_class == "doc_search":
                semantic_retriever_tool = tool.semantic_retriever_tool.to_langchain_tool()
                tool_type = "doc_search_semantic_retriever"
                metadata_dict = {
                    "type": tool_type,
                    "friendly_name": tool.metadata.friendly_name
                }
                self._add_tool(semantic_retriever_tool, metadata_dict, doc_type, tool_type)

    def _sanitize_tool_names(self, doc_type: str):
        for tool_type in self.tools[doc_type]:
            for tool in self.tools[doc_type][tool_type]:
                tool.name = sanitize_tool_name(tool.name)

    def _generate_tool_descriptions(self, doc_type: str, tool_type: str):
        nl = "\n\n\n"
        sp = "=========="
        if doc_type not in self.tools_descriptions:
            self.tools_descriptions[doc_type] = {}
        if tool_type not in self.tools_descriptions[doc_type]:
            self.tools_descriptions[doc_type][tool_type] = ""
        self.tools_descriptions[doc_type][tool_type] = nl + nl.join([f"{sp} {t.name} {sp} \n\n {t.description}" for t in self.tools[doc_type][tool_type]]) + nl
        
    # TODO: have one single ToolExecutorNode 
    def update_tools(self, doc_search_tools: list[DocSearchToolWrapper]):

        self.tools = {}
        self.tool_name_to_metadata = {}

        # TODO: remove this layer of complexity on segmenting different tools
        self._add_tools(doc_search_tools, "all_docs")
        self._sanitize_tool_names("all_docs")
        self._generate_tool_descriptions("all_docs", "doc_search_semantic_retriever")

        self.tool_node = ToolExecutorNode(
            tools=self.tools["all_docs"]["doc_search_semantic_retriever"],
            tool_name_to_metadata=self.tool_name_to_metadata["all_docs"]["doc_search_semantic_retriever"], 
            message_state_key=self.state_message_key, 
            retrieved_items_state_key=self.state_retrieved_nodes_key,
            file_id_to_path=self.file_id_to_path
        )
        
        self.tool_llm = self.LLM.bind_tools(self.tools["all_docs"]["doc_search_semantic_retriever"])

        self.build()

    
    def get_current_thread_id(self):
        return self.config["configurable"].get("thread_id")

    def set_thread(self, thread_id: str):
        self.config["configurable"]["thread_id"] = thread_id

    async def _communicate_plan(self, state: ChatGraphState) -> AsyncIterator[dict]:

        with open(os.path.join(os.path.dirname(__file__), "prompts", "communicate_plan.md"), "r") as f:
            system_prompt_template = f.read()
        system_prompt = system_prompt_template + self.tools_descriptions["all_docs"]["doc_search_semantic_retriever"]
        prompt = [
            SystemMessage(content=system_prompt),
            *state[self.state_message_key],
            HumanMessage(content="Provide a plan for your next step."),
        ]
        writer = get_stream_writer()
        final = ""
        async for chunk in self.LLM.astream(prompt):
            delta = chunk.content or ""
            writer({"planning_message": delta})
            final += delta
        yield {
            self.state_message_key: state[self.state_message_key] + [AIMessage(content=final)],
            self.state_retrieved_nodes_key: state[self.state_retrieved_nodes_key],  # reset sources
        }

    async def _call_tools(self, state: ChatGraphState) -> AsyncIterator[dict]:
        
        with open(os.path.join(os.path.dirname(__file__), "prompts", "call_tools_prompt.md"), "r") as f:
            system_prompt_template = f.read()
        system_prompt = system_prompt_template + self.tools_descriptions["all_docs"]["doc_search_semantic_retriever"]
        prompt = [
            SystemMessage(content=system_prompt),
            *state[self.state_message_key],
        ]
        assistant_msg = await self.tool_llm.ainvoke(prompt)
        yield {
            self.state_message_key: state[self.state_message_key] + [assistant_msg],
            self.state_retrieved_nodes_key: state[self.state_retrieved_nodes_key],
        }

    async def _communicate_result(self, state: ChatGraphState) -> AsyncIterator[dict]:

        with open(os.path.join(os.path.dirname(__file__), "prompts", "communicate_result_prompt.md"), "r") as f:
            system_prompt_template = f.read()
        system_prompt = system_prompt_template # no tools descriptions here
        prompt = [
            SystemMessage(content=system_prompt),
            *state[self.state_message_key],
        ]

        target_splitter = TargetSplitter("__sources__")
        writer = get_stream_writer()
        final = ""
        evidence_text = ""
        async for chunk in self.LLM.astream(prompt):
            delta = chunk.content or ""
            splitted_chunks = target_splitter.feed(delta)
            for tag, text in splitted_chunks:
                if tag == "before":
                    writer({"answer_message": text})
                    final += text
                elif tag == "after":
                    evidence_text += text
        yield {
            self.state_message_key: state[self.state_message_key] + [AIMessage(content=final)],
            self.state_retrieved_nodes_key: state[self.state_retrieved_nodes_key],
            "evidence_text": evidence_text,
        }

    @staticmethod
    def _custom_tools_condition(state: ChatGraphState) -> str:
        print("[harlus_chat] checking if tools are needed")
        last_msg = state["messages"][-1] # TODO: make this cleaner by passing self.state_message_key
        if hasattr(last_msg, "tool_calls") and last_msg.tool_calls:
            return "tools"
        else:
            return "no_tools"

    def build(self):

        graph_builder = StateGraph(ChatGraphState)

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

    # TODO: use source_highlight_pipeline here
    async def _get_retrieved_nodes(self, graph):
        state = await graph.aget_state(self.config)
        retrieved_nodes = state.values.get(self.state_retrieved_nodes_key, [])
        retrieved_nodes = [
            source for source in retrieved_nodes if isinstance(source, DocSearchRetrievedNode)
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
    
    async def _get_citations(self, graph):
        state = await graph.aget_state(self.config)
        evidence_text = state.values.get("evidence_text", "")
        citations = parse_evidence(evidence_text)
        return citations

    async def _get_chat_source_comments(self, graph):
        
        chat_source_comments = []

        # get the retrieved nodes from the graph
        retrieved_nodes = await self._get_retrieved_nodes(graph)
        retriever_tools = self.tools["all_docs"]["doc_search_semantic_retriever"]
        citations = await self._get_citations(graph)
        if len(citations) > 0 and len(retrieved_nodes) > 0:
            chat_source_comments = await get_chat_source_comments_from_citations(
                citations, 
                retrieved_nodes, 
                self.file_id_to_path, 
                self.get_current_thread_id(), 
                str(uuid.uuid4()) # not implementing message_id tracking yet
            )
        # fall back to retrieved nodes if LLM did not find any citations
        # for now this will hilight all 
        elif len(retrieved_nodes) > 0: 
            chat_source_comments = await get_chat_source_comments_from_retrieved_nodes(
                retrieved_nodes, 
                self.get_current_thread_id(), 
                str(uuid.uuid4()) # not implementing message_id tracking yet
            )
        
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
            "evidence_text": "",
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
