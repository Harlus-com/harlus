import fitz
from rapidfuzz import process, fuzz
from typing import Tuple, Dict, Union




def fuzzy_find_best_substring(long_text: str, short_text: str):

    long_text_choices = [long_text[i:i+len(short_text)] for i in range(len(long_text)-len(short_text)+1)]
    
    match = process.extractOne(
        query=short_text,
        choices=long_text_choices,  
        scorer=fuzz.partial_ratio,
        processor=None,
        score_cutoff=80,
    )
    return match


def vertices_to_rects(vertices: list[Tuple[float, float]]):
    assert len(vertices) % 4 == 0
    rects = []
    for i in range(0, len(vertices), 4):
        all_vertices = vertices[i:i+4]
        rect = fitz.Quad(all_vertices).rect
        rects.append(rect)
    return rects


def get_standard_rects_from_pdf(pdf_path: str, target_text: str, page_nb: int = None):

    doc = fitz.open(pdf_path)
    max_search_page = len(doc)
    min_search_page = 0

    # page_nb is 1-indexed by default, PyMuPDF is 0-indexed
    if page_nb is not None:
        page_nb = page_nb - 1
        min_search_page = max(0, page_nb - 1)
        max_search_page = min(len(doc) - 1, page_nb + 1)

    try: left_target_text = target_text[:20]
    except: left_target_text = target_text
    try: right_target_text = target_text[-20:]
    except: right_target_text = target_text

    page_width = doc[0].rect.width
    page_height = doc[0].rect.height

    all_standard_rects = []

    for page in doc[min_search_page:max_search_page]:

        page_number = page.number

        start = None
        stop = None

        # left match
        page_text = page.get_text()
        try:
            match = fuzzy_find_best_substring(page_text, left_target_text)
            rl = page.search_for(match[0])
            start = rl[0].tl 
        except:
            continue


        # right match
        page_text = page.get_text()
        try:
            match = fuzzy_find_best_substring(page_text, right_target_text)
            rl = page.search_for(match[0])
            stop = rl[0].br  
        except:
            continue

        # get rects
        try:
            highlight = page.add_highlight_annot(start=start, stop=stop)
            vertices = highlight.vertices
            rects = vertices_to_rects(vertices)
            page.delete_annot(highlight)
            page_width = page.rect.width
            page_height = page.rect.height
            standard_rects = [
                {
                    "left": (rect.x0 / page_width) * 100,
                    "top": (rect.y0 / page_height) * 100,
                    "width": (rect.width / page_width) * 100,
                    "height": (rect.height / page_height) * 100,
                    "page": page_number
                } 
                for rect in rects
            ]
            all_standard_rects.extend(standard_rects)
        except:
            continue
    return all_standard_rects


def prune_overlapping_rects(standard_rects: list[Dict[str, Union[float, int]]], overlap_threshold: float = 0.5) -> list[Dict[str, Union[float, int]]]:
    

    all_page_numbers = list(set(rect["page"] for rect in standard_rects))
    pruned = []
    for page_number in all_page_numbers:
        page_standard_rects = [rect for rect in standard_rects if rect["page"] == page_number]
        page_fitz_rects = [fitz.Rect(rect["left"], rect["top"], rect["left"] + rect["width"], rect["top"] + rect["height"]) for rect in page_standard_rects]

        for i, rect in enumerate(page_fitz_rects):
            keep = True
            for j, other in enumerate(page_fitz_rects):
                if i == j:
                    continue
        
                intersection = rect & other  # intersection of two rects
                if intersection.is_empty:
                    continue

                inter_area = intersection.get_area()
                min_area = min(rect.get_area(), other.get_area())
                overlap_ratio = inter_area / min_area

                if overlap_ratio > overlap_threshold:
                    keep = False
                    break

            if keep:
                pruned.append(page_standard_rects[i])

    return pruned



def get_llamaparse_rects(file_path, bounding_boxes, page_nb):
    doc = fitz.open(file_path)
    page = doc[page_nb]
    page_width = page.rect.width
    page_height = page.rect.height
    standard_rects = []
    for bounding_box in bounding_boxes:
        standard_rects.append({
                    "left": float(bounding_box.left / page_width) * 100,
                    "top": float(bounding_box.top / page_height) * 100,
                    "width": float(bounding_box.width / page_width) * 100,
                    "height": float(bounding_box.height / page_height) * 100,
                    "page": page_nb - 1, # llama parse is 1-indexed
                    "type": "relative"
                } )
    return standard_rects



