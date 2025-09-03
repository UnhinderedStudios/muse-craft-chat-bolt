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

  async generateAlbumCovers(songDetails: SongDetails): Promise<{ 
    cover1: string; 
    cover2: string; 
    debug?: {
      inputSource: string;
      inputContent: string;
      chatPrompt: string;
      imagenPrompt: string;
      imagenParams: any;
      rawResponse: any;
    }
  }> {
    // Title-only prompt logic (strict)
    const title = (songDetails.title || "").trim();
    if (!title) {
      throw new Error("Album cover generation requires a non-empty title.");
    }
    const source = "title";
    const content = title;
    const chatInstruction = `Create a single, concise prompt for an image-generation model to produce a square musical album cover based ONLY on this song title. Cinematic and realistic. No humans, no typography, no logos.\n\nSong Title: ${content}`;

    console.log(`🎨 generateAlbumCovers - Using ${source}:`, content);
    
    // Get the album cover prompt from ChatGPT
    const promptResponse = await this.chat([
      {
        role: "user",
        content: chatInstruction
      }
    ]);

    const albumPrompt = promptResponse.content;
    console.log("🤖 ChatGPT generated prompt:", albumPrompt);

    const requestParams = { prompt: albumPrompt, aspectRatio: "1:1", n: 2 };
    console.log("📡 Sending to Imagen:", requestParams);

    // Generate album covers with new response format
    const response = await fetch(`${FUNCTIONS_BASE}/generate-album-cover`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestParams),
    });

    const data = await handle(response);
    console.log("🖼️ Imagen response:", data);

    const debug = {
      inputSource: source,
      inputContent: content,
      chatPrompt: chatInstruction,
      imagenPrompt: albumPrompt,
      imagenParams: requestParams,
      rawResponse: data
    };

    // Handle response format with base64 images array
    if (data.images && Array.isArray(data.images) && data.images.length > 0) {
      return {
        cover1: data.images[0] || '',
        cover2: data.images[1] || data.images[0] || '', // Fallback to first image if only one generated
        debug
      };
    }

    // If no images returned, return empty strings
    return {
      cover1: '',
      cover2: '',
      debug
    };
  },

  async testAlbumCoverHealth(): Promise<{
    ok: boolean;
    geminiKey: boolean;
    keyLength: number;
    model: string;
    jwtRequired: boolean;
  }> {
    const response = await fetch(`${FUNCTIONS_BASE}/generate-album-cover/health`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    return handle(response);
  },

  async testAlbumCover(songDetails?: SongDetails): Promise<{ 
    cover1: string; 
    cover2: string; 
    debug?: {
      inputSource: string;
      inputContent: string;
      chatPrompt: string;
      imagenPrompt: string;
      imagenParams: any;
      rawResponse: any;
    }
  }> {
    if (songDetails && (songDetails.title || songDetails.lyrics || songDetails.style)) {
      console.log("🧪 testAlbumCover - Using provided song details:", songDetails);
      return this.generateAlbumCovers(songDetails);
    }
    
    const testPrompt = "A vibrant abstract digital art album cover with swirling colors, musical notes floating in space, cosmic background, no humans, artistic and modern style";
    console.log("🧪 testAlbumCover - Using test prompt:", testPrompt);
    
    const response = await fetch(`${FUNCTIONS_BASE}/generate-album-cover`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: testPrompt }),
    });

    const data = await handle(response);
    console.log("Test album cover response:", data);

    const debug = {
      inputSource: "fallback",
      inputContent: "test prompt (no song details provided)",
      chatPrompt: "Direct test prompt (no ChatGPT processing)",
      imagenPrompt: testPrompt,
      imagenParams: { prompt: testPrompt },
      rawResponse: data
    };

    if (data.images && Array.isArray(data.images) && data.images.length > 0) {
      const covers = {
        cover1: data.images[0] || '',
        cover2: data.images[1] || data.images[0] || '',
        debug
      };
      console.log("Parsed covers:", covers);
      return covers;
    }

    // If no images returned, return empty strings
    const emptyCovers = {
      cover1: '',
      cover2: '',
      debug
    };
    console.log("No images returned:", emptyCovers);
    return emptyCovers;
  },
};
