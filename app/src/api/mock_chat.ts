export interface MockMessage {
  userMessage: string;
  assistantMessage: string;
  readingMessages?: string[];
}

export const mockConversations: MockMessage[] = [
  {
    userMessage: "Does the new earnings call confirm last quarter's hypotheses?",
    assistantMessage: "I analysed the report and contrassted it to your investment theses from last quarter.\nI found that <summary> but difference on <detail>.",
    readingMessages: [
      "Generating a plan...",
      "Setting up workflow based on the plan...",
      "Downloading latest sell-side report...",
      "Extracting the CAPEX and investment in working capital to compute FCFs...",
      "Comparing new KPIs to last quarter's hypotheses...",
    ]
  },
  {
    userMessage: "Facts",
    assistantMessage: `
While Apple saw only a slight dip in China sales, other U.S. hardware makers were hit much harder:

- **Cisco**: China revenue plunged **25% YoY**.  
- **Nvidia**: Sales dropped **13%**, with a **$5.5B charge** tied to export bans.  
- **AMD**: Took a **$1.5B write-down** on stranded GPU inventory.  
- **Intel**: Lost **$1B in revenue** from Huawei license revocation.  
- **Overall impact**: U.S. firms lost **$7B in China sales** in 1H 2025; over **$25B remains at risk** for FY 2026.
`,
    readingMessages: [
      "Let's see how Apple's sales in China compare to other U.S. hardware firms.",
      "Searching Bloomberg terminal for iPad sales...",
      "Searching Bloomberg terminal for iPad sales..."
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
