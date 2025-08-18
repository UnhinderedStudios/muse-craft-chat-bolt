export type ChatRole = "user" | "assistant";

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface ChatBubbleProps {
  role: ChatRole;
  content: string;
}