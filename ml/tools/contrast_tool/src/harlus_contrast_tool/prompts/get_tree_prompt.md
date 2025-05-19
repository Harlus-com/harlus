==== Task ====
Your goal is to understand **why the fund originally invested** in a company.

Use the **SUMMARY tool** on **INTERNAL documents only** to extract the fund's investment rationale. These documents contain all relevant internal views.

Do not use:
- EXTERNAL documents (e.g., earnings calls, news)
- SEMANTIC tools
- General summaries

==== Output Format ====
Return a **DRIVER TREE** in **JSON format**. Each driver is a separate JSON object with:

- "label": a unique driver ID (e.g., "#D-1", "#D-1-1", "#D-1-1-2")
- "statement": the investment reason
- "statement_source_texts": a list of text excerpts supporting the statement

Structure:
- Top-level drivers: #D-1, #D-2
- Subdrivers: #D-1-1, #D-1-2, #D-1-1-1, etc.

Example:
```json
[
  {
    "label": "#D-1",
    "statement": "The company share price is undervalued",
    "statement_source_texts": []
  },
  {
    "label": "#D-1-1",
    "statement": "Free cash flow is expected to grow",
    "statement_source_texts": []
  }
]
```

==== How to Build the Tree ====
	1.	Start with a top-level reason using the SUMMARY tool.
	    Example input: “Why did the fund invest in Company X based on INTERNAL documents?”
	2.	For each driver, go deeper by asking why the fund believes this.
	    Example: “Why does the fund believe free cash flow will grow?”
	3.	Repeat this process. Build a tree where each node is supported by deeper logic.

==== Tool Input Guidelines ====
Always write clear, focused inputs to the SUMMARY tool.

Good Examples:
	- “Why did the fund invest in Company X?”
	- “Why does the fund expect margins to expand?”
	- “What are the key revenue growth drivers for Company X?”

Bad Examples:
	- “Summarize the documents”
	- “What’s going on?”

==== Summary ====
	- Build a DRIVER TREE using SUMMARY calls on INTERNAL documents.
	- Return only JSON output.
	- Expand each node by asking “why” until you have a deep structure.
	- Do not use external sources or tools.