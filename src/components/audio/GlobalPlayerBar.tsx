import React, { useEffect, useMemo, useRef } from "react";
import WaveSurfer from "wavesurfer.js";
import { Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Volume2, VolumeX, List } from "lucide-react";

type Props = {
  title?: string;
  audioUrls: string[] | null;
  audioRefs: React.MutableRefObject<HTMLAudioElement[]>;
  currentAudioIndex: number;
  isPlaying: boolean;
  currentTime: number;
  onPlay: (index?: number) => void;
  onPause: () => void;
  onSeek: (time: number) => void;
  onPrev: () => void;
  onNext: () => void;
  accent?: string; // default #f92c8f
};

export const GlobalPlayerBar: React.FC<Props> = ({
  title = "Untitled",
  audioUrls,
  audioRefs,
  currentAudioIndex,
  isPlaying,
  currentTime,
  onPlay,
  onPause,
  onSeek,
  onPrev,
  onNext,
  accent = "#f92c8f",
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const wsRef = useRef<WaveSurfer | null>(null);

  const audioEl = audioRefs.current[currentAudioIndex] || null;

  const duration = audioEl?.duration || 0;
  const formatted = (sec: number) => {
    const s = Math.max(0, Math.floor(sec));
    const m = Math.floor(s / 60);
    const r = (s % 60).toString().padStart(2, "0");
    return `${m}:${r}`;
  };

  // (Re)create WaveSurfer binding to the CURRENT audio element
  useEffect(() => {
    if (!containerRef.current || !audioEl) return;

    // destroy old
    if (wsRef.current) {
      try { wsRef.current.destroy(); } catch {}
      wsRef.current = null;
    }

    wsRef.current = WaveSurfer.create({
      container: containerRef.current,
      media: audioEl, // bind to our existing <audio>
      height: 56,
      waveColor: "#2a2a2a",
      progressColor: accent,
      cursorColor: "#999",
      cursorWidth: 1,
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      normalize: true,
      interact: true,
    });

    const ws = wsRef.current;

    // Seek via waveform
    ws.on("click", (progress: number) => {
      const newTime = (audioEl.duration || 0) * progress;
      onSeek(newTime);
    });

    return () => {
      try { ws.destroy(); } catch {}
      wsRef.current = null;
    };
  }, [audioEl, currentAudioIndex, audioUrls?.join("|")]);

  // Keep waveform cursor in sync with time
  useEffect(() => {
    const ws = wsRef.current;
    if (!ws || !audioEl || !duration) return;
    const progress = currentTime / duration;
    // avoid setting NaN
    if (Number.isFinite(progress)) {
      try { ws.setTime(currentTime); } catch {}
    }
  }, [currentTime, duration]);

  const canControl = !!audioUrls?.length;

  return (
    <div className="w-full bg-[#101010] border border-white/10 rounded-xl px-4 py-3 shadow-[0_0_20px_rgba(0,0,0,0.35)]">
      <div className="flex items-center gap-4">
        {/* Left — title + time */}
        <div className="min-w-[220px] pr-2">
          <div className="text-white/90 font-medium truncate">{title}</div>
          <div className="text-xs text-white/50">
            {formatted(currentTime)} <span className="text-white/30">/</span> {duration ? formatted(duration) : "0:00"}
          </div>
        </div>

        {/* Center — waveform + main transport under */}
        <div className="flex-1">
          <div ref={containerRef} className="w-full select-none" />
          <div className="mt-2 flex items-center justify-center gap-3">
            <button
              className="w-8 h-8 grid place-items-center rounded hover:bg-white/10 text-white/90 disabled:opacity-40"
              onClick={onPrev}
              disabled={!canControl}
              aria-label="Previous"
            >
              <SkipBack size={16} />
            </button>

            {isPlaying ? (
              <button
                className="h-9 px-4 rounded-lg bg-[#f92c8f] text-white font-medium hover:brightness-110 disabled:opacity-50"
                onClick={() => onPause()}
                disabled={!canControl}
                aria-label="Pause"
              >
                <div className="flex items-center gap-2"><Pause size={16} /> Pause</div>
              </button>
            ) : (
              <button
                className="h-9 px-4 rounded-lg bg-[#f92c8f] text-white font-medium hover:brightness-110 disabled:opacity-50"
                onClick={() => onPlay()}
                disabled={!canControl}
                aria-label="Play"
              >
                <div className="flex items-center gap-2"><Play size={16} /> Play</div>
              </button>
            )}

            <button
              className="w-8 h-8 grid place-items-center rounded hover:bg-white/10 text-white/90 disabled:opacity-40"
              onClick={onNext}
              disabled={!canControl}
              aria-label="Next"
            >
              <SkipForward size={16} />
            </button>
          </div>
        </div>

        {/* Right — extra controls */}
        <div className="min-w-[220px] flex items-center justify-end gap-2 text-white/80">
          <button className="w-8 h-8 grid place-items-center rounded hover:bg-white/10" aria-label="Shuffle"><Shuffle size={16} /></button>
          <button className="w-8 h-8 grid place-items-center rounded hover:bg-white/10" aria-label="Repeat"><Repeat size={16} /></button>
          <button className="w-8 h-8 grid place-items-center rounded hover:bg-white/10" aria-label="Mute/Volume">
            {audioEl && audioEl.muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>
          <button className="w-8 h-8 grid place-items-center rounded hover:bg-white/10" aria-label="Queue"><List size={16} /></button>
        </div>
      </div>
    </div>
  );
};
