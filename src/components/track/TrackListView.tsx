import { useState } from "react";
import { Grid3X3, List, Play, Pause, Maximize2 } from "lucide-react";
import { CyberCard } from "@/components/cyber/CyberCard";
import { CyberButton } from "@/components/cyber/CyberButton";
import { Button } from "@/components/ui/button";
import { AudioPlayer } from "@/components/audio/AudioPlayer";
import { KaraokeLyrics } from "@/components/audio/KaraokeLyrics";

interface TrackListViewProps {
  versions: any[];
  onAudioPlay: (index: number) => void;
  currentAudioIndex: number;
  isPlaying: boolean;
  currentTime: number;
  onSeek: (time: number) => void;
  onAudioPause: () => void;
  audioRefs: React.MutableRefObject<HTMLAudioElement[]>;
  onTimeUpdate: (audio: HTMLAudioElement) => void;
  showFullscreenKaraoke: boolean;
  setShowFullscreenKaraoke: (show: boolean) => void;
  selectedView: "grid" | "list";
  setSelectedView: (view: "grid" | "list") => void;
}

export function TrackListView({
  versions,
  onAudioPlay,
  currentAudioIndex,
  isPlaying,
  currentTime,
  onSeek,
  onAudioPause,
  audioRefs,
  onTimeUpdate,
  showFullscreenKaraoke,
  setShowFullscreenKaraoke,
  selectedView,
  setSelectedView
}: TrackListViewProps) {
  const currentVersion = versions[currentAudioIndex];

  return (
    <CyberCard className="h-full">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-medium text-cyber-primary">Track List</h3>
        <div className="flex gap-2">
          <Button
            variant={selectedView === "grid" ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedView("grid")}
          >
            <Grid3X3 className="w-4 h-4" />
          </Button>
          <Button
            variant={selectedView === "list" ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedView("list")}
          >
            <List className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="space-y-4 h-[calc(100%-80px)] overflow-y-auto">
        {versions.map((version, index) => (
          <div key={index} className="p-4 rounded-lg border border-cyber-accent/30 bg-black/20 hover:bg-black/30 transition-colors">
            <div className="flex items-center gap-3">
              <CyberButton
                onClick={() => onAudioPlay(index)}
                variant="secondary"
                className="shrink-0"
              >
                {currentAudioIndex === index && isPlaying ? (
                  <Pause className="w-4 h-4" />
                ) : (
                  <Play className="w-4 h-4" />
                )}
              </CyberButton>
              
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-cyber-primary">
                  Version {index + 1}
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {version.audioId}
                </div>
              </div>

              {currentVersion?.words && currentVersion.words.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowFullscreenKaraoke(true)}
                  className="shrink-0"
                >
                  <Maximize2 className="w-4 h-4" />
                </Button>
              )}
            </div>

            {/* Hidden audio elements */}
            <audio
              ref={(el) => {
                if (el) {
                  audioRefs.current[index] = el;
                }
              }}
              src={version.url}
              onTimeUpdate={(e) => onTimeUpdate(e.target as HTMLAudioElement)}
              onEnded={() => onAudioPause()}
              preload="metadata"
              style={{ display: 'none' }}
            />

            {/* Karaoke Lyrics - only show for current playing track */}
            {currentAudioIndex === index && currentVersion?.words && currentVersion.words.length > 0 && (
              <div className="mt-3 pt-3 border-t border-cyber-accent/20">
                <KaraokeLyrics
                  words={currentVersion.words}
                  currentTime={currentTime}
                  isPlaying={isPlaying}
                  className="text-sm"
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </CyberCard>
  );
}