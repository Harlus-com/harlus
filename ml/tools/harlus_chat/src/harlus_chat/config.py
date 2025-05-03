from langchain_tavily import TavilySearch
from langchain_openai import ChatOpenAI
import os


OPENAI_API_KEY = "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"
TAVILY_API_KEY = "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"
os.environ["OPENAI_API_KEY"] = OPENAI_API_KEY
os.environ["TAVILY_API_KEY"] = TAVILY_API_KEY

LLM = ChatOpenAI(model="gpt-4o-mini", temperature=0, api_key=OPENAI_API_KEY)
TAVILY_TOOL = TavilySearch(max_results=2)