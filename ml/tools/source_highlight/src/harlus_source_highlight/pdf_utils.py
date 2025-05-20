import fitz
import re
from typing import List, Optional
from collections import Counter
from rapidfuzz import fuzz

# Note: AI generated



def _normalize_word(w: str) -> str:
    return re.sub(r"[^\w]", "", w.casefold())

def _normalize(text: str) -> str:
    return re.sub(r"[^\w]", "", text.casefold())

def _normalize_spaces(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()

## -----------------------------------------------------------------------------
## 1. Bag of words
## -----------------------------------------------------------------------------

def _get_bag_of_words_rects_from_page(
        page: fitz.Page, 
        query: str, 
        threshold: float = 0.8
        ) -> Optional[List[fitz.Rect]]:
    
    # Step 1: normalize query into a bag of words
    query_words = [_normalize_word(w) for w in query.split() if len(w) > 1]
    if not query_words:
        return None
    query_counter = Counter(query_words)
    qlen = len(query_words)
    window_size = int(qlen * 1.2)

    # Step 2: extract page words [(text, rect)]
    pdf_words_raw = page.get_text("words")  # [x0, y0, x1, y1, "text", ...]
    pdf_words = [(w[4], fitz.Rect(w[:4])) for w in pdf_words_raw if w[4].strip()]
    if len(pdf_words) < qlen:
        return None

    # Step 3: sliding window
    best_hit = None  # (match_count, start_idx, end_idx, rects)
    for i in range(len(pdf_words) - window_size + 1):
        window = pdf_words[i:i + window_size]
        window_words = [_normalize_word(w) for w, _ in window]
        window_counter = Counter(window_words)

        # Count how many query words match (with frequency)
        match_count = sum(min(query_counter[w], window_counter.get(w, 0)) for w in query_counter)
        match_ratio = match_count / qlen

        if match_ratio >= threshold:
            rects = [r for _, r in window]
            if best_hit is None or match_count > best_hit[0]:
                best_hit = (match_count, i, i + window_size, rects)

    if best_hit:
        return best_hit[3]  # List of fitz.Rect
    return None

def _get_bag_of_words_rects(
        query: str,
        pdf_path: str,
        page_nb: int,
    ):

    doc = fitz.open(pdf_path)
    page = doc.load_page(page_nb)
    return _get_bag_of_words_rects_from_page(page, query)

## -----------------------------------------------------------------------------
## 2. Fuzzy match
## -----------------------------------------------------------------------------

def _get_best_fuzzy_match(
        text: str,
        query: str,
        min_score: float = 0.80
    ) -> Optional[str]:
    
    norm_query = _normalize(query)
    if len(norm_query) < 3:
        return None

    collapsed_text = _normalize_spaces(text)
    norm_collapsed = _normalize(collapsed_text)

    if len(norm_collapsed) < len(norm_query):
        return None

    best = (-1, -1, 0.0)
    for i in range(len(norm_collapsed) - len(norm_query) + 1):
        window = norm_collapsed[i:i + len(norm_query)]
        score = fuzz.ratio(norm_query, window) / 100
        if score > best[2]:
            best = (i, i + len(norm_query), score)

    if best[2] < min_score:
        return None

    
    orig_indices = [i for i, c in enumerate(text) if c.isalnum()]
    try:
        start = orig_indices[best[0]]
        end = orig_indices[best[1] - 1] + 1
        matched_text = text[start:end]
        return matched_text
    except IndexError:
        return None


def _get_fuzzy_match_rects_from_page(
    page: fitz.Page,
    query: str,
    min_score: float = 0.80
) -> Optional[List[fitz.Rect]]:
    text = page.get_text("text")
    matched_text = _get_best_fuzzy_match(text, query, min_score)

    if matched_text:
        flags = (
            getattr(fitz, "TEXT_IGNORECASE", 0)
            | fitz.TEXT_DEHYPHENATE
            | fitz.TEXT_PRESERVE_WHITESPACE
            | fitz.TEXT_PRESERVE_LIGATURES
        )
        rects = page.search_for(matched_text.strip(), flags=flags)
        if rects:
            return rects

    return None

def _get_fuzzy_match_rects(
        query: str,
        pdf_path: str,
        page_nb: int,
    ):
    doc = fitz.open(pdf_path)
    page = doc.load_page(page_nb)
    return _get_fuzzy_match_rects_from_page(page, query)



