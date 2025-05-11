import os
import yaml
from typing import Optional, List

from typing import Dict, Callable, Tuple, Optional

import fitz

from rapidfuzz import fuzz

from nltk.tokenize import sent_tokenize

from llama_index.core import Document
from llama_parse import LlamaParse
from llama_index.core import SimpleDirectoryReader

from .api_interfaces import BoundingBox


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
    pdf_path: str,
    sentence: str,
    page_num: int,
    threshold: int = 50,
) -> List[BoundingBox]:
    """
    Fuzzy-match `sentence` on page `page_num` of `pdf_path`.
    Returns a list of (x0_pct, y0_pct, width_pct, height_pct) tuples for each matching line
    if score ≥ threshold, else None.
    Coordinates are percentages (0-100) of page dimensions.
    """
    # 1) normalize the sentence
    target = " ".join(sentence.split()).lower()

    # 2) open document and get page dimensions
    doc = fitz.open(pdf_path)
    page = doc.load_page(page_num - 1)
    p_width = page.rect.width
    p_height = page.rect.height

    # 3) load words on the page and sort
    words = page.get_text("words")
    words.sort(key=lambda w: (w[1], w[0]))

    # 4) prepare word list and texts for fuzzy matching
    page_words = [((w[0], w[1], w[2], w[3]), w[4].lower(), w[6]) for w in words]
    texts = [w for (_, w, _) in page_words]

    # 5) fuzzy-match the target sentence
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

    # 6) align boundaries exactly to the target tokens
    start, end = best_i, best_i + N
    while start < end and texts[start] != tokens[0]:
        start += 1
    while end > start and texts[end - 1] != tokens[-1]:
        end -= 1

    # 7) group words by line number and merge rectangles
    line_groups: dict[int, list[fitz.Rect]] = {}
    for idx in range(start, end):
        (x0, y0, x1, y1), _, line_no = page_words[idx]
        line_groups.setdefault(line_no, []).append(fitz.Rect(x0, y0, x1, y1))

    rects: List[fitz.Rect] = []
    for ln in sorted(line_groups):
        group = line_groups[ln]
        r = group[0]
        for extra in group[1:]:
            r |= extra
        rects.append(r)

    # 8) convert to relative percentage coordinates
    output: List[BoundingBox] = []
    for r in rects:
        x0, y0 = r.x0, r.y0
        w, h = r.width, r.height
        x0_pct = round((x0 / p_width) * 100, 2)
        y0_pct = round((y0 / p_height) * 100, 2)
        w_pct = round((w / p_width) * 100, 2)
        h_pct = round((h / p_height) * 100, 2)
        output.append(
            BoundingBox(
                left=x0_pct,
                top=y0_pct,
                width=w_pct,
                height=h_pct,
                page=page_num,
            )
        )

    return output


# def is_table_block(text: str) -> bool:
#     """
#     Heuristic: a block is a table if it has ≥2 non-blank lines,
#     and each line splits into >1 “columns” when you split on ≥2 spaces.
#     """
#     lines = [ln for ln in text.splitlines() if ln.strip()]
#     if len(lines) < 2:
#         return False
#     col_counts = [len(re.split(r'\s{2,}', ln.strip())) for ln in lines]
#     return max(col_counts) > 1 and min(col_counts) > 1


# def load_sentence_and_table_nodes(pdf_path: str):
#     """
#     Load PDF and create Document nodes for tables and sentences,
#     with bounding boxes as percentages of page dimensions.
#     """
#     doc = fitz.open(pdf_path)
#     nodes = []
#     for page in doc:
#         page_width = page.rect.width
#         page_height = page.rect.height
#         blocks = page.get_text("blocks")  # (x0, y0, x1, y1, text, block_no)
#         for x0, y0, x1, y1, block_text, _ in blocks:
#             if is_table_block(block_text):
#                 # Entire table as one node, with relative bbox
#                 x_pct = x0 / page_width
#                 y_pct = y0 / page_height
#                 w_pct = (x1 - x0) / page_width
#                 h_pct = (y1 - y0) / page_height
#                 nodes.append(Document(
#                     text=block_text,
#                     extra_info={
#                         "page": page.number + 1,
#                         "bbox": [x_pct, y_pct, w_pct, h_pct],
#                         "is_table": True
#                     }
#                 ))
#             else:
#                 for sent in nltk.sent_tokenize(block_text):
#                     rects = page.search_for(sent)
#                     for r in rects:
#                         x_pct = r.x0 / page_width
#                         y_pct = r.y0 / page_height
#                         w_pct = (r.x1 - r.x0) / page_width
#                         h_pct = (r.y1 - r.y0) / page_height
#                         nodes.append(Document(
#                             text=sent,
#                             extra_info={
#                                 "page": page.number + 1,
#                                 "bbox": [x_pct, y_pct, w_pct, h_pct],
#                                 "is_table": False
#                             }
#                         ))
#     return nodes

def visualize_bounding_boxes(
        pdf_path: str,
        sentences: list[str],
        output_path: str):

    doc = fitz.open(pdf_path)

    for sentence in sentences:
        for page_num, page in enumerate(doc):
            # Find sentence instances
            found_instances = page.search_for(sentence)

            # Draw rectangles on found instances
            for bbox in found_instances:
                # Draw a rectangle (red, 1pt width)
                page.draw_rect(
                    bbox,
                    color=(1, 0, 0),
                    fill=(1, 1, 0),
                    width=1.0,
                    overlay=False,
                )

    doc.save(output_path)
    doc.close()


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
