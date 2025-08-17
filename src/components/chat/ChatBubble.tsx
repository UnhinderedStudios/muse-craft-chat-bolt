import React from "react";
import { cn } from "@/lib/utils";

export type ChatRole = "user" | "assistant";

interface ChatBubbleProps {
  role: ChatRole;
  content: string;
}

export const ChatBubble: React.FC<ChatBubbleProps> = ({ role, content }) => {
  const isUser = role === "user";
  return (
    <div
      className={cn(
        "w-full flex",
        isUser ? "justify-end" : "justify-start"
      )}
    >
      <div
        className={cn(
          "max-w-[85%] px-4 py-3 leading-relaxed",
          "rounded-[16px]",
          isUser
            ? "chat-bubble-user text-text-primary"
            : "chat-bubble-assistant text-text-primary"
        )}
      >
        <p className="whitespace-pre-wrap">{content}</p>
      </div>
    </div>
  );
};
