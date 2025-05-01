# Expose only registry APIs
from .base import get_prompt, list_prompts, update_prompt, reset_prompt

# Import each prompt module to trigger registration
from . import retrieval
from . import summarization

__all__ = [
    "get_prompt",
    "list_prompts",
    "update_prompt",
    "reset_prompt",
    # to expose constants:
    # *retrieval.__all__,
    # *summarization.__all__,
]