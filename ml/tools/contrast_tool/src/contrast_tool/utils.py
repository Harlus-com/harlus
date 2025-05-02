import os
import yaml
from typing import Optional

# from fastapi import APIRouter
from typing import Dict, Callable, Tuple, Optional

import fitz

from rapidfuzz import fuzz

import nltk
from nltk.tokenize import sent_tokenize

from llama_index.core import Document
from llama_parse import LlamaParse
from llama_index.core import SimpleDirectoryReader


def get_file_metadata(file_path: str) -> dict[str, str]:

    extension = os.path.splitext(file_path)[1].lower()
    file_types = {".pdf": "pdf", ".xlsx": "excel", ".xls": "excel", ".docx": "word"}
    return {
        "file_type": file_types.get(extension, "unknown"),
        "file_path": file_path,
    }


def load_document(file_path: str, document_type: str) -> list[Document]:

    parser = LlamaParse(result_type="markdown")
    reader = SimpleDirectoryReader(
        input_files=[file_path],
        file_extractor={".pdf": parser},
        file_metadata=get_file_metadata,
    )
    documents = reader.load_data()

    for i, doc in enumerate(documents):
        doc.metadata["document_type"] = document_type
        doc.metadata["file_type"] = "pdf"
        doc.metadata["file_path"] = file_path

        if "page_number" not in doc.metadata:
            doc.metadata["page_number"] = i + 1

    return documents


def load_pdf_sentences(pdf_path: str):
    """
    Reads the PDF, splits each page into sentences,
    and returns a list of dicts: [{"id": int, "text": str, "page": int}, ...].
    """
    doc = fitz.open(pdf_path)
    sentences = []
    sent_id = 0
    for page_no in range(doc.page_count):
        page = doc[page_no]
        text = page.get_text()
        for sent in sent_tokenize(text):
            sentences.append(
                {
                    "id": sent_id,
                    "text": sent,
                    "page": page_no + 1,  # 1-based page numbering
                }
            )
            sent_id += 1
    return sentences


def find_fuzzy_bounding_boxes(
    pdf_path: str, sentence: str, page_num: int, threshold: int = 50
) -> Tuple[Optional[list[Tuple[float, float, float, float]]], fitz.Document]:
    """
    Fuzzy-match `sentence` on page `page_num` of `pdf_path`.
    Returns a list of (x0, y0, width, height) tuples for each matching line
    if score ≥ threshold, else None.
    """
    # 1) normalize the sentence
    target = " ".join(sentence.split()).lower()

    # 2) load that page’s words
    doc = fitz.open(pdf_path)
    page = doc.load_page(page_num - 1)
    words = page.get_text("words")
    words.sort(key=lambda w: (w[1], w[0]))

    # 3) build lower-cased word list
    page_words = [((w[0], w[1], w[2], w[3]), w[4].lower(), w[6]) for w in words]
    texts = [w for (_, w, _) in page_words]

    # 4) slide a window to find best fuzzy match
    tokens = target.split()
    N = len(tokens)
    best_score, best_i = 0, 0
    for i in range(len(texts) - N + 1):
        chunk = " ".join(texts[i : i + N])
        score = fuzz.ratio(chunk, target)
        if score > best_score:
            best_score, best_i = score, i

    if best_score < threshold:
        return None

    # 5) trim extra words so boundaries align exactly
    start, end = best_i, best_i + N
    while start < end and texts[start] != tokens[0]:
        start += 1
    while end > start and texts[end - 1] != tokens[-1]:
        end -= 1

    # 6) group by line_no and union each group into Rects
    line_groups: dict[int, list[fitz.Rect]] = {}
    for idx in range(start, end):
        (x0, y0, x1, y1), _, line_no = page_words[idx]
        line_groups.setdefault(line_no, []).append(fitz.Rect(x0, y0, x1, y1))

    rects: list[fitz.Rect] = []
    for ln in sorted(line_groups):
        group = line_groups[ln]
        r = group[0]
        for extra in group[1:]:
            r |= extra
        rects.append(r)

    # 7) convert each Rect into (x0, y0, width, height)
    output: list[Tuple[float, float, float, float]] = []
    for r in rects:
        x0, y0 = r.x0, r.y0
        w, h = r.width, r.height  # properties of fitz.Rect
        output.append((x0, y0, w, h))

    return output, doc


# def visualize_bounding_boxes(
#         pdf_path: str,
#         sentences: list[str],
#         output_path: str):

#     doc = fitz.open(pdf_path)

#     for sentence in sentences:
#         for page_num, page in enumerate(doc):
#             # Find sentence instances
#             found_instances = page.search_for(sentence)

#             # Draw rectangles on found instances
#             for bbox in found_instances:
#                 # Draw a rectangle (red, 1pt width)
#                 page.draw_rect(
#                     bbox,
#                     color=(1, 0, 0),
#                     fill=(1, 1, 0),
#                     width=1.0,
#                     overlay=False,
#                 )

#     doc.save(output_path)
#     doc.close()


# def add_router(
#     config: Dict[str, Any],
#     handler: Callable
# ) -> APIRouter:
#     """
#     Register an API route on `router` by looking up `route_name`
#     in config["api"]["routes"].

#     Args:
#         router:     The APIRouter to register on.
#         config:     The loaded YAML dict (must have api.routes).
#         route_name: The name/key in each route config (matches the "handler" field).
#         handler:    The function or bound method to call when this endpoint is hit.

#     Raises:
#         ValueError: If no matching route config is found.
#     """
#     router = APIRouter()
#     router.add_api_route(
#         path=config["path"],
#         endpoint=handler,
#         methods=config["methods"],
#         response_model=config["response_model"],
#         description=config["description"],
#     )

#     return router


def load_config(file_path: str) -> dict:
    """
    Load configuration from the default YAML file.

    Returns:
        dict: The loaded configuration.

    Raises:
        FileNotFoundError: If the configuration file is not found.
        yaml.YAMLError: If the configuration file is invalid.
    """
    try:
        with open(file_path, "r") as f:
            config = yaml.safe_load(f)
            if not isinstance(config, dict):
                raise ValueError("Configuration file must contain a YAML dictionary")
            return config
    except FileNotFoundError:
        raise FileNotFoundError(
            f"Configuration file not found at {file_path}. "
            "Please ensure the config.yaml file exists in the contrast_tool package directory."
        )
    except yaml.YAMLError as e:
        raise yaml.YAMLError(f"Error parsing configuration file: {e}")
