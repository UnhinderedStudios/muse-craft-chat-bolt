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
  async chat(
    messages: ChatMessage[],
    systemOrOptions?: string | { system?: string; model?: string; temperature?: number }
  ): Promise<{ content: string }> {
    const payload: any = { messages };
    if (typeof systemOrOptions === 'string') {
      payload.system = systemOrOptions;
    } else if (typeof systemOrOptions === 'object' && systemOrOptions) {
      if (systemOrOptions.system) payload.system = systemOrOptions.system;
      if (systemOrOptions.model) payload.model = systemOrOptions.model;
      if (typeof systemOrOptions.temperature === 'number') payload.temperature = systemOrOptions.temperature;
    }

    const resp = await fetch(`${FUNCTIONS_BASE}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
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
    // Determine the source for the prompt in priority order: title > lyrics > style
    let source = "fallback";
    let content = "A cinematic, realistic musical album cover without humans or text";
    let chatInstruction = "";

    if (songDetails.title?.trim()) {
      source = "title";
      content = songDetails.title.trim();
      chatInstruction = `Create a simple 1 sentence prompt for an image generation tool for a musical album cover based on this song title. Keep it cinematic and realistic, do not show humans or text in it. Do not use any parameter instructions such as AR16:9.\n\nSong Title: ${content}`;
    } else if (songDetails.lyrics?.trim()) {
      source = "lyrics";
      content = songDetails.lyrics.trim();
      chatInstruction = `Summarize the song lyrics into a simple 1 sentence prompt for an image generation tool for a musical album cover. Keep it cinematic and realistic, do not show humans or text in it. Do not use any parameter instructions such as AR16:9.\n\nSong Lyrics: ${content}`;
    } else if (songDetails.style?.trim()) {
      source = "style";
      content = songDetails.style.trim();
      chatInstruction = `Create a simple 1 sentence prompt for an image generation tool for a musical album cover based on this music style. Keep it cinematic and realistic, do not show humans or text in it. Do not use any parameter instructions such as AR16:9.\n\nMusic Style: ${content}`;
    }

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

  async startWavConversion(params: { audioId?: string; taskId?: string; musicIndex?: number }): Promise<{ jobId: string }> {
    const resp = await fetch(`${FUNCTIONS_BASE}/suno/wav`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    return handle(resp);
  },

  async pollWav(jobId: string): Promise<{ status: "pending" | "ready" | "error"; wavUrl?: string; error?: string; blob?: Blob }> {
    const resp = await fetch(`${FUNCTIONS_BASE}/suno/wav?jobId=${encodeURIComponent(jobId)}`);
    
    // Check if response is a WAV file download
    const contentType = resp.headers.get('content-type');
    if (contentType === 'audio/wav' && resp.ok) {
      const blob = await resp.blob();
      return { status: "ready", blob };
    }
    
    return handle(resp);
  },

  async convertToWav(params: { audioId?: string; taskId?: string; musicIndex?: number }): Promise<string> {
    const { jobId } = await this.startWavConversion(params);
    
    // Poll with exponential backoff and extended timeout for callback-driven approach
    const maxAttempts = 60; // ~3 minutes max to accommodate callback delays
    let attempt = 0;
    
    while (attempt < maxAttempts) {
      // Shorter initial delays, longer maximum delay
      await new Promise(resolve => setTimeout(resolve, Math.min(500 * Math.pow(1.1, attempt), 3000)));
      
      const result = await this.pollWav(jobId);
      
      if (result.status === "ready") {
        if (result.blob) {
          // Create download URL from blob and trigger download
          const downloadUrl = URL.createObjectURL(result.blob);
          const link = document.createElement('a');
          link.href = downloadUrl;
          link.download = `track-${jobId}.wav`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(downloadUrl);
          return "Downloaded";
        } else if (result.wavUrl) {
          return result.wavUrl;
        }
      }
      
      if (result.status === "error") {
        throw new Error(result.error || "WAV conversion failed");
      }
      
      attempt++;
    }
    
    throw new Error("WAV conversion timed out after 3 minutes. The conversion may still be processing - try again later.");
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

  // Generate album covers from a custom prompt using Gemini/Imagen edge function
  async generateAlbumCoversByPrompt(prompt: string, n: number = 4): Promise<string[]> {
    const response = await fetch(`${FUNCTIONS_BASE}/generate-album-cover`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, aspectRatio: "1:1", n }),
    });
    const data = await handle(response);
    if (data.images && Array.isArray(data.images)) {
      return data.images as string[];
    }
    return [];
  },
};
