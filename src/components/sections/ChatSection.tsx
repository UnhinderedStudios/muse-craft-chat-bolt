import React from "react";
import { ChatContainer } from "@/components/chat/ChatContainer";
import { ChatInput } from "@/components/chat/ChatInput";
import { ResizableContainer } from "@/components/layout/ResizableContainer";
import { type ChatMessage, type FileAttachment } from "@/types";

interface ChatSectionProps {
  messages: ChatMessage[];
  input: string;
  setInput: (value: string) => void;
  busy: boolean;
  isAnalyzingImage: boolean;
  isReadingText: boolean;
  attachedFiles: FileAttachment[];
  chatHeight: number;
  isResizing: boolean;
  handleMouseDown: (e: React.MouseEvent) => void;
  onSend: () => void;
  handleFileUpload: () => void;
  removeFile: (index: number) => void;
  randomizeAll: () => void;
  scrollerRef: React.RefObject<HTMLDivElement>;
}

export const ChatSection: React.FC<ChatSectionProps> = ({
  messages,
  input,
  setInput,
  busy,
  isAnalyzingImage,
  isReadingText,
  attachedFiles,
  chatHeight,
  isResizing,
  handleMouseDown,
  onSend,
  handleFileUpload,
  removeFile,
  randomizeAll,
  scrollerRef
}) => {
  return (
    <ResizableContainer
      isResizing={isResizing}
      handleMouseDown={handleMouseDown}
      className="h-full"
    >
      <div className="h-full flex flex-col">
        <ChatContainer
          messages={messages}
          chatHeight={chatHeight}
          scrollTop={0}
          setScrollTop={() => {}}
          scrollerRef={scrollerRef}
        />
        <ChatInput
          input={input}
          setInput={setInput}
          onSend={onSend}
          onRandomize={randomizeAll}
          disabled={busy}
        />
      </div>
    </ResizableContainer>
  );
};