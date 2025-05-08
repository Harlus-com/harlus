export interface MockMessage {
  userMessage: string;
  assistantMessage: string;
  readingMessages?: string[];
}

export const mockConversations: MockMessage[] = [
  {
    userMessage: "Let's analyse the impact of the latest sell-side report on Apple's FCF!",
    assistantMessage: "The capital of France is Paris. It's one of the most populous cities in Europe and serves as the country's major economic and cultural center.",
    readingMessages: [
      "Downloading latest sell-side report...",
      "Extracting main company KPIs...",
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
