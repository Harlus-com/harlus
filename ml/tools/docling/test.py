import json
from pydantic import BaseModel
from typing import Literal


class Contrast(BaseModel):
    text_1_claim_summary: str
    text_1_evidence: list[str]
    text_2_claim_summary: str
    text_2_evidence: list[str]
    result: Literal["match", "contradiction"]


run_count = 0


def truncate_text(text: str, max_length: int = 100) -> str:
    if len(text) <= max_length:
        return text

    # Find the last space before max_length
    last_space = text[:max_length].rfind(" ")
    if last_space == -1:  # If no space found, just split at max_length
        return text[:max_length] + "\n" + truncate_text(text[max_length:], max_length)

    # Split at the last space and continue on next line
    return text[:last_space] + "\n" + truncate_text(text[last_space + 1 :], max_length)


with open(f"contrasts_{run_count}.json", "r") as f:
    contrasts = [Contrast(**c) for c in json.load(f)]


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
