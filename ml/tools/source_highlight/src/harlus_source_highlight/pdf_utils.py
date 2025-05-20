import fitz
import re
from typing import List, Optional
from collections import Counter
from rapidfuzz import fuzz

# Note: the algorithms are leaning heavily on AI generated code.
# while they are simple, this avoided some development and test work.

def _normalize_word(w: str) -> str:
    return re.sub(r"[^\w]", "", w.casefold())

def _concatenate_line_rects(rects: List[fitz.Rect], y_tolerance: float = 2.0) -> List[fitz.Rect]:
    """
    Concatenates rects on the same line.
    """

    if not rects:
        return []
        
    line_groups = {}
    
    # group rects by y-mid
    for rect in rects:
        y_mid = (rect.y0 + rect.y1) / 2
        
        assigned = False
        for y_key in line_groups.keys():
            if abs(y_key - y_mid) <= y_tolerance:
                line_groups[y_key].append(rect)
                assigned = True
                break
        
        if not assigned:
            line_groups[y_mid] = [rect]
    
    # concatenate rects in the same group
    concatenated_rects = []
    for line_rects in line_groups.values():
        if line_rects:
            line_rects.sort(key=lambda r: r.x0)
            
            x0 = min(r.x0 for r in line_rects)
            y0 = min(r.y0 for r in line_rects)
            x1 = max(r.x1 for r in line_rects)
            y1 = max(r.y1 for r in line_rects)
            
            concatenated_rects.append(fitz.Rect(x0, y0, x1, y1))
    
    return concatenated_rects

## -----------------------------------------------------------------------------
## 1. Bag of words
## -----------------------------------------------------------------------------

def _get_bag_of_words_rects_from_page(
    page: fitz.Page,
    query: str,
    threshold: float = 0.80,         # required overlap ratio
    window_factor: float = 1.05,     # window_len = ceil(q_len * window_factor)
) -> Optional[List[fitz.Rect]]:
    

    # normalize query words
    q_words = [_normalize_word(w) for w in query.split()]
    q_words = [w for w in q_words if len(w) >= 3]
    if not q_words:
        return None

    q_len = len(q_words)
    q_counter = Counter(q_words)
    win_len = max(q_len, int(round(q_len * window_factor)))

    # get and normalize page words
    words_raw = page.get_text("words") # [x0,y0,x1,y1,text,…]
    p_words_and_rects: List[Tuple[str, fitz.Rect]] = []
    for w in words_raw:
        norm = _normalize_word(w[4])
        if len(norm) >= 3:                      
            p_words_and_rects.append((norm, fitz.Rect(w[:4])))

    if len(p_words_and_rects) < q_len:
        return None

    #slide to find best overlap
    best: Optional[Tuple[float, int, int]] = None  # (ratio, start, end)
    best_rects: List[fitz.Rect] = []

    for i in range(len(p_words_and_rects) - win_len + 1):
        p_window = p_words_and_rects[i : i + win_len]
        p_counter = Counter(tok for tok, _ in p_window)

        # count matches
        matches = sum(min(q_counter[tok], p_counter.get(tok, 0)) for tok in q_counter)
        ratio   = matches / q_len

        if ratio >= threshold:
            if best is None or ratio > best[0]:
                best = (ratio, i, i + win_len)
                best_rects = [r for _, r in p_window]

    if not best:
        return None

    # concatenate rects on the same line
    return _concatenate_line_rects(best_rects)

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

import re
from typing import List, Optional, Tuple
from rapidfuzz import fuzz
import fitz


def _collapse_spaces(text: str) -> Tuple[str, List[int]]:
    """
    Collapses runs of whitespace to one space and keeps a mapping
    """

    out_chars: List[str] = []
    mapping:   List[int] = []
    in_space = False

    for idx, ch in enumerate(text):
        if ch.isspace():
            if not in_space:
                out_chars.append(" ")
                mapping.append(idx)
                in_space = True
        else:
            out_chars.append(ch)
            mapping.append(idx)
            in_space = False

    return "".join(out_chars), mapping


def _strip_non_alnum(text: str) -> Tuple[str, List[int]]:
    """
    Keeps only 0-9 A-Z a-z, returns mapping.
    """
    chars, mp = [], []
    for i, ch in enumerate(text):
        if ch.isalnum():
            chars.append(ch.casefold())
            mp.append(i)
    return "".join(chars), mp


def _get_best_fuzzy_match(
    text: str,
    query: str,
    min_score: float = 0.80,
) -> Optional[str]:
    

    # skip short queries
    stripped_query, _ = _strip_non_alnum(query)
    if len(stripped_query) < 3:
        return None

    # clean text
    collapsed_text, map_c2o = _collapse_spaces(text)
    norm_text,  map_n2c = _strip_non_alnum(collapsed_text)

    # clean query
    norm_query, _ = _strip_non_alnum(query)

    # skip if text is too short
    if len(norm_text) < len(norm_query):
        return None

    # slide over normalized text to find best match
    best = (-1, -1, 0.0)  # (n_start, n_end, score)
    qlen = len(norm_query)
    for i in range(len(norm_text) - qlen + 1):
        score = fuzz.ratio(norm_query, norm_text[i:i + qlen]) / 100
        if score > best[2]:
            best = (i, i + qlen, score)

    if best[2] < min_score:
        return None

    # map normalized text to original text
    c_start = map_n2c[best[0]]
    c_end   = map_n2c[best[1] - 1] + 1
    o_start = map_c2o[c_start]
    o_end   = map_c2o[c_end - 1] + 1

    return text[o_start:o_end]




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
            return rects, matched_text

    return None, ""

def _get_fuzzy_match_rects(
        query: str,
        pdf_path: str,
        page_nb: int,
    ):
    doc = fitz.open(pdf_path)
    page = doc.load_page(page_nb)
    return _get_fuzzy_match_rects_from_page(page, query)



