==== Task ====
You are given a DRIVER TREE that explains why a fund invested in a company.

Your task has **two parts**:

1. **Deepen the tree** by generating new driver nodes using “why” reasoning. 

2. **Specify the tree** by ensuring the statements are specific.

You must use the **TOOLS** to obtain the information on which you can base your answer.

==== Tool Usage ====
The tools you have at your disposal semantic and keyword retrievers. They will send you better
information when your input is:
  - rich: it is a full question, and contains enough context
  - specific: it is focused on one topic

GOOD TOOL INPUTS:
- "Why does the fund believe operating margins will expand?"
- "What supports the claim that free cash flow will grow?"
- "What evidence underpins margin expansion expectations?"

BAD TOOL INPUTS:
- "cash flow"
- "inrease?"
- "tell me more"

==== Deepen tree approach ==== 
You can use the following approach to deepen the tree:

  1. For each original statement, reason with questions like: 
      - “Why does the fund believe statement A?”
      - "Which information in the document does support statement A?"
      - "Which statements could support statement A? Are they indeed mentioned in the tool(s)?"
  2. Use your TOOLS to get the information with which you can answer the questions you reasoned about. 
  3. Recursively use this approach to add new and deper drivers.

A good driver tree will have 10-15 drivers on 2-4 levels.

==== Specify tree approach ==== 

  1. For each original statement, reason with questions like:
    - "Is this stament specific enough?"
    - "If I am sceptical, what would I want to know more to believe this statement"?
    - "How?", "How much?", "Wich segement?", "Which period?", "Which geography?"
  2. Use your TOOLS to get the information with which you can answer the questions you reasoned about. 
  3. Update the drivers to make them more specific.


A statement is more specific if it is:
  - measurable, meaning it has a
      - number with unit: e.g. $500B
      - scope: e.g. sales in EU
        note: scope can be geographical, over product, over business units
      - (potentially) date or period: e.g. for Q1 2025
  - uses more concrete language (using comparissons, examples, better vocabulary)


==== Output Format (Flat JSON) ====
Return the driver tree as a **flat JSON list**. Each item must include:

- `"label"`: Driver ID (e.g., "#D-1", "#D-1-1", "#D-1-1-2")
- `"statement"`: A concise explanation of the investment belief
- `"statement_source_texts"`: A list of direct source text excerpts from INTERNAL DOCUMENTS. This should be a COPY of the EXACT text you saw.

Each deeper-level driver should follow the hierarchy in the label (e.g., a reason that explains "#D-1" should be labeled "#D-1-1").

Example output format:
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
	- Step 1: Add new, deeper drivers using “why” reasoning. 
  - Step 2: Make the drivers more specific.
	- Return the full updated driver tree as a flat JSON list.