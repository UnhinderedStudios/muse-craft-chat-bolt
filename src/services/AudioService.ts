import { TrackItem } from "@/types";
import { logger } from "@/lib/logger";

export class AudioService {
  private static instance: AudioService;
  private audioElements: Map<string, HTMLAudioElement> = new Map();

  private constructor() {}

  static getInstance(): AudioService {
    if (!AudioService.instance) {
      AudioService.instance = new AudioService();
    }
    return AudioService.instance;
  }

  pauseAllExcept(exceptTrackId?: string): void {
    this.audioElements.forEach((audio, trackId) => {
      if (trackId !== exceptTrackId && !audio.paused) {
        audio.pause();
        logger.debug(`[Audio] Paused track: ${trackId}`);
      }
    });
  }

  registerAudioElement(trackId: string, audio: HTMLAudioElement): void {
    this.audioElements.set(trackId, audio);
  }

  unregisterAudioElement(trackId: string): void {
    this.audioElements.delete(trackId);
  }

  getAudioElement(trackId: string): HTMLAudioElement | undefined {
    return this.audioElements.get(trackId);
  }

  createTrackId(jobId: string, index: number, audioId?: string): string {
    return audioId || `${jobId}-${index}`;
  }

  formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  getCurrentTrackProgress(trackId: string): { currentTime: number; duration: number; progress: number } | null {
    const audio = this.audioElements.get(trackId);
    if (!audio) return null;

    return {
      currentTime: audio.currentTime,
      duration: audio.duration,
      progress: audio.duration > 0 ? (audio.currentTime / audio.duration) * 100 : 0
    };
  }

  seekTo(trackId: string, time: number): boolean {
    const audio = this.audioElements.get(trackId);
    if (!audio) return false;

    audio.currentTime = time;
    return true;
  }

  setVolume(trackId: string, volume: number): boolean {
    const audio = this.audioElements.get(trackId);
    if (!audio) return false;

    audio.volume = Math.max(0, Math.min(1, volume));
    return true;
  }

  cleanupUnusedAudio(currentTracks: TrackItem[]): void {
    const currentTrackIds = new Set(currentTracks.map(t => t.id));
    const audioToRemove: string[] = [];

    this.audioElements.forEach((_, trackId) => {
      if (!currentTrackIds.has(trackId)) {
        audioToRemove.push(trackId);
      }
    });

    audioToRemove.forEach(trackId => {
      const audio = this.audioElements.get(trackId);
      if (audio) {
        audio.pause();
        audio.src = '';
      }
      this.audioElements.delete(trackId);
      logger.debug(`[Audio] Cleaned up unused audio: ${trackId}`);
    });
  }
}

export const audioService = AudioService.getInstance();
