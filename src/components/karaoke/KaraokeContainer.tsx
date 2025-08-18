import React from "react";
import { cn } from "@/lib/utils";
import { KaraokeLyrics } from "@/components/audio/KaraokeLyrics";
import { Play, Pause } from "lucide-react";
import { TimestampedWord } from "@/types";

interface KaraokeContainerProps {
  versions: Array<{
    url: string;
    audioId: string;
    musicIndex: number;
    words: TimestampedWord[];
    hasTimestamps?: boolean;
  }>;
  currentAudioIndex: number;
  currentTime: number;
  isPlaying: boolean;
  albumCovers: { cover1: string; cover2: string } | null;
  audioElement: HTMLAudioElement | null;
  onPlayPause: () => void;
  className?: string;
}

export const KaraokeContainer: React.FC<KaraokeContainerProps> = ({
  versions,
  currentAudioIndex,
  currentTime,
  isPlaying,
  albumCovers,
  audioElement,
  onPlayPause,
  className
}) => {
  const currentVersion = versions[currentAudioIndex];
  const hasLyrics = currentVersion?.words?.length > 0;
  const albumCover = albumCovers 
    ? (currentAudioIndex === 1 ? albumCovers.cover2 : albumCovers.cover1)
    : null;

  const duration = audioElement?.duration || 0;
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  if (!versions.length || !hasLyrics) {
    return (
      <div className={cn(
        "bg-card-main rounded-xl border border-border-main p-6 flex items-center justify-center",
        className
      )}>
        <p className="text-text-secondary text-sm">
          Karaoke will appear here when lyrics are ready
        </p>
      </div>
    );
  }

  return (
    <div className={cn(
      "bg-card-main rounded-xl border border-border-main overflow-hidden",
      className
    )}>
      {/* Album Art Section with Audio Controls - Top 20% */}
      <div className="relative h-[20%] min-h-[120px]">
        {albumCover ? (
          <div className="relative w-full h-full">
            <img 
              src={albumCover}
              alt="Album Cover"
              className="w-full h-full object-cover opacity-50"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
            
            {/* Audio Controls Overlay */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
              <div className="flex items-center gap-3">
                {/* Play/Pause Button */}
                <button
                  onClick={onPlayPause}
                  className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
                >
                  {isPlaying ? (
                    <Pause className="w-4 h-4 text-white" />
                  ) : (
                    <Play className="w-4 h-4 text-white ml-0.5" />
                  )}
                </button>
                
                {/* Progress Bar */}
                <div className="flex-1 flex items-center gap-2 text-xs text-white/80">
                  <span>{formatTime(currentTime)}</span>
                  <div className="flex-1 h-1 bg-white/20 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-white/60 transition-all duration-100"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <span>{formatTime(duration)}</span>
                </div>
                
                {/* Track Indicator */}
                <div className="text-xs text-white/60">
                  {currentAudioIndex + 1}/{versions.length}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="w-full h-full bg-muted/20 flex items-center justify-center">
            <div className="text-text-secondary text-sm">No album cover</div>
          </div>
        )}
      </div>

      {/* Karaoke Lyrics Section - Bottom 80% */}
      <div className="h-[80%] p-4">
        <KaraokeLyrics 
          words={currentVersion.words}
          currentTime={currentTime}
          isPlaying={isPlaying}
          className="h-full border-0 bg-transparent p-0"
        />
      </div>
    </div>
  );
};