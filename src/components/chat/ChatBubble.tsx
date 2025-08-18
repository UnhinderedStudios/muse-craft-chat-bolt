import React from "react";
import { cn } from "@/lib/utils";
import { ChatBubbleProps } from "@/types";

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
          "rounded-[16px] bg-[#000000]",
          isUser
            ? "border border-white text-text-primary shadow-[0_0_20px_rgba(255,255,255,0.3)]"
            : "border border-accent-primary text-text-primary shadow-[0_0_20px_rgba(202,36,116,0.4)]"
        )}
      >
        <p className="whitespace-pre-wrap">{content}</p>
      </div>
    </div>
  );
};
