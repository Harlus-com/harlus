import json
import re
from langchain_core.messages import AIMessage
from .custom_types import ContrastToolGraphState
from langchain_tavily import TavilySearch
from langchain_core.tools import Tool


def _clean_and_parse_json(text: str):
    
    cleaned = re.sub(r"^`{3}(json)?", "", text.strip(), flags=re.IGNORECASE)
    cleaned = re.sub(r"`{3}$", "", cleaned.strip())
    cleaned = re.sub(r"^'+", "", cleaned.strip())
    cleaned = re.sub(r"'+$", "", cleaned.strip())
    cleaned = re.sub(r"\\n", "", cleaned.strip())
    cleaned = re.sub(r"\\", "", cleaned.strip())
    cleaned = re.sub(r"'", "", cleaned.strip())

    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass

    match = re.search(r'({.*?}|\[.*?\])', cleaned, re.DOTALL)
    if match:
        candidate = match.group(1)
        try:
            return json.loads(candidate)
        except json.JSONDecodeError:
            pass

    cleaned_no_trailing_commas = re.sub(r',(\s*[}\]])', r'\1', cleaned)
    try:
        return json.loads(cleaned_no_trailing_commas)
    except json.JSONDecodeError:
        pass

    raise ValueError("Failed to parse JSON from input.")


def _sanitize_tool_name(name: str) -> str:
    return re.sub(r"[^a-zA-Z0-9_-]", "_", name)


def _strip_none(list_of_elements: list[any]) -> list[any]:
    return [element for element in list_of_elements if element is not None]

def _convert_verdict(verdict: str) -> str:
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
    

def _get_last_message(state: dict | ContrastToolGraphState, state_key: str = "messages") -> AIMessage:
    if messages := state.get(state_key, []):
        message = messages[-1]
        return message
    else:
        raise ValueError("No message found in input")


    
def _parse_tool_class(tool: Tool) -> str:
    if isinstance(tool, TavilySearch):
        return "tavily_search"
    elif hasattr(tool, 'tool_class') and tool.tool_class == "DocSearchToolWrapper":
        return "doc_search"
    else:
        raise ValueError(f" - {tool} is not a recognized tool.")