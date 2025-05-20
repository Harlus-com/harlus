==== Task ====
You are given a DRIVER TREE representing the fund’s original investment thesis.

Your job is to assess **how the LATEST EXTERNAL DOCUMENTS** impact each driver.

For every driver:
1. Use the **RETRIEVER tool** to query the **LATEST EXTERNAL DOCUMENTS** (e.g., earnings calls, annual reports).
2. Find evidence in the **RETRIEVER tool** results that either supports, contradicts, or qualifies the statement in the driver.
3. Update each driver node with your findings using the fields below.

Do not use information already present in the tree. Your job is to challenge the tree by using the retriever tools.

==== Output Format ====
For each driver, keep the original JSON structure, and add the following fields:

- "evidence": A short summary of what the external evidence says about the driver’s statement.
- "evidence_source_texts":  A list of direct text excerpts from EXTERNAL DOCUMENTS which support your evidence. You should USE EXACTLY the same text as provided by the retriever tool.
- "verdict": One of "support", "contradict", "neutral", or "mixed".
- "verdict_statement": A short explanation of why you chose that verdict.

==== Example Output ====
```json
{
  "label": "#D-1-1-1-3",
  "statement": "The company leads in R&D investments in markets X and Y",
  "statement_source_texts": [
    "R&D spend in markets X and Y exceeded $1.3B in 2024, growing at 18% YoY.",
    "CEO highlighted focus on innovation in adjacent verticals as a key long-term differentiator."
  ],
  "evidence": "The Q2 earnings call confirmed continued R&D focus, with $50B announced for a new facility in market X.",
  "evidence_source_texts": [
    "We are announcing over $50B in a new plant in Arizona to research the latest generation..."
  ],
  "verdict": "support",
  "verdict_statement": "The new investment confirms continued leadership in R&D as stated in the original thesis."
}
```

==== Retrieval Guidelines ====
Use the **RETRIEVER tool** for every driver — you must **verify each driver independently**.

Your queries should:
- Be specific
- Use synonymous phrases
- Target the LATEST EXTERNAL DOCUMENTS only (e.g. earnings calls, investor materials)

GOOD QUERIES:
- "Did the Q2 2025 earnings call mention gross margin trends?"
- "What was said about capital investment in market X?"
- "Are there updates on free cash flow growth?"

BAD QUERIES:
- "Summarize the document"
- "What’s going on?"
- "Tell me everything about the company"

If no useful evidence is found, acknowledge that and try alternate phrasing or related queries.

==== Rules ====
- Do not rely on prior information in the driver tree
- Do not include tool calls or metadata in the output
- Only include updated driver items with the new fields

==== Summary ====
- Use RETRIEVER to verify each driver using external data
- Add "evidence", "evidence_source_texts", "verdict", and "verdict_statement" to each driver
- Output must stay in flat JSON format