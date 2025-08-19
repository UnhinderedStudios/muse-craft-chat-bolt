import React from "react";
import { cn } from "@/lib/utils";
import { ChatBubbleProps } from "@/types";
import { parseSongRequest } from "@/lib/parseSongRequest";
import { ChatSongPreview } from "./ChatSongPreview";

export const ChatBubble: React.FC<ChatBubbleProps> = ({ role, content }) => {
  const isUser = role === "user";
  
  // For assistant messages, check if content contains a song request
  const songRequest = !isUser ? parseSongRequest(content) : null;
  
  // Remove the JSON from the content if we found a song request
  let displayContent = content;
  if (songRequest) {
    displayContent = content
      .replace(/```(?:json)?\s*\{[\s\S]*?\}\s*```/gi, '')
      .replace(/\{"song_request"[\s\S]*?\}\}/g, '')
      .trim();
  }
  
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
        {songRequest ? (
          <div className="space-y-4">
            {displayContent && (
              <p className="whitespace-pre-wrap">{displayContent}</p>
            )}
            <ChatSongPreview songRequest={songRequest} />
          </div>
        ) : (
          <p className="whitespace-pre-wrap">{content}</p>
        )}
      </div>
    </div>
  );
};
