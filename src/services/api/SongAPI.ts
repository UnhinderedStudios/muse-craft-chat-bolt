import { supabase, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";

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

export interface SongGenerationResult {
  status: string;
  audioUrl?: string;
  audioUrls?: string[];
  error?: string;
}

export interface MusicGenerationDetails {
  response: {
    sunoData: Array<{
      id: string;
      audioUrl: string;
      musicIndex: number;
    }>;
  };
  statusRaw: string;
  taskId: string;
}

export class SongAPI {
  async startSong(details: SongDetails): Promise<{ jobId: string }> {
    const { data, error } = await supabase.functions.invoke('suno', {
      body: details
    });

    if (error) throw new Error(error.message);
    return data;
  }

  async pollSong(jobId: string): Promise<SongGenerationResult> {
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
  }

  async getMusicGenerationDetails(jobId: string): Promise<MusicGenerationDetails> {
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
  }

  async generateSong(details: SongDetails, onProgress?: (progress: number) => void): Promise<string[]> {
    const { jobId } = await this.startSong(details);
    logger.info(`[SongAPI] Started generation with jobId: ${jobId}`);

    const POLL_INTERVAL_MS = 5000;
    const MAX_WAIT_MS = 10 * 60 * 1000;
    const maxAttempts = Math.ceil(MAX_WAIT_MS / POLL_INTERVAL_MS);

    let attempts = 0;
    const startTime = Date.now();

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));

      const result = await this.pollSong(jobId);
      attempts++;

      if (onProgress) {
        const elapsed = Date.now() - startTime;
        const progress = Math.min((elapsed / MAX_WAIT_MS) * 90, 90);
        onProgress(progress);
      }

      if (result.status === "complete" && result.audioUrls) {
        logger.info(`[SongAPI] Generation complete: ${result.audioUrls.length} songs`);
        return result.audioUrls;
      }

      if (result.status === "error") {
        throw new Error(result.error || "Generation failed");
      }
    }

    throw new Error("Generation timed out");
  }
}

export const songAPI = new SongAPI();
