import React, { useEffect, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";
import {
  SkipBack, SkipForward, Play, Pause, Shuffle, Repeat,
  Volume2, VolumeX, Plus, Heart, Share2, MoreHorizontal
} from "lucide-react";

type Props = {
  title: string;
  audioRefs: React.MutableRefObject<HTMLAudioElement[]>;
  currentAudioIndex: number;
  isPlaying: boolean;
  currentTime: number;
  onPrev: () => void;
  onNext: () => void;
  onPlay: () => void;
  onPause: () => void;
  onSeek: (time: number) => void;
  accent?: string;
  disabled?: boolean; // NEW
};

const fmt = (s?: number) => {
  if (!s || !isFinite(s)) return "0:00";
  const t = Math.floor(s);
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
};

export const GlobalPlayerBar: React.FC<Props> = ({
  title,
  audioRefs,
  currentAudioIndex,
  isPlaying,
  currentTime,
  onPrev,
  onNext,
  onPlay,
  onPause,
  onSeek,
  accent = "#f92c8f",
  disabled = false,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const wsRef = useRef<WaveSurfer | null>(null);

  const audioEl = audioRefs.current[currentAudioIndex] ?? null;
  const duration = audioEl?.duration ?? 0;
  const reallyDisabled = disabled || !audioEl;

  // Build/Bind wavesurfer only when we actually have an <audio>
  useEffect(() => {
    if (!containerRef.current || !audioEl) return;

    if (wsRef.current) {
      try { wsRef.current.destroy(); } catch {}
      wsRef.current = null;
    }

    const ws = WaveSurfer.create({
      container: containerRef.current,
      height: 48,
      waveColor: "#2a2a2a",
      progressColor: accent,
      cursorColor: "transparent",
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      normalize: true,
      minPxPerSec: 40,
      interact: true,
    });

    // Load the existing audio element by URL
    if (audioEl.src) {
      ws.load(audioEl.src);
    }

    // Seek from waveform -> parent handler
    ws.on("click", (progress: number) => {
      const dur = audioEl?.duration ?? 0;
      if (dur > 0) onSeek(progress * dur);
    });

    wsRef.current = ws;
    return () => {
      try { ws.destroy(); } catch {}
      wsRef.current = null;
    };
  }, [audioEl, accent]);

  // Keep ws in sync with time
  useEffect(() => {
    if (!wsRef.current) return;
    try {
      // @ts-ignore
      if (typeof wsRef.current.setTime === "function") {
        // @ts-ignore
        wsRef.current.setTime(currentTime || 0);
      } else if (duration > 0) {
        wsRef.current.seekTo((currentTime || 0) / duration);
      }
    } catch {}
  }, [currentTime, duration]);

  const left = (
    <div className="shrink-0 w-[220px] flex flex-col">
      <div className="text-white/90 truncate text-sm sm:text-[15px] leading-tight">
        {title || (reallyDisabled ? "No track yet" : "Untitled")}
      </div>
      <div className="text-white/50 text-xs">
        {fmt(currentTime)} • {fmt(duration)}
      </div>
    </div>
  );

  const right = (
    <div className="shrink-0 w-[220px] flex items-center justify-end gap-3">
      {[Plus, Heart, Share2, MoreHorizontal].map((Icon, i) => (
        <button
          key={i}
          className={`p-2 rounded text-white/80 hover:bg-white/5 ${reallyDisabled ? "opacity-40 pointer-events-none" : ""}`}
          aria-disabled={reallyDisabled}
        >
          <Icon size={16} />
        </button>
      ))}
    </div>
  );

  return (
    <div className="w-full rounded-xl bg-[#101010] border border-white/10 shadow-[0_0_0_1px_rgba(255,255,255,0.02)_inset,0_10px_30px_rgba(0,0,0,0.35)] px-3 sm:px-4 py-3">
      {/* Top row */}
      <div className="flex items-center gap-3 sm:gap-4">
        {left}
        <div className="min-w-0 flex-1">
          {/* Real waveform or placeholder */}
          {reallyDisabled ? (
            <div className="w-full h-[48px] rounded-md bg-[#1f1f1f]">
              {/* subtle stripes to hint waveform */}
              <div className="h-full w-full opacity-30 bg-[linear-gradient(90deg,transparent_0_2px,#2a2a2a_2px_4px)] bg-[length:4px_100%] rounded-md" />
            </div>
          ) : (
            <div ref={containerRef} className="w-full h-[48px]" />
          )}
        </div>
        {right}
      </div>

      {/* Transport */}
      <div className="flex items-center justify-center gap-3 sm:gap-4 mt-3">
        <button
          onClick={() => !reallyDisabled && onPrev()}
          className={`h-9 w-9 grid place-items-center rounded-md bg-white/5 text-white hover:bg-white/10 ${reallyDisabled ? "opacity-40 pointer-events-none" : ""}`}
          aria-disabled={reallyDisabled}
        >
          <SkipBack size={16} />
        </button>

        <button
          onClick={() => !reallyDisabled && (isPlaying ? onPause() : onPlay())}
          className={`h-9 px-4 grid place-items-center rounded-md text-white ${reallyDisabled ? "opacity-40 pointer-events-none" : ""}`}
          style={{ backgroundColor: reallyDisabled ? "rgba(249,44,143,.6)" : accent }}
          aria-disabled={reallyDisabled}
        >
          {isPlaying ? <Pause size={16} /> : <Play size={16} />}
        </button>

        <button
          onClick={() => !reallyDisabled && onNext()}
          className={`h-9 w-9 grid place-items-center rounded-md bg-white/5 text-white hover:bg-white/10 ${reallyDisabled ? "opacity-40 pointer-events-none" : ""}`}
          aria-disabled={reallyDisabled}
        >
          <SkipForward size={16} />
        </button>

        <div className="mx-1 sm:mx-2" />

        <button className={`h-9 w-9 grid place-items-center rounded-md bg-white/5 text-white hover:bg-white/10 ${reallyDisabled ? "opacity-40 pointer-events-none" : ""}`} aria-disabled={reallyDisabled}>
          <Shuffle size={16} />
        </button>
        <button className={`h-9 w-9 grid place-items-center rounded-md bg-white/5 text-white hover:bg-white/10 ${reallyDisabled ? "opacity-40 pointer-events-none" : ""}`} aria-disabled={reallyDisabled}>
          <Repeat size={16} />
        </button>

        <div className="mx-1 sm:mx-2" />

        <button className={`h-9 w-9 grid place-items-center rounded-md bg-white/5 text-white hover:bg-white/10 ${reallyDisabled ? "opacity-40 pointer-events-none" : ""}`} aria-disabled={reallyDisabled}>
          {/* icon only; keep simple for now */}
          <Volume2 size={16} />
        </button>
      </div>
    </div>
  );
};
