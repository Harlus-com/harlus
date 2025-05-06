from llama_index.llms.openai import OpenAI
from llama_index.embeddings.openai import OpenAIEmbedding
from enum import Enum

NUM_WORKERS = 20

LLM_LIBRARY = {
    "openai-gpt-4o-mini": OpenAI(
        model="gpt-4o-mini", temperature=0.1
    ),
    "openai-gpt-3.5-turbo": OpenAI(
        model="gpt-3.5-turbo", temperature=0.1
    ),
    "openai-text-embedding-3-large": OpenAIEmbedding(
        model="text-embedding-3-large"
    ),
}

LLM = LLM_LIBRARY["openai-gpt-4o-mini"]

FASTLLM = LLM_LIBRARY["openai-gpt-3.5-turbo"]

EMBEDDING_MODEL = LLM_LIBRARY["openai-text-embedding-3-large"]
