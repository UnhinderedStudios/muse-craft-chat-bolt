import { SongDetails } from "./song";
import { TimestampedWord } from "./audio";

export interface TrackVersion {
  url: string;
  audioId: string;
  musicIndex: number;
  words: TimestampedWord[];
  hasTimestamps?: boolean;
  timestampError?: string;
}

export interface ActiveGeneration {
  id: string;
  jobId: string;
  progress: number;
  status: 'starting' | 'polling' | 'complete' | 'failed';
  details: SongDetails;
  startTime: number;
  progressText: string;
  audioUrls?: string[];
  versions?: TrackVersion[];
  coverUrls?: string[];
  error?: string;
}

export interface GenerationManagerState {
  activeGenerations: Map<string, ActiveGeneration>;
  completedQueue: string[];
  totalProgress: number;
  activeCount: number;
  canGenerate: boolean;
}

export const MAX_CONCURRENT_GENERATIONS = 10;