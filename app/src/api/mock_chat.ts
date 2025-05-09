export interface MockMessage {
  userMessage: string;
  assistantMessage: string;
  readingMessages?: string[];
}

export const mockConversations: MockMessage[] = [
  {
    userMessage: "Let's analyse the impact of the latest sell-side report on Apple's FCF!",
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
    userMessage: "Do any sell-side reports confirm this?",
    assistantMessage: "The capital of France is Paris. It's one of the most populous cities in Europe and serves as the country's major economic and cultural center.",
    readingMessages: [
      "Let's see if other reports confirm the decreasing iPad sales.",
      "Searching Bloomberg terminal for iPad sales...",
      "Comparing KPIs to current values in financial_model.xls..."
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
