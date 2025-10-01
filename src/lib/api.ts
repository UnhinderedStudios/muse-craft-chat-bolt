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
    const trackId = params.audioId || `${params.taskId}-${params.musicIndex || 0}`;
    
    // First, check if we have cached karaoke data in Supabase
    const { data: existingKaraoke, error: fetchError } = await supabase
      .from('karaoke_lyrics')
      .select('*')
      .eq('track_id', trackId)
      .maybeSingle();
    
    if (!fetchError && existingKaraoke) {
      console.log(`🎤 Found cached karaoke data for track ${trackId}`);
      return {
        alignedWords: existingKaraoke.lyrics_data as Array<{
          word: string;
          success: boolean;
          start_s: number;
          end_s: number;
          p_align: number;
        }>,
        waveformData: existingKaraoke.waveform_data as number[],
        hootCer: existingKaraoke.hoot_cer,
        isStreamed: existingKaraoke.is_streamed
      };
    }
    
    // If not cached, fetch from edge function
    console.log(`🎤 Fetching new karaoke data for track ${trackId}`);
    const { data, error } = await supabase.functions.invoke('timestamped-lyrics', {
      body: params
    });
    
    if (error) throw new Error(error.message);
    
    // Cache the result in Supabase for future use
    try {
      await supabase
        .from('karaoke_lyrics')
        .insert({
          track_id: trackId,
          task_id: params.taskId,
          music_index: params.musicIndex || 0,
          audio_id: params.audioId,
          lyrics_data: data.alignedWords,
          waveform_data: data.waveformData,
          hoot_cer: data.hootCer,
          is_streamed: data.isStreamed
        });
      console.log(`✅ Cached karaoke data for track ${trackId}`);
    } catch (cacheError) {
      console.warn('Failed to cache karaoke data:', cacheError);
      // Don't throw - the main operation succeeded
    }
    
    return data;
  },

  async generateAlbumCovers(songDetails: SongDetails): Promise<{ 
    coverIds: string[];
    coverUrls: string[];
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
    if (!data?.images || !Array.isArray(data.images) || data.images.length === 0) {
      console.log("No images returned from edge function");
      return { coverIds: [], coverUrls: [] };
    }

    // Upload images to Supabase storage and create database records
    const coverIds: string[] = [];
    const coverUrls: string[] = [];

    for (let i = 0; i < data.images.length; i++) {
      const base64Image = data.images[i];
      if (!base64Image) continue;

      try {
        // Convert base64 to blob
        const base64Data = base64Image.replace(/^data:image\/[a-z]+;base64,/, '');
        const byteCharacters = atob(base64Data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let j = 0; j < byteCharacters.length; j++) {
          byteNumbers[j] = byteCharacters.charCodeAt(j);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'image/jpeg' });

        // Generate unique filename
        const filename = `cover-${Date.now()}-${i + 1}.jpg`;
        
        // Upload to storage
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('album-covers')
          .upload(filename, blob);

        if (uploadError) {
          console.error("❌ Upload error:", uploadError);
          continue;
        }

        // Get public URL
        const { data: urlData } = supabase.storage
          .from('album-covers')
          .getPublicUrl(filename);

        if (!urlData?.publicUrl) {
          console.error("❌ Failed to get public URL");
          continue;
        }

        // Create database record
        const { data: dbData, error: dbError } = await supabase
          .from('album_covers')
          .insert({
            track_id: 'temp', // Will be updated when applied to track
            image_url: urlData.publicUrl,
            image_type: 'album_cover',
            prompt_used: albumPrompt,
            is_selected: false
          })
          .select('id')
          .single();

        if (dbError) {
          console.error("❌ Database error:", dbError);
          continue;
        }

        coverIds.push(dbData.id);
        coverUrls.push(urlData.publicUrl);
        console.log(`✅ Uploaded cover ${i + 1}: ${dbData.id}`);
      } catch (error) {
        console.error(`❌ Error processing image ${i + 1}:`, error);
      }
    }

    return { coverIds, coverUrls };
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
    coverUrls: string[];
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
      return {
        coverUrls: data.images
      };
    }

    // If no images returned, return empty array
    return {
      coverUrls: []
    };
  },

  // Generate album covers from a custom prompt using Gemini/Imagen edge function
  async generateAlbumCoversByPrompt(prompt: string, trackId?: string, n: number = 4): Promise<{ coverIds: string[]; coverUrls: string[] }> {
    console.log("🎨 Calling edge function with prompt:", prompt);
    
    const { data, error } = await supabase.functions.invoke('generate-album-cover', {
      body: { prompt, aspectRatio: "1:1", n }
    });
    
    if (error) {
      console.error("❌ Edge function error:", error);
      throw new Error(error.message || "Failed to generate album covers");
    }
    
    console.log("✅ Edge function response:", data);
    
    if (!data?.images || !Array.isArray(data.images) || data.images.length === 0) {
      return { coverIds: [], coverUrls: [] };
    }

    // Upload images to Supabase storage and create database records
    const coverIds: string[] = [];
    const coverUrls: string[] = [];

    for (let i = 0; i < data.images.length; i++) {
      const base64Image = data.images[i];
      if (!base64Image) continue;

      try {
        // Convert base64 to blob using fetch (more efficient for large images)
        const response = await fetch(base64Image);
        const blob = await response.blob();

        // Generate unique filename
        const filename = `cover-${Date.now()}-${i + 1}.jpg`;
        
        // Upload to storage
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('album-covers')
          .upload(filename, blob);

        if (uploadError) {
          console.error("❌ Upload error:", uploadError);
          continue;
        }

        // Get public URL
        const { data: urlData } = supabase.storage
          .from('album-covers')
          .getPublicUrl(filename);

        if (!urlData?.publicUrl) {
          console.error("❌ Failed to get public URL");
          continue;
        }

        // Create database record
        const { data: dbData, error: dbError } = await supabase
          .from('album_covers')
          .insert({
            track_id: trackId || 'temp',
            image_url: urlData.publicUrl,
            image_type: 'album_cover',
            prompt_used: prompt,
            is_selected: false
          })
          .select('id')
          .single();

        if (dbError) {
          console.error("❌ Database error:", dbError);
          continue;
        }

        coverIds.push(dbData.id);
        coverUrls.push(urlData.publicUrl);
        console.log(`✅ Uploaded cover ${i + 1}: ${dbData.id}`);
      } catch (error) {
        console.error(`❌ Error processing image ${i + 1}:`, error);
      }
    }

    return { coverIds, coverUrls };
  },

  // Generate artist images with optional Face Swap on a locked image
  async generateArtistImages(
    prompt: string,
    backgroundHex?: string,
    characterCount?: number,
    isRealistic?: boolean,
    facialReference?: string,
    lockedImage?: string,
    clothingReference?: string,
    primaryClothingType?: string
  ): Promise<{ images: string[]; enhancedPrompt?: string; debug?: any }> {
    // Generate client-side request ID for tracking
    const clientRequestId = `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // PRIORITY: Direct face swap on locked image (no Gemini generation)
    if (facialReference && lockedImage) {
      console.log(`🔒👤 [${clientRequestId}] Direct face swap on locked image`);
      try {
        // Convert locked image URL/data to File
        const targetResp = await fetch(lockedImage);
        if (!targetResp.ok) throw new Error('Failed to load locked image');
        const targetBlob = await targetResp.blob();
        const targetFile = new File([targetBlob], 'locked-target.jpg', { type: targetBlob.type || 'image/jpeg' });

        // Convert facial reference data URL to file
        const facialResp = await fetch(facialReference);
        const facialBlob = await facialResp.blob();
        const facialFile = new File([facialBlob], 'facial-reference.jpg', { type: 'image/jpeg' });

        const formData = new FormData();
        formData.append('targetImage', targetFile);
        formData.append('facialReference', facialFile);

        const apiResponse = await fetch(`${SUPABASE_URL}/functions/v1/direct-faceswap`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
            'apikey': SUPABASE_PUBLISHABLE_KEY,
          },
          body: formData
        });

        if (!apiResponse.ok) {
          const errorData = await apiResponse.json().catch(() => ({}));
          console.error(`❌ [${clientRequestId}] Direct face swap failed:`, apiResponse.status, errorData);
          throw new Error(errorData.error || `Direct face swap failed (${apiResponse.status})`);
        }

        const data = await apiResponse.json();
        console.log(`✅ [${clientRequestId}] Direct face swap successful`, data);
        return { images: data.images || [], enhancedPrompt: data.enhancedPrompt, debug: data.debug };
      } catch (error) {
        console.error(`❌ [${clientRequestId}] Error in direct face swap:`, error);
        throw error;
      }
    }

    // If facial reference is provided (but no locked image), use two-stage Face Swap v3
    if (facialReference) {
      console.log(`🔄 [${clientRequestId}] Using MagicAPI Face Swap v3 (two-stage)`);
      
      try {
        // Load the fixed reference image
        const response = await fetch('/reference-frame.png');
        if (!response.ok) {
          throw new Error('Failed to load reference image');
        }
        const blob = await response.blob();
        const referenceFile = new File([blob], 'reference-frame.png', { type: blob.type });
        
        // Convert facial reference data URL to file
        const facialResponse = await fetch(facialReference);
        const facialBlob = await facialResponse.blob();
        const facialFile = new File([facialBlob], 'facial-reference.jpg', { type: 'image/jpeg' });
        
        console.log(`📤 [${clientRequestId}] Sending FormData to face swap API:`, {
          targetImageType: referenceFile.type,
          targetImageSize: referenceFile.size,
          sourceImageType: facialFile.type,
          sourceImageSize: facialFile.size
        });
        
        // Use FormData for face swap
        const formData = new FormData();
        // Default safety prompt if none provided (API requires a prompt)
        const safePrompt = (prompt && prompt.trim().length > 0)
          ? prompt
          : 'Generate a clean artist portrait matching the composition. Swap the face to the uploaded person only. No props.';
        formData.append('prompt', safePrompt);
        formData.append('image', referenceFile); // staging image
        formData.append('facialReference', facialFile); // source image for face
        if (backgroundHex) {
          formData.append('backgroundHex', backgroundHex);
        }
        formData.append('characterCount', (characterCount || 1).toString());
        
        const apiResponse = await fetch(`${SUPABASE_URL}/functions/v1/faceswap-image-v3`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
            'apikey': SUPABASE_PUBLISHABLE_KEY,
          },
          body: formData
        });
        
        if (!apiResponse.ok) {
          const errorData = await apiResponse.json().catch(() => ({}));
          console.error(`❌ [${clientRequestId}] Face swap failed:`, apiResponse.status, errorData);
          throw new Error(errorData.error || `Failed to perform face swap (${apiResponse.status})`);
        }
        
        const data = await apiResponse.json();
        console.log(`✅ [${clientRequestId}] Face swap successful:`, data);
        
        return {
          images: data.images || [],
          enhancedPrompt: data.enhancedPrompt,
          debug: data.debug
        };
      } catch (error) {
        console.error(`❌ [${clientRequestId}] Error in face swap:`, error);
        throw error;
      }
    }
    
    // Fallback to original Gemini generation when no facial reference
    console.log(`🎨 [${clientRequestId}] Using Gemini for regular artist generation (no facial reference)`);
    
    // Add automatic prompt prefix for artist generation (safer language)
    const promptPrefix = "Match the overall framing, camera angle, and lighting style of the reference image. Generate a new, original character from scratch that is completely different from the alien creature in the reference image. The character should have a dynamic pose and it should be clear that the character is a music artist. No objects such as guitars, mics, chairs or anything else at all can be present in the image. Generate a new character: ";
    
    // Add style prefix based on toggle state
    const stylePrefix = isRealistic ? "Realistic: " : "Realistic 3D anime stylized: ";
    
    const fullPrompt = promptPrefix + stylePrefix + prompt;
    
    console.log(`🎨 [${clientRequestId}] Calling Gemini with enhanced prompt:`, fullPrompt);
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
      
      // Add clothing reference if provided
      if (clothingReference) {
        // Convert clothing reference data URL to file
        const clothingResp = await fetch(clothingReference);
        const clothingBlob = await clothingResp.blob();
        const clothingFile = new File([clothingBlob], 'clothing-reference.jpg', { type: 'image/jpeg' });
        formData.append('clothingReference', clothingFile);
        console.log(`🎽 [${clientRequestId}] Adding clothing reference to FormData`);
        
        // Add primary clothing type if available
        if (primaryClothingType) {
          formData.append('primaryClothingType', primaryClothingType);
          console.log(`🏷️ [${clientRequestId}] Adding primary clothing type: ${primaryClothingType}`);
        }
      }
      
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

  async modifyLockedImage(
    imageUrl: string, 
    modification: string, 
    clothingReference?: string,
    primaryClothingType?: string,
    colorReference?: string
  ): Promise<{ images: string[] }> {
    
    if (clothingReference || colorReference) {
      // Use FormData for clothing/color mode
      const formData = new FormData();
      formData.append('imageUrl', imageUrl);
      formData.append('modification', modification);
      
      if (clothingReference) {
        // Convert data URL to File for clothing reference
        const response = await fetch(clothingReference);
        const blob = await response.blob();
        const file = new File([blob], 'clothing-reference.jpg', { type: blob.type });
        formData.append('clothingReference', file);
        
        if (primaryClothingType) {
          formData.append('primaryClothingType', primaryClothingType);
        }
      }

      if (colorReference) {
        // Convert data URL to File for color reference
        const response = await fetch(colorReference);
        const blob = await response.blob();
        const file = new File([blob], 'color-reference.png', { type: blob.type });
        formData.append('colorReference', file);
      }

      const apiResponse = await fetch(`https://afsyxzxwxszujnsmukff.supabase.co/functions/v1/modify-locked-image`, {
        method: 'POST',
        body: formData
      });

      if (!apiResponse.ok) {
        const errorData = await apiResponse.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `Failed to modify locked image (${apiResponse.status})`);
      }

      return await apiResponse.json();
    } else {
      // Use JSON for regular mode
      const { data, error } = await supabase.functions.invoke('modify-locked-image', {
        body: {
          imageUrl,
          modification
        }
      });
      
      if (error) throw new Error(error.message);
      return data;
    }
  },
};
