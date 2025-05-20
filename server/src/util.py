import datetime
import hashlib
import re
from pydantic import BaseModel


def snake_to_camel(s: str) -> str:
    return "".join(
        word if i == 0 else word.capitalize() for i, word in enumerate(s.split("_"))
    )


def clean_name(name: str) -> str:
    return (
        name.replace(" ", "_")
        .replace(".", "_")
        .replace("-", "_")
        .replace(")", "")
        .replace("(", "")
        .replace(":", "")
        .replace("!", "")
        .replace("?", "")
        .replace("'", "")
        .replace('"', "")
    )


def normalize_underscores(name: str) -> str:
    return re.sub(r"_+", "_", name)


def get_content_hash(path: str) -> str:
    return hashlib.sha256(open(path, "rb").read()).hexdigest()


class BoundingBoxConverter:
    def __init__(self, page_w: float, page_h: float):
        self.page_w = page_w
        self.page_h = page_h

    def from_pymupdf_to_reactpdf(self, bbox: list[float]) -> dict[str, float]:
        x0, y0, w, h = bbox
        return {
            "left": (x0 / self.page_w) * 100,
            "top": (y0 / self.page_h) * 100,
            "width": (w / self.page_w) * 100,
            "height": (h / self.page_h) * 100,
        }


class Timestamp(BaseModel):
    second: int
    minute: int
    hour: int
    day: int
    month: int
    year: int

    def __str__(self) -> str:
        return f"{self.year}-{self.month}-{self.day} {self.hour}:{self.minute}:{self.second}"


def timestamp_now() -> Timestamp:
    now = datetime.datetime.now()
    return Timestamp(
        second=now.second,
        minute=now.minute,
        hour=now.hour,
        day=now.day,
        month=now.month,
        year=now.year,
    )
