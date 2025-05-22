from langchain_core.messages import (
    SystemMessage,    
)
from langgraph.graph import (
    StateGraph, 
    END, 
    START
)
from langgraph.checkpoint.memory import InMemorySaver
from typing import (
    AsyncIterator, 
)
from .config import LLM
import os
import json 
from harlus_doc_search.loader import DocSearchToolWrapper
import uuid
from .tool_executor import (
    ToolExecutorNode,
)
from .custom_types import (
    ContrastToolGraphState, 
)
import uuid
from .utils import (
    clean_and_parse_json,
    sanitize_tool_name,
    parse_tool_class,
)
from .claim_comments import (
    get_claim_comments_from_driver_tree
)


class ContrastAgentGraph:

    def __init__(self):
        
        self.LLM = LLM
        self.config = {"configurable": {"thread_id": "n.a.", "user_id": "n.a."}}
        self.graph = None
        self.tools_descriptions = {}
        self.checkpointer = InMemorySaver()

    
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
            # TODO: add all the metadata we extract here:
            # - available tools
            # - their different namings
            # to the DocSearchToolWrapper, so we can just iterate over a list of available tools
            elif tool_class == "doc_search":
                semantic_retriever_tool = tool.semantic_retriever_tool.to_langchain_tool()
                tool_type = "doc_search_semantic_retriever"
                metadata_dict = {
                    "type": tool_type,
                    "friendly_name": tool.metadata.friendly_name
                }
                self._add_tool(semantic_retriever_tool, metadata_dict, doc_type, tool_type)
                summary_retriever_tool = tool.summary_retriever_tool.to_langchain_tool()
                tool_type = "doc_search_summary_retriever"
                metadata_dict = {
                    "type": tool_type,
                    "friendly_name": tool.metadata.friendly_name
                }
                self._add_tool(summary_retriever_tool, metadata_dict, doc_type, tool_type)


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
    def update_tools(self, internal_tools: list[DocSearchToolWrapper], external_tools: list[DocSearchToolWrapper]):

        self.tools = {}
        self.tool_name_to_metadata = {}

        self._add_tools(internal_tools, "internal")
        self._add_tools(external_tools, "external")
        self._sanitize_tool_names("internal")
        self._sanitize_tool_names("external")
        self._generate_tool_descriptions("internal", "doc_search_summary_retriever")
        self._generate_tool_descriptions("internal", "doc_search_semantic_retriever")
        self._generate_tool_descriptions("external", "doc_search_semantic_retriever")

        get_tree_tool_node = ToolExecutorNode(tools=self.tools["internal"]["doc_search_summary_retriever"], tool_name_to_metadata=self.tool_name_to_metadata["internal"]["doc_search_summary_retriever"], message_state_key="internal_messages", retrieved_items_state_key="internal_retrieved_items")
        refine_tree_tool_node = ToolExecutorNode(tools=self.tools["internal"]["doc_search_semantic_retriever"], tool_name_to_metadata=self.tool_name_to_metadata["internal"]["doc_search_semantic_retriever"], message_state_key="internal_messages", retrieved_items_state_key="internal_retrieved_items")
        add_statement_source_texts_tool_node = ToolExecutorNode(tools=self.tools["internal"]["doc_search_semantic_retriever"], tool_name_to_metadata=self.tool_name_to_metadata["internal"]["doc_search_semantic_retriever"], message_state_key="internal_messages", retrieved_items_state_key="internal_retrieved_items")
        verify_tree_tool_node = ToolExecutorNode(tools=self.tools["external"]["doc_search_semantic_retriever"], tool_name_to_metadata=self.tool_name_to_metadata["external"]["doc_search_semantic_retriever"], message_state_key="external_messages", retrieved_items_state_key="external_retrieved_items")
        
        self.tool_nodes = {
            "get_tree": get_tree_tool_node,
            "refine_tree": refine_tree_tool_node,
            "add_statement_source_texts": add_statement_source_texts_tool_node,
            "verify_tree": verify_tree_tool_node,
        }

        self.get_tree_llm = self.LLM.bind_tools(self.tools["internal"]["doc_search_summary_retriever"])
        self.refine_tree_llm = self.LLM.bind_tools(self.tools["internal"]["doc_search_semantic_retriever"])
        self.verify_tree_llm = self.LLM.bind_tools(self.tools["external"]["doc_search_semantic_retriever"])

        self.build()

    def get_current_thread_id(self):
        return self.config["configurable"].get("thread_id")

    def start_new_thread(self):
        self.config["configurable"]["thread_id"] = str(uuid.uuid4())
    
    # TODO: resolve double naming requitement in app.py
    def resume_thread(self, thread_id: str):
        self.config["configurable"]["thread_id"] = thread_id

    def set_thread(self, thread_id: str):
        self.config["configurable"]["thread_id"] = thread_id

    async def _get_tree(self, state: ContrastToolGraphState) -> AsyncIterator[dict]:
        
        print("[harlus_contrast_tool] getting tree")

        with open(os.path.join(os.path.dirname(__file__), "prompts/get_tree_prompt.md"), "r") as f:
            system_prompt = f.read()
        
        system_prompt = system_prompt + self.tools_descriptions["internal"]["doc_search_summary_retriever"]
        prompt = [
            SystemMessage(content=system_prompt),
            *state["internal_messages"],
        ]
        
        message = await self.get_tree_llm.ainvoke(prompt)
        
        if hasattr(message, "tool_calls") and message.tool_calls:
            driver_tree = state["driver_tree"]
        else:
            driver_tree = message.content
        yield {
            "internal_messages": [message],
            "driver_tree": driver_tree,
        }
       

    async def _refine_tree(self, state: ContrastToolGraphState) -> AsyncIterator[dict]:
        
        print("[harlus_contrast_tool] refining tree")

        with open(os.path.join(os.path.dirname(__file__), "prompts/refine_tree_prompt.md"), "r") as f:
            system_prompt = f.read()
        
        system_prompt = system_prompt + self.tools_descriptions["internal"]["doc_search_semantic_retriever"]
        prompt = [
            SystemMessage(content=system_prompt),
            *state["internal_messages"],
            state["driver_tree"],
        ]
        message = await self.refine_tree_llm.ainvoke(prompt)
            
        if hasattr(message, "tool_calls") and message.tool_calls:
            driver_tree = state["driver_tree"]
        else:
            driver_tree = message.content
        yield {
            "internal_messages": [message],
            "driver_tree": driver_tree,
        }
    

    async def _verify_tree(self, state: ContrastToolGraphState) -> AsyncIterator[dict]:
        print("[harlus_contrast_tool] verifying tree")
        with open(os.path.join(os.path.dirname(__file__), "prompts/verify_tree_prompt.md"), "r") as f:
            system_prompt = f.read()
        system_prompt = system_prompt + self.tools_descriptions["external"]["doc_search_semantic_retriever"]
        prompt = [
            SystemMessage(content=system_prompt),
            *state["external_messages"],
            state["driver_tree"],
        ]
        message = await self.verify_tree_llm.ainvoke(prompt)
        if hasattr(message, "tool_calls") and message.tool_calls:
            driver_tree = state["driver_tree"]
        else:
            driver_tree = message.content
        yield {
            "external_messages": [message],
            "driver_tree": driver_tree,
        }

    async def _format_output(self, state: ContrastToolGraphState) -> AsyncIterator[dict]:
        print("[harlus_contrast_tool] formatting output")
        with open(os.path.join(os.path.dirname(__file__), "prompts/format_output_prompt.md"), "r") as f:
            system_prompt = f.read()
        system_prompt = system_prompt
        prompt = [
            SystemMessage(content=system_prompt),
            state["driver_tree"],
        ]
        message = await self.LLM.ainvoke(prompt)
        yield {
            "driver_tree": message.content,
        }
    
    async def _get_source_nodes(self, state: ContrastToolGraphState) -> AsyncIterator[dict]:
        print("[harlus_contrast_tool] getting claim comments")
        driver_tree = state["driver_tree"]
        parsed_driver_tree = clean_and_parse_json(driver_tree)
        claim_comments = await get_claim_comments_from_driver_tree(
            parsed_driver_tree,
            self.tools["internal"]["doc_search_semantic_retriever"],
            self.tools["external"]["doc_search_semantic_retriever"]
        )
        yield {
            "claim_comments": claim_comments
        }


    @staticmethod
    def _custom_tools_condition_internal(state: ContrastToolGraphState) -> str:
        last_msg = state["internal_messages"][-1]
        if hasattr(last_msg, "tool_calls") and last_msg.tool_calls:
            return "tools"
        else:
            return "no_tools"
        
    @staticmethod
    def _post_verify_tree_condition(state: ContrastToolGraphState) -> str:
        last_msg = state["external_messages"][-1]
        if hasattr(last_msg, "tool_calls") and last_msg.tool_calls:
            return "tools"
        else:
            driver_tree = state["driver_tree"]
        try:
            clean_and_parse_json(driver_tree)
            return "parsable"
        except:
            return "not_parsable"
        

    def build(self):

        graph_builder = StateGraph(ContrastToolGraphState)
        graph_builder.add_node("get_tree", self._get_tree, metadata={"name": "get_tree"})
        graph_builder.add_node("refine_tree", self._refine_tree, metadata={"name": "refine_tree"})
        graph_builder.add_node("verify_tree", self._verify_tree, metadata={"name": "verify_tree"})
        graph_builder.add_node("format_output", self._format_output, metadata={"name": "format_output"})
        graph_builder.add_node("get_source_nodes", self._get_source_nodes, metadata={"name": "get_source_nodes"})
        graph_builder.add_node("tools_get_tree", self.tool_nodes["get_tree"], metadata={"name": "tools_get_tree"})
        graph_builder.add_node("tools_verify_tree", self.tool_nodes["verify_tree"], metadata={"name": "tools_verify_tree"})
        graph_builder.add_node("tools_refine_tree", self.tool_nodes["refine_tree"], metadata={"name": "tools_refine_tree"})
        
        
        graph_builder.add_edge(START, "get_tree")
        graph_builder.add_conditional_edges(
            "get_tree",
            self._custom_tools_condition_internal,
            {"tools":"tools_get_tree", "no_tools":"refine_tree"}
        )
        graph_builder.add_edge("tools_get_tree", "get_tree")
        graph_builder.add_conditional_edges(
            "refine_tree",
            self._custom_tools_condition_internal,
            {"tools":"tools_refine_tree", "no_tools":"verify_tree"}
        )
        graph_builder.add_edge("tools_refine_tree", "refine_tree")
        graph_builder.add_conditional_edges(
            "verify_tree",
            self._post_verify_tree_condition,
            {"tools":"tools_verify_tree", "parsable": "get_source_nodes", "not_parsable": "format_output"}
        )
        graph_builder.add_edge("tools_verify_tree", "verify_tree") 
        graph_builder.add_edge("format_output", "get_source_nodes") 
        graph_builder.add_edge("get_source_nodes", END)       

        self.graph_builder = graph_builder
        return self.graph_builder
    

    async def _get_state(self):
        state = await self.graph.aget_state(self.config)
        return state

    async def _get_claim_comments(self):
        state = await self._get_state()
        return state.values.get("claim_comments", [])
    
    async def _get_driver_tree(self):
        state = await self._get_state()
        return state.values.get("driver_tree", "")


    async def _get_graph_picture(self):
        return self.graph.get_graph().draw_ascii()
        
    async def run(self, user_message: str):
        input_state = {
            "internal_messages": [("user", user_message)], 
            "external_messages": [("user", "")], 
            "driver_tree": "",
            "internal_retrieved_items": [],
            "external_retrieved_items": [],
        }
        self.graph = self.graph_builder.compile(checkpointer=self.checkpointer)
        async for message_chunk in self.graph.astream(
            input_state,
            stream_mode="custom",
            config = self.config
        ):
            pass 
        claim_comments = await self._get_claim_comments()
        driver_tree = await self._get_driver_tree()
        return claim_comments, driver_tree

        
    async def stream(self, user_message: str):
        
        input_state = {
            "internal_messages": [("user", user_message)], 
            "external_messages": [("user", "")], 
            "driver_tree": "",
            "internal_retrieved_items": [],
            "external_retrieved_items": [],
        }

        

        self.graph = self.graph_builder.compile(checkpointer=self.checkpointer)
        
        # 1. stream the answer 
        print("[harlus_contrast_tool] Streaming answer...")
        async for message_chunk in self.graph.astream(
            input_state,
            stream_mode="custom",
            config = self.config
        ):
            for key, value in message_chunk.items():
                response = '\n'.join([
                    f'data: {json.dumps({"text": value})}',
                    f'event: {key}',
                    '\n\n'
                ])
                yield response
            
            
        # 2. stream the claim comments
        print("[harlus_contrast_tool] Streaming claim comments...")
        data = await self._get_claim_comments(self.graph)
        data = [d.model_dump() for d in data]
        response = '\n'.join([
                f'data: {json.dumps(data)}',
                f'event: claim_comments',
                '\n\n'
        ])
        print(f"[harlus_contrast_tool] Sent {len(data)} claim comments")
        yield response
        

        # 3. stream the completion
        response = '\n'.join([
                    f'data: ',
                    f'event: complete',
                    '\n\n'
            ])
        yield response

