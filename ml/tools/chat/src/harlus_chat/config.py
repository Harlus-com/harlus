from langchain_tavily import TavilySearch
from langchain_openai import ChatOpenAI
import os


OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
if not OPENAI_API_KEY:
    raise ValueError("OPENAI_API_KEY environment variable is not set")

LLM = ChatOpenAI(model="gpt-4o-mini", temperature=0, api_key=OPENAI_API_KEY)
TAVILY_TOOL = TavilySearch(max_results=5)
