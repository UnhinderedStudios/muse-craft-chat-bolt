import React, { useRef } from "react";
import { CyberCard } from "@/components/cyber/CyberCard";
import { CyberButton } from "@/components/cyber/CyberButton";
import { KaraokeLyrics } from "./KaraokeLyrics";
import { Play, Pause, SkipBack, SkipForward } from "lucide-react";
import { TimestampedWord } from "@/types";

interface AudioPlayerProps {
  audioUrls: string[];
  currentIndex: number;
  setCurrentIndex: (index: number) => void;
  currentTime: number;
  setCurrentTime: (time: number) => void;
  isPlaying: boolean;
  setIsPlaying: (playing: boolean) => void;
  covers: string[];
  timestampedLyrics: TimestampedWord[];
  onFullscreenKaraoke: () => void;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({
  audioUrls,
  currentIndex,
  setCurrentIndex,
  currentTime,
  setCurrentTime,
  isPlaying,
  setIsPlaying,
  covers,
  timestampedLyrics,
  onFullscreenKaraoke
}) => {
  const audioRef = useRef<HTMLAudioElement>(null);

  const togglePlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleNext = () => {
    if (currentIndex < audioUrls.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  if (!audioUrls?.length) return null;

  return (
    <>
      {/* Audio Players */}
      <CyberCard className="space-y-4">
        <div className="text-center space-y-4">
          <h3 className="text-lg font-medium text-text-primary">
            Generated Songs ({audioUrls.length})
          </h3>
          
          {/* Album Covers */}
          {covers.length > 0 && (
            <div className="flex gap-4 justify-center">
              {covers.map((cover, index) => (
                <img
                  key={index}
                  src={cover}
                  alt={`Album cover ${index + 1}`}
                  className="w-24 h-24 rounded-lg border border-border-main"
                />
              ))}
            </div>
          )}

          {/* Audio Controls */}
          <div className="flex items-center justify-center gap-4">
            <CyberButton
              variant="icon"
              onClick={handlePrevious}
              disabled={currentIndex === 0}
            >
              <SkipBack className="w-4 h-4" />
            </CyberButton>
            
            <CyberButton
              variant="icon"
              onClick={togglePlayPause}
            >
              {isPlaying ? (
                <Pause className="w-4 h-4" />
              ) : (
                <Play className="w-4 h-4" />
              )}
            </CyberButton>
            
            <CyberButton
              variant="icon"
              onClick={handleNext}
              disabled={currentIndex === audioUrls.length - 1}
            >
              <SkipForward className="w-4 h-4" />
            </CyberButton>
          </div>

          {/* Track indicator */}
          <p className="text-text-secondary text-sm">
            Track {currentIndex + 1} of {audioUrls.length}
          </p>

          {/* Hidden audio element */}
          <audio
            ref={audioRef}
            src={audioUrls[currentIndex]}
            onTimeUpdate={() => {
              if (audioRef.current) {
                setCurrentTime(audioRef.current.currentTime);
              }
            }}
            onLoadedData={() => {
              if (isPlaying && audioRef.current) {
                audioRef.current.play();
              }
            }}
            className="w-full"
            controls
          />
        </div>
      </CyberCard>

      {/* Karaoke Lyrics */}
      {timestampedLyrics.length > 0 && (
        <CyberCard className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-text-primary">
              Karaoke Lyrics
            </h3>
            <CyberButton
              variant="secondary"
              onClick={onFullscreenKaraoke}
              className="text-sm"
            >
              Fullscreen
            </CyberButton>
          </div>
          
          <div className="h-32 overflow-hidden">
            <KaraokeLyrics
              words={timestampedLyrics}
              currentTime={currentTime}
              isPlaying={isPlaying}
              className="lyrics-scrollbar"
            />
          </div>
        </CyberCard>
      )}
    </>
  );
};