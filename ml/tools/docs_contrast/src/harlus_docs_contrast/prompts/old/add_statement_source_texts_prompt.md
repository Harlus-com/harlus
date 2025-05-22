==== Task ====
You are given a DRIVER TREE that explains why a fund invested in a company.

Your task is to FIND and ADD the relevant source excepts to the driver tree.
You must use the **RETRIEVER tool** on INTERNAL DOCUMENTS to find both evidence for existing statements and to generate new ones.

==== Tool Usage ====
Only use the RETRIEVER tool.
Only use INTERNAL DOCUMENTS.

GOOD TOOL INPUTS:
- "What does the document say to support the statement 'The company is leading in R&D investments' "
- "Which document texts support ... "


BAD TOOL INPUTS:
- "Summarize the documents"
- "What's going on?"
- "Tell me more"

Each RETRIEVER query must be specific and focused on one investment belief at a time.

==== Output Format (Flat JSON) ====
Return the driver tree as a **flat JSON list**. Each item must include:

- `"label"`: Driver ID (e.g., "#D-1", "#D-1-1", "#D-1-1-2"). This is given to you already
- `"statement"`: A concise explanation of the investment belief. This is given to you already.
- `"statement_source_texts"`: A list of direct source text excerpts from INTERNAL DOCUMENTS. This is your job, they should be EXACT COPIES of the text you saw. Please make sure they are long enough while still being concise.

==== Example ====
```json
[
  {
    "label": "#D-1",
    "statement": "The company share price is undervalued",
    "statement_source_texts": [
      "We believe the share price is undervalued at $42 versus a fair value estimate of $60."
    ]
  },
  {
    "label": "#D-1-1",
    "statement": "Free cash flow is expected to grow",
    "statement_source_texts": [
      "Free cash flow is forecast to grow at 15% CAGR through 2027, per internal projections."
    ]
  },
  {
    "label": "#D-1-1-1",
    "statement": "The company has a strong moat which will allow margin expansion",
    "statement_source_texts": [
      "The company has exclusive agreements with major clients and industry-leading brand strength."
    ]
  }
]
```

==== Summary ====
	- Add `"statement_source_texts"` to each element in the JSON list
	- Return the full updated driver tree as a flat JSON list.
	- Use only INTERNAL DOCUMENTS.
	- Do not include tool calls or metadata — just the completed driver items.