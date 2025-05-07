from .build_graph import ChatAgentGraph
import json

# TODO: Decide if we actually use this wrapper since 
# ChatAgentGraph is self defined and we can use it directly
class ChatModelWrapper:

    def __init__(
        self, chat_model: ChatAgentGraph, name: str
    ):
        self.chat_model = chat_model
        self.name = name


    def get_debug_info(self):

        thread_ids = self.chat_model.get_thread_ids()
        debug_info = {}
        for thread_id in thread_ids:
            messages = self.chat_model.get_messages(thread_id)
            debug_info[f"messages_thread_{thread_id}.json"] = json.dumps(messages)
        return debug_info

    def get(self) -> ChatAgentGraph:
        return self.chat_model

    def get_tool_name(self) -> str:
        return self.name