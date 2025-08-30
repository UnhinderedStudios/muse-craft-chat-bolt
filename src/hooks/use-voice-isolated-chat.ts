import { useState, useRef, useCallback } from "react";
import { ChatMessage, FileAttachment } from "@/types";
import { api } from "@/lib/api";

export function useVoiceIsolatedChat() {
  const [voiceMessages, setVoiceMessages] = useState<ChatMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);

  const sendVoiceMessage = useCallback(async (message: string, systemPrompt: string, attachments?: FileAttachment[]) => {
    if (!message.trim() && !(attachments && attachments.length)) return null;

    const userMessage: ChatMessage = { 
      role: "user", 
      content: message,
      attachments
    };
    
    const newMessages = [...voiceMessages, userMessage];
    setVoiceMessages(newMessages);
    setIsProcessing(true);

    try {
      const response = await api.chat(newMessages, systemPrompt);
      const assistantMessage: ChatMessage = { 
        role: "assistant", 
        content: response.content 
      };
      
      const finalMessages = [...newMessages, assistantMessage];
      setVoiceMessages(finalMessages);
      setIsProcessing(false);
      
      return assistantMessage;
    } catch (error) {
      console.error("Voice chat error:", error);
      setIsProcessing(false);
      return null;
    }
  }, [voiceMessages]);

  const clearVoiceMessages = useCallback(() => {
    setVoiceMessages([]);
    setIsProcessing(false);
  }, []);

  return {
    voiceMessages,
    sendVoiceMessage,
    clearVoiceMessages,
    isProcessing,
    scrollerRef
  };
}