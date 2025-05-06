from llama_index.core.prompts import PromptTemplate
from .base import register_prompt


_PROMPT_VERIFY_CLAIM_NAME = "verify claim with data"
_PROMPT_VERIFY_CLAIM_TEXT = """\
You are a fact-verification assistant. Your task
1. If the evidence supports the claim, respond exactly 'True.'
2. If the evidence contradicts the claim, respond exactly 'False.'
3. If the evidence is insufficient to decide, respond exactly 'Insufficient evidence.'

For numeric claims:
- Extract the numeric values from the claim and the evidence.
- If they differ, compute the percent error as:
    |(ClaimValue - EvidenceValue) / EvidenceValue| x 100%
Round to one decimal place and state whether the claim over- or understates the metric.
Finally, provide a 1-2 sentence explanation citing which evidence snippets you used.

Claim: 
{claim}

Evidence:
{data}
{output_format}\
"""
PROMPT_VERIFY_CLAIM = PromptTemplate(_PROMPT_VERIFY_CLAIM_TEXT)
register_prompt(PROMPT_VERIFY_CLAIM, name=_PROMPT_VERIFY_CLAIM_NAME)