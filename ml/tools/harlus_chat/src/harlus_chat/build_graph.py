from langchain_core.messages import (
    ToolMessage,
    SystemMessage,
    AIMessage,
    HumanMessage,
    AIMessageChunk,
)
from langgraph.graph import (
    StateGraph, 
    END, 
    START
)
from langgraph.checkpoint.memory import MemorySaver
from langchain_core.tools import BaseTool
from langgraph.graph.message import add_messages
from llama_index.core.tools import QueryEngineTool
from typing import (
    List, 
    AsyncIterator, 
)
from .config import LLM, TAVILY_TOOL
import re
import json 
from rapidfuzz.fuzz import partial_ratio
from .boundig_boxes import (
    get_standard_rects_from_pdf, 
    prune_overlapping_rects, 
    get_llamaparse_rects
)
from .custom_types import (
    GraphState, 
    BoundingBox, 
    HighlightArea, 
    ChatSourceComment, 
    DocSearchRetrievedNode, 
    TavilyToolRetrievedWebsite,
    DocSearchNodeMetadata
)
import uuid
from llama_index.core.schema import NodeWithScore
from langchain_tavily import TavilySearch


class BasicToolNode:
    """
    Runs the tools requested in the last AIMessage.

    Updates the state with the retrieved nodes from the tool calls.
    
    """

    def __init__(self, tools: list, tool_name_to_type: dict) -> None:
        self.tools_by_name = {tool.name: tool for tool in tools}
        self.tool_name_to_type = tool_name_to_type

    def __call__(self, inputs: dict):
        """
        inputs (GraphState), currently corresponding to:
            messages: list[tuple[str, str]]
            retrieved_nodes: list[list[any]]
            full_answer: str
        """

        # Get the last message
        if messages := inputs.get("messages", []):
            message = messages[-1]
        else:
            raise ValueError("No message found in input")
        outputs = []

        # Get the tool calls

        for tool_call in message.tool_calls:

            # get the current tool (DocSearchToolWrapper or TavilySearchTool)
            tool = self.tools_by_name[tool_call["name"]]
            sources_list = []

            
            print("[harlus_chat] processing tool calls")

            # tool is a DocSearchToolWrapper
            if self.tool_name_to_type[tool_call["name"]] == "doc_search":
                print("- executing doc search tool call: ", tool_call["name"])
                try:

                    tool_result = tool.invoke(tool_call["args"])
                    
                    for retrieved_node in tool_result.raw_output.source_nodes:

                        
                        # assert that the retrieved node is a NodeWithScore
                        assert isinstance(retrieved_node, NodeWithScore), "[Harlus_chat] Retreived node is not a NodeWithScore"

                        # convert from NodeWithScore to DocSearchRetrievedNode
                        page_nb = retrieved_node.metadata.get("page_nb", None)
                        bounding_boxes = [
                            {
                                "left": rect['x'],
                                "top": rect['y'],
                                "width": rect['w'],
                                "height": rect['h'],
                                "page": page_nb,
                                "type": "absolute"
                            }
                            for rect in retrieved_node.metadata.get("bounding_boxes", [])
                        ]
                        metadata = DocSearchNodeMetadata(
                            raw_metadata=retrieved_node.metadata,
                            page_nb=page_nb,
                            file_path=retrieved_node.metadata.get("file_path", None),
                            bounding_boxes=bounding_boxes
                        )
                        sources_list.append(DocSearchRetrievedNode(
                            metadata=metadata,
                            text=retrieved_node.text,
                        ))
                    content = json.dumps(tool_result.content)
                    outputs.append(ToolMessage(
                        content=content,
                        name=tool_call["name"],
                        tool_call_id=tool_call["id"],
                    ))
                except:
                    raise ValueError(f"[Harlus_chat] Failed to extract retrieved nodes from {tool_call['name']} failed")
            
            # Tool is TavilySearchTool
            elif tool_call.get("name", "") == "tavily_search":
                print("- executing tavily search tool call: ", tool_call["name"])
                try:
                    tool_result = tool.invoke(tool_call["args"])
                    content = json.dumps(tool_result)
                    for result in tool_result.get("results", []):
                        tavily_tool_metadata = TavilyToolRetrievedWebsite(
                            title=result.get("title", ""),
                            url=result.get("url", ""),
                            content=result.get("content", ""),
                        )
                        sources_list.append(tavily_tool_metadata)
                    outputs.append(ToolMessage(
                        content=content,
                        name=tool_call["name"],
                        tool_call_id=tool_call["id"],
                    ))
                except:
                    raise ValueError(f"[Harlus_chat] Failed to extract retrieved nodes from {tool_call['name']} failed")
        
            
        return {
            "messages": outputs,
            "sources": inputs.get("sources", []) + sources_list,
            "full_answer": inputs.get("full_answer", "")
        }




