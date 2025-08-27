import React from "react";
import { Play, Pause } from "lucide-react";
import { TrackItem } from "@/types";
import { CyberButton } from "@/components/cyber/CyberButton";

type Props = {
  tracks: TrackItem[];
  currentIndex: number;
  isPlaying: boolean;
  audioRefs: React.MutableRefObject<HTMLAudioElement[]>;
  onPlayPause: (index: number) => void;
  onSeek: (t: number) => void;
  setCurrentIndex: (index: number) => void;
  onTimeUpdate: (audio: HTMLAudioElement) => void;
};

export default function TrackListPanel({
  tracks,
  currentIndex,
  isPlaying,
  audioRefs,
  onPlayPause,
  onSeek,
  setCurrentIndex,
  onTimeUpdate,
}: Props) {
  return (
    <div className="h-full lg:sticky lg:top-6 bg-[#151515] rounded-2xl p-6 flex flex-col">
      <h3 className="text-white font-semibold mb-4">Track List</h3>

      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar space-y-3 pr-1">
        {tracks.map((t, i) => {
          const active = i === currentIndex;
          return (
            <div
              key={t.id}
              className={`rounded-xl bg-[#1e1e1e] ${active ? "p-4" : "p-3"} cursor-pointer hover:bg-[#252525] transition-colors`}
              onClick={() => setCurrentIndex(i)}
            >
              {/* Row: cover + title + mini controls */}
              <div className="flex items-center gap-3">
                <div className={`shrink-0 ${active ? "w-12 h-12" : "w-10 h-10"} rounded-md bg-black/30 overflow-hidden`}>
                  {t.coverUrl ? (
                    <img src={t.coverUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-purple-500/20 to-cyan-500/20" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="text-xs text-white/60 truncate">No Artist – {t.title || "Song Title"}</div>

                  {/* progress bar */}
                  <div
                    className="mt-1 h-1.5 bg-white/10 rounded cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      
                      // First, switch to this track if it's not already active
                      if (i !== currentIndex) {
                        setCurrentIndex(i);
                      }
                      
                      // Start playing this track
                      onPlayPause(i);
                      
                      // Then seek to the clicked position
                      const audio = audioRefs.current[i];
                      if (!audio || !audio.duration) return;
                      const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                      const pct = (e.clientX - rect.left) / rect.width;
                      const seek = pct * audio.duration;
                      onSeek(seek);
                    }}
                  >
                    <div
                      className="h-full bg-white/70 rounded"
                      style={{
                        width: (() => {
                          const a = audioRefs.current[i];
                          if (!a || !a.duration) return "0%";
                          const time = a.currentTime || 0;
                          return `${(time / a.duration) * 100}%`;
                        })(),
                      }}
                    />
                  </div>
                </div>

                <CyberButton
                  variant="icon"
                  className="w-8 h-8 shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    onPlayPause(i);
                  }}
                >
                  {active && isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </CyberButton>
              </div>

              {/* Expanded panel for active track */}
              {active && (
                <div className="mt-3 rounded-lg bg-black/20 p-3">
                  <div className="text-sm font-semibold text-white/80 mb-2">Parameters:</div>
                  <div className="grid grid-cols-3 gap-2">
                    {(t.params?.length ? t.params : ["Text","Text","Text","Text","Text","Text"]).slice(0,6).map((p, idx) => (
                      <div key={idx} className="px-3 py-1.5 rounded-full bg-white/25 text-[12px] text-black font-semibold text-center truncate">
                        {p || "Text"}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Hidden audio element per track */}
              <audio
                src={t.url}
                preload="auto"
                className="hidden"
                crossOrigin="anonymous"
                ref={(el) => { if (el) audioRefs.current[i] = el; }}
                onTimeUpdate={(e) => {
                  onTimeUpdate(e.currentTarget);
                }}
              />
            </div>
          );
        })}
        
        {tracks.length === 0 && (
          <div className="text-center text-white/40 py-8">
            <div className="text-sm">No tracks yet</div>
            <div className="text-xs mt-1">Generate a song to see it here</div>
          </div>
        )}
      </div>
    </div>
  );
}