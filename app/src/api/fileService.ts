// Service to handle file operations and communication with the backend API
import { WorkspaceFile, ChatMessage } from "./types";
import { client } from "./client";
// Mock API service for now - will be replaced with actual API calls
class FileService {
  private chatHistory: ChatMessage[] = [];

  // Add files to the workspace
  addFiles(filePaths: string[], workspaceId: string): Promise<WorkspaceFile[]> {
    return Promise.all(
      filePaths.map((path) => client.post("/file/load", { path, workspaceId }))
    );
  }

  importFile(filePath: string, workspaceId: string): Promise<WorkspaceFile> {
    return client.post("/file/load", { path: filePath, workspaceId });
  }

  importFolder(
    folderPath: string,
    workspaceId: string
  ): Promise<WorkspaceFile[]> {
    return client.post("/folder/load", { path: folderPath, workspaceId });
  }

  // Get all files in the workspace
  async getFiles(workspaceId?: string): Promise<WorkspaceFile[]> {
    const files = await client.get(`/workspace/files/${workspaceId}`);
    const statuses = await Promise.all(
      files.map((file) => client.get(`/file/get/status/${file.id}`))
    );
    return files.map((file, index) => ({
      ...file,
      status: statuses[index],
    }));
  }

  deleteFile(file: WorkspaceFile): Promise<boolean> {
    return client.delete(
      `/file/delete/${file.id}?workspace_id=${file.workspaceId}`
    );
  }

  getFileData(file: WorkspaceFile): Promise<ArrayBuffer> {
    return client.getBuffer(
      `/file/get/${file.id}?workspace_id=${file.workspaceId}`
    );
  }

  // Send a message to the AI assistant
  async sendMessage(content: string): Promise<ChatMessage> {
    // Add user message
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      sender: "user",
      content,
      timestamp: new Date(),
    };

    this.chatHistory.push(userMessage);

    // Mock AI response - would be replaced with actual API call
    // For demo, we have some predefined responses
    let responseContent = `I'm analyzing your question: "${content}"`;

    if (content.toLowerCase().includes("financial")) {
      responseContent =
        "The financial reports show a 5% increase in revenue compared to the previous quarter, with significant growth in the technology sector.";
    } else if (content.toLowerCase().includes("market")) {
      responseContent =
        "Market analysis indicates a potential shift towards sustainable investments, with ESG-focused companies outperforming the broader market by 2.3% in Q1.";
    } else if (content.toLowerCase().includes("competitor")) {
      responseContent =
        "Competitor earnings reports reveal a slowdown in their core business segments, with a 3% decline in retail operations but 7% growth in digital services.";
    }

    const aiMessage: ChatMessage = {
      id: (Date.now() + 1).toString(),
      sender: "assistant",
      content: responseContent,
      timestamp: new Date(),
    };

    this.chatHistory.push(aiMessage);
    return aiMessage;
  }

  // Get chat history
  async getChatHistory(): Promise<ChatMessage[]> {
    return this.chatHistory;
  }

  // Run contrast analysis between two files
  async runContrastAnalysis(file1Id: string, file2Id: string): Promise<any> {
    // This would call your API to perform the analysis
    // Return mock data based on the selected files

    const files = await this.getFiles();
    const file1 = files.find((f) => f.id === file1Id);
    const file2 = files.find((f) => f.id === file2Id);

    if (!file1 || !file2) {
      throw new Error("Files not found");
    }

    // Custom response based on file names for demo purposes
    if (file1.name.includes("Financial") && file2.name.includes("Competitor")) {
      return {
        similarities: [
          "Both reports cover the Q1 2025 period",
          "Both mention global market conditions affecting results",
          "Both discuss supply chain challenges",
        ],
        differences: [
          {
            file1: "Reports revenue growth of 5% year-over-year",
            file2: "Shows revenue decline of 3% in retail operations",
            context: "Financial Performance",
          },
          {
            file1: "Highlights expansion in Asian markets",
            file2: "Focuses on consolidation in European regions",
            context: "Geographic Strategy",
          },
          {
            file1: "Projects continued growth in Q2",
            file2: "Warns of potential challenges in upcoming quarters",
            context: "Future Outlook",
          },
        ],
      };
    } else if (file1.name.includes("Market") || file2.name.includes("Market")) {
      return {
        similarities: [
          "Both discuss industry trends",
          "Both mention regulatory impacts on the sector",
          "Both reference technological innovations",
        ],
        differences: [
          {
            file1: "Focuses on macro-economic factors",
            file2: "Emphasizes company-specific performance metrics",
            context: "Analysis Scope",
          },
          {
            file1: "Covers multiple industry segments",
            file2: "Detailed analysis of specific business units",
            context: "Coverage Breadth",
          },
          {
            file1: "Includes long-term 5-year projections",
            file2: "Primarily focused on quarterly performance",
            context: "Time Horizon",
          },
        ],
      };
    } else {
      // Generic response
      return {
        similarities: [
          "Both documents are PDF reports",
          "Both contain financial data and analysis",
          "Both reference industry benchmarks",
        ],
        differences: [
          {
            file1: `${file1.name} focuses more on quantitative metrics`,
            file2: `${file2.name} includes more qualitative assessments`,
            context: "Analysis Approach",
          },
          {
            file1: `${
              file1.name
            } was created ${new Date().toLocaleDateString()}`,
            file2: `${
              file2.name
            } was created ${new Date().toLocaleDateString()}`,
            context: "Creation Date",
          },
          {
            file1: `${file1.name} is structured as a formal report`,
            file2: `${file2.name} follows a presentation format`,
            context: "Document Structure",
          },
        ],
      };
    }
  }
}

export const fileService = new FileService();
