from llama_index.core.agent.workflow import ToolCallResult, AgentStream
import orjson
import json


async def stream_generator_v2(handler, file_location_to_id: dict[str, str]):

    source_info = []
    action_collect_mode = False
    action_input_collect_mode = False
    action_input_str = ""
    action_str = ""
    delta_collector = ""
    previous_delta = ""
    is_first_action = True
    hold_stream = False

    # very quick fix for createing a human readable react stream. To fix by using workflows.
    async for ev in handler.stream_events():

        if isinstance(ev, AgentStream):

            delta_collector += ev.delta

            if len(delta_collector) > 50:
                delta_collector = delta_collector[-50:]

            if "Action" in delta_collector:
                hold_stream = True

            if "Action:" in delta_collector:
                action_collect_mode = True
                hold_stream = True
                delta_collector = ""

            if "Action Input:" in delta_collector:
                action_input_collect_mode = True
                action_collect_mode = False
                hold_stream = True
                delta_collector = ""

            if not hold_stream:

                delta_str = orjson.dumps(previous_delta).decode("utf-8")
                event_str = "message"
                end_str = "\n\n"
                response = "\n".join(
                    [f"data: {delta_str}", f"event: {event_str}", end_str]
                )
                yield response

            if action_collect_mode and (
                "\n" in ev.delta or "Answer" in delta_collector
            ):
                print("this is action string: ", action_str)
                action_str = (
                    action_str[: action_str.find("Action Input")]
                    if "Action Input" in action_str
                    else action_str
                )
                action_str = action_str.replace("Action:", "")
                action_str = action_str.replace(":", "")
                action_collect_mode = False
                action_input_collect_mode = False
                hold_stream = False
                if is_first_action:
                    is_first_action = False
                    action_pre_str = "\n\n Reading documents...\n - "
                else:
                    action_pre_str = "\n - "
                action_out_str = action_str
                action_post_str = ""
                action_resp_str = action_pre_str + action_out_str + action_post_str
                action_str = ""

                delta_str = orjson.dumps(action_resp_str).decode("utf-8")
                event_str = "message"
                end_str = "\n\n"
                response = "\n".join(
                    [f"data: {delta_str}", f"event: {event_str}", end_str]
                )
                yield response

            if action_input_collect_mode and (
                "\n" in ev.delta or "Answer" in delta_collector
            ):
                action_input_collect_mode = False
                action_collect_mode = False
                hold_stream = False
                pass

            if action_collect_mode:
                action_str += ev.delta

            if action_input_collect_mode:
                action_input_str += ev.delta

            previous_delta = ev.delta

        if isinstance(ev, ToolCallResult):
            try:
                current_source_info = _parse_source_from_source_nodes(
                    ev.tool_output.raw_output.source_nodes, file_location_to_id
                )
                source_info.extend(current_source_info)
            except Exception as e:
                print("Error parsing source info", e)
                pass

    source_str = json.dumps(source_info)
    event_str = "sources"
    end_str = "\n\n"
    response = "\n".join([f"data: {source_str}", f"event: {event_str}", end_str])
    yield response


def _parse_source_from_source_nodes(source_nodes, file_location_to_id: dict[str, str]):
    source_info = []
    for source_node in source_nodes:
        metadata = {**source_node.metadata}
        if "file_path" in metadata:
            metadata["file_id"] = file_location_to_id[metadata["file_path"]]
            source_info.append(
                {
                    "text": source_node.text,
                    "metadata": metadata,
                }
            )
    return source_info
