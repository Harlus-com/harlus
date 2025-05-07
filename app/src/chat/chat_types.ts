import { ChatSourceComment } from "@/api/comment_types";

export interface ChatSourceCommentGroup {
  filePath: string;
  chatSourceComments: ChatSourceComment[];
}

export interface ChatMessage {
  id: string;
  sender: "user" | "assistant";
  content: string;
  timestamp?: string;
  chatSourceCommentGroups: ChatSourceCommentGroup[];
  messageType?: "reading_message" | "answer_message";
}

export interface MessagePair {
  id: string;
  userMessage: ChatMessage;
  assistantMessage: ChatMessage | null;
  readingMessages: ChatMessage[];
  answerCount: number;
  showReadingMessages: boolean;
  readingMessageBuffer: string; // Buffer to accumulate reading message content
}

export interface Thread {
  id: string;
  title: string;
  lastMessageAt: string;
}