class AsyncToolNode:
    def __init__(self, tools, tool_name_to_type):
        self.tools = BasicToolNode(tools, tool_name_to_type)

    async def __call__(self, state: GraphState) -> dict:
        return self.tools(state)

def sanitize_tool_name(name):
    return re.sub(r"[^a-zA-Z0-9_-]", "_", name)




class ChatAgentGraph:
    """
    ChatAgentGraph represents the agent behind the chat interface.
    
    This agent can be instantiated with a list of tools. After instantiating the agent, you must call the `build()` method.

    ```
    agent = ChatAgentGraph(tools=[tool1, tool2, tool3])
    agent.build()
    ```

    After building the agent, you can use the `stream()` method to start the chat. This method requires two arguments:
    - `user_message`: The message to send to the agent.
    - `thread_id`: The id of the thread to use. This is used to identify the thread in the database.

    ```
    async for message_chunk in agent.stream(user_message="Hello, how are you?", thread_id="1"):
        print(message_chunk)
    ```

    The `stream()` method acts as an EventSource stream. It outputs events with the following format:

    ```
    data: {"text": "Hello, how are you?"}
    event: "message"


    ```

    Currently, the stream supports the following events:
    - "message": A message from the agent. Data will have the following format:
    ```
    data: {"text": "Hello, how are you?"}
    event: "message"
    ```
    - "sources": A list of source annotations. Data will have the following format:
    ```
    data: [ChatSourceComment.model_dump(), ChatSourceComment.model_dump(), ...]
    event: "sources"
    ```
    - "complete": The stream is complete. Data will have the following format:
    ```
    data: "n.a."
    event: "complete"
    ```


    """
    def __init__(self, tools: List[any]):
        self.tools = []
        self.tool_name_to_type = {}
        print("[harlus_chat] adding tools")
        for tool in tools:

            # tool is a Langgraph BaseTool
            if isinstance(tool, TavilySearch):
                print(" - adding tavily search tool")
                self.tools.append(tool)
                self.tool_name_to_type[sanitize_tool_name(tool.name)] = "tavily_search"

            # tool is a DocSearchToolWrapper
            elif hasattr(tool, 'tool_class') and tool.tool_class == "DocSearchToolWrapper":
                print(" - adding doc search tool")
                lctool = tool.tool.to_langchain_tool()
                self.tools.append(lctool)
                self.tool_name_to_type[sanitize_tool_name(lctool.name)] = "doc_search"
            else:
                raise ValueError(f" - {tool} is not a recognized tool.")
    
        for tool in self.tools:
            tool.name = sanitize_tool_name(tool.name)
        
        
        self.tools_descriptions_string = "\n - " + "\n -".join([f"{tool.name}: {tool.description}" for tool in tools])
        self.LLM = LLM
        self.TOOL_LLM = LLM.bind_tools(self.tools)
        self.graph = None
        self.config = {"configurable": {"thread_id": "1"}}

    async def _communicate_plan(self, state: GraphState) -> AsyncIterator[dict]:
        prompt = [
            SystemMessage(content=f"""
            You are an autonomous AI agent solving a task step-by-step using tools.
            Decide what to do next. YOU MUST BASE YOUR ANSWER ON THE TOOLS PROVIDED BELOW. DO NOT RELY ON PRIOR KNOWLEDGE.
                        
            WRITE A SHORT AND CONCISE PLAN BASED ON THE TOOLS PROVIDED. FOLLOW THE EXAMPLES BELOW.
                                  
            "Reading Apple's 2024 Annual 10K report to find information on ..."
            "Reading Applied Materials 2024 Earnings call transcript from Q1 to find information on ..."
            "Searching the web for information on ..."
                        
            {self.tools_descriptions_string}
            """),
            *state["messages"], 
            HumanMessage(content="Provide a plan for your next step.")
        ]

        final = ""
        async for chunk in self.LLM.astream(prompt):
            delta = chunk.content or ""
            final += delta
        yield {
            "messages": state["messages"] + [AIMessage(content=final)],
            "sources": state.get("sources", []),
            "full_answer": state.get("full_answer", ""),
        }
        


    async def _call_tools(self, state: GraphState) -> AsyncIterator[dict]:
        prompt = [
            SystemMessage(content=f"""
            Only use the tools you have been provided with. 
            Base yourself on the plan provided by the user.
            If the plan does not require you to use any tools. Don't do anything.
                          
            ONLY USE THE TOOLS YOU HAVE BEEN PROVIDED WITH.
            """),
            *state["messages"],
        ]
        return {
            "messages": [await self.TOOL_LLM.ainvoke(prompt)],
            "sources": state["sources"],
            "full_answer": state["full_answer"],
        }

    @staticmethod
    def _custom_tools_condition(state: GraphState) -> str:
        last_msg = state["messages"][-1]
        if hasattr(last_msg, "tool_calls") and last_msg.tool_calls:
            return "tools"
        else:
            return "no_tools"


    async def _communicate_output(self, state: GraphState) -> AsyncIterator[dict]:
        prompt = [
            SystemMessage(content=f"""
            You will summarize an answer to the last Human Message based on the subsequent tool calls and AI messages
            """),
            *state["messages"]
        ]
        final = ""
        async for chunk in self.LLM.astream(prompt):
            delta = chunk.content or ""
            final += delta

        yield {
            "messages": state["messages"] + [AIMessage(content=final)],
            "sources": state.get("sources", []),
            "full_answer": state.get("full_answer", "") + final,
        }


    def build(self):

        # graph builder
        graph_builder = StateGraph(GraphState)

        # nodes
        graph_builder.add_node("communicate_plan", self._communicate_plan, metadata={"name": "communicate_plan"})
        graph_builder.add_node("call_tools", self._call_tools, metadata={"name": "call_tools"})
        graph_builder.add_node("tools", AsyncToolNode(tools=self.tools, tool_name_to_type=self.tool_name_to_type), metadata={"name": "tools"})

        # fixed edges
        graph_builder.add_edge(START, "communicate_plan")
        graph_builder.add_edge("communicate_plan", "call_tools")
        graph_builder.add_edge("tools", "call_tools")

        # conditional edges
        graph_builder.add_conditional_edges(
            "call_tools",
            self._custom_tools_condition,
            {"tools":"tools", "no_tools":END}
        )

        # compile
        graph = graph_builder.compile(checkpointer=MemorySaver())
        self.graph = graph

        return graph
    

    def _get_sources(self):
        return self.graph.get_state(self.config).values.get("sources", [])

    def _get_retrieved_nodes(self):

        # extract nodes which were retrieved during the last run through the graph
        sources = self._get_sources()
        retrieved_nodes = [source for source in sources if isinstance(source, DocSearchRetrievedNode)]

        # prune nodes which have similar text
        pruned_retrieved_nodes = []
        for retrieved_node in retrieved_nodes:
            retrieved_node_text = retrieved_node.text.strip().lower()
            for pruned_retrieved_node in pruned_retrieved_nodes:
                pruned_retrieved_node_text = pruned_retrieved_node.text.strip().lower()
                if partial_ratio(retrieved_node_text, pruned_retrieved_node_text) > 90:
                    break
            else:
                pruned_retrieved_nodes.append(retrieved_node)
        
        return pruned_retrieved_nodes

    def _get_chat_source_comments(self):

        chat_source_comments = []

        # get the retrieved nodes from the graph
        retrieved_nodes = self._get_retrieved_nodes()
        nb_messages = len(self.graph.get_state(self.config).values.get("messages", []))

        # convert the retrieved nodes to source annotations
        last_unique_id = ""
        for retrieved_node in retrieved_nodes:

            file_path = retrieved_node.metadata.file_path
            text = retrieved_node.text
            page_nb = retrieved_node.metadata.page_nb

           

            # get the rects from the llama parse tool (course)
            bounding_boxes = retrieved_node.metadata.bounding_boxes
            backup_standard_rects = get_llamaparse_rects(file_path, bounding_boxes, page_nb)

            # get the rects based on text from the pdf (fine-grained)
            standard_rects = get_standard_rects_from_pdf(file_path, text, page_nb)
            standard_rects = prune_overlapping_rects(standard_rects)

            # if no fine-grained rects are found, use the course rects
            if len(standard_rects) == 0:
                standard_rects = backup_standard_rects

            # convert to ChatSourceComment framework
            unique_id = str(uuid.uuid4())
            bboxes = [BoundingBox(**rect) for rect in standard_rects]
            highlight_area = HighlightArea(bounding_boxes=bboxes, jump_to_page_number=page_nb)
            chat_source_comment = ChatSourceComment(
                highlight_area=highlight_area,
                id=unique_id,
                file_path=file_path,
                thread_id=self.config["configurable"].get("thread_id"),
                message_id=str(nb_messages),
                text="Response source",
                next_chat_comment_id=last_unique_id
            )
            last_unique_id = unique_id
            chat_source_comments.append(chat_source_comment)

        return chat_source_comments
    

    async def stream(self, user_message: str, thread_id: str = "1"):

        input_state = {
            "messages": [("user", user_message)], 
            "retrieved_nodes": [], 
            "full_answer": ""
        }

        self.config["configurable"]["thread_id"] = thread_id

        # 1. stream the answer 
        print("[harlus_chat] Streaming answer...")
        async for message_chunk, metadata in self.graph.astream(
            input_state,
            stream_mode="messages",
            config = self.config
        ):
            try:
                # stream only message chunks
                if isinstance(message_chunk, AIMessageChunk):
                    # stream reading message
                    if metadata.get("langgraph_node") == "communicate_plan":
                        response = '\n'.join([
                            f'data: {json.dumps({"text": message_chunk.content})}',
                            f'event: {"reading_message"}',
                            '\n\n'
                        ])
                    # stream answer message
                    elif metadata.get("langgraph_node") == "call_tools":
                        response = '\n'.join([
                            f'data: {json.dumps({"text": message_chunk.content})}',
                            f'event: {"answer_message"}',
                            '\n\n'
                        ])
                    else:
                        print(f"[harlus_chat] Ignoring stream from unknown node: {metadata.get('langgraph_node')}")
                
                    yield response
            except Exception as e:
                print(f"Streaming error: {e}")
            
        # 2. stream the source annotations
        print("[harlus_chat] Streaming source annotations...")
        try:
            data = self._get_chat_source_comments()
            data = [d.model_dump() for d in data]
            response = '\n'.join([
                    f'data: {json.dumps(data)}',
                    f'event: {"sources"}',
                    '\n\n'
            ])
            print(f"[harlus_chat] Sent {len(data)} source annotations")
            yield response
        except Exception as e:
            print(f"[harlus_chat] Error sending source annotations: {e}")

        # 3. stream the completion
        response = '\n'.join([
                    f'data: ',
                    f'event: {"complete"}',
                    '\n\n'
            ])
        yield response
    
    