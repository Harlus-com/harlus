import json
import re
from langchain_core.messages import AIMessage
from langchain_tavily import TavilySearch
from langchain_core.tools import Tool
from .custom_types import ChatGraphState



def sanitize_tool_name(name: str) -> str:
    return re.sub(r"[^a-zA-Z0-9_-]", "_", name)


def strip_none(list_of_elements: list[any]) -> list[any]:
    return [element for element in list_of_elements if element is not None]

def convert_verdict(verdict: str) -> str:
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
    

def get_last_message(state: dict | ChatGraphState, state_key: str = "messages") -> AIMessage:
    if messages := state.get(state_key, []):
        message = messages[-1]
        return message
    else:
        raise ValueError("No message found in input")


    
def parse_tool_class(tool: Tool) -> str:
    if isinstance(tool, TavilySearch):
        return "tavily_search"
    elif hasattr(tool, 'tool_class') and tool.tool_class == "DocSearchToolWrapper":
        return "doc_search"
    else:
        raise ValueError(f" - {tool} is not a recognized tool.")