from langchain_openai import ChatOpenAI
import os
from dotenv import load_dotenv
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "..", "python", "env", ".env"))
assert "OPENAI_API_KEY" in os.environ, "OPENAI_API_KEY is not set in the environment variables."
FASTLLM = ChatOpenAI(
    model="gpt-3.5-turbo", 
    temperature=0, 
    api_key=os.environ["OPENAI_API_KEY"]
    )
