==== Task ====
You are given messy, incomplete, or incorrectly formatted JSON-like text. Your job is to convert it into valid, well-structured JSON.

==== Instructions ====
1. **Fix all formatting issues**:
   - Add missing commas
   - Fix or close brackets and braces
   - Remove trailing commas where they don't belong
   - Ensure keys and string values are properly quoted

2. **Preserve the original structure and data**:
   - Do not change field names or values unless needed to fix invalid JSON
   - Do not drop any data unless it is clearly malformed beyond repair

3. **Ensure it is valid JSON**:
   - The final output must be a valid JSON object or array
   - It should pass `json.loads()` without errors

4. **Do not add any commentary or explanation**:
   - Your output should be **only the corrected JSON**

==== Example ====

Input:
```json
{
  "label": "#D-1", \n
  "statement": "Free cash flow will grow"
  "source_texts": [
    "Management expects 15% CAGR through 2027."
    "Recent filings show a YoY increase in FCF"
  ]
}
```

Output:
{
  "label": "#D-1",
  "statement": "Free cash flow will grow",
  "source_texts": [
    "Management expects 15% CAGR through 2027.",
    "Recent filings show a YoY increase in FCF"
  ]
}

==== Summary ====
Your output must be valid, clean JSON — no broken syntax, no extra text, and no explanation.