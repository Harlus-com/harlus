from llama_index.core.prompts import PromptTemplate


# Main registry for live prompts:
_PROMPT_REGISTRY: dict[str,PromptTemplate] = {}
# Backup of the originals, populated on first registration:
_DEFAULT_PROMPT_REGISTRY: dict[str, PromptTemplate] = {}


def register_prompt(prompt: PromptTemplate, name: str | None = None) -> None:
    """
    Add a RichPromptTemplate to the registry under its name.
    If `name` is provided, use it; otherwise, use prompt.name.
    Raises ValueError if no name is found or the key already exists.
    """
    key = name or getattr(prompt, "name", None)
    if not key:
        raise ValueError("PromptTemplate must have a 'name' attribute or a 'name' argument for registration")
    if key in _PROMPT_REGISTRY:
        raise ValueError(f"Prompt '{key}' is already registered")
    # Store in both registries the first time
    _PROMPT_REGISTRY[key] = prompt
    _DEFAULT_PROMPT_REGISTRY[key] = prompt


def get_prompt(key: str) -> PromptTemplate:
    """
    Retrieve a prompt by its key. Raises KeyError if not found.
    """
    try:
        return _PROMPT_REGISTRY[key]
    except KeyError:
        raise KeyError(f"Prompt '{key}' not found in registry")


def list_prompts() -> list[str]:
    """
    List all registered prompt keys.
    """
    output_lines: list[str] = []
    for key, prompt in _PROMPT_REGISTRY.items():
        output_lines.append(f"Name: {key}\n{prompt.get_template()}")
    return "\n\n".join(output_lines)


def update_prompt(key: str, new_prompt: PromptTemplate) -> None:
    """
    Update an existing prompt in the registry.
    Raises KeyError if the key does not exist.
    """
    if key not in _PROMPT_REGISTRY:
        raise KeyError(f"Cannot update prompt '{key}': not registered")
    _PROMPT_REGISTRY[key] = new_prompt


def reset_prompt(key: str) -> None:
    """
    Restore the prompt identified by `key` back to its original
    registered version.
    """
    if key not in _DEFAULT_PROMPT_REGISTRY:
        raise KeyError(f"No default version stored for prompt '{key}'")
    _PROMPT_REGISTRY[key] = _DEFAULT_PROMPT_REGISTRY[key]