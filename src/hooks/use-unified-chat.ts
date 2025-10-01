import { useState, useRef, useEffect } from "react";
import { ChatMessage, FileAttachment } from "@/types";
import { api } from "@/lib/api";
import { extractTextFromAttachments } from "@/lib/extractTextFromFiles";
import { logger } from "@/lib/logger";

interface UseChatOptions {
  initialMessages?: ChatMessage[];
  onMessagesChange?: (messages: ChatMessage[]) => void;
}

export function useUnifiedChat(options: UseChatOptions = {}) {
  const {
    initialMessages = [
      { role: "assistant", content: "Hey! I can help write and generate a song. What vibe are you going for?" }
    ],
    onMessagesChange
  } = options;

  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [scrollTop, setScrollTop] = useState(0);
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollerRef.current?.scrollTo({
      top: scrollerRef.current.scrollHeight,
      behavior: "smooth"
    });
  }, [messages]);

  useEffect(() => {
    if (onMessagesChange) {
      onMessagesChange(messages);
    }
  }, [messages, onMessagesChange]);

  const sendMessage = async (
    message: string,
    systemPrompt: string,
    attachments?: FileAttachment[]
  ): Promise<ChatMessage | null> => {
    if (!message.trim() && !(attachments && attachments.length)) return null;

    let appendedText = "";
    if (attachments && attachments.length > 0) {
      try {
        appendedText = await extractTextFromAttachments(attachments);
      } catch (e) {
        logger.error("Attachment text extraction failed:", e);
      }
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
      const finalMessages = [...newMessages, assistantMessage];
      setMessages(finalMessages);
      return assistantMessage;
    } catch (error) {
      logger.error("Chat error:", error);
      return null;
    }
  };

  const updateMessages = (newMessages: ChatMessage[]) => {
    setMessages(newMessages);
  };

  return {
    messages,
    input,
    setInput,
    sendMessage,
    updateMessages,
    scrollTop,
    setScrollTop,
    scrollerRef
  };
}
