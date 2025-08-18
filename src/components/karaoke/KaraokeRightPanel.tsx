import React from "react";
import { Play, Pause } from "lucide-react";
import { KaraokeLyrics } from "@/components/audio/KaraokeLyrics";
import { TimestampedWord } from "@/types";
import { cn } from "@/lib/utils";

interface KaraokeRightPanelProps {
  versions: Array<{
    url: string;
    audioId: string;
    words: TimestampedWord[];
    hasTimestamps?: boolean;
  }>;
  currentAudioIndex: number;
  currentTime: number;
  isPlaying: boolean;
  albumCovers: { cover1: string; cover2: string } | null;
  isGeneratingCovers: boolean;
  audioRefs: React.MutableRefObject<HTMLAudioElement[]>;
  onPlayPause: (index: number) => void;
  onAudioPause: () => void;
}

export const KaraokeRightPanel: React.FC<KaraokeRightPanelProps> = ({
  versions,
  currentAudioIndex,
  currentTime,
  isPlaying,
  albumCovers,
  isGeneratingCovers,
  audioRefs,
  onPlayPause,
  onAudioPause,
}) => {
  if (!versions.length) {
    return null;
  }

  const currentVersion = versions[currentAudioIndex];
  const currentAlbumCover = currentAudioIndex === 0 ? albumCovers?.cover1 : albumCovers?.cover2;
  const audioElement = audioRefs.current[currentAudioIndex];
  const duration = audioElement?.duration || 0;

  const handlePlayPause = () => {
    if (isPlaying) {
      onAudioPause();
    } else {
      onPlayPause(currentAudioIndex);
    }
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="bg-[#151515] rounded-2xl h-[500px] flex flex-col overflow-hidden">
      {/* Album Art Section - Top 20% */}
      <div className="relative h-[100px] bg-muted/10 rounded-t-2xl overflow-hidden">
        {currentAlbumCover ? (
          <div
            className="absolute inset-0 bg-cover bg-center opacity-50"
            style={{ backgroundImage: `url(${currentAlbumCover})` }}
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-muted/20" />
        )}
        
        {/* Audio Controls Overlay */}
        <div className="absolute bottom-0 left-0 right-0 bg-black/60 backdrop-blur-sm p-3">
          <div className="flex items-center gap-3">
            {/* Play/Pause Button */}
            <button
              onClick={handlePlayPause}
              className="flex items-center justify-center w-8 h-8 rounded-full bg-primary hover:bg-primary/80 transition-colors"
            >
              {isPlaying ? (
                <Pause size={16} className="text-primary-foreground" />
              ) : (
                <Play size={16} className="text-primary-foreground ml-0.5" />
              )}
            </button>

            {/* Track Info & Progress */}
            <div className="flex-1 min-w-0">
              <div className="text-xs text-white/80 mb-1">
                Version {currentAudioIndex + 1}
              </div>
              
              {/* Progress Bar */}
              <div className="flex items-center gap-2 text-xs text-white/60">
                <span>{formatTime(currentTime)}</span>
                <div className="flex-1 h-1 bg-white/20 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-200"
                    style={{ width: `${progressPercentage}%` }}
                  />
                </div>
                <span>{formatTime(duration)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Karaoke Lyrics Section - Bottom 80% */}
      <div className="flex-1 p-4">
        <KaraokeLyrics
          words={currentVersion?.words || []}
          currentTime={currentTime}
          isPlaying={isPlaying}
          className="h-full border-0 bg-transparent"
        />
      </div>
    </div>
  );
};