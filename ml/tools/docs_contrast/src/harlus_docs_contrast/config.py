from langchain_tavily import TavilySearch
from langchain_openai import ChatOpenAI
import os
from dotenv import load_dotenv

# TODO: remove after development (useful when loading tool from notebooks)
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "..", "python", "env", ".env"))


assert "OPENAI_API_KEY" in os.environ, "OPENAI_API_KEY is not set in the environment variables."
assert "TAVILY_API_KEY" in os.environ, "TAVILY_API_KEY is not set in the environment variables."


LLM = ChatOpenAI(model="gpt-4o-mini", temperature=0, api_key=os.environ["OPENAI_API_KEY"])
TAVILY_TOOL = TavilySearch(max_results=5)



