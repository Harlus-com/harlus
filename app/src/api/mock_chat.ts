export interface MockMessage {
  userMessage: string;
  assistantMessage: string;
  readingMessages?: string[];
}

export const mockConversations: MockMessage[] = [
  {
    userMessage: "Does the new earnings call confirm last quarter's hypotheses?",
    assistantMessage: `
1. The call confirmed that **“Apple Intelligence” is already boosting demand**.  
2. **Services delivered a record $26.6 billion in revenue (+12 % YoY)** and a **75.7 % gross margin**.  
3. **Greater China remains a headwind** (-2 % YoY, roughly flat ex-FX), but the risk is moderating rather than worsening.  
4. Management flagged potential **$900 million tariff costs** and heavy capital outlays.

I contrasted both documents in the following analysis:
`,
    readingMessages: [
      "Generating a plan...",
      "Extracting last quarter's hypotheses from updates/25-Q1.pdf...",
      "Comparing each hypothesis to the new earnings call...",
    ]
  },
  {
    userMessage: "how",
    assistantMessage: `
While Apple saw only a slight dip in China sales, other U.S. hardware makers were hit much harder:

- **Cisco**: China revenue plunged **25% YoY**.  
- **Nvidia**: Sales dropped **13%**, with a **$5.5B charge** tied to export bans.  
- **AMD**: Took a **$1.5B write-down** on stranded GPU inventory.  
- **Intel**: Lost **$1B in revenue** from Huawei license revocation.
`,
    readingMessages: [
      "Searching for sell-side reports on Cisco, Nvidia, AMD, and Intel...",
    ]
  },
  {
    userMessage: "Reduce the growth estimates in my valuation model and adapt my report to the new facts",
    assistantMessage: "I made suggestions in the valuation model. Let me know if you'd like to discuss them.",
    readingMessages: [
      "Updating models/valuation.xls...",
      "Updating updates/25-Q2.docx..."
    ]
  }

  // Add more mock conversations as needed
];

// Helper function to find a matching response
export function findMockResponse(userMessage: string): MockMessage | undefined {
  // Simple exact match for now - you can make this more sophisticated
  return mockConversations.find(conv => {
    const firstWord = conv.userMessage.trim().split(/\s+/)[0].toLowerCase();
    const inputFirstWord = userMessage.trim().split(/\s+/)[0].toLowerCase();
    return firstWord === inputFirstWord;
  });
}
