import { useState, useRef, useEffect } from "react";
import { ChatMessage, FileAttachment } from "@/types";
import { api } from "@/lib/api";
// System prompt will be passed from parent component

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [scrollTop, setScrollTop] = useState(0);
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollerRef.current?.scrollTo({ 
      top: scrollerRef.current.scrollHeight, 
      behavior: "smooth" 
    });
  }, [messages]);

  const sendMessage = async (message: string, systemPrompt: string, attachments?: FileAttachment[]) => {
    if (!message.trim() && !(attachments && attachments.length)) return;

    // Attempt to extract text from supported binary documents on the client
    // to provide the model with actual content (PDF, DOCX, RTF). We keep
    // text files for the server to decode to avoid duplication.
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
    setMessages(newMessages);
    setInput("");

    try {
      const response = await api.chat(newMessages, systemPrompt);
      const assistantMessage: ChatMessage = { 
        role: "assistant", 
        content: response.content 
      };
      setMessages([...newMessages, assistantMessage]);
      return assistantMessage; // Return the AI response
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