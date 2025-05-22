from typing import List
from .config import FASTLLM
from llama_index.core.schema import NodeWithScore
from .custom_types import DocSearchRetrievedNode
from .type_utils import get_file_id_from_node
async def _get_retrieved_nodes(
        query: str, 
        retriever: any 
        ) -> list[NodeWithScore] | None:
    tool_result = await retriever.ainvoke(query)
    retrieved_nodes = tool_result.raw_output
    return retrieved_nodes
    

async def get_best_retrieved_nodes(
        query: str, 
        retrievers: list[any],
        min_score: float = 0.8,
        max_nodes: int = 4
        ) -> list[NodeWithScore] | None:
    all_nodes = []
    for retriever_tool in retrievers:
        retrieved_nodes = await _get_retrieved_nodes(query, retriever_tool)
        all_nodes.extend(retrieved_nodes)
    
    sorted_nodes = sorted(all_nodes, key=lambda node: node.score, reverse=True)
    file_id = ""
    if len(sorted_nodes) >= 0:
        file_id = get_file_id_from_node(sorted_nodes[0])
        
    qualified_nodes = [node for node in sorted_nodes if node.score >= min_score]
    
    if not qualified_nodes:
        return None, file_id
    
    return qualified_nodes[:max_nodes], file_id


async def _get_source_from_node_with_llm(
    node: any,
    query: str
    ) -> str | None:
    prompt = f"""
=== Task ===
Your only task is to extract the EXACT text from input A which matches the meaning of input B.
=== Input A ===
{node.text}
=== Input B ===
{query}
=== Output ===
The text from input A which matches the meaning of input B. 
If no match is found, include <!NO_MATCH!> in your response.
The matched text should appear character by character in the same order as it does in input A.
=== Format ===
Output only the exact text and nothing more. If no match is found, output <!NO_MATCH!>.
=== Example ===
Input A: 'We invested 12% of our revenues in technology companies this year.'
Input B: 'The company invested 12% of its income in tech companies.'
You: 'We invested 12% of our revenues in technology companies this year.'
    """
    response = await FASTLLM.ainvoke(prompt)
    return response.content

async def get_source_from_nodes_with_llm(
    nodes: List[DocSearchRetrievedNode],
    query: str
    ) -> tuple[str | None, DocSearchRetrievedNode | None]:
    i = 0
    while i < len(nodes):
        trial_output = await _get_source_from_node_with_llm(nodes[i], query)
        if "<!NO_MATCH!>" in trial_output:
            i += 1
        else:
            return trial_output, nodes[i]
    return None, None
    