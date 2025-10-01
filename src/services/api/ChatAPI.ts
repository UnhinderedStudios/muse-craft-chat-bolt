import { supabase } from "@/integrations/supabase/client";

export type ChatMessage = { role: "user" | "assistant"; content: string };

export interface ChatOptions {
  system?: string;
  model?: string;
  temperature?: number;
}

export class ChatAPI {
  async chat(
    messages: ChatMessage[],
    systemOrOptions?: string | ChatOptions
  ): Promise<{ content: string }> {
    const payload: Record<string, unknown> = { messages };

    if (typeof systemOrOptions === 'string') {
      payload.system = systemOrOptions;
    } else if (typeof systemOrOptions === 'object' && systemOrOptions) {
      if (systemOrOptions.system) payload.system = systemOrOptions.system;
      if (systemOrOptions.model) payload.model = systemOrOptions.model;
      if (typeof systemOrOptions.temperature === 'number') {
        payload.temperature = systemOrOptions.temperature;
      }
    }

    const { data, error } = await supabase.functions.invoke('chat', {
      body: payload
    });

    if (error) throw new Error(error.message);
    return data;
  }
}

export const chatAPI = new ChatAPI();
