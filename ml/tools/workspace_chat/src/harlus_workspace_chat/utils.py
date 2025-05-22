import json
import re
from langchain_core.messages import AIMessage
from langchain_tavily import TavilySearch
from langchain_core.tools import Tool
from .custom_types import ChatGraphState
from typing import List, Tuple


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
    

class TargetSplitter:
    """
    Tags a stream to be before or after a target string.
    """
    __slots__ = ("target", "before_tag", "after_tag", "buf", "tlen", "done")

    def __init__(self, target="__sources__", *, before_tag="before", after_tag="after"):
        self.target = target
        self.before_tag = before_tag
        self.after_tag = after_tag
        self.buf = ""
        self.tlen = len(target)
        self.done = False

    def feed(self, chunk):
        if self.done:
            return [(self.after_tag, chunk)]
        data = self.buf + chunk
        pos = data.find(self.target)
        if pos != -1:
            self.done = True
            before = data[:pos]
            after = data[pos + self.tlen :]
            self.buf = ""
            out = []
            if before:
                out.append((self.before_tag, before))
            if after:
                out.append((self.after_tag, after))
            return out
        if len(data) <= self.tlen:
            self.buf = data
            return []
        emit = data[:-self.tlen]
        self.buf = data[-self.tlen :]
        return [(self.before_tag, emit)]

    def flush(self):
        if not self.done and self.buf:
            r = [(self.before_tag, self.buf)]
        else:
            r = []
        self.buf = ""
        return r
    




EVID_RE = re.compile(
    r'^[ \t]*\[{1,}\s*(\d+)\s*\]{1,}[ \t]*(?:\r?\n[ \t]*)?',
    re.MULTILINE
)

def parse_evidence(text: str) -> List[Tuple[int, str]]:
    """
    Parses strings of the format `[1] ...` into a list of tuples of the format `(page_number, evidence)`.
    """
    
    matches = list(EVID_RE.finditer(text))
    entries: List[Tuple[int, str]] = []

    for idx, m in enumerate(matches):
        start = m.end()
        end = matches[idx + 1].start() if idx + 1 < len(matches) else len(text)
        body = text[start:end].strip()
        entries.append((int(m.group(1)), body))

    return entries