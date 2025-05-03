import fitz
from rapidfuzz import process, fuzz
from typing import Tuple
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



def get_vertices(pdf_path: str, target_text: str):

    doc = fitz.open(pdf_path)

    all_quads = []

    try: left_target_text = target_text[:20]
    except: left_target_text = target_text
    try: right_target_text = target_text[-20:]
    except: right_target_text = target_text

    for page in doc:

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

        try:
            highlight = page.add_highlight_annot(start=start, stop=stop)
            quads = highlight.vertices
            page.delete_annot(highlight)
            all_quads.extend(quads)
        except:
            continue

    return all_quads


def vertices_to_rects(vertices: list[Tuple[float, float]]):
    assert len(vertices) % 4 == 0
    rects = []
    for i in range(0, len(vertices), 4):
        all_vertices = vertices[i:i+4]
        rect = fitz.Quad(all_vertices).rect
        rects.append(rect)
    return rects

def rects_to_reactpdf(rects: list[fitz.Rect]):
    return [
            {
                "left": rect.x0,
                "top": rect.y0,
                "width": rect.width,
                "height": rect.height
            } 
            for rect in rects
        ]