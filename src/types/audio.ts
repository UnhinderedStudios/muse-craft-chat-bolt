export interface TimestampedWord {
  word: string;
  start: number;
  end: number;
  success: boolean;
  p_align?: number;
}

export interface AudioPlayerState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
}