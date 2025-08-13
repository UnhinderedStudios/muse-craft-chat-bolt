export type ChatMessage = { role: "user" | "assistant"; content: string };

export type SongDetails = {
  title?: string;
  genre?: string;
  mood?: string;
  tempo?: string;
  language?: string;
  vocals?: "male" | "female" | "duet" | "none" | string;
  style?: string;
  lyrics?: string;
};

const FUNCTIONS_BASE = "https://afsyxzxwxszujnsmukff.supabase.co/functions/v1";

async function handle(resp: Response) {
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(text || `${resp.status} ${resp.statusText}`);
  }
  return resp.json();
}

export const api = {
  async chat(messages: ChatMessage[], system?: string): Promise<{ content: string }> {
    const resp = await fetch(`${FUNCTIONS_BASE}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages, system }),
    });
    return handle(resp);
  },

  async startSong(details: SongDetails): Promise<{ jobId: string }> {
    const resp = await fetch(`${FUNCTIONS_BASE}/suno`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(details),
    });
    return handle(resp);
  },

  async pollSong(jobId: string): Promise<{ status: string; audioUrl?: string; audioUrls?: string[]; error?: string }> {
    const resp = await fetch(`${FUNCTIONS_BASE}/suno?jobId=${encodeURIComponent(jobId)}`);
    return handle(resp);
  },
};
