import React from "react";
import { cn } from "@/lib/utils";
import { ChatMessage } from "@/types";

interface VoiceChatLogProps {
  messages: ChatMessage[];
}

export const VoiceChatLog: React.FC<VoiceChatLogProps> = ({ messages }) => {
  return (
    <div className="h-full border border-white/20 rounded-xl p-4 overflow-hidden" style={{ backgroundColor: '#33343630' }}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-text-primary">Voice Chat</h3>
        <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
      </div>

      <div className="space-y-3 h-full overflow-y-auto custom-scrollbar">
        {messages.length === 0 ? (
          <div className="text-center text-text-secondary text-sm py-8">
            <p>Start speaking to begin conversation</p>
          </div>
        ) : (
          messages.map((message, index) => (
            <div
              key={index}
              className={cn(
                "flex",
                message.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              <div
                className={cn(
                  "max-w-[80%] px-3 py-2 rounded-lg text-xs leading-relaxed border",
                  message.role === "user"
                    ? "bg-white text-gray-800 ml-4 border-gray-300"
                    : "bg-gray-100 text-gray-800 mr-4 border-gray-300"
                )}
              >
                <div className="flex items-center space-x-2 mb-1">
                  <div
                    className={cn(
                      "w-2 h-2 rounded-full",
                      message.role === "user" ? "bg-white/60" : "bg-accent-primary"
                    )}
                  />
                  <span className="text-xs opacity-70 font-medium">
                    {message.role === "user" ? "You" : "AI"}
                  </span>
                </div>
                <p className="text-xs leading-relaxed">{message.content}</p>
              </div>
            </div>
          ))
        )}
      </div>

    </div>
  );
};