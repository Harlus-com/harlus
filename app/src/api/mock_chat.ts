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
    assistantMessage: "Apple has been relatively resilient in China despite harsh U.S.-China tech tariffs, reporting only a 2% decline in Greater China revenue for the March quarter. In contrast, other major U.S. hardware firms—like Cisco (-25%) and Nvidia (-13%)—have seen significantly larger sales drops. Apple stands out for weathering the tariff and export-control storm more effectively than peers hit with multi-billion dollar losses and inventory write-offs.",
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
      "Updating model.xls...",
      "Updating report.docx..."
    ]
  }

  // Add more mock conversations as needed
];

// Helper function to find a matching response
export function findMockResponse(userMessage: string): MockMessage | undefined {
  // Simple exact match for now - you can make this more sophisticated
  return mockConversations.find(conv => 
    conv.userMessage.toLowerCase() === userMessage.toLowerCase()
  );
}
