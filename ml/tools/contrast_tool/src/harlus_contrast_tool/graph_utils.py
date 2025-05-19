from langchain_core.messages import (
    ToolMessage,
    AIMessage,
    AIMessageChunk,
)
from typing import (
    AsyncIterator, 
)
import json 
from .custom_types import (
    ContrastToolGraphState, 
    BoundingBox, 
    HighlightArea, 
    DocSearchRetrievedNode, 
    TavilyToolRetrievedWebsite,
    DocSearchNodeMetadata
)
from langgraph.config import get_stream_writer
from llama_index.core.schema import NodeWithScore
from langchain_tavily import TavilySearch
import fitz


def _get_last_message(state: dict | ContrastToolGraphState, state_key: str = "messages") -> AIMessage:
    if messages := state.get(state_key, []):
        message = messages[-1]
        return message
    else:
        raise ValueError("No message found in input")

def _get_doc_search_nodes_with_scores(tool_result, tool_type: str) -> list[NodeWithScore]:
    if  tool_type == "doc_search_retriever":
        raw_source_nodes = tool_result.raw_output
    else:
        raw_source_nodes = tool_result.raw_output.source_nodes
    return raw_source_nodes

def _convert_node_with_score_to_retrieved_nodes(retrieved_node: NodeWithScore) -> DocSearchRetrievedNode:

    assert isinstance(retrieved_node, NodeWithScore), "[Harlus_chat] Retreived node is not a NodeWithScore"
    page_nb = 0 
    bounding_boxes = []
    doc_items = retrieved_node.metadata.get("doc_items", [])
    for doc_item in doc_items:
        positions = doc_item.get("prov", [])
        for position in positions:
            page_nb = position.get("page_no", 0)
            bbox = position.get("bbox", None)
            if bbox is not None:
                bounding_boxes.append({
                    "left": bbox['l'],
                    "top": bbox['t'],
                    "width": bbox['r'] - bbox['l'],
                    "height": bbox['t'] - bbox['b'],
                "page": page_nb,
                "type": "absolute"
            })
    metadata = DocSearchNodeMetadata(
        raw_metadata=retrieved_node.metadata,
        page_nb=page_nb,
        file_path=retrieved_node.metadata.get("file_path", ""),
        bounding_boxes=bounding_boxes
    )
    output = DocSearchRetrievedNode(
        metadata=metadata,
        text=retrieved_node.text,
    )
    return output

def _get_bounding_boxes(retrieved_node: DocSearchRetrievedNode):
        
        file_path = retrieved_node.metadata.file_path
        page_nb = retrieved_node.metadata.page_nb
        doc = fitz.open(file_path)
        page = doc[page_nb-1]
        page_width = page.rect.width
        page_height = page.rect.height

        bounding_boxes = retrieved_node.metadata.bounding_boxes

        standardized_bounding_boxes = []
        for bbox in bounding_boxes:
            standardized_bounding_boxes.append({
                "left": float(bbox.left / page_width) * 100,
                "top": float((page_height - bbox.top) / page_height) * 100,
                "width": float(bbox.width / page_width) * 100,
                "height": float((bbox.height / page_height) * 100),
                "page": page_nb-1, 
                "type": "relative"
            })

        # convert to ChatSourceComment framework
        bboxes = [BoundingBox(**bbox) for bbox in standardized_bounding_boxes]

        return bboxes

def _get_highlight_area(retrieved_node: DocSearchRetrievedNode):
    bounding_boxes = _get_bounding_boxes(retrieved_node)
    highlight_area = HighlightArea(bounding_boxes=bounding_boxes, jump_to_page_number=retrieved_node.metadata.page_nb)
    return highlight_area

def _convert_to_tavily_tool_retrieved_website(result) -> TavilyToolRetrievedWebsite:
    tavily_tool_retrieved_website = TavilyToolRetrievedWebsite(
        title=result.get("title", ""),
        url=result.get("url", ""),
        content=result.get("content", ""),
    )
    return tavily_tool_retrieved_website


def _convert_verdict(verdict: str):
    if verdict == "support":
        return "true"
    elif verdict == "contradict":
        return "false"
    elif verdict == "neutral":
        return "unknown"
    elif verdict == "mixed":
        return "unknown"
    else:
        return "unknown"
    
def _parse_tool_class(tool) -> str:
        if isinstance(tool, TavilySearch):
            return "tavily_search"
        elif hasattr(tool, 'tool_class') and tool.tool_class == "DocSearchToolWrapper":
            return "doc_search"
        else:
            raise ValueError(f" - {tool} is not a recognized tool.")
    

class BasicToolNode:
    
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
        self.doc_search_tool_types = ["doc_search_semantic", "doc_search_summary", "doc_search_retriever"]

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
        nodes_with_scores = _get_doc_search_nodes_with_scores(tool_result, tool_type)
        for node_with_score in nodes_with_scores:
            retrieved_node = _convert_node_with_score_to_retrieved_nodes(node_with_score)
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
            tavily_tool_retrieved_website = _convert_to_tavily_tool_retrieved_website(result)
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
        message = _get_last_message(state, self.message_state_key)
        tool_messages = []
        retrieved_items = []
        

        for tool_call in message.tool_calls:
            tool_type = self._parse_tool_call_type(tool_call)
            
            if tool_type == "doc_search":
                retrieved_nodes, tool_message = await self._process_doc_search_tool_call(tool_call)
                tool_messages.append(tool_message)
                retrieved_items.extend(retrieved_nodes)
            elif tool_type == "tavily_search":
                tavily_tool_retrieved_websites, tool_message = await self._process_tavily_search_tool_call(tool_call)
                tool_messages.append(tool_message)
                retrieved_items.extend(tavily_tool_retrieved_websites)
            
        
        yield {
            self.message_state_key: tool_messages,
            self.retrieved_items_state_key: retrieved_items,
        }
        

