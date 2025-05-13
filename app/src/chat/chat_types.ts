import { ChatSourceComment } from "@/api/comment_types";
import { Timestamp } from "@/api/common_api_types";
import { ComponentData, ReadonlyComponentData } from "@/core/ui_state";

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
  messageType?: "reading_message" | "answer_message" | "planning_message";
}

export interface MessagePair {
  id: string;
  userMessage: ChatMessage;
  assistantMessage: ChatMessage | null;
  readingMessages: ChatMessage[];
  planningMessage: ChatMessage | null;
  answerCount: number;
  showReadingMessages: boolean;
  readingMessageBuffer: string; // Buffer to accumulate reading message content
}

export interface Thread {
  id: string;
  title: string;
  lastMessageAt: string;
  createdAt: Timestamp;
}

export enum ThreadSavedState {
  UI_ONLY = "ui_only",
  SAVED_NO_MESSAGES = "saved_no_messages",
  SAVED_WITH_MESSAGES = "saved_with_messages",
}

export class ThreadState {
  savedState: ThreadSavedState;
}

export type ThreadComponentData = ComponentData<Thread, ThreadState>;

export type ReadonlyThread = ReadonlyComponentData<Thread, ThreadState>;
