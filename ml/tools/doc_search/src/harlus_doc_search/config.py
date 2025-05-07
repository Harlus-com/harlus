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
}

LLM = LLM_LIBRARY["openai-gpt-4o-mini"]

FASTLLM = LLM_LIBRARY["openai-gpt-3.5-turbo"]

EMBEDDING_MODEL = LLM_LIBRARY["openai-text-embedding-3-large"]
