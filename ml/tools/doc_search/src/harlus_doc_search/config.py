from llama_index.llms.openai import OpenAI
from llama_index.embeddings.openai import OpenAIEmbedding
import os

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
if not OPENAI_API_KEY:
    raise ValueError("OPENAI_API_KEY environment variable is not set")

NUM_WORKERS = 20

LLM_LIBRARY = {
    "openai-gpt-4o-mini": OpenAI(
        model="gpt-4o-mini", temperature=0, api_key=os.environ["OPENAI_API_KEY"]
    ),
    "openai-gpt-3.5-turbo": OpenAI(
        model="gpt-3.5-turbo", temperature=0, api_key=os.environ["OPENAI_API_KEY"]
    ),
    "openai-text-embedding-3-large": OpenAIEmbedding(
        model="text-embedding-3-large", api_key=os.environ["OPENAI_API_KEY"]
    ),
    "openai-gpt-4o": OpenAI(
        model="gpt-4o", temperature=0, api_key=os.environ["OPENAI_API_KEY"]
    ),
}

MAX_CONTEXT_LENGTH = 90_000

LLM = LLM_LIBRARY["openai-gpt-4o-mini"]

FASTLLM = LLM_LIBRARY["openai-gpt-3.5-turbo"]

EMBEDDING_MODEL = LLM_LIBRARY["openai-text-embedding-3-large"]
