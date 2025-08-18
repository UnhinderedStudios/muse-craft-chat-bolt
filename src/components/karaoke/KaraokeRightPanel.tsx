import React, { useEffect, useRef } from "react";
import { Play, Pause, Mic } from "lucide-react";
import { KaraokeLyrics } from "@/components/audio/KaraokeLyrics";
import { TimestampedWord } from "@/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

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
  onFullscreenKaraoke: () => void;
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
  onFullscreenKaraoke,
}) => {
  const hasContent = versions.length > 0;
  const currentVersion = hasContent ? versions[currentAudioIndex] : null;
  const currentAlbumCover = hasContent && currentAudioIndex === 0 ? albumCovers?.cover1 : hasContent ? albumCovers?.cover2 : null;
  const audioElement = hasContent ? audioRefs.current[currentAudioIndex] : null;
  const duration = audioElement?.duration || 0;

  const handlePlayPause = () => {
    if (!hasContent) return;
    
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
  const lyricsScrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll lyrics when playing
  useEffect(() => {
    if (isPlaying && hasContent && currentVersion?.words?.length && lyricsScrollRef.current) {
      const container = lyricsScrollRef.current;
      const highlightedElement = container.querySelector('[data-highlighted="true"]');
      if (highlightedElement) {
        highlightedElement.scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        });
      }
    }
  }, [currentTime, isPlaying, hasContent, currentVersion?.words]);

  return (
    <div className="bg-[#151515] rounded-2xl h-[500px] flex flex-col overflow-hidden">
      {/* Album Art Section - Made 10% taller (115px -> 127px) */}
      <div className="relative h-[127px] bg-muted/10 rounded-t-2xl overflow-hidden flex-shrink-0">
        {currentAlbumCover ? (
          <div
            className="absolute inset-0 bg-cover bg-center opacity-50"
            style={{ backgroundImage: `url(${currentAlbumCover})` }}
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-muted/10" />
        )}
        
        {/* Audio Controls Overlay - Made 10% smaller */}
        <div className="absolute bottom-0 left-0 right-0 bg-black/60 backdrop-blur-sm p-2">
          {hasContent ? (
            <div className="flex items-center gap-2">
              {/* Play/Pause Button - Made smaller */}
              <button
                onClick={handlePlayPause}
                className={cn(
                  "flex items-center justify-center w-7 h-7 rounded-full transition-colors",
                  hasContent ? "bg-primary hover:bg-primary/80" : "bg-muted cursor-not-allowed"
                )}
                disabled={!hasContent}
              >
                {hasContent && isPlaying ? (
                  <Pause size={14} className="text-primary-foreground" />
                ) : (
                  <Play size={14} className="text-primary-foreground ml-0.5" />
                )}
              </button>

              {/* Track Info & Progress */}
              <div className="flex-1 min-w-0">
                <div className="text-xs text-white/80 mb-0.5">
                  {hasContent ? `Version ${currentAudioIndex + 1}` : "Waiting for audio..."}
                </div>
                
                {/* Progress Bar - Made more compact */}
                <div className="flex items-center gap-1.5 text-xs text-white/60">
                  <span>{hasContent ? formatTime(currentTime) : "--:--"}</span>
                  <div className="flex-1 h-1 bg-white/20 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all duration-200"
                      style={{ width: hasContent ? `${progressPercentage}%` : '0%' }}
                    />
                  </div>
                  <span>{hasContent ? formatTime(duration) : "--:--"}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center text-white/60 text-sm">
              Generate a song to see audio controls
            </div>
          )}
        </div>
      </div>

      {/* Karaoke Lyrics Section - Adjusted for new album art height (373px) */}
      <div className="flex flex-col p-4" style={{ height: 'calc(500px - 127px)' }}>
        {/* Scrollable Lyrics Container */}
        <div className="flex-1 mb-4 min-h-0">
          {hasContent ? (
            <div 
              ref={lyricsScrollRef}
              className="h-full overflow-y-auto custom-scrollbar pr-2"
            >
              <div className="py-2">
                <KaraokeLyrics
                  words={currentVersion?.words || []}
                  currentTime={currentTime}
                  isPlaying={isPlaying}
                  className="border-0 bg-transparent"
                />
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-muted-foreground text-center">
              <div>
                <div className="text-lg mb-2">🎤</div>
                <p>Karaoke lyrics will appear here when you generate a song</p>
              </div>
            </div>
          )}
        </div>
        
        {/* Fullscreen Button - Fixed at bottom */}
        {hasContent && currentVersion?.words?.length > 0 && (
          <div className="flex justify-center">
            <Button
              variant="outline"
              size="sm"
              onClick={onFullscreenKaraoke}
              className="flex items-center gap-2"
            >
              <Mic className="w-4 h-4" />
              Fullscreen
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};