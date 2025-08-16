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

  async getMusicGenerationDetails(jobId: string): Promise<{
    response: {
      sunoData: Array<{
        id: string;
        audioUrl: string;
        musicIndex: number;
      }>;
    };
    statusRaw: string;
    taskId: string;
  }> {
    const resp = await fetch(`${FUNCTIONS_BASE}/suno?jobId=${encodeURIComponent(jobId)}&details=true`);
    return handle(resp);
  },

  async getTimestampedLyrics(params: { taskId: string; audioId?: string; musicIndex?: number }): Promise<{ 
    alignedWords: Array<{
      word: string;
      success: boolean;
      start_s: number;
      end_s: number;
      p_align: number;
    }>;
    waveformData?: number[];
    hootCer?: number;
    isStreamed?: boolean;
  }> {
    const resp = await fetch(`${FUNCTIONS_BASE}/timestamped-lyrics`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    return handle(resp);
  },

  async generateAlbumCovers(lyrics: string): Promise<{ cover1: string; cover2: string }> {
    // First, get the album cover prompt from ChatGPT
    const promptResponse = await this.chat([
      {
        role: "user",
        content: `Summarise the song lyrics as if you were making a cool vibrant album cover that shouldn't have any humans being shown in it, this is meant to be a prompt for Google Imagen 4, do not use any parameter instructions such as AR16:9, I only want the prompt text.\n\nLyrics:\n${lyrics}`
      }
    ]);

    const albumPrompt = promptResponse.content;

    // Generate two unique album covers using the same prompt
    const [cover1Response, cover2Response] = await Promise.all([
      fetch(`${FUNCTIONS_BASE}/generate-album-cover`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: albumPrompt }),
      }),
      fetch(`${FUNCTIONS_BASE}/generate-album-cover`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: albumPrompt }),
      })
    ]);

    const [cover1Data, cover2Data] = await Promise.all([
      handle(cover1Response),
      handle(cover2Response)
    ]);

    return {
      cover1: `data:image/png;base64,${cover1Data.imageData}`,
      cover2: `data:image/png;base64,${cover2Data.imageData}`
    };
  },
};
