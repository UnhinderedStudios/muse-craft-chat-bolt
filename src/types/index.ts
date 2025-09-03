// Re-export all types for easy import
export * from './chat';
export * from './audio';
export * from './song';

import { TimestampedWord } from './audio';

export interface TrackItem {
  id: string;               // audioId (fallback: `${taskId}-${index}`)
  url: string;
  title?: string;           // details.title || "Song Title"
  coverUrl?: string;        // albumCovers cover1/cover2 mapped per version
  createdAt: number;        // Date.now() when added
  params: string[];         // styleTags at time of generation
  words?: TimestampedWord[];
  hasTimestamps?: boolean;
}