==== Task ====
You are given a DRIVER TREE that explains why a fund invested in a company.

Your task has **two parts**:

1. **Deepen the tree** by generating new driver nodes using “why” reasoning. For each original statement, ask: “Why does the fund believe this?” and add new, deeper drivers that expand on the logic. You MUST ask these questions to the tools you have.

2. **Make the tree more specific** by asking "how", "how much", "which segment", "which geograph". You MUST ask these questions to the tools you have.

You must use the **TOOLS** to obtain the information on which you can base your answer.

==== Tool Usage ====
Use the tools with input that is:
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

  1. For each original statement, use the tools witn questions like: 
      - “Why does the fund believe statement A?”
      - "Which information in the document does support statement A?"
      - "Which statements could support statement A? Are they indeed mentioned in the tool(s)?"
    to get more information.
  2. When you get the tool results, add the new drivers correctly to the tree and recursively use this approach to add new and deper drivers.

A good driver tree will have 10-15 drivers on 2-4 levels.

-- Example 1 --

1. Existing statement:
 - The free cash flow will grow

  Questions to use:
  - What factors contribute to free cash flow?
  - Why does the fund believe free cash flow will grow?

2. Tool returns:
 - "... as the company is doing large investements ... we believe maintenance CAPEX to be at x% ... "
 - "... we are bullish on the ability for the company to grow its revenue at x% per year ..."

  New sub-statements:
  - Maintenance CAPEX is lower than expected at x%
  - Revenue will grow at x% per year


-- Example 2 --

1. Existing statement:
 - Revenue will grow at x% per year

Questions to use:
 - What factors contribute to growth of revenue?

2. Tool returns:
 - "... driven by growth in the end markets X and Y  ... "
 - "... the company is gaining market share ..."

  New sub-statements:
  - The company is gaining market share
  - The end-markets in X and Y are growing at x%  

==== Specify tree approach ==== 

After you have deepened the tree, you can specifiy the tree. 

  1. For each original statement, use your tools with questions like:
    - "Is this stament specific enough?"
    - "If I am sceptical, what would I want to know more to believe this statement"?
    - "How?", "How much?", "Wich segement?", "Which period?", "Which geography?"
  2. Update the drivers to make them more specific.

s
A statement is more specific if it is:
  - measurable, meaning it has a
      - number with unit: e.g. $500B
      - scope: e.g. sales in EU
        note: scope can be geographical, over product, over business units
      - (potentially) date or period: e.g. for Q1 2025
  - uses more concrete language (using comparissons, examples, better vocabulary)

-- Example --

1. Existing statement
   The market is growing

   Questions to use
     - By how much is the market growing?
     - Which market is growing?
     - Is the market growing in all geographies and products?

2. Tool input
   ... We see especially that the electronics end-market is growing .. globally this is x% per year. ... especially India is driving growth with y% per year.

   New statment
   The electronics end-market is growing at x% per year, driven by India (growing at y% per year)
   


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
	- Step 1: Deepen the tree as explained in the approach 
  - Step 2: Specify the tree as explained in the approach
	- Return the full updated driver tree as a flat JSON list.