import { ChatSourceComment } from "@/api/comment_types";

export interface ChatSourceCommentGroup {
  filePath: string;
  chatSourceComments: ChatSourceComment[];
}

export interface ChatMessage {
  id: string;
  sender: "user" | "assistant";
  content: string;
  timestamp?: Date;
  chatSourceCommentGroups: ChatSourceCommentGroup[];
  messageType?: "reading_message" | "answer_message";
}
