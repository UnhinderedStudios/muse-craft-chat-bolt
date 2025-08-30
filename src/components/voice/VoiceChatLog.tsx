import React from "react";
import { cn } from "@/lib/utils";
import { ChatMessage } from "@/types";

interface VoiceChatLogProps {
  messages: ChatMessage[];
}

export const VoiceChatLog: React.FC<VoiceChatLogProps> = ({ messages }) => {
  return (
    <div className="h-full bg-gray-900/10 border border-white/20 rounded-xl p-4 overflow-hidden">
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
                    ? "bg-accent-primary text-white ml-4 border-white/30"
                    : "bg-gray-800/80 text-text-primary mr-4 border-white/20"
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

      {/* Cyber Grid Lines */}
      <div className="absolute inset-0 pointer-events-none opacity-10">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-accent-primary to-transparent h-px top-1/4" />
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-accent-primary to-transparent h-px top-3/4" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-accent-primary to-transparent w-px left-1/4" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-accent-primary to-transparent w-px left-3/4" />
      </div>
    </div>
  );
};