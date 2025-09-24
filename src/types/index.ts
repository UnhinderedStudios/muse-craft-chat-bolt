// Re-export all types for easy import
export * from './chat';
export * from './audio';
export * from './song';

import { TimestampedWord } from './audio';

export interface TrackItem {
  id: string;               // audioId (fallback: `${taskId}-${index}`)
  url: string;
  title?: string;           // details.title || "Song Title"
  coverUrl?: string;        // Current selected cover URL from storage
  albumCoverIds?: string[]; // All generated album cover IDs for this track (newest first)
  createdAt: number;        // Date.now() when added
  params: string[];         // styleTags at time of generation
  words?: TimestampedWord[];
  hasTimestamps?: boolean;
  hasBeenPlayed?: boolean;  // Track if this song has been played before
  jobId?: string;           // ID of the generation job that created this track
  audioId?: string;         // Best available audioId for API calls
}

export interface AlbumCover {
  id: string;
  track_id: string;
  image_url: string;
  image_type: 'album_cover' | 'artist_image';
  prompt_used?: string;
  is_selected: boolean;
  created_at: string;
  updated_at: string;
  metadata?: Record<string, any>;
}