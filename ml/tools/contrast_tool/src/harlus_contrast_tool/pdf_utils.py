import fitz
import re
from rapidfuzz import fuzz
from typing import List, Dict, Optional, Tuple, Any, Set
from .custom_types import HighlightArea, BoundingBox


def _normalize(text: str) -> str:
    """Lower-case and remove non-alphanumeric chars."""
    return re.sub(r"[^\w]", "", text.casefold())


def _best_match(needle: str, haystack: str, min_score: float = 0.75) -> Tuple[int, int, float]:
    """Find best fuzzy match of needle in haystack, return (start, end, score)."""
    if not needle or not haystack:
        return (-1, -1, 0.0)
    
    n, best = len(needle), (-1, -1, 0.0)
    for i in range(max(1, len(haystack) - n + 1)):
        window = min(n, len(haystack) - i)
        score = fuzz.ratio(needle[:window], haystack[i:i+window]) / 100
        if score > best[2]:
            best = (i, i + window, score)
            if score >= 0.98:  # Early exit on near-perfect match
                break
    return best


def _iou(r1: fitz.Rect, r2: fitz.Rect) -> float:
    """Calculate Intersection over Union between two rectangles."""
    if r1.is_empty or r2.is_empty:
        return 0.0
        
    inter = r1 & r2
    if not inter or inter.is_empty:
        return 0.0
        
    union = r1.get_area() + r2.get_area() - inter.get_area()
    if union <= 0:
        return 0.0
        
    return inter.get_area() / union


def find_text_in_page(query: str, page: fitz.Page, min_score: float = 0.75) -> List[Tuple[fitz.Rect, float]]:
    """
    Find text in a page and return a list of rects for each line of matching text.
    Handles text spanning across multiple lines, rotated text, and hyphenation.
    """
    results = []
    
    # Try a case-insensitive exact search first (fastest path)
    flags = fitz.TEXT_DEHYPHENATE | fitz.TEXT_PRESERVE_WHITESPACE | fitz.TEXT_PRESERVE_LIGATURES
    quads = page.search_for(query, quads=True, flags=flags)
    if quads:
        # If found exact matches, use them and exit early
        return [(quad.rect, 1.0) for quad in quads]
    
    # Create normalized versions for fuzzy matching
    norm_query = _normalize(query)
    if len(norm_query) < 3:  # Too short to match reliably
        return []
    
    # Try multi-line matching approach
    try:
        # Get words with bounding boxes
        words = page.get_text("words")
        if not words:
            return []
            
        # Extract text lines from word list
        lines = _extract_text_lines(page, words)
        
        # First try single-line matches
        for line_idx, line_words in enumerate(lines):
            if not line_words:
                continue
                
            line_text = " ".join(w[4] for w in line_words)
            
            # Check for hyphenated words
            next_line_text = ""
            if line_idx < len(lines) - 1 and lines[line_idx + 1]:
                next_line_text = " ".join(w[4] for w in lines[line_idx + 1])
                
                # Remove hyphen at end of line and join with next line
                if line_text.endswith("-"):
                    dehyphenated = line_text[:-1] + next_line_text
                    if fuzz.ratio(query, dehyphenated) >= min_score * 100:
                        # Found hyphenated match across two lines
                        rect1 = _get_line_rect(line_words)
                        rect2 = _get_line_rect(lines[line_idx + 1])
                        score = fuzz.ratio(query, dehyphenated) / 100
                        results.append((rect1, score))
                        results.append((rect2, score))
                        continue

            # Check normal line match
            if fuzz.partial_ratio(query, line_text) >= min_score * 100:
                rect = _get_line_rect(line_words)
                score = fuzz.partial_ratio(query, line_text) / 100
                results.append((rect, score))
        
        # If no single line matches worked, try multi-line matching
        if not results:
            results = _find_multiline_matches(lines, query, min_score)
    
    except Exception as e:
        # Fallback to using the built-in search with a lower threshold
        # This is a safety net in case our custom logic fails
        try:
            # Try to find individual words from the query
            words = query.split()
            for word in words:
                if len(word) >= 3:  # Only search for reasonably long words
                    quads = page.search_for(word, quads=True)
                    if quads:
                        results.extend([(quad.rect, 0.8) for quad in quads])
        except:
            pass
    
    return results


