from llama_index.core.schema import (
    TextNode,
    NodeRelationship,
    RelatedNodeInfo,
)
from llama_index.core.schema import (
    NodeRelationship,
    RelatedNodeInfo,
    IndexNode,
    Node,
)
from tqdm import tqdm
import asyncio
from typing import List, Dict
from llama_index.core.node_parser import (
    MarkdownElementNodeParser,
    SentenceWindowNodeParser,
)
from llama_index.core.extractors import BaseExtractor

# TODO: make this configurable
NUM_WORKERS = 10
MAX_TEXT_LENGTH = 4096


def split_llamaparse_items(items: List[Dict]) -> List[Dict]:
    items_out = []
    for item in items:
        current_max_length = len(item["md"])
        if current_max_length > MAX_TEXT_LENGTH:
            splits = item["md"].split(".")
            current_max_length = 0
            split_index = 0
            for i, split in enumerate(splits):
                current_max_length += len(split)
                if current_max_length >= MAX_TEXT_LENGTH / 2:
                    split_index = i
                    break
            split_1 = splits[:split_index]
            split_2 = splits[split_index:]
            item_1 = {**item, "md": ".".join(split_1)}
            item_2 = {**item, "md": ".".join(split_2)}
            items_out.extend(split_llamaparse_items([item_1]))
            items_out.extend(split_llamaparse_items([item_2]))
        else:
            items_out.append(item)
    return items_out


def add_node_relationships(nodes_in: List[Node]) -> List[Node]:
    """
    Add previous/next relationships between consecutive nodes in a list.

    Creates bidirectional relationships between adjacent nodes where:
    - Each node points to the next node in the sequence
    - Each node points to the previous node in the sequence

    Args:
        nodes_in (List[Node]): Input list of nodes to add relationships between

    Returns:
        List[Node]: Nodes with previous/next relationships added
    """

    # add relationships between consecutive nodes
    nodes_out = []
    for i in range(len(nodes_in)):

        previous_block_node = nodes_in[i - 1] if i > 0 else None
        current_block_node = nodes_in[i]
        next_block_node = nodes_in[i + 1] if i < len(nodes_in) - 1 else None

        if previous_block_node is not None:
            previous_block_node.relationships[NodeRelationship.NEXT] = RelatedNodeInfo(
                node_id=current_block_node.node_id
            )
            current_block_node.relationships[NodeRelationship.PREVIOUS] = (
                RelatedNodeInfo(node_id=previous_block_node.node_id)
            )

        if next_block_node is not None:
            current_block_node.relationships[NodeRelationship.NEXT] = RelatedNodeInfo(
                node_id=next_block_node.node_id
            )
            next_block_node.relationships[NodeRelationship.PREVIOUS] = RelatedNodeInfo(
                node_id=current_block_node.node_id
            )

        nodes_out.extend([current_block_node])

    return nodes_out


def split_text_nodes(
    nodes_in: List[Node], sentence_window_parser: SentenceWindowNodeParser
) -> List[Node]:
    """
    Split text nodes from LlamaParse JSON.

    Args:
        nodes_in (List[Node]): Input nodes from LlamaParse JSON
        sentence_window_parser (SentenceWindowParser): Parser for splitting text into smaller window-based nodes
    Returns:
        List[Node]: Processed nodes including:
            - Original block nodes with relationships
            - Extended nodes from metadata
            - Fine-grained sentence nodes for text blocks
    """

    nodes_out = []
    for i in tqdm(range(len(nodes_in)), desc="  > splitting text nodes: "):
        current_node = nodes_in[i]
        if current_node.metadata["type"] == "text":
            fine_nodes = sentence_window_parser.get_nodes_from_documents([current_node])
            nodes_out.extend(fine_nodes)
        nodes_out.append(current_node)
    return nodes_out


async def add_metadata_to_nodes(
    nodes_in: List[Node], extractor_list: List[BaseExtractor]
) -> List[Node]:
    """
    Adds metadata in two ways:
    1. Add metadata from each extractor in the extractor list to the base nodes
    2. Create index nodes containing the extracted metadata values

    Args:
        base_nodes (List[Node]): List of nodes to add metadata to
        extractor_list (List[BaseExtractor]): List of extractors to use

    Returns:
        List[Node]: List containing:
            - Original nodes with added metadata from extractors
            - New index nodes created from the extracted metadata values
    """

    # store extracted metadata for each node (used for node extension)
    extactor_metadata_map = {}

    # Run extractors sequentially
    extractor_metadata_list = []
    nodes_out = []
    for extractor in extractor_list:
        print(f"  > extracting metadata for {extractor.__class__.__name__} ...")
        extractor_metadata = extractor.extract(nodes_in)
        extractor_metadata_list.append(extractor_metadata)

    # iterate over extracted metadata
    for extractor_metadata in extractor_metadata_list:
        for node, new_metadata in zip(nodes_in, extractor_metadata):

            # extend node metadata with extractor metadata
            node.metadata = {**node.metadata, **new_metadata}
            nodes_out.append(node)

            if node.node_id not in extactor_metadata_map:
                extactor_metadata_map[node.node_id] = new_metadata
            else:
                extactor_metadata_map[node.node_id].update(new_metadata)

    # extend nodes with index nodes for each value in extracted metadata
    for node_id, metadata in extactor_metadata_map.items():  # for each node
        for val in metadata.values():  # create index node for all metadata values
            if isinstance(val, str):
                nodes_out.append(
                    IndexNode(
                        text=val,
                        index_id=node_id,
                        metadata={**node.metadata, **{"type": "index"}},
                    )
                )
            else:
                print(f"  > skipping index node for {node_id} - {val}")

    return nodes_out
