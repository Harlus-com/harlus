from llama_index.llms.openai import OpenAI
from llama_index.embeddings.openai import OpenAIEmbedding
import os
<<<<<<< HEAD

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
if not OPENAI_API_KEY:
    raise ValueError("OPENAI_API_KEY environment variable is not set")
=======
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "..", "python", "env", ".env"))
assert "OPENAI_API_KEY" in os.environ, "OPENAI_API_KEY is not set in the environment variables."

>>>>>>> d112146 (integrate contrast tool)

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

LLM = LLM_LIBRARY["openai-gpt-4o-mini"]

FASTLLM = LLM_LIBRARY["openai-gpt-3.5-turbo"]

EMBEDDING_MODEL = LLM_LIBRARY["openai-text-embedding-3-large"]
