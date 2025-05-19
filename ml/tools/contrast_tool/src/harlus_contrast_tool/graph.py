from langchain_core.messages import (
    SystemMessage,    
)
from langgraph.graph import (
    StateGraph, 
    END, 
    START
)
from langgraph.checkpoint.sqlite.aio import AsyncSqliteSaver
from typing import (
    AsyncIterator, 
)
from .config import LLM
import os
import json 
from harlus_doc_search.loader import DocSearchToolWrapper
import uuid
from .graph_utils import (
    _convert_node_with_score_to_retrieved_nodes,
    _get_highlight_area,
    _get_bounding_boxes,
    _convert_verdict,
    _parse_tool_class,
    BasicToolNode,
)
from .custom_types import (
    ContrastToolGraphState, 
    HighlightArea, 
    LinkComment,
    ClaimComment,
)
from harlus_doc_search.loader import DocSearchToolWrapper
import uuid
from .utils import (
    robust_load_json,
    sanitize_tool_name,
)






class ContrastAgentGraph:

    def __init__(self,  persist_dir: str):
        
        self.LLM = LLM
        self.config = {"configurable": {"thread_id": "n.a.", "user_id": "n.a."}}
        self.persist_dir = persist_dir
        os.makedirs(self.persist_dir, exist_ok=True)
        self.db_path = os.path.join(self.persist_dir, "langgraph.db")
        self.memory = None
        self.graph = None
        self.tools_descriptions = {}

    
    def _add_tool(self, tool, metadata_dict, doc_type: str, tool_type: str):
        if doc_type not in self.tools:
            self.tools[doc_type] = {}
        if tool_type not in self.tools[doc_type]:
            self.tools[doc_type][tool_type] = []
        self.tools[doc_type][tool_type].append(tool)
        if doc_type not in self.tool_name_to_metadata:
            self.tool_name_to_metadata[doc_type] = {}
        if tool_type not in self.tool_name_to_metadata[doc_type]:
            self.tool_name_to_metadata[doc_type][tool_type] = {}
        sanitized_name = sanitize_tool_name(tool.name)
        self.tool_name_to_metadata[doc_type][tool_type][sanitized_name] = metadata_dict
    
    def _add_tools(self, tools: list[any], doc_type: str):
        for tool in tools:
            tool_class = _parse_tool_class(tool)
            if tool_class == "tavily_search":
                metadata_dict = {
                    "type": "tavily_search",
                    "friendly_name": "the web"
                }
                self._add_tool(tool, metadata_dict, doc_type, tool_class)
            elif tool_class == "doc_search":
                semantic_tool = tool.semantic_tool.to_langchain_tool()
                tool_type = "doc_search_semantic"
                metadata_dict = {
                    "type": tool_type,
                    "friendly_name": tool.metadata.friendly_name
                }
                self._add_tool(semantic_tool, metadata_dict, doc_type, tool_type)
                summary_tool = tool.summary_tool.to_langchain_tool()
                tool_type = "doc_search_summary"
                metadata_dict = {
                    "type": tool_type,
                    "friendly_name": tool.metadata.friendly_name
                }
                self._add_tool(summary_tool, metadata_dict, doc_type, tool_type)
                retriever_tool = tool.retriever_tool.to_langchain_tool()
                tool_type = "doc_search_retriever"
                metadata_dict = {
                    "type": tool_type,
                    "friendly_name": tool.metadata.friendly_name
                }
                self._add_tool(retriever_tool, metadata_dict, doc_type, tool_type)
    
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
        
    # TODO: have one single BasicToolNode 
    # TODO: rename to ToolExecutor
    def update_tools(self, internal_tools: list[DocSearchToolWrapper], external_tools: list[DocSearchToolWrapper]):

        self.tools = {}
        self.tool_name_to_metadata = {}

        self._add_tools(internal_tools, "internal")
        self._add_tools(external_tools, "external")
        self._sanitize_tool_names("internal")
        self._sanitize_tool_names("external")
        self._generate_tool_descriptions("internal", "doc_search_summary")
        self._generate_tool_descriptions("internal", "doc_search_retriever")
        self._generate_tool_descriptions("external", "doc_search_retriever")

        get_tree_tool_node = BasicToolNode(tools=self.tools["internal"]["doc_search_summary"], tool_name_to_metadata=self.tool_name_to_metadata["internal"]["doc_search_summary"], message_state_key="internal_messages", retrieved_items_state_key="internal_retrieved_items")
        refine_tree_tool_node = BasicToolNode(tools=self.tools["internal"]["doc_search_retriever"], tool_name_to_metadata=self.tool_name_to_metadata["internal"]["doc_search_retriever"], message_state_key="internal_messages", retrieved_items_state_key="internal_retrieved_items")
        add_statement_source_texts_tool_node = BasicToolNode(tools=self.tools["internal"]["doc_search_retriever"], tool_name_to_metadata=self.tool_name_to_metadata["internal"]["doc_search_retriever"], message_state_key="internal_messages", retrieved_items_state_key="internal_retrieved_items")
        verify_tree_tool_node = BasicToolNode(tools=self.tools["external"]["doc_search_retriever"], tool_name_to_metadata=self.tool_name_to_metadata["external"]["doc_search_retriever"], message_state_key="external_messages", retrieved_items_state_key="external_retrieved_items")
        
        self.tool_nodes = {
            "get_tree": get_tree_tool_node,
            "refine_tree": refine_tree_tool_node,
            "add_statement_source_texts": add_statement_source_texts_tool_node,
            "verify_tree": verify_tree_tool_node,
        }

        self.get_tree_llm = self.LLM.bind_tools(self.tools["internal"]["doc_search_summary"])
        self.refine_tree_llm = self.LLM.bind_tools(self.tools["internal"]["doc_search_retriever"])
        self.verify_tree_llm = self.LLM.bind_tools(self.tools["external"]["doc_search_retriever"])

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

    # TODO: Use SummaryIndexRetrieverTool to get the full document
    async def _get_tree(self, state: ContrastToolGraphState) -> AsyncIterator[dict]:
        
        # TODO: add comment 
        print("[harlus_contrast_tool] getting tree")

        with open(os.path.join(os.path.dirname(__file__), "prompts/get_tree_prompt.md"), "r") as f:
            system_prompt = f.read()
        
        system_prompt = system_prompt + self.tools_descriptions["internal"]["doc_search_summary"]
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
       
    async def _add_statement_source_texts(self, state: ContrastToolGraphState) -> AsyncIterator[dict]:
        
        print("[harlus_contrast_tool] adding statement source texts")

        with open(os.path.join(os.path.dirname(__file__), "prompts/add_statement_source_texts_prompt.md"), "r") as f:
            system_prompt = f.read()
        
        system_prompt = system_prompt + self.tools_descriptions["internal"]["doc_search_retriever"]
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

    async def _refine_tree(self, state: ContrastToolGraphState) -> AsyncIterator[dict]:
        
        print("[harlus_contrast_tool] refining tree")

        with open(os.path.join(os.path.dirname(__file__), "prompts/refine_tree_prompt.md"), "r") as f:
            system_prompt = f.read()
        
        system_prompt = system_prompt + self.tools_descriptions["internal"]["doc_search_retriever"]
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
        system_prompt = system_prompt + self.tools_descriptions["external"]["doc_search_retriever"]
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

    
    async def _extract_claim_comments_from_driver_tree(self, parsed_driver_tree):
        claim_comments = []
        for contrast in parsed_driver_tree:
            evidence_source_texts = contrast["evidence_source_texts"]
            contrast["link_comments"] = []
            for evidence_source_text in evidence_source_texts:
                all_nodes = []
                for retriever_tool in self.tools["external"]["doc_search_retriever"]:
                    tool_result = await retriever_tool.ainvoke(evidence_source_text)
                    retrieved_nodes = tool_result.raw_output
                    all_nodes.extend(retrieved_nodes)
                score_to_node = {node.score: node for node in all_nodes}
                max_node = score_to_node[max(score_to_node.keys())]
                max_node = _convert_node_with_score_to_retrieved_nodes(max_node)
                highlight_area = _get_highlight_area(max_node)
                link_comment = LinkComment(
                    file_path=max_node.metadata.file_path,
                    highlight_area=highlight_area,
                    text=contrast["evidence"],
                )
                contrast["link_comments"].append(link_comment)

            statement_source_texts = contrast["statement_source_texts"]
            contrast["statement_nodes"] = []
            for statement_source_text in statement_source_texts:
                all_bounding_boxes = []
                all_nodes = []
                for retriever_tool in self.tools["internal"]["doc_search_retriever"]:
                    tool_result = await retriever_tool.ainvoke(statement_source_text)
                    retrieved_nodes = tool_result.raw_output
                    all_nodes.extend(retrieved_nodes)
                score_to_node = {node.score: node for node in all_nodes}
                max_node = score_to_node[max(score_to_node.keys())]
                max_node = _convert_node_with_score_to_retrieved_nodes(max_node)
                bounding_boxes = _get_bounding_boxes(max_node)
                all_bounding_boxes.extend(bounding_boxes)
                highlight_area = HighlightArea(bounding_boxes=all_bounding_boxes, jump_to_page_number=max_node.metadata.page_nb)
                claim_comment = ClaimComment(
                    file_path=max_node.metadata.file_path,
                    highlight_area=highlight_area,
                    text=contrast["verdict_statement"],
                    links=contrast["link_comments"],
                    verdict=_convert_verdict(contrast["verdict"]),
                )
                claim_comments.append(claim_comment)
        return claim_comments
    
    async def _get_source_nodes(self, state: ContrastToolGraphState) -> AsyncIterator[dict]:
        print("[harlus_contrast_tool] getting claim comments")
        driver_tree = state["driver_tree"]
        parsed_driver_tree = robust_load_json(driver_tree)
        yield {
            "claim_comments": await self._extract_claim_comments_from_driver_tree(parsed_driver_tree)
        }


    @staticmethod
    def _custom_tools_condition_internal(state: ContrastToolGraphState) -> str:
        last_msg = state["internal_messages"][-1]
        if hasattr(last_msg, "tool_calls") and last_msg.tool_calls:
            return "tools"
        else:
            return "no_tools"
        
    @staticmethod
    def _custom_tools_condition_external(state: ContrastToolGraphState) -> str:
        last_msg = state["external_messages"][-1]
        if hasattr(last_msg, "tool_calls") and last_msg.tool_calls:
            return "tools"
        else:
            return "no_tools"
        

    def build(self):

        graph_builder = StateGraph(ContrastToolGraphState)

        graph_builder.add_node("get_tree", self._get_tree, metadata={"name": "get_tree"})
        graph_builder.add_node("refine_tree", self._refine_tree, metadata={"name": "refine_tree"})
        graph_builder.add_node("verify_tree", self._verify_tree, metadata={"name": "verify_tree"})
        graph_builder.add_node("format_output", self._format_output, metadata={"name": "format_output"})
        graph_builder.add_node("add_statement_source_texts", self._add_statement_source_texts, metadata={"name": "add_statement_source_texts"})
        graph_builder.add_node("get_source_nodes", self._get_source_nodes, metadata={"name": "get_source_nodes"})
        graph_builder.add_node("tools_get_tree", self.tool_nodes["get_tree"], metadata={"name": "tools_get_tree"})
        graph_builder.add_node("tools_verify_tree", self.tool_nodes["verify_tree"], metadata={"name": "tools_verify_tree"})
        graph_builder.add_node("tools_refine_tree", self.tool_nodes["refine_tree"], metadata={"name": "tools_refine_tree"})
        graph_builder.add_node("tools_add_statement_source_texts", self.tool_nodes["add_statement_source_texts"], metadata={"name": "tools_add_statement_source_texts"})
        
        # Get tree loop
        graph_builder.add_edge(START, "get_tree")
        graph_builder.add_conditional_edges(
            "get_tree",
            self._custom_tools_condition_internal,
            {"tools":"tools_get_tree", "no_tools":"add_statement_source_texts"}
        )
        graph_builder.add_edge("tools_get_tree", "get_tree")


        # Add statement source texts loop
        graph_builder.add_conditional_edges(
            "add_statement_source_texts",
            self._custom_tools_condition_internal,
            {"tools":"tools_add_statement_source_texts", "no_tools":"refine_tree"}
        )
        graph_builder.add_edge("tools_add_statement_source_texts", "add_statement_source_texts")


        # refine tree loop
        graph_builder.add_conditional_edges(
            "refine_tree",
            self._custom_tools_condition_internal,
            {"tools":"tools_refine_tree", "no_tools":"verify_tree"}
        )
        graph_builder.add_edge("tools_refine_tree", "refine_tree")

        # Verify tree loop
        graph_builder.add_conditional_edges(
            "verify_tree",
            self._custom_tools_condition_external,
            {"tools":"tools_verify_tree", "no_tools": "format_output"}
        )
        graph_builder.add_edge("tools_verify_tree", "verify_tree") 
        graph_builder.add_edge("format_output", "get_source_nodes") 
        graph_builder.add_edge("get_source_nodes", END)       

        self.graph_builder = graph_builder
        return self.graph_builder
    

    async def _get_claim_comments(self, graph):
        state = await graph.aget_state(self.config)
        return state.values.get("claim_comments", [])
    
    async def _get_driver_tree(self, graph):
        state = await graph.aget_state(self.config)
        return state.values.get("driver_tree", "")
    
    async def _get_state(self):
        async with AsyncSqliteSaver.from_conn_string(self.db_path) as memory:
            graph = self.graph_builder.compile(checkpointer=memory)
            state = await graph.aget_state(self.config)
            return state

    async def _get_graph_picture(self):
        async with AsyncSqliteSaver.from_conn_string(self.db_path) as memory:
            graph = self.graph_builder.compile(checkpointer=memory)
            return graph.get_graph().draw_ascii()
        
    async def run(self, user_message: str):
        input_state = {
            "internal_messages": [("user", user_message)], 
            "external_messages": [("user", "")], 
            "driver_tree": "",
            "internal_retrieved_items": [],
            "external_retrieved_items": [],
        }
        async with AsyncSqliteSaver.from_conn_string(self.db_path) as memory:
            graph = self.graph_builder.compile(checkpointer=memory)
            async for message_chunk in graph.astream(
                input_state,
                stream_mode="custom",
                config = self.config
            ):
                pass 
            claim_comments = await self._get_claim_comments(graph)
            driver_tree = await self._get_driver_tree(graph)
            return claim_comments, driver_tree

        
    async def stream(self, user_message: str):
        
        input_state = {
            "internal_messages": [("user", user_message)], 
            "external_messages": [("user", "")], 
            "driver_tree": "",
            "internal_retrieved_items": [],
            "external_retrieved_items": [],
        }

        

        # TODO: strip checkpointer 
        async with AsyncSqliteSaver.from_conn_string(self.db_path) as memory:
            graph = self.graph_builder.compile(checkpointer=memory)
        
            # 1. stream the answer 
            print("[harlus_contrast_tool] Streaming answer...")
            async for message_chunk in graph.astream(
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
            data = await self._get_claim_comments(graph)
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

