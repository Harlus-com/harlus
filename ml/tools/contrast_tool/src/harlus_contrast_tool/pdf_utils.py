import fitz, re
from rapidfuzz import fuzz
from typing import List, Dict
from .custom_types import HighlightArea, BoundingBox


def _normalize(t: str) -> str:
    """lower-case, remove every char that isn’t [0-9A-Z_a-z]."""
    return re.sub(r"[^\w]", "", t.casefold())


def _best_partial_ratio(needle: str, hay: str) -> tuple[int, int, float]:
    """slide a |needle|-long window over *hay*, return (start, end, score)."""
    n = len(needle)
    best = (-1, -1, 0.0)
    for i in range(len(hay) - n + 1):
        score = fuzz.ratio(needle, hay[i : i + n]) / 100
        if score > best[2]:
            best = (i, i + n, score)
            if score == 1.0:
                break
    return best


def _iou(r1: fitz.Rect, r2: fitz.Rect) -> float:
    inter = r1 & r2
    if not inter:
        return 0.0
    return inter.get_area() / (r1.get_area() + r2.get_area() - inter.get_area())


def _greedy_non_overlap(hits: List[Dict], iou_thr: float = 0.8) -> List[Dict]:
    """highest-score first; drop any later rect with IoU ≥ iou_thr."""
    hits.sort(key=lambda h: h["score"], reverse=True)
    keep: List[Dict] = []
    for h in hits:
        if all(_iou(h["bbox"], k["bbox"]) < iou_thr for k in keep):
            keep.append(h)
    return keep


    

def _get_highlight_area_from_pdf_search(
    query: str,
    pdf_path: str,
    min_score: float = 0.80,
    dedup_iou: float = 0.80,
) -> List[Dict]:
    """
    Return [{'page': int, 'bbox': fitz.Rect, 'sentence': str, 'score': float}, …]
    One result per sentence fragment in *query* that meets *min_score*.
    """

    sentences = [s.strip() for s in query.split(".") if s.strip()]
    if not sentences:
        return []

    doc           = fitz.open(pdf_path)
    collected: List[Dict] = []

    for sent in sentences:
        norm_needle = _normalize(sent)
        if len(norm_needle) < 4:          
            continue

        best_hit_for_sentence = None      

        for pno, page in enumerate(doc, 1):
            raw_text = page.get_text("text")

            proj_chars, orig_idx_map = [], []
            for idx, ch in enumerate(raw_text):
                if ch.isalnum():
                    proj_chars.append(ch.casefold())
                    orig_idx_map.append(idx)
            proj_text = "".join(proj_chars)
            if len(proj_text) < len(norm_needle) // 2:
                continue

            start_p, end_p, score = _best_partial_ratio(norm_needle, proj_text)
            if score < min_score:
                continue

            start_o = orig_idx_map[start_p]
            end_o   = orig_idx_map[end_p - 1] + 1
            slice_raw = raw_text[start_o:end_o]
            slice_for_search = re.sub(r"\s+", " ", slice_raw).strip()

            flags = getattr(fitz, "TEXT_IGNORECASE", 0)
            rects = page.search_for(slice_for_search, flags=flags)
            if not rects:
                continue

            bbox = fitz.Rect(rects[0])
            for r in rects[1:]:
                bbox |= r

            if (best_hit_for_sentence is None) or (score > best_hit_for_sentence[2]):
                best_hit_for_sentence = (pno, bbox, score)

        if best_hit_for_sentence:
            collected.append(
                {
                    "page":     best_hit_for_sentence[0]-1,
                    "bbox":     best_hit_for_sentence[1],
                    "sentence": sent,
                    "score":    best_hit_for_sentence[2],
                }
            )
    collected_list = _greedy_non_overlap(collected, dedup_iou)
    if len(collected_list) == 0:
        return None
    bounding_boxes = []
    page_width = doc[collected_list[0]["page"]].rect.width
    page_height = doc[collected_list[0]["page"]].rect.height
    for collected in collected_list:
        bounding_boxes.append(BoundingBox(
            left=collected["bbox"].x0 / page_width * 100,
            top=collected["bbox"].y0 / page_height * 100,
            width=(collected["bbox"].x1 - collected["bbox"].x0) / page_width * 100,
            height=(collected["bbox"].y1 - collected["bbox"].y0) / page_height * 100,
            page=collected["page"],
        ))
    highlight_area = HighlightArea(bounding_boxes=bounding_boxes, jump_to_page_number=collected_list[0]["page"])
    return highlight_area



