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
text1 = open("AMAT_Q1_24_results.md").read()
text2 = open("AMAT_Q2_2024_Earnings_Release.md").read()

good_contrast = open("good_contrast.json").read()
bad_contrast = open("bad_contrast.json").read()

system_prompt = """You are a senior equity‐research analyst at a long‐only, value‐focused investment fund.
The fund's edge lies in deep, qualitative understanding of businesses—competitive moats, industry structure, management incentives, secular growth drivers, and capital‐allocation discipline. Spreadsheet work (e.g., owner‐earnings, FCF yield, ROIC) is used only to corroborate—or challenge—those qualitative insights.

You have received two markdown documents:

Text 1 – Investment Thesis
Sets out the core narrative, strategic rationale, and valuation logic for a prospective investment.

Text 2 – Evidence Pack
May reinforce, nuance, or contradict the thesis via earnings calls, sell‐side notes, regulatory filings, competitor commentary, press articles, etc.

Your task:
Identify supporting or contradicting evidence in Text 2 relative to key claims in Text 1, then summarise the contrasts in a structured JSON list of Contrast objects (schema below).

You key objective is to find contrasts that would help an investor to understand whether to update their investment thesis (text 1).
"""

print(len(text1))
print(len(text2))
text2 = text2[:80000]
print(len(text2))

response = client.chat.completions.create(
    model="o3",
    messages=[
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": f"Text 1:\n\n{text1}"},
        {"role": "user", "content": f"Text 2:\n\n{text2}"},
    ],
    functions=[contrast_function],
    function_call={"name": "generate_contrasts"},
    stream=True,
)

# Collect the streaming response
full_response = ""
print("\nGenerating contrasts...")
for chunk in response:
    if chunk.choices[0].delta.function_call:
        if chunk.choices[0].delta.function_call.arguments:
            full_response += chunk.choices[0].delta.function_call.arguments
            print(".", end="", flush=True)

print("\n\nProcessing response...")
data = json.loads(full_response)

# parse into Pydantic models
contrasts = TypeAdapter(list[Contrast]).validate_python(data["contrasts"])


def truncate_text(text: str, max_length: int = 100) -> str:
    if len(text) <= max_length:
        return text

    # Find the last space before max_length
    last_space = text[:max_length].rfind(" ")
    if last_space == -1:  # If no space found, just split at max_length
        return text[:max_length] + "\n" + truncate_text(text[max_length:], max_length)

    # Split at the last space and continue on next line
    return text[:last_space] + "\n" + truncate_text(text[last_space + 1 :], max_length)


run_count = int(open("run_count.txt").read())

run_count += 1


with open(f"contrasts_{run_count}.json", "w") as f:
    json.dump([c.model_dump() for c in contrasts], f, indent=2)


with open(f"contrasts_{run_count}.txt", "w") as f:
    f.write("[\n")
    for i, c in enumerate(contrasts):
        contrast_dict = c.model_dump()
        # Truncate all text fields
        for key in contrast_dict:
            if isinstance(contrast_dict[key], str):
                contrast_dict[key] = contrast_dict[key]
            elif isinstance(contrast_dict[key], list):
                contrast_dict[key] = [
                    truncate_text(item) for item in contrast_dict[key]
                ]

        # Write the contrast in a readable format
        f.write("  {\n")
        for key, value in contrast_dict.items():
            if isinstance(value, str):
                lines = value.split("\n")
                f.write(f'    "{key}": "{value}"')
                f.write(",\n")
            elif isinstance(value, list):
                f.write(f'    "{key}": [\n')
                for item in value:
                    # Split each item into lines and indent
                    lines = item.split("\n")
                    f.write(f'      "{lines[0]}')
                    for line in lines[1:]:
                        f.write(f"\n        {line}")
                    f.write(",\n")
                f.write("    ],\n")
        f.write("  }")
        if i < len(contrasts) - 1:
            f.write(",\n")
        else:
            f.write("\n")
    f.write("]")

with open("run_count.txt", "w") as f:
    f.write(str(run_count))
