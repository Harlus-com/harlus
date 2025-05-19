from langchain_tavily import TavilySearch
from langchain_openai import ChatOpenAI
import os


OPENAI_API_KEY = "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"
TAVILY_API_KEY = "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"
os.environ["OPENAI_API_KEY"] = OPENAI_API_KEY
os.environ["TAVILY_API_KEY"] = TAVILY_API_KEY

LLM = ChatOpenAI(model="gpt-4o-mini", temperature=0, api_key=OPENAI_API_KEY)
TAVILY_TOOL = TavilySearch(max_results=5)







from llama_index.llms.openai import OpenAI
from llama_index.embeddings.openai import OpenAIEmbedding
from enum import Enum

LLAMA_CLOUD_API_KEY = "llx-bkniMqcARmtgvoBP24DQKuckttPfYrmnuFJ2zJU4KrWsKecy"
OPENAI_API_KEY = "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"
NUM_WORKERS = 20


LLM_LIBRARY = {
    "openai-gpt-4o-mini": OpenAI(
        model="gpt-4o-mini", temperature=0, api_key=OPENAI_API_KEY
    ),
    "openai-gpt-3.5-turbo": OpenAI(
        model="gpt-3.5-turbo", temperature=0, api_key=OPENAI_API_KEY
    ),
    "openai-text-embedding-3-large": OpenAIEmbedding(
        model="text-embedding-3-large", api_key=OPENAI_API_KEY
    ),
    "openai-gpt-4o": OpenAI(
        model="gpt-4o", temperature=0, api_key=OPENAI_API_KEY
    ),
}

LLI_LLM = LLM_LIBRARY["openai-gpt-4o-mini"]

FASTLLM = LLM_LIBRARY["openai-gpt-3.5-turbo"]

EMBEDDING_MODEL = LLM_LIBRARY["openai-text-embedding-3-large"]