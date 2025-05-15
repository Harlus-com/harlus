# from docling.document_converter import DocumentConverter

# file_name = "Littelfuse_2024_Annual_Report"

# converter = DocumentConverter()
# result = converter.convert(f"{file_name}.pdf")
# with open(f"{file_name}.md", "w") as f:
#    f.write(result.document.export_to_markdown())


from openai import OpenAI

client = OpenAI(
    api_key="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"
)
# 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

# print(response.output_text)


contrast_function = {
    "name": "generate_contrasts",
    "description": "Compare two texts and output a list of contrasts",
    "parameters": {
        "type": "object",
        "properties": {
            "contrasts": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "text_1_claim_summary": {"type": "string"},
                        "text_1_evidence": {
                            "type": "array",
                            "items": {"type": "string"},
                        },
                        "text_2_claim_summary": {"type": "string"},
                        "text_2_evidence": {
                            "type": "array",
                            "items": {"type": "string"},
                        },
                        "result": {
                            "type": "string",
                            "enum": ["match", "contradiction"],
                        },
                    },
                    "required": [
                        "text_1_claim_summary",
                        "text_1_evidence",
                        "text_2_claim_summary",
                        "text_2_evidence",
                        "result",
                    ],
                },
            },
        },
        "required": ["contrasts"],
    },
}

import json
from pydantic import TypeAdapter
from pydantic import BaseModel
from typing import Literal


class Contrast(BaseModel):
    text_1_claim_summary: str
    text_1_evidence: list[str]
    text_2_claim_summary: str
    text_2_evidence: list[str]
    result: Literal["match", "contradiction"]


# your two big markdown files as Python strings
text1 = open("Littelfuse_memo.md").read()
text2 = open("Littelfuse_2024_Annual_Report.md").read()


system_prompt = """You are a senior equity‐research analyst at a long‐only, value‐focused investment fund.
The fund’s edge lies in deep, qualitative understanding of businesses—competitive moats, industry structure, management incentives, secular growth drivers, and capital‐allocation discipline. Spreadsheet work (e.g., owner‐earnings, FCF yield, ROIC) is used only to corroborate—or challenge—those qualitative insights.

You have received two markdown documents:

Text 1 – Investment Thesis
Sets out the core narrative, strategic rationale, and valuation logic for a prospective investment.

Text 2 – Evidence Pack
May reinforce, nuance, or contradict the thesis via earnings calls, sell‐side notes, regulatory filings, competitor commentary, press articles, etc.

Your task:
Identify supporting or contradicting evidence in Text 2 relative to each key claim in Text 1, then summarise the contrasts in a structured JSON list of Contrast objects (schema below).

Judgement on granularity:
- Surface no more than 20 contrasts total.
- If overlap is vast, prioritise the strongest confirmations or contradictions (materiality, credibility of source, magnitude of impact).
- If overlap is minimal, return only the few relevant points—or none, if genuinely no intersection exists.

Parity of treatment:
- Give equal weight to confirming and disconfirming evidence.
- A “match” is still valuable; do not bias toward finding contradictions.

Evidence quality:
- Use exact excerpts—verbatim sentences or short paragraphs—from each text to back every claim summary.
- Choose excerpts that plainly anchor the summary; avoid vague paraphrase or partial quotes."""

response = client.chat.completions.create(
    model="gpt-4o-mini",
    messages=[
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": f"Text 1:\n\n{text1}"},
        {"role": "user", "content": f"Text 2:\n\n{text2}"},
    ],
    functions=[contrast_function],
    function_call={"name": "generate_contrasts"},
    temperature=0,
)

# the model's function_call argument will contain a JSON string in `arguments`
args_json = response.choices[0].message.function_call.arguments
data = json.loads(args_json)

# parse into Pydantic models
contrasts = TypeAdapter(list[Contrast]).validate_python(data["contrasts"])

with open("contrasts.json", "w") as f:
    for c in contrasts:
        print(c.model_dump_json(indent=2))
        f.write(c.model_dump_json(indent=2))
