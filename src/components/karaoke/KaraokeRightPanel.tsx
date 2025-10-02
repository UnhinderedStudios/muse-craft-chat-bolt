import React, { useRef } from "react";
import { Play, Pause, Mic, RefreshCw } from "lucide-react";
import { KaraokeLyrics } from "@/components/audio/KaraokeLyrics";
import { TimestampedWord } from "@/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useScrollDelegationHook } from "@/utils/scrollDelegation";
import { PlaceholderOrb } from "@/components/ui/PlaceholderOrb";
import EllipsisMarquee from "@/components/ui/EllipsisMarquee";

interface KaraokeRightPanelProps {
  versions: Array<{
    url: string;
    audioId: string;
    words: TimestampedWord[];
    hasTimestamps?: boolean;
    timestampError?: string;
  }>;
  currentAudioIndex: number;
  currentTrackIndex: number;
  currentTime: number;
  isPlaying: boolean;
  albumCovers: { coverUrls: string[] } | null;
  currentTrackCoverUrl?: string;
  currentTrackTitle?: string;
  isGeneratingCovers: boolean;
  audioRefs: React.MutableRefObject<HTMLAudioElement[]>;
  onPlayPause: (index: number) => void;
  onAudioPause: () => void;
  onFullscreenKaraoke: () => void;
  onSeek?: (time: number) => void;
  onRetryTimestamps?: (index: number) => void;
  onRefreshLyrics?: (index: number) => void;
}

export const KaraokeRightPanel: React.FC<KaraokeRightPanelProps> = ({
  versions,
  currentAudioIndex,
  currentTrackIndex,
  currentTime,
  isPlaying,
  albumCovers,
  currentTrackCoverUrl,
  currentTrackTitle,
  isGeneratingCovers,
  audioRefs,
  onPlayPause,
  onAudioPause,
  onFullscreenKaraoke,
  onSeek,
  onRetryTimestamps,
  onRefreshLyrics,
}) => {
  const currentVersion = versions.length > 0 && currentAudioIndex >= 0 && currentAudioIndex < versions.length ? versions[currentAudioIndex] : null;
  // Safety check: only show content if we have both versions and valid audio refs indicating active tracks
  const hasValidTracks = audioRefs.current && audioRefs.current.length > 0 && audioRefs.current.some(ref => ref !== null);
  const hasContent = !!currentVersion && hasValidTracks;
  const currentAlbumCover = currentTrackCoverUrl;
  const audioElement = audioRefs.current[currentTrackIndex] || null;
  const duration = audioElement?.duration || 0;

  // Scroll delegation for the main panel
  const panelRef = useRef<HTMLDivElement>(null);
  useScrollDelegationHook(panelRef);

  const handlePlayPause = () => {
    if (isPlaying) {
      onAudioPause();
    } else {
      onPlayPause(currentTrackIndex);
    }
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioElement || !onSeek) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    const seekTime = percentage * duration;
    
    onSeek(seekTime);
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div ref={panelRef} className="h-full min-h-0 bg-[#151515] rounded-2xl flex flex-col overflow-hidden">
      {/* Album Art Section - Made 10% taller (115px -> 127px) */}
      <div className="relative h-[127px] rounded-t-2xl overflow-hidden flex-shrink-0" style={{ backgroundColor: '#1e1e1e' }}>
        {currentAlbumCover ? (
          <div
            className="absolute inset-0 bg-cover bg-center opacity-50"
            style={{ backgroundImage: `url(${currentAlbumCover})` }}
          />
        ) : (
          <PlaceholderOrb className="absolute inset-0" />
        )}
        
        {/* Audio Controls Overlay - Made 10% smaller */}
        <div className="absolute bottom-0 left-0 right-0 bg-black/60 backdrop-blur-sm p-2">
          {hasContent ? (
            <div className="flex items-center gap-2">
              {/* Play/Pause Button - Made smaller */}
              <button
                onClick={handlePlayPause}
                className={cn(
                  "flex items-center justify-center w-7 h-7 transition-opacity",
                  audioElement ? "hover:opacity-60" : "cursor-not-allowed opacity-50"
                )}
                disabled={!audioElement}
              >
                {hasContent && isPlaying ? (
                  <Pause size={14} className="text-white fill-white" />
                ) : (
                  <Play size={14} className="text-white fill-white ml-0.5" />
                )}
              </button>

              {/* Track Info & Progress */}
              <div className="flex-1 min-w-0">
                <div className="text-xs text-white/80 mb-0.5 min-w-0">
                  <EllipsisMarquee
                    text={currentTrackTitle ? `No Artist - ${currentTrackTitle}` : "Waiting for audio..."}
                    className="text-xs text-white/80"
                    speedPxPerSec={30}
                  />
                </div>
                
                {/* Progress Bar - Made more compact */}
                <div className="flex items-center gap-1.5 text-xs text-white/60">
                  <span>{audioElement ? formatTime(currentTime) : "--:--"}</span>
                  <div 
                    className="flex-1 h-1 bg-white/20 rounded-full overflow-hidden cursor-pointer"
                    onClick={handleProgressClick}
                  >
                    <div
                      className="h-full bg-white transition-all duration-200"
                      style={{ width: audioElement ? `${progressPercentage}%` : '0%' }}
                    />
                  </div>
                  <span>{audioElement ? formatTime(duration) : "--:--"}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center text-white/60 text-sm">
              Waiting for a generation
            </div>
          )}
        </div>
      </div>

      {/* Karaoke Lyrics Section - Flexible height */}
      <div className="flex flex-col p-4 flex-1 min-h-0">
        {/* Lyrics Container - Give KaraokeLyrics a fixed height to scroll within */}
        <div className="flex-1 mb-2 min-h-0">
          {hasContent ? (
            <>
              <KaraokeLyrics
                words={currentVersion?.words || []}
                currentTime={currentTime}
                isPlaying={isPlaying}
                className="h-full border-0 bg-transparent"
              />
            </>
          ) : (
            <div className="h-full flex items-center justify-center text-muted-foreground text-center">
              <div className="flex justify-center">
                <div className="loader">
                  <div className="bar"></div>
                  <div className="bar"></div>
                  <div className="bar"></div>
                </div>
              </div>
            </div>
          )}
        </div>
        
        {/* Karaoke Mode Button - Fixed at bottom */}
        {hasContent && currentVersion?.words?.length > 0 && (
          <button
            onClick={onFullscreenKaraoke}
            className="karaoke-mode-button w-full h-9 text-white text-sm font-medium px-4 rounded-xl flex items-center justify-center gap-2 mt-2"
          >
            <Mic className="w-4 h-4" />
            Karaoke Mode
          </button>
        )}
      </div>
    </div>
  );
};