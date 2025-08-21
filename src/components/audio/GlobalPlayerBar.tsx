import React, { useEffect, useMemo, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";
import {
  SkipBack,
  SkipForward,
  Play,
  Pause,
  Shuffle,
  Repeat,
  Volume2,
  VolumeX,
  Plus,
  Heart,
  Share2,
  MoreHorizontal,
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
  accent?: string; // default #f92c8f
};

const fmt = (sec: number | undefined) => {
  if (!sec || !isFinite(sec)) return "0:00";
  const s = Math.floor(sec);
  const m = Math.floor(s / 60);
  const r = (s % 60).toString().padStart(2, "0");
  return `${m}:${r}`;
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
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const wsRef = useRef<WaveSurfer | null>(null);
  const [muted, setMuted] = useState(false);

  const audioEl = audioRefs.current[currentAudioIndex] ?? null;
  const duration = audioEl?.duration ?? 0;

  // Build / bind WaveSurfer to the existing <audio> element
  useEffect(() => {
    if (!containerRef.current || !audioEl) return;

    // Destroy old instance
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

  // Keep waveform position in sync with parent time
  useEffect(() => {
    if (!wsRef.current) return;
    try {
      // setTime avoids emitting another "seek"
      // (if not available, fallback to seekTo)
      // @ts-ignore - types may not include setTime in some builds
      if (typeof wsRef.current.setTime === "function") {
        // @ts-ignore
        wsRef.current.setTime(currentTime || 0);
      } else if (duration > 0) {
        wsRef.current.seekTo((currentTime || 0) / duration);
      }
    } catch {}
  }, [currentTime, duration]);

  // Sync mute UI with audio element
  useEffect(() => {
    if (!audioEl) return;
    setMuted(!!audioEl.muted);
  }, [audioEl]);

  const togglePlay = () => (isPlaying ? onPause() : onPlay());
  const toggleMute = () => {
    if (!audioEl) return;
    audioEl.muted = !audioEl.muted;
    setMuted(!!audioEl.muted);
  };

  return (
    <div className="w-full rounded-xl bg-[#101010] border border-white/10 shadow-[0_0_0_1px_rgba(255,255,255,0.02)_inset,0_10px_30px_rgba(0,0,0,0.35)] px-3 sm:px-4 py-3">
      {/* Top row: left (title/time) • center (waveform) • right (misc icons) */}
      <div className="flex items-center gap-3 sm:gap-4">
        {/* LEFT — fixed width */}
        <div className="shrink-0 w-[220px] flex flex-col">
          <div className="text-white/90 truncate text-sm sm:text-[15px] leading-tight">
            {title || "Untitled"}
          </div>
          <div className="text-white/50 text-xs">{fmt(currentTime)} • {fmt(duration)}</div>
        </div>

        {/* CENTER — waveform */}
        <div className="min-w-0 flex-1">
          <div ref={containerRef} className="w-full h-[48px]" />
        </div>

        {/* RIGHT — fixed width */}
        <div className="shrink-0 w-[220px] flex items-center justify-end gap-3">
          <button className="p-2 rounded hover:bg-white/5 text-white/80" aria-label="Add">
            <Plus size={16} />
          </button>
          <button className="p-2 rounded hover:bg-white/5 text-white/80" aria-label="Like">
            <Heart size={16} />
          </button>
          <button className="p-2 rounded hover:bg-white/5 text-white/80" aria-label="Share">
            <Share2 size={16} />
          </button>
          <button className="p-2 rounded hover:bg-white/5 text-white/80" aria-label="More">
            <MoreHorizontal size={16} />
          </button>
        </div>
      </div>

      {/* Bottom row: main transport centered under the track */}
      <div className="flex items-center justify-center gap-3 sm:gap-4 mt-3">
        <button
          onClick={onPrev}
          className="h-9 w-9 grid place-items-center rounded-md bg-white/5 hover:bg-white/10 text-white"
          aria-label="Previous"
        >
          <SkipBack size={16} />
        </button>

        <button
          onClick={togglePlay}
          className="h-9 px-4 grid place-items-center rounded-md text-white"
          style={{ backgroundColor: accent }}
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? <Pause size={16} /> : <Play size={16} />}
        </button>

        <button
          onClick={onNext}
          className="h-9 w-9 grid place-items-center rounded-md bg-white/5 hover:bg-white/10 text-white"
          aria-label="Next"
        >
          <SkipForward size={16} />
        </button>

        <div className="mx-1 sm:mx-2" />

        <button className="h-9 w-9 grid place-items-center rounded-md bg-white/5 hover:bg-white/10 text-white" aria-label="Shuffle">
          <Shuffle size={16} />
        </button>
        <button className="h-9 w-9 grid place-items-center rounded-md bg-white/5 hover:bg-white/10 text-white" aria-label="Repeat">
          <Repeat size={16} />
        </button>

        <div className="mx-1 sm:mx-2" />

        <button
          onClick={toggleMute}
          className="h-9 w-9 grid place-items-center rounded-md bg-white/5 hover:bg-white/10 text-white"
          aria-label="Mute"
        >
          {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
        </button>
      </div>
    </div>
  );
};
