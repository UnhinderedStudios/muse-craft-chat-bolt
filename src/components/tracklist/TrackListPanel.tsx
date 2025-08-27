import React, { useEffect, useState } from "react";
import { Play, Pause, RotateCw, X } from "lucide-react";
import { TrackItem } from "@/types";
import { CyberButton } from "@/components/cyber/CyberButton";
import { Dialog, DialogContent } from "@/components/ui/dialog";

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
  const [audioCurrentTimes, setAudioCurrentTimes] = useState<number[]>([]);
  const [showQuickAlbumGenerator, setShowQuickAlbumGenerator] = useState(false);
  const [selectedTrackForRegen, setSelectedTrackForRegen] = useState<TrackItem | null>(null);

  // Initialize audio times array when tracks change
  useEffect(() => {
    setAudioCurrentTimes(new Array(tracks.length).fill(0));
  }, [tracks.length]);

  // Reset previous track's time when currentIndex changes
  useEffect(() => {
    setAudioCurrentTimes(prev => {
      const newTimes = [...prev];
      // Reset all other tracks to 0 except current
      for (let i = 0; i < newTimes.length; i++) {
        if (i !== currentIndex) {
          newTimes[i] = 0;
        }
      }
      return newTimes;
    });
  }, [currentIndex]);

  return (
    <div className="h-full lg:sticky lg:top-6 bg-[#151515] rounded-2xl p-6 flex flex-col">
      <h3 className="text-white font-semibold mb-4">Track List</h3>

      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar space-y-3 pr-1">
        {tracks.map((t, i) => {
          const active = i === currentIndex;
          return (
            <div
              key={t.id}
              className={`rounded-xl bg-[#1e1e1e] ${active ? "p-4" : "p-3"} ${!active ? "cursor-pointer" : ""} hover:bg-[#252525] transition-colors`}
              onClick={!active ? () => {
                setCurrentIndex(i);
                onPlayPause(i);
              } : undefined}
            >
              {/* Row: cover + title + mini controls */}
              <div className="flex items-center gap-3">
                <div className={`shrink-0 ${active ? "w-12 h-12" : "w-10 h-10"} rounded-md bg-black/30 overflow-hidden ${active ? "relative group" : ""}`}>
                  {t.coverUrl ? (
                    <img src={t.coverUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-purple-500/20 to-cyan-500/20" />
                  )}
                  {active && (
                    <div 
                      className="absolute inset-0 bg-black/50 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedTrackForRegen(t);
                        setShowQuickAlbumGenerator(true);
                      }}
                    >
                      <RotateCw className="w-4 h-4 text-white hover:animate-spin transition-transform duration-300" />
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="text-xs text-white/60 truncate">No Artist – {t.title || "Song Title"}</div>

                  {/* progress bar */}
                  <div
                    className="mt-1 h-1.5 bg-white/10 rounded cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      
                      // Calculate seek position first
                      const audio = audioRefs.current[i];
                      if (!audio || !audio.duration) return;
                      const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                      const pct = (e.clientX - rect.left) / rect.width;
                      const seek = pct * audio.duration;
                      
                      if (i !== currentIndex) {
                        // Different track: switch to it and start playing
                        setCurrentIndex(i);
                        onPlayPause(i);
                      }
                      
                      // Always seek to the clicked position
                      onSeek(seek);
                    }}
                  >
                     <div
                       className="h-full bg-white/70 rounded"
                       style={{
                         width: (() => {
                           const a = audioRefs.current[i];
                           if (!a || !a.duration) return "0%";
                           const time = audioCurrentTimes[i] || 0;
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
                   const audio = e.currentTarget;
                   // Only update progress for the currently active track
                   if (i === currentIndex) {
                     setAudioCurrentTimes(prev => {
                       const newTimes = [...prev];
                       newTimes[i] = audio.currentTime;
                       return newTimes;
                     });
                   }
                   // Call the original onTimeUpdate
                   onTimeUpdate(audio);
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

      {/* Quick Album Cover Generator Overlay */}
      <Dialog open={showQuickAlbumGenerator} onOpenChange={setShowQuickAlbumGenerator}>
        <DialogContent className="max-w-none w-full h-full bg-black/70 backdrop-blur border-0 p-0 flex flex-col">
          <div className="relative w-full h-full flex flex-col">
            {/* Custom X button */}
            <button
              className="absolute top-6 right-6 z-10 w-8 h-8 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
              onClick={() => setShowQuickAlbumGenerator(false)}
            >
              <X className="w-6 h-6" />
            </button>
            
            {/* Title */}
            <div className="flex-shrink-0 pt-12 pb-8 text-center">
              <h2 className="text-2xl font-semibold text-white">Quick Album Cover Generator</h2>
              {selectedTrackForRegen && (
                <p className="text-white/60 mt-2">Regenerating cover for "{selectedTrackForRegen.title}"</p>
              )}
            </div>
            
            {/* Content area for future implementation */}
            <div className="flex-1 flex items-center justify-center">
              <div className="text-white/40 text-center">
                <div className="text-lg mb-2">Album cover generation coming soon...</div>
                <div className="text-sm">This feature will allow you to regenerate album covers</div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}