import json
import re

def robust_load_json(text: str):
    """
    Attempts to extract and parse JSON from a text block that may contain code fences,
    quotes, or be poorly formatted.
    Returns the parsed JSON object or raises a ValueError if no valid JSON is found.
    """
    # Step 1: Remove common code block markers and extraneous characters
    cleaned = re.sub(r"^`{3}(json)?", "", text.strip(), flags=re.IGNORECASE)
    cleaned = re.sub(r"`{3}$", "", cleaned.strip())
    cleaned = re.sub(r"^'+", "", cleaned.strip())
    cleaned = re.sub(r"'+$", "", cleaned.strip())
    cleaned = re.sub(r"\\n", "", cleaned.strip())
    cleaned = re.sub(r"\\", "", cleaned.strip())
    cleaned = re.sub(r"'", "", cleaned.strip())

    # Step 2: Try parsing the whole thing as JSON
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass

    # Step 3: Try to locate the first JSON-like structure using regex
    match = re.search(r'({.*?}|\[.*?\])', cleaned, re.DOTALL)
    if match:
        candidate = match.group(1)
        try:
            return json.loads(candidate)
        except json.JSONDecodeError:
            pass

    # Step 4: Try removing trailing commas, common in copy-pasted JSON
    cleaned_no_trailing_commas = re.sub(r',(\s*[}\]])', r'\1', cleaned)
    try:
        return json.loads(cleaned_no_trailing_commas)
    except json.JSONDecodeError:
        pass

    raise ValueError("Failed to parse JSON from input.")


def sanitize_tool_name(name):
    return re.sub(r"[^a-zA-Z0-9_-]", "_", name)