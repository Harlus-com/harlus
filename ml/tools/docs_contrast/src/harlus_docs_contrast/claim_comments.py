import asyncio
from custom_types import LinkComment, ClaimComment, HighlightArea
from harlus_source_highlight import HighlightPipeline
from .utils import _strip_none, _convert_verdict
from langchain_core.tools import Tool


async def _get_link_comment(
        source_text: str, 
        comment_text: str, 
        highlight_pipeline: HighlightPipeline
        ) -> LinkComment | None:

    highlight_area, file_path, state = await highlight_pipeline.run(source_text)
    if highlight_area is None:
        print(" - no highlight area found, state:", state, " \n - source text:", source_text)
        return None
    try:

        link_comment = LinkComment(
            file_path=file_path,
            highlight_area=HighlightArea(**highlight_area.model_dump()),
            text=comment_text,
        )
    except Exception as e:
        print(" - error creating link comment", e)
        print(" - highlight area:", highlight_area)
        print(" - file path:", file_path)
        print(" - comment text:", comment_text)
        assert False
    return link_comment

async def _get_claim_comment_from_source_text(
        source_text: str, 
        comment_text: str, 
        verdict: str, 
        link_comments: list[LinkComment], 
        highlight_pipeline: HighlightPipeline
        ) -> ClaimComment | None:
    
    highlight_area, file_path, state = await highlight_pipeline.run(source_text)
    if highlight_area is None:
        print(" - no highlight area found, state:", state, " \n - source text:", source_text)
        return None
    return ClaimComment(
        file_path=file_path,
        highlight_area=HighlightArea(**highlight_area.model_dump()),
        text=comment_text,
        links=link_comments,
        verdict=verdict,
    )

async def _get_claim_comments_from_contrast(
        contrast: dict, 
        source_retrievers: list[Tool], 
        evidence_retrievers: list[Tool]
    ) -> list[ClaimComment] | None:

    source_texts = contrast["evidence_source_texts"]
    comment_text = contrast["evidence"]

    evidence_highlight_pipeline = HighlightPipeline(
        retrievers=evidence_retrievers,
    )
    
    evidence_tasks = [
        _get_link_comment(
            source_text, 
            comment_text, 
            evidence_highlight_pipeline
            ) 
        for source_text in source_texts
    ]
    link_comments = await asyncio.gather(*evidence_tasks)
    link_comments = _strip_none(link_comments)
    if len(link_comments) == 0:
        return None

    source_texts = contrast["statement_source_texts"]
    comment_text = contrast["verdict_statement"]
    verdict = _convert_verdict(contrast["verdict"])
    statement_highlight_pipeline = HighlightPipeline(
        retrievers=source_retrievers,
    )
    statement_tasks = [
        _get_claim_comment_from_source_text(
            source_text, 
            comment_text, 
            verdict, 
            link_comments, 
            statement_highlight_pipeline
            ) 
        for source_text in source_texts]
    claim_comments = await asyncio.gather(*statement_tasks)
    claim_comments = _strip_none(claim_comments)
    if len(claim_comments) == 0:
        return None
    return claim_comments


async def _get_claim_comments_from_driver_tree(
        driver_tree: list[dict], 
        source_retrievers: list[Tool], 
        evidence_retrievers: list[Tool]
    ) -> list[ClaimComment] | None:

    claim_comments = []
    contrast_tasks = [_get_claim_comments_from_contrast(contrast, source_retrievers, evidence_retrievers) for contrast in driver_tree]
    results = await asyncio.gather(*contrast_tasks)
    results = _strip_none(results)
    for result in results:
        claim_comments.extend(result)
    claim_comments = _strip_none(claim_comments)
    return claim_comments