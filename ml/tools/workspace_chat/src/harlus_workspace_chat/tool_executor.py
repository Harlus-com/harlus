from langchain_core.messages import (
    ToolMessage,
    AIMessageChunk,
)
from typing import (
    AsyncIterator, 
)
import json 
from .custom_types import (
    DocSearchRetrievedNode, 
    TavilyToolRetrievedWebsite,
)
from langgraph.config import get_stream_writer
import asyncio
from .type_utils import (
    get_doc_search_retrieved_node_from_node_with_score,
    get_nodes_with_score_from_doc_search_tool_result,
    get_tavily_tool_retrieved_website_from_tool_result,
)
from .utils import (
    get_last_message,
)

class ToolExecutorNode:
    
    def __init__(self, 
                 tools: list, 
                 tool_name_to_metadata: dict, 
                 message_state_key: str = "messages", 
                 retrieved_items_state_key: str = "retrieved_items"
                 ) -> None:    
        self.tools_by_name = {tool.name: tool for tool in tools}
        self.tool_name_to_metadata = tool_name_to_metadata
        self.message_state_key = message_state_key
        self.retrieved_items_state_key = retrieved_items_state_key
        # TODO: add these as a property of the DocSearchToolWrapper
        self.doc_search_tool_types = [
            "doc_search_semantic_query_engine", 
            "doc_search_summary_query_engine", 
            "doc_search_semantic_retriever", 
            "doc_search_summary_retriever",
            "doc_search_sub_question_semantic_query_engine"
        ]

    async def _process_doc_search_tool_call(self, tool_call) -> tuple[list[DocSearchRetrievedNode], ToolMessage]:
        retrieved_nodes = []
        tool = self.tools_by_name[tool_call["name"]]
        tool_metadata = self.tool_name_to_metadata[tool_call["name"]]
        tool_type = tool_metadata.get("type", "")
        tool_friendly_name = tool_metadata.get("friendly_name", "")
        writer = get_stream_writer()
        writer({"reading_message" : f"Reading {tool_friendly_name} ... "})
        print(f" - executing tool call {tool_call['name']}")
        tool_result = await tool.ainvoke(tool_call["args"])
        nodes_with_scores = get_nodes_with_score_from_doc_search_tool_result(tool_result, tool_type)
        for node_with_score in nodes_with_scores:
            retrieved_node = get_doc_search_retrieved_node_from_node_with_score(node_with_score)
            retrieved_nodes.append(retrieved_node)
        content = json.dumps(tool_result.content)
        tool_message = ToolMessage(
            content=content,
            name=tool_call["name"],
            tool_call_id=tool_call["id"],
        )
        return retrieved_nodes, tool_message
    
    async def _process_tavily_search_tool_call(self, tool_call) -> tuple[list[TavilyToolRetrievedWebsite], ToolMessage]:
        tool = self.tools_by_name[tool_call["name"]]
        tool_metadata = self.tool_name_to_metadata[tool_call["name"]]
        tool_friendly_name = tool_metadata.get("friendly_name", "")
        writer = get_stream_writer()
        writer({"tool": f"Searching {tool_friendly_name} ... "})
        tool_result = await tool.ainvoke(tool_call["args"])
        content = json.dumps(tool_result)
        tavily_tool_retrieved_websites = []
        for result in tool_result.get("results", []):
            tavily_tool_retrieved_website = get_tavily_tool_retrieved_website_from_tool_result(result)
            tavily_tool_retrieved_websites.append(tavily_tool_retrieved_website)
        tool_message = ToolMessage(
            content=content,
            name=tool_call["name"],
            tool_call_id=tool_call["id"],
        )
        return tavily_tool_retrieved_websites, tool_message
    
    def _parse_tool_call_type(self, tool_call) -> str:
        tool = self.tools_by_name[tool_call["name"]]
        tool_metadata = self.tool_name_to_metadata[tool_call["name"]]
        tool_type = tool_metadata.get("type", "")
        if tool_type in self.doc_search_tool_types:
            return "doc_search"
        elif tool_call.get("name", "") == "tavily_search":
            return "tavily_search"
        else:
            raise ValueError(f" - {tool} is not a recognized tool.")

    async def __call__(self, state: dict) -> AsyncIterator[dict | AIMessageChunk]:  
        message = get_last_message(state, self.message_state_key)
        tool_messages = []
        retrieved_items = []
        

        tasks = []
        for tool_call in message.tool_calls:
            tool_type = self._parse_tool_call_type(tool_call)
            
            if tool_type == "doc_search":
                tasks.append(self._process_doc_search_tool_call(tool_call))
            elif tool_type == "tavily_search":
                tasks.append(self._process_tavily_search_tool_call(tool_call))
        
        results = await asyncio.gather(*tasks)
        
        for result in results:
            if isinstance(result[0], list) and isinstance(result[0][0], DocSearchRetrievedNode):
                retrieved_nodes, tool_message = result
                tool_messages.append(tool_message)
                retrieved_items.extend(retrieved_nodes)
            elif isinstance(result[0], list) and isinstance(result[0][0], TavilyToolRetrievedWebsite):
                tavily_tool_retrieved_websites, tool_message = result
                tool_messages.append(tool_message)
                retrieved_items.extend(tavily_tool_retrieved_websites)
        
        yield {
            self.message_state_key: tool_messages,
            self.retrieved_items_state_key: retrieved_items,
        }
        