def _find_multiline_matches(
    lines: List[List[Any]],
    query: str,
    min_score: float
) -> List[Tuple[fitz.Rect, float]]:
    """Find matches that span multiple lines."""
    results = []
    
    # Try combining different numbers of consecutive lines
    for window_size in range(2, min(6, len(lines) + 1)):
        for i in range(len(lines) - window_size + 1):
            window_lines = lines[i:i+window_size]
            if not all(window_lines):
                continue
                
            # Create text from window of lines
            window_text = " ".join(" ".join(w[4] for w in line) for line in window_lines if line)
            
            # Check for match in combined text
            if fuzz.partial_ratio(query, window_text) >= min_score * 100:
                score = fuzz.partial_ratio(query, window_text) / 100
                
                # Add each line's bounding box as a separate result
                for line_words in window_lines:
                    if line_words:
                        rect = _get_line_rect(line_words)
                        results.append((rect, score))
                
                # Once we find a good match, stop checking this window size
                break
    
    return results


def _extract_text_lines(page: fitz.Page, words: List[Any] = None) -> List[List[Any]]:
    """
    Extract text as lines of words from a page.
    Uses adaptive line grouping to handle varying text sizes and styles.
    """
    if words is None:
        words = page.get_text("words")
    
    if not words:
        return []
    
    # Analyze the page to determine common line heights
    y_diffs = []
    sorted_words = sorted(words, key=lambda w: w[1])  # Sort by y0
    
    for i in range(1, len(sorted_words)):
        y_diff = sorted_words[i][1] - sorted_words[i-1][1]
        if 0 < y_diff < 50:  # Reasonable line height differences
            y_diffs.append(y_diff)
    
    # Calculate median line height if possible, otherwise use default
    if y_diffs:
        y_diffs.sort()
        median_line_height = y_diffs[len(y_diffs) // 2]
        line_tolerance = max(median_line_height * 0.5, 2.0)
    else:
        line_tolerance = 3.0
    
    # Group words by line using dynamic tolerance
    words_by_line = {}
    for word in words:
        # Find the closest line
        y0 = word[1]
        assigned = False
        
        for line_key in words_by_line.keys():
            if abs(y0 - line_key) <= line_tolerance:
                words_by_line[line_key].append(word)
                assigned = True
                break
        
        if not assigned:
            words_by_line[y0] = [word]
    
    # Sort lines by vertical position and sort words within each line
    sorted_lines = []
    for y0 in sorted(words_by_line.keys()):
        line_words = sorted(words_by_line[y0], key=lambda w: w[0])  # Sort by x0
        sorted_lines.append(line_words)
    
    return sorted_lines


def _get_line_rect(line_words: List[Any]) -> fitz.Rect:
    """Create a bounding rectangle for a line of words with padding."""
    if not line_words:
        return fitz.Rect(0, 0, 0, 0)
    
    # Create initial rect from first word
    rect = fitz.Rect(line_words[0][:4])
    
    # Expand to include all words
    for word in line_words[1:]:
        rect |= fitz.Rect(word[:4])
    
    # Add small margin for better visual appearance (0.5pt on each side)
    return rect + (-0.5, -0.5, 0.5, 0.5)


def get_highlight_area_from_pdf_search(
    query: str,
    pdf_path: str,
    min_score: float = 0.75,
    dedup_iou: float = 0.5,
) -> Optional[HighlightArea]:
    """
    Find text from query in PDF and return HighlightArea with bounding boxes.
    
    Args:
        query: Text to search for
        pdf_path: Path to PDF file
        min_score: Minimum match score (0.0-1.0)
        dedup_iou: IoU threshold for removing duplicate boxes
        
    Returns:
        HighlightArea with bounding boxes for each line of matched text
    """
    # Split query into sentences
    sentences = [s.strip() for s in re.split(r'[.!?]', query) if s.strip() and len(s.strip()) >= 3]
    if not sentences:
        return None

    try:
        doc = fitz.open(pdf_path)
        matches = []
        visited_pages = set()

        # Find each sentence in the document
        for sentence in sentences:
            best_score_for_sentence = min_score
            sentence_matches = []
            
            # First check pages where we already found other matches
            for page_num in visited_pages:
                page = doc[page_num]
                page_matches = find_text_in_page(sentence, page, min_score)
                for bbox, score in page_matches:
                    if score >= best_score_for_sentence:
                        sentence_matches.append({
                            "page": page_num,
                            "bbox": bbox,
                            "sentence": sentence,
                            "score": score
                        })
                        best_score_for_sentence = max(best_score_for_sentence, score)
            
            # If we didn't find good matches on already visited pages, check all pages
            if not sentence_matches or best_score_for_sentence < 0.9:
                for page_num in range(len(doc)):
                    if page_num in visited_pages:
                        continue  # Skip already checked pages
                        
                    page = doc[page_num]
                    page_matches = find_text_in_page(sentence, page, min_score)
                    
                    for bbox, score in page_matches:
                        if score >= best_score_for_sentence:
                            sentence_matches.append({
                                "page": page_num,
                                "bbox": bbox,
                                "sentence": sentence,
                                "score": score
                            })
                            best_score_for_sentence = max(best_score_for_sentence, score)
                            visited_pages.add(page_num)
                    
                    # Stop searching if we found a very good match
                    if best_score_for_sentence > 0.95:
                        break
            
            matches.extend(sentence_matches)

        # Remove overlapping boxes (keep higher scores)
        if matches:
            # Sort by score (higher first)
            matches.sort(key=lambda m: m["score"], reverse=True)
            kept = []
            
            for match in matches:
                # Keep if not overlapping with any already kept box on same page
                page_matches = [k for k in kept if k["page"] == match["page"]]
                if all(_iou(match["bbox"], k["bbox"]) < dedup_iou for k in page_matches):
                    kept.append(match)
            
            # Convert to normalized coordinates
            bboxes = []
            for match in kept:
                page = doc[match["page"]]
                w, h = page.rect.width, page.rect.height
                bbox = match["bbox"]
                
                # Ensure bbox is valid
                if not bbox.is_empty and bbox.is_infinite == 0:
                    bboxes.append(BoundingBox(
                        left=max(0, bbox.x0) / w * 100,
                        top=max(0, bbox.y0) / h * 100,
                        width=min(100, (bbox.x1 - bbox.x0) / w * 100),
                        height=min(100, (bbox.y1 - bbox.y0) / h * 100),
                        page=match["page"],
                    ))
            
            # Sort by page and vertical position
            if bboxes:
                bboxes.sort(key=lambda b: (b.page, b.top))
                return HighlightArea(
                    bounding_boxes=bboxes, 
                    jump_to_page_number=bboxes[0].page
                )
    
    except Exception as e:
        # Last resort: just try to find any occurrences of the text
        try:
            doc = fitz.open(pdf_path)
            bboxes = []
            
            for page_num, page in enumerate(doc):
                for word in query.split():
                    if len(word) >= 3:
                        quads = page.search_for(word)
                        if quads:
                            w, h = page.rect.width, page.rect.height
                            for quad in quads:
                                bbox = quad.rect
                                bboxes.append(BoundingBox(
                                    left=max(0, bbox.x0) / w * 100,
                                    top=max(0, bbox.y0) / h * 100,
                                    width=min(100, (bbox.x1 - bbox.x0) / w * 100),
                                    height=min(100, (bbox.y1 - bbox.y0) / h * 100),
                                    page=page_num,
                                ))
            
            if bboxes:
                bboxes.sort(key=lambda b: (b.page, b.top))
                return HighlightArea(
                    bounding_boxes=bboxes, 
                    jump_to_page_number=bboxes[0].page
                )
        except:
            pass
    
    return None


# For backward compatibility
_get_highlight_area_from_pdf_search = get_highlight_area_from_pdf_search



