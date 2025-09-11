import { useState, useRef, useEffect } from "react";
import { ChatMessage, FileAttachment } from "@/types";
import { api } from "@/lib/api";
import { useSessionManager } from "./use-session-manager";

export function useSessionChat() {
  const { currentSession, updateCurrentSessionChat } = useSessionManager();
  const [input, setInput] = useState("");
  const [scrollTop, setScrollTop] = useState(0);
  const scrollerRef = useRef<HTMLDivElement>(null);

  // Get messages from current session
  const messages = currentSession?.chatMessages || [
    { role: "assistant", content: "Hey! I can help write and generate a song. What vibe are you going for?" }
  ];

  useEffect(() => {
    scrollerRef.current?.scrollTo({ 
      top: scrollerRef.current.scrollHeight, 
      behavior: "smooth" 
    });
  }, [messages]);

  const sendMessage = async (message: string, systemPrompt: string, attachments?: FileAttachment[]) => {
    if (!message.trim() && !(attachments && attachments.length)) return;

    // Attempt to extract text from supported binary documents on the client
    let appendedText = "";
    try {
      if (attachments && attachments.length > 0) {
        const { extractTextFromAttachments } = await import("@/lib/extractTextFromFiles");
        appendedText = await extractTextFromAttachments(attachments);
      }
    } catch (e) {
      console.error("Attachment text extraction failed:", e);
    }

    const userMessage: ChatMessage = { 
      role: "user", 
      content: appendedText ? `${message}\n\n${appendedText}` : message,
      attachments
    };
    const newMessages = [...messages, userMessage];
    
    // Update session with new messages
    updateCurrentSessionChat(newMessages);
    setInput("");

    try {
      const response = await api.chat(newMessages, systemPrompt);
      const assistantMessage: ChatMessage = { 
        role: "assistant", 
        content: response.content 
      };
      const finalMessages = [...newMessages, assistantMessage];
      
      // Update session with assistant response
      updateCurrentSessionChat(finalMessages);
      return assistantMessage;
    } catch (error) {
      console.error("Chat error:", error);
      return null;
    }
  };

  return {
    messages,
    input,
    setInput,
    sendMessage,
    scrollTop,
    setScrollTop,
    scrollerRef
  };
}