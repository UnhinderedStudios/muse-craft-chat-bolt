export interface SongDetails {
  title?: string;
  genre?: string;
  mood?: string;
  tempo?: string;
  language?: string;
  vocals?: "male" | "female" | "duet" | "none" | string;
  style?: string;
  lyrics?: string;
}

export interface GenerationState {
  busy: boolean;
  progress: number;
  progressText: string;
  jobId?: string;
  audioUrls?: string[];
  currentIndex: number;
  coverUrls?: string[];
  timestampedLyrics?: TimestampedWord[];
}

export interface TagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  className?: string;
}

import { TimestampedWord } from './audio';