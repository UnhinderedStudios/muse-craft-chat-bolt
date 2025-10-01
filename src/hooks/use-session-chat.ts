import { useCallback, useEffect } from "react";
import { useSessionManager } from "./use-session-manager";
import { useUnifiedChat } from "./use-unified-chat";
import { ChatMessage } from "@/types";

export function useSessionChat() {
  const { currentSession, updateCurrentSessionChat } = useSessionManager();

  const messages = currentSession?.chatMessages || [
    { role: "assistant" as const, content: "Hey! I can help write and generate a song. What vibe are you going for?" }
  ];

  const handleMessagesChange = useCallback((newMessages: ChatMessage[]) => {
    updateCurrentSessionChat(newMessages);
  }, [updateCurrentSessionChat]);

  const chatHook = useUnifiedChat({
    initialMessages: messages,
    onMessagesChange: handleMessagesChange
  });

  useEffect(() => {
    chatHook.updateMessages(messages);
  }, [currentSession?.id]);

  return chatHook;
}
