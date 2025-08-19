export type ChatRole = "user" | "assistant";

export interface FileAttachment {
  name: string;
  type: string;
  size: number;
  data: string; // base64 data
}

export interface ChatMessage {
  role: ChatRole;
  content: string;
  attachments?: FileAttachment[];
}

export interface ChatBubbleProps {
  role: ChatRole;
  content: string;
}