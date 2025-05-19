from langchain_tavily import TavilySearch
from langchain_openai import ChatOpenAI
import os
from dotenv import load_dotenv

print(os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "..", "python", "env", ".env"))
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "..", "python", "env", ".env"))

assert "OPENAI_API_KEY" in os.environ, "OPENAI_API_KEY is not set in the environment variables."
assert "TAVILY_API_KEY" in os.environ, "TAVILY_API_KEY is not set in the environment variables."


OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
if not OPENAI_API_KEY:
    raise ValueError("OPENAI_API_KEY environment variable is not set")

LLM = ChatOpenAI(model="gpt-4o-mini", temperature=0, api_key=OPENAI_API_KEY)
TAVILY_TOOL = TavilySearch(max_results=5)
