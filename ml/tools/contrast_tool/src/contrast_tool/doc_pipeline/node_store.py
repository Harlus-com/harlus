from llama_index.core.schema import IndexNode, TextNode
from llama_index.core.schema import NodeRelationship, RelatedNodeInfo


def node_relationship_to_dict(relationships):
    """Serialize node relationships to a dictionary format that can be JSON serialized.
    
    Args:
        relationships: Dict of node relationships
        
    Returns:
        Dict with serialized relationship data
    """
    return {
        rel_type.name: rel_info.__dict__
        for rel_type, rel_info in relationships.items()
    }

def dict_to_node_relationship(relationship_dict):
    """Deserialize node relationships from a dictionary format that can be JSON serialized.
    
    Args:
        relationship_dict: Dict of node relationships
        
    Returns:
        Dict with deserialized relationship data
    """

    value_map = {
        'CHILD' : '5',
        'NEXT' : '3',
        'PARENT' : '4',
        'PREVIOUS' : '2',
        'SOURCE' : '1'
    }
    return {
        NodeRelationship(value=value_map[rel_type]): RelatedNodeInfo(**relationship_dict[rel_type])
        for rel_type in relationship_dict
    }

NODE_PERSISTENT_ATTRS = [
    "text",
    "metadata",
    "excluded_embed_metadata_keys",
    "excluded_llm_metadata_keys",
    "metadata_template",
    "text_template",
    "start_char_idx",
    "end_char_idx",
    "metadata_separator",
    "mimetype",
    "node_id"
]

NODE_SERIALIZE_ATTRS = {
    "relationships": {
        "forward": node_relationship_to_dict,
        "backward": dict_to_node_relationship
    }
}

INDEX_NODE_ATTRS = NODE_PERSISTENT_ATTRS + [
    "index_id",
]

TEXT_NODE_ATTRS = NODE_PERSISTENT_ATTRS


def nodes_to_json_obj(nodes):
    out = []
    for node in nodes:
        if isinstance(node, IndexNode):
            if hasattr(node, 'obj') and node.obj is not None and node.obj.metadata.get("type") == "table":
                extension = nodes_to_json_obj([node.obj])
                out.extend(extension)
            type_dict ={"type": "IndexNode"}
            attribute_dict = {attr_name: getattr(node, attr_name) for attr_name in INDEX_NODE_ATTRS}
            serialize_dict = {attr_name: attr_func["forward"](getattr(node, attr_name)) for attr_name, attr_func in NODE_SERIALIZE_ATTRS.items()}
            out.append({**type_dict, **attribute_dict, **serialize_dict})
                
        elif isinstance(node, TextNode):
            type_dict ={"type": "TextNode"}
            attribute_dict = {attr_name: getattr(node, attr_name) for attr_name in TEXT_NODE_ATTRS}
            serialize_dict = {attr_name: attr_func["forward"](getattr(node, attr_name)) for attr_name, attr_func in NODE_SERIALIZE_ATTRS.items()}
            out.append({**type_dict, **attribute_dict, **serialize_dict})
        else:
            raise TypeError(f"Unsupported node type: {type(node)}")
    return out


def json_obj_to_nodes(json_in):
    nodes = []
    for node_dict in json_in:
        try:
            if node_dict["type"] == "IndexNode":
                node = IndexNode(
                    **{attr_name: node_dict[attr_name] for attr_name in INDEX_NODE_ATTRS}, 
                    **{attr_name: attr_func["backward"](node_dict[attr_name]) for attr_name, attr_func in NODE_SERIALIZE_ATTRS.items()}
                )
                node.node_id = node_dict["node_id"]
                node.index_id = node_dict["index_id"]
                nodes.append(node)
            elif node_dict["type"] == "TextNode":
                node = TextNode(
                    **{attr_name: node_dict[attr_name] for attr_name in TEXT_NODE_ATTRS}, 
                    **{attr_name: attr_func["backward"](node_dict[attr_name]) for attr_name, attr_func in NODE_SERIALIZE_ATTRS.items()}
                )
                node.node_id = node_dict["node_id"]
                nodes.append(node)
            else:
                raise TypeError(f"Unsupported node type: {node_dict['type']}")
        except Exception as e:
            print(node_dict)
            print(e)
    node_map = {
        node.id_: node
        for node in nodes
    }
    nodes_out = []
    for node in nodes:
        if isinstance(node, IndexNode):
            try:
                node.obj = node_map.get(node.index_id)
            except KeyError:
                print(f"IndexNode with index_id {node.index_id} not found in node_map")
        nodes_out.append(node)
    return nodes_out