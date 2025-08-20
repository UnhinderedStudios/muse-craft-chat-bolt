import React from "react";
import { CyberCard } from "@/components/cyber/CyberCard";
import { CyberButton } from "@/components/cyber/CyberButton";
import { AudioPlayer } from "@/components/audio/AudioPlayer";
import { KaraokeLyrics } from "@/components/audio/KaraokeLyrics";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Play, Pause, RotateCcw, Music } from "lucide-react";
import { type TimestampedWord, type SongDetails } from "@/types";

interface TrackListSectionProps {
  canGenerate: boolean;
  busy: boolean;
  generationProgress: number;
  details: SongDetails;
  versions: Array<{
    url: string;
    audioId: string;
    musicIndex: number;
    words: TimestampedWord[];
    hasTimestamps?: boolean;
    timestampError?: string;
  }>;
  albumCovers: { cover1: string; cover2: string } | null;
  isGeneratingCovers: boolean;
  currentTime: number;
  isPlaying: boolean;
  currentAudioIndex: number;
  audioRefs: React.MutableRefObject<HTMLAudioElement[]>;
  startGeneration: () => void;
  testAlbumCoverWithLyrics: () => void;
  handleAudioPlay: (index: number) => void;
  handleAudioPause: () => void;
  handleTimeUpdate: (audio: HTMLAudioElement) => void;
  handleSeek: (time: number) => void;
  setShowFullscreenKaraoke: (show: boolean) => void;
}

export const TrackListSection: React.FC<TrackListSectionProps> = ({
  canGenerate,
  busy,
  generationProgress,
  details,
  versions,
  albumCovers,
  isGeneratingCovers,
  currentTime,
  isPlaying,
  currentAudioIndex,
  audioRefs,
  startGeneration,
  testAlbumCoverWithLyrics,
  handleAudioPlay,
  handleAudioPause,
  handleTimeUpdate,
  handleSeek,
  setShowFullscreenKaraoke
}) => {
  return (
    <CyberCard variant="alt" className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-text-primary">Generated Tracks</h2>
        <div className="flex gap-2">
          <CyberButton 
            variant="primary" 
            onClick={testAlbumCoverWithLyrics}
            disabled={busy || isGeneratingCovers}
          >
            Test Covers
          </CyberButton>
          <CyberButton 
            variant="primary"
            onClick={startGeneration}
            disabled={!canGenerate || busy}
          >
            <Music className="w-4 h-4 mr-2" />
            Generate Song
          </CyberButton>
        </div>
      </div>

      {busy && (
        <div className="space-y-4 mb-6">
          <Progress value={generationProgress} className="w-full" />
          <p className="text-text-secondary text-center">
            Generating your song... {Math.round(generationProgress)}%
          </p>
        </div>
      )}

      {albumCovers && (
        <div className="mb-6">
          <h3 className="text-text-primary font-medium mb-3">Album Covers</h3>
          <div className="grid grid-cols-2 gap-4">
            <img src={albumCovers.cover1} alt="Album Cover 1" className="w-full rounded-lg" />
            <img src={albumCovers.cover2} alt="Album Cover 2" className="w-full rounded-lg" />
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto space-y-4">
        {versions.length > 0 ? (
          versions.map((version, index) => (
            <div key={`${version.audioId}-${index}`} className="border border-border-main rounded-lg p-4 bg-card">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-text-primary font-medium">
                  Version {index + 1}
                  {version.hasTimestamps && " (Karaoke Ready)"}
                  {version.timestampError && " (No Karaoke)"}
                </h3>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => isPlaying && currentAudioIndex === index ? handleAudioPause() : handleAudioPlay(index)}
                    className="bg-card-alt border-border-main hover:border-accent-primary"
                  >
                    {isPlaying && currentAudioIndex === index ? (
                      <Pause className="w-4 h-4" />
                    ) : (
                      <Play className="w-4 h-4" />
                    )}
                  </Button>
                  {version.hasTimestamps && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowFullscreenKaraoke(true)}
                      className="bg-card-alt border-border-main hover:border-accent-primary"
                    >
                      Karaoke
                    </Button>
                  )}
                </div>
              </div>

              <audio
                ref={(el) => {
                  if (el) {
                    audioRefs.current[index] = el;
                  }
                }}
                src={version.url}
                onTimeUpdate={(e) => handleTimeUpdate(e.currentTarget)}
                onLoadedMetadata={(e) => {
                  console.log(`Audio ${index} loaded, duration:`, e.currentTarget.duration);
                }}
                preload="metadata"
                className="w-full"
                controls
              />

              {version.hasTimestamps && (
                <div className="mt-4">
                  <KaraokeLyrics
                    words={version.words}
                    currentTime={currentTime}
                    isPlaying={currentAudioIndex === index && isPlaying}
                  />
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="text-center text-text-secondary py-8">
            <Music className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No tracks generated yet</p>
            <p className="text-sm">Click "Generate Song" to create your first track</p>
          </div>
        )}
      </div>
    </CyberCard>
  );
};