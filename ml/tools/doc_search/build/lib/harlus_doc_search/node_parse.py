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
    SentenceWindowNodeParser
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
                if current_max_length >= MAX_TEXT_LENGTH/2:
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


def create_nodes_from_llamaparse_json(json_in: List[List[Dict]], file_path: str) -> List[Node]:
    """
    Create nodes from LlamaParse JSON.

    This function:
    1. Adds page information as metadata to each page item returned by LlamaParse
    2. Adds bounding box information as metadata to each item
    3. Regroups items to have the same itemgroup_id if they are part of the same group (e.g. heading and the items underneath it)
    4. Sets current headings as metadata to each item
    5. Creates nodes from each item
    
    Args:
        json_in (List[List[Dict]]): Input JSON from LlamaParse
        
    Returns:
        List[Node]: List of nodes created from JSON
    """

    # 1. add page information as metadata to each item
    json_out = []
    item_id = 0
    for page in json_in[0]["pages"]:
        page_txt = page["text"]
        page_md = page["md"]
        page_nb = page["page"]
        for item in page["items"]:
            item = {**item, "page_nb":page_nb, "page_md" : page_md, "page_txt": page_txt, "item_id": item_id}
            json_out.append(item)
            item_id += 1
    json_in = json_out


    # 2. add bounding box information as metadata to each item
    json_out = []
    for item in json_in:
        item = {**item, "bounding_boxes": [item["bBox"]]}
        json_out.append(item)
    json_in = json_out


    # 3. add itemgroup_id to each item
    json_out = []
    itemgroup_id = 0
    last_type = ""
    for item in json_in:
        if item["type"] == "heading":
            custom_type = item["type"] + "_" + str(item["lvl"])
        else:
            custom_type = item["type"]
        if not custom_type == last_type: 
            itemgroup_id += 1 
        item = {**item, "itemgroup_id" : itemgroup_id, "custom_type": custom_type}
        last_type  = custom_type
        json_out.append(item)
    json_in = json_out


    # 4. add itemgroup_id to each item
    last_itemgroup_id = 0
    new_item = {}
    json_out = []
    for item in json_in:
        itemgroup_id = item["itemgroup_id"]
        if itemgroup_id == last_itemgroup_id and (item["type"] == "heading" or item["type"] == "text"):
            new_item["value"] += "\n\n" + item["value"]
            new_item["md"] += "\n\n" + item["md"]
            new_item["bounding_boxes"] += item["bounding_boxes"]
        else:
            json_out.append(new_item)
            new_item = item
        last_itemgroup_id = itemgroup_id
    json_out.append(new_item)
    json_out = json_out[1:]
    json_in = json_out


    # 5. set current headings as metadata to each item
    json_out = []
    current_headings = {"heading_1": "", "heading_2" : "", "heading_3": ""}
    for item in json_in:
        if item["type"] == "heading":
            current_headings[item["custom_type"]] = item["md"]
        item["current_headings"] = "\n\n".join(current_headings.values())
        json_out.append(item)
    json_in = json_out


     # 5. Split text nodes if they are too long
    json_out = []
    for item in json_in:
        if item["type"] == "text":
            json_out.extend(split_llamaparse_items([item]))
        else:
            json_out.append(item)
    json_in = json_out

    # 6. create nodes from each item which is not a heading
    nodes_out = []
    for item in tqdm(json_in):
        if item["type"] != "heading":
            node_metadata = {
                "page_nb": item["page_nb"],
                "current_headings": item["current_headings"],
                "type": item["type"],
                "bounding_boxes": item["bounding_boxes"],
                "file_path": file_path
            }
            block_node = TextNode(text=item["md"], metadata=node_metadata)
            nodes_out.append(block_node)
    return nodes_out


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

        previous_block_node = nodes_in[i-1] if i > 0 else None
        current_block_node = nodes_in[i]
        next_block_node = nodes_in[i+1] if i < len(nodes_in) - 1 else None

        if previous_block_node is not None:
            previous_block_node.relationships[NodeRelationship.NEXT] = RelatedNodeInfo(node_id=current_block_node.node_id)
            current_block_node.relationships[NodeRelationship.PREVIOUS] = RelatedNodeInfo(node_id=previous_block_node.node_id)

        if next_block_node is not None:
            current_block_node.relationships[NodeRelationship.NEXT] = RelatedNodeInfo(node_id=next_block_node.node_id)
            next_block_node.relationships[NodeRelationship.PREVIOUS] = RelatedNodeInfo(node_id=current_block_node.node_id)

        nodes_out.extend([current_block_node])
    
    return nodes_out


async def process_table_node(node, markdown_parser):

    if node.metadata["type"] == "table":
        table_base_nodes = await markdown_parser.aget_nodes_from_node(node)
        text_text_nodes, table_index_nodes = markdown_parser.get_nodes_and_objects(table_base_nodes)
        for table_text_node in text_text_nodes:
            table_text_node.metadata["file_path"] = node.metadata["file_path"]
        return text_text_nodes + table_index_nodes
    else:
        return [node]
    

async def split_table_nodes(nodes_in, markdown_parser):
    """
    Use the markdown parser (expected to be MarkdownElementNodeParser) to process markdown tables.

    MarkdownElementNodeParser will create a summary text node of the table and index nodes for the rows/columns.

    TODO: Evaluate if we can use MarkdownElementNodeParser to process all nodes (with downside that we lose bounding box and page number information)
    
    """

    semaphore = asyncio.Semaphore(NUM_WORKERS)

    async def process_with_semaphore(node):
        async with semaphore:
            return await process_table_node(node, markdown_parser)

    tasks = [process_with_semaphore(node) for node in nodes_in]
    nodes_out = []
    for task in tqdm(asyncio.as_completed(tasks), total=len(tasks), desc="  > splitting tables: "):
        result = await task
        nodes_out.extend(result)

    return nodes_out





def split_text_nodes(nodes_in: List[Node], sentence_window_parser: SentenceWindowNodeParser) -> List[Node]:
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

async def add_metadata_to_nodes(nodes_in: List[Node], extractor_list: List[BaseExtractor]) -> List[Node]:
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
    for node_id, metadata in extactor_metadata_map.items(): # for each node
        for val in metadata.values(): # create index node for all metadata values
            if isinstance(val, str):
                nodes_out.append(IndexNode(text=val, index_id=node_id, metadata={**node.metadata, **{'type': 'index'}}))
            else:
                print(f"  > skipping index node for {node_id} - {val}")

    return nodes_out













