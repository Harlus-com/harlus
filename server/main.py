import argparse
import sys
import uvicorn
from src.app import app

import asyncio
asyncio.set_event_loop_policy(asyncio.DefaultEventLoopPolicy())
import nest_asyncio
loop = asyncio.new_event_loop()
asyncio.set_event_loop(loop)
nest_asyncio.apply(loop=asyncio.get_event_loop())


import dotenv
import json

from contrast_tool import ContrastTool


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--reload", action="store_true", help="Enable auto-reload")
    parser.add_argument(
        "--port", type=int, default=8000, help="Port to run the server on"
    )
    args = parser.parse_args()
    is_frozen = getattr(sys, "frozen", False)

    uvicorn.run(
        app if is_frozen else "src.app:app",
        host="0.0.0.0",
        port=args.port,
        reload=args.reload,
        loop="asyncio"
    )


if __name__ == "__main__":
    main()
