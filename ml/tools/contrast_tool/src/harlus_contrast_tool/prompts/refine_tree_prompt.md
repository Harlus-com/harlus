==== Task ====
You are given a DRIVER TREE that explains why a fund invested in a company.

Your task has **two parts**:

1. **Enrich the existing drivers** by adding a new field called `"statement_source_texts"` to each node. This should contain direct source excerpts from INTERNAL DOCUMENTS that support the statement.

2. **Deepen the tree** by generating new driver nodes using “why” reasoning. For each original statement, ask: “Why does the fund believe this?” and add new, deeper drivers that expand on the logic.

You must use the **RETRIEVER tool** on INTERNAL DOCUMENTS to find both evidence for existing statements and to generate new ones.

==== Tool Usage ====
Only use the RETRIEVER tool.
Only use INTERNAL DOCUMENTS.

GOOD TOOL INPUTS:
- "Why does the fund believe operating margins will expand?"
- "What supports the claim that free cash flow will grow?"
- "What evidence underpins margin expansion expectations?"

BAD TOOL INPUTS:
- "Summarize the documents"
- "What's going on?"
- "Tell me more"

Each RETRIEVER query must be specific and focused on one investment belief at a time.

==== Output Format (Flat JSON) ====
Return the driver tree as a **flat JSON list**. Each item must include:

- `"label"`: Driver ID (e.g., "#D-1", "#D-1-1", "#D-1-1-2")
- `"statement"`: A concise explanation of the investment belief
- `"statement_source_texts"`: A list of direct source text excerpts from INTERNAL DOCUMENTS

Each deeper-level driver should follow the hierarchy in the label (e.g., a reason that explains "#D-1" should be labeled "#D-1-1").

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
	- Step 1: Add statement_evidence to all existing drivers using the RETRIEVER tool.
	- Step 2: Add new, deeper drivers using “why” reasoning. Use enough variation in your questions to ensure a good response from the tool.
	- Return the full updated driver tree as a flat JSON list.
	- Use only INTERNAL DOCUMENTS.
	- Do not use subdrivers.
	- Do not include tool calls or metadata — just the completed driver items.