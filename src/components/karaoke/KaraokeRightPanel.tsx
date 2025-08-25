// components/karaoke/KaraokeRightPanel.tsx
import React from "react";
import { KaraokeLyrics } from "@/components/audio/KaraokeLyrics";

type Props = {
  versions: Array<{
    url: string;
    audioId: string;
    musicIndex: number;
    words: any[];
    hasTimestamps?: boolean;
    timestampError?: string;
  }>;
  currentAudioIndex: number;
  currentTime: number;
  isPlaying: boolean;
  albumCovers?: { cover1: string; cover2: string } | null;
  isGeneratingCovers?: boolean;
  audioRefs: React.MutableRefObject<HTMLAudioElement[]>;
  onPlayPause: (index: number) => void;
  onAudioPause: () => void;
  onFullscreenKaraoke: () => void;
  onSeek: (t: number) => void;

  /** height synced with chat on desktop */
  panelHeight?: number;
};

export function KaraokeRightPanel({
  versions,
  currentAudioIndex,
  currentTime,
  isPlaying,
  panelHeight,
}: Props) {
  const active = versions[currentAudioIndex];

  return (
    <div
      /* ROOT: fixed height + no scrolling here */
      className="bg-[#151515] rounded-2xl flex flex-col min-h-0 overflow-hidden"
      style={panelHeight ? { height: panelHeight } : undefined}
    >
      {/* header / controls (leave as-is if you have them) */}
      <div className="shrink-0 px-6 pt-6 pb-3" />

      {/* BODY: only child that can scroll */}
      <div className="flex-1 min-h-0 px-6 pb-6">
        <div className="h-full overflow-y-auto custom-scrollbar">
          {active?.words?.length ? (
            <KaraokeLyrics
              words={active.words}
              currentTime={currentTime}
              isPlaying={isPlaying}
            />
          ) : (
            <div className="text-center text-white/50 py-20">
              Karaoke lyrics will appear here when you generate a song
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default KaraokeRightPanel;