import React from "react";
import { ChatBubble } from "./ChatBubble";
import { useChat } from "@/hooks/use-chat";
import { cn } from "@/lib/utils";

interface ChatContainerProps {
  messages: any[];
  input: string;
  setInput: (input: string) => void;
  onSend: () => void;
  busy: boolean;
  isAnalyzingImage: boolean;
  isReadingText: boolean;
  attachedFiles: any[];
  onFileUpload: () => void;
  removeFile: (index: number) => void;
  chatHeight: number;
}

export const ChatContainer: React.FC<ChatContainerProps> = ({
  messages,
  chatHeight
}) => {
  return (
    <div 
      className="overflow-y-auto custom-scrollbar pl-8 pr-6 pt-8"
      style={{ height: `${chatHeight}px` }}
    >
      <div className="space-y-4 pr-4 pl-4 pt-4 pb-32">
        {messages.map((msg, i) => (
          <ChatBubble key={i} role={msg.role} content={msg.content} />
        ))}
      </div>
    </div>
  );
};