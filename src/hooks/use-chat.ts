import { useState, useRef, useEffect } from "react";
import { ChatMessage, FileAttachment } from "@/types";
import { api } from "@/lib/api";
// System prompt will be passed from parent component

export function useChat(systemPrompt: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: "Hey! I can help write and generate a song. What vibe are you going for?" },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [isAnalyzingImage, setIsAnalyzingImage] = useState(false);
  const [isReadingText, setIsReadingText] = useState(false);
  const [scrollTop, setScrollTop] = useState(0);
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollerRef.current?.scrollTo({ 
      top: scrollerRef.current.scrollHeight, 
      behavior: "smooth" 
    });
  }, [messages]);

  const sendMessage = async (message: string, attachments?: FileAttachment[]) => {
    if (!message.trim() && !(attachments && attachments.length)) return;

    setBusy(true);
    setIsAnalyzingImage(!!attachments?.some(a => a.type.startsWith('image/')));
    setIsReadingText(!!attachments?.some(a => !a.type.startsWith('image/')));

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
      setBusy(false);
      setIsAnalyzingImage(false);
      setIsReadingText(false);
      return response.content;
    } catch (error) {
      console.error("Chat error:", error);
      setBusy(false);
      setIsAnalyzingImage(false);
      setIsReadingText(false);
      return null;
    }
  };

  return {
    messages,
    input,
    setInput,
    busy,
    isAnalyzingImage,
    isReadingText,
    sendMessage,
    scrollTop,
    setScrollTop,
    scrollerRef
  };
}