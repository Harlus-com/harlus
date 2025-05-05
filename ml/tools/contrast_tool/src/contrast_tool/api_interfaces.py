from pydantic import BaseModel, Field
from typing import List, Tuple, Literal
from dataclasses import dataclass

@dataclass
class HighlightArea:
    bounding_boxes: List[Tuple[float, float, float, float]]
    jump_to_page: int

@dataclass
class Claim:
    text: str # claim
    file_path: str
    highlight_area: HighlightArea

@dataclass
class Verdict:
    claim: Claim
    status: Literal["true", "false", "unknown"]
    explanation: str # text for the comment
    evidence_file_path: str
    evidence_highlight_area: HighlightArea

@dataclass
class LinkComment:
    file_path: str
    text: str # text in comment
    highlight_area: HighlightArea

@dataclass
class ClaimComment:
    file_path: str
    text: str # text in comment
    highlight_area: HighlightArea
    links: List[LinkComment]
    verdict: Literal["true", "false", "unknown"]

# class Highlight:
#     # text: str # latex add text here to put in comments of evidence comment
#     file_path: str
    # highlight_area: HighlightArea
