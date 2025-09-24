import { supabase, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "@/integrations/supabase/client";

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

    const { data, error } = await supabase.functions.invoke('chat', {
      body: payload
    });
    
    if (error) throw new Error(error.message);
    return data;
  },

  async startSong(details: SongDetails): Promise<{ jobId: string }> {
    const { data, error } = await supabase.functions.invoke('suno', {
      body: details
    });
    
    if (error) throw new Error(error.message);
    return data;
  },

  async pollSong(jobId: string): Promise<{ status: string; audioUrl?: string; audioUrls?: string[]; error?: string }> {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/suno?jobId=${jobId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
        'apikey': SUPABASE_PUBLISHABLE_KEY,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Edge Function returned a non-2xx status code`);
    }
    
    return await response.json();
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
    const response = await fetch(`${SUPABASE_URL}/functions/v1/suno?jobId=${jobId}&details=true`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
        'apikey': SUPABASE_PUBLISHABLE_KEY,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Edge Function returned a non-2xx status code`);
    }
    
    return await response.json();
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
    const { data, error } = await supabase.functions.invoke('timestamped-lyrics', {
      body: params
    });
    
    if (error) throw new Error(error.message);
    return data;
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
    const { data, error } = await supabase.functions.invoke('generate-album-cover', {
      body: requestParams
    });

    if (error) {
      console.error("🖼️ Album cover generation error:", error);
      throw new Error(error.message);
    }
    
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
    const { data, error } = await supabase.functions.invoke('generate-album-cover/health');
    
    if (error) throw new Error(error.message);
    return data;
  },

  async startWavConversion(params: { audioId?: string; taskId?: string; musicIndex?: number }): Promise<{ jobId: string }> {
    const { data, error } = await supabase.functions.invoke('suno/wav', {
      body: params
    });
    
    if (error) throw new Error(error.message);
    return data;
  },

  async pollWav(jobId: string): Promise<{ status: "pending" | "ready" | "error"; wavUrl?: string; error?: string; blob?: Blob }> {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/suno/wav?jobId=${jobId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
        'apikey': SUPABASE_PUBLISHABLE_KEY,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Edge Function returned a non-2xx status code`);
    }
    
    return await response.json();
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
    
    const { data, error } = await supabase.functions.invoke('generate-album-cover', {
      body: { prompt: testPrompt }
    });

    if (error) {
      console.error("Test album cover error:", error);
      throw new Error(error.message);
    }
    
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
    console.log("🎨 Calling edge function with prompt:", prompt);
    
    const { data, error } = await supabase.functions.invoke('generate-album-cover', {
      body: { prompt, aspectRatio: "1:1", n }
    });
    
    if (error) {
      console.error("❌ Edge function error:", error);
      throw new Error(error.message || "Failed to generate album covers");
    }
    
    console.log("✅ Edge function response:", data);
    
    if (data?.images && Array.isArray(data.images)) {
      return data.images as string[];
    }
    return [];
  },

  // Generate artist images using Gemini 2.5 Flash with fixed reference image
  async generateArtistImages(prompt: string, backgroundHex?: string, characterCount?: number): Promise<{ images: string[]; enhancedPrompt?: string; debug?: any }> {
    // Generate client-side request ID for tracking
    const clientRequestId = `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Add automatic prompt prefix for artist generation (safer language)
    const promptPrefix = "Match the overall framing, camera angle, and lighting style of the reference image. Generate a new, original character from scratch that is completely different from the alien creature in the reference image. The character should have a dynamic pose and it should be clear that the character is a music artist. No objects such as guitars, mics, chairs or anything else at all can be present in the image. Generate a new character: ";
    const fullPrompt = promptPrefix + prompt;
    
    console.log(`🎨 [${clientRequestId}] Calling artist generator with enhanced prompt:`, fullPrompt);
    console.log(`🔄 [${clientRequestId}] Using fixed reference image from /reference-frame.png`);
    
    try {
      // Load the fixed reference image
      const response = await fetch('/reference-frame.png');
      if (!response.ok) {
        throw new Error('Failed to load reference image');
      }
      const blob = await response.blob();
      const referenceFile = new File([blob], 'reference-frame.png', { type: blob.type });
      
      console.log(`📤 [${clientRequestId}] Sending FormData with fixed reference image:`, {
        type: referenceFile.type,
        size: referenceFile.size,
        name: referenceFile.name
      });
      
      // Use FormData for image upload
      const formData = new FormData();
      formData.append('prompt', fullPrompt);
      formData.append('image', referenceFile);
      if (backgroundHex) {
        formData.append('backgroundHex', backgroundHex);
      }
      // Always send characterCount, default to 1 if not specified
      formData.append('characterCount', (characterCount || 1).toString());
      
      const apiResponse = await fetch(`${SUPABASE_URL}/functions/v1/generate-artist-image`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
          'apikey': SUPABASE_PUBLISHABLE_KEY,
        },
        body: formData
      });
      
      if (!apiResponse.ok) {
        const errorData = await apiResponse.json().catch(() => ({}));
        console.error(`❌ [${clientRequestId}] Artist generation failed:`, apiResponse.status, errorData);
        
        // Handle specific error cases with retry logic
        if (apiResponse.status === 502 || apiResponse.status === 503) {
          console.log(`🔄 [${clientRequestId}] Server error ${apiResponse.status}, will retry...`);
          throw new Error(`Server temporarily unavailable (${apiResponse.status}). Please try again in a moment.`);
        }
        
        throw new Error(errorData.error || `Failed to generate artist images (${apiResponse.status})`);
      }
      
      const data = await apiResponse.json();
      console.log(`✅ [${clientRequestId}] Artist generation successful:`, data);
      
      return {
        images: data.images || [],
        enhancedPrompt: data.enhancedPrompt,
        debug: data.debug
      };
    } catch (error) {
      console.error(`❌ [${clientRequestId}] Error loading reference image or generating:`, error);
      throw error;
    }
  },
};
