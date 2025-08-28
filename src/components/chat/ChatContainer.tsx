import React from "react";
import { ChatBubble } from "./ChatBubble";
import { useChat } from "@/hooks/use-chat";
import { cn } from "@/lib/utils";

interface ChatContainerProps {
  chatHeight: number;
  scrollTop: number;
  setScrollTop: (scrollTop: number) => void;
  messages: any[];
  scrollerRef: React.RefObject<HTMLDivElement>;
}

export const ChatContainer: React.FC<ChatContainerProps> = ({
  chatHeight,
  scrollTop,
  setScrollTop,
  messages,
  scrollerRef
}) => {
  return (
    <>
      {/* Gradient overlay at top when scrolled */}
      {scrollTop > 50 && (
        <div className="absolute top-0 left-0 right-0 h-16 bg-gradient-to-b from-[#151515] via-[#151515]/95 via-[#151515]/70 to-transparent z-30 pointer-events-none" />
      )}
      
      {/* Chat Conversation - dynamic height */}
      <div 
        className="overflow-y-auto custom-scrollbar pl-8 pr-6 pt-8"
        ref={scrollerRef}
        style={{ height: `${chatHeight}px` }}
        onScroll={(e) => {
          const target = e.target as HTMLDivElement;
          setScrollTop(target.scrollTop);
        }}
      >
        <div className="space-y-4 pr-4 pl-4 pt-4 pb-[calc(var(--dock-h)+4rem)]">
          {messages.map((msg, i) => (
            <ChatBubble key={i} role={msg.role} content={msg.content} />
          ))}
        </div>
      </div>
    </>
  );
};