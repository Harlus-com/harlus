from llama_index.core.prompts import PromptTemplate
from .base import register_prompt


_PROMPT_GET_CLAIMS_NAME = "extract claims"
_PROMPT_GET_CLAIMS_TEXT = """\
What are *all* the sentences in this report that express a projection, an outlook or an expectation about company KPIs or market characteristics. \
Write one precise sentence per item, each time mentioning the topic, the expected value or trend and the period or horizon date. \
Use *only* figures that appear in the text. Do not invent anything.
{output_format}\
"""
PROMPT_GET_CLAIMS = PromptTemplate(_PROMPT_GET_CLAIMS_TEXT,)
register_prompt(PROMPT_GET_CLAIMS, name=_PROMPT_GET_CLAIMS_NAME)


_PROMPT_EXTRACT_QUESTIONS_NAME = "get questions to challenge claim"
_PROMPT_EXTRACT_QUESTIONS_TEXT = """
List 3 questions that a financial analyst would ask to identify all relevant information that can verify this claim. Make sure that the questions are
- concise, i.e.each question focusses on a different feature of the claim
- precise, i.e. include as much data from the claim as possible
- complete, i.e. search for all aliases of the claim's topic and its key drivers
"""
PROMPT_EXTRACT_QUESTIONS = PromptTemplate(_PROMPT_EXTRACT_QUESTIONS_TEXT)
register_prompt(PROMPT_EXTRACT_QUESTIONS, name=_PROMPT_EXTRACT_QUESTIONS_NAME)


# PRIMER = dedent("""
# "You are a **senior sell-side equity-research analyst** converting an "
# "unstructured company report into structured, machine-readable data. "
# "Follow the requested output schema exactly and **NEVER invent, infer, "
# "round, or recalculate numbers** that are not in the text.\n\n"
# """).strip()

# PROMPTS: dict[str, str] = {
#     "facts": dedent("""
#         {primer}

#         Summarise **every** past or present KPI or market characteristic that appears in the report. \
#         Omit any forward-looking statements. \
#         Write one precise sentence per item, each time mentioning the exact value, period, currency and/or trend. \
#         Use *only* figures that appear in the text. Do not invent anything.
#     """).strip(),
#     "forecast": dedent("""
#         {primer}

#         Summarise **every** projection, outlook or expectation about KPIs or market characteristics mentioned in the report. \
#         Write one precise sentence per item, each time starting with the date of the report (e.g. In May 2024, ...) \
#         then mentioning the topic, expected value, period, currency and/or trend. \
#         Use *only* figures that appear in the text. Do not invent anything.
#     """).strip(),
#     "drivers_risks": dedent("""
#         {primer}

#         For each forecast presented below, extract the key drivers and risks cited in the report. \
#         Cite evidence for each driver/risk in parentheses. \
#         If the report names no drivers or risks, write: \
#         "The report is silent on specific drivers and risks, but I suggest monitoring … ." \
#     """).strip(),
#     "theses": dedent("""
#         {primer}

#         Produce a Markdown *bullet-point list* that summarises every forecast presented below, \
#         together with its key drivers and risks as follows:
#         **Hypothesis #{{n}}:** <one actionable sentence> 
#             # - Drivers: <short description of key drivers>
#             # - Risks: <short description of key risks>
#         Each hypothesis must be
#             - Specific: concern only one KPI or market characteristic.  
#             - Measurable: contain the exact value or trend.
#             - Time-bound: specify the period.  
#             Example: "The company's EBITDA margin will rise to ≥ 18 % in FY-2026."
#         Reuse facts, drivers and risks exactly as extracted; add nothing new. \
#         Output *only* the bullet list—no extra commentary.
#     """).strip(),
# }