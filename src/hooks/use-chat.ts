import { useState, useRef, useEffect } from "react";
import { ChatMessage } from "@/types";
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

  const sendMessage = async (message: string, systemPrompt: string) => {
    if (!message.trim()) return;

    const userMessage: ChatMessage = { role: "user", content: message };
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
    } catch (error) {
      console.error("Chat error:", error);
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