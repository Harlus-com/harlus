
import fitz
from llama_index.core.retrievers import BaseRetriever
from rapidfuzz import fuzz

from .api_interfaces import BoundingBox, HighlightArea

def get_config() -> dict:
    """
    Load configuration (inlined).

    Returns:
        dict: The hard‑coded configuration.
    """
    return {
        "claim getter": {
            "model_name": "gpt-4o",
            "temperature": 0.0,
            "max_tokens": 500,
        },
        "claim checker": {
            "question model": {
                "model_name": "gpt-3.5-turbo",
                "temperature": 0.0,
                "max_tokens": 500,
            },
            "answer model": {
                "model_name": "gpt-4o-mini",
                "temperature": 0.0,
                "max_tokens": 250,
            },
            "verification model": {
                "model_name": "gpt-4o",
                "temperature": 0.0,
                "max_tokens": 500,
            },
        },
    }


def get_highlight_area(
        sentence: str,
        file_path: str,
        file_sentence_retriever: BaseRetriever,
    ) -> HighlightArea:
        # TODO can highlight on several pages
        # TODO highlight several sentences related to the claim
        # TODO move to utils

        # sentence that matches the claim
        sentence = file_sentence_retriever.retrieve(sentence)
        source = " ".join(sentence[0].get_content().split())
        page_num = int(sentence[0].node.metadata.get("page_label"))

        bbox = find_fuzzy_bounding_boxes(file_path, source, page_num) or []

        return HighlightArea(bounding_boxes=bbox, jump_to_page=page_num)


def find_fuzzy_bounding_boxes(
    pdf_path: str,
    sentence: str,
    page_num: int,
    threshold: int = 50,
) -> list[BoundingBox]:
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

    rects: list[fitz.Rect] = []
    for ln in sorted(line_groups):
        group = line_groups[ln]
        r = group[0]
        for extra in group[1:]:
            r |= extra
        rects.append(r)

    # 8) convert to relative percentage coordinates
    output: list[BoundingBox] = []
    for r in rects:
        x0, y0 = r.x0, r.y0
        w, h = r.width, r.height
        x0_pct = (x0 / p_width) * 100
        y0_pct = (y0 / p_height) * 100
        w_pct = (w / p_width) * 100
        h_pct = (h / p_height) * 100
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