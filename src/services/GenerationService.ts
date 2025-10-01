import { songAPI, imageAPI, type SongDetails } from "./api";
import { logger } from "@/lib/logger";
import { TrackItem } from "@/types";

export interface GenerationProgress {
  stage: 'generating' | 'creating_covers' | 'complete' | 'error';
  progress: number;
  message: string;
}

export interface GenerationResult {
  tracks: TrackItem[];
  coverUrls: string[];
  jobId: string;
}

export class GenerationService {
  private static instance: GenerationService;

  private constructor() {}

  static getInstance(): GenerationService {
    if (!GenerationService.instance) {
      GenerationService.instance = new GenerationService();
    }
    return GenerationService.instance;
  }

  async generateSong(
    details: SongDetails,
    jobId: string,
    onProgress?: (progress: GenerationProgress) => void
  ): Promise<GenerationResult> {
    try {
      onProgress?.({
        stage: 'generating',
        progress: 10,
        message: 'Starting song generation...'
      });

      const audioUrls = await songAPI.generateSong(details, (progress) => {
        onProgress?.({
          stage: 'generating',
          progress: Math.min(progress, 80),
          message: 'Generating audio...'
        });
      });

      logger.info(`[Generation] Generated ${audioUrls.length} audio URLs for job ${jobId}`);

      onProgress?.({
        stage: 'creating_covers',
        progress: 85,
        message: 'Creating album covers...'
      });

      let coverUrls: string[] = [];
      try {
        const coverResult = await imageAPI.generateAlbumCovers(details, 3);
        coverUrls = coverResult.coverUrls;
        logger.info(`[Generation] Generated ${coverUrls.length} album covers`);
      } catch (error) {
        logger.error('[Generation] Album cover generation failed:', error);
      }

      const tracks: TrackItem[] = audioUrls.map((url, index) => ({
        id: `${jobId}-${index}`,
        url,
        title: details.title || 'Untitled Song',
        coverUrl: coverUrls[index % coverUrls.length],
        albumCoverIds: [],
        createdAt: Date.now(),
        params: details.style ? [details.style] : [],
        hasTimestamps: false,
        hasBeenPlayed: false,
        jobId
      }));

      onProgress?.({
        stage: 'complete',
        progress: 100,
        message: 'Generation complete!'
      });

      return {
        tracks,
        coverUrls,
        jobId
      };

    } catch (error) {
      logger.error('[Generation] Failed:', error);
      onProgress?.({
        stage: 'error',
        progress: 0,
        message: error instanceof Error ? error.message : 'Generation failed'
      });
      throw error;
    }
  }

  async retryGeneration(
    originalJobId: string,
    details: SongDetails,
    onProgress?: (progress: GenerationProgress) => void
  ): Promise<GenerationResult> {
    const newJobId = `${originalJobId}-retry-${Date.now()}`;
    logger.info(`[Generation] Retrying generation with new job ID: ${newJobId}`);
    return this.generateSong(details, newJobId, onProgress);
  }
}

export const generationService = GenerationService.getInstance();
