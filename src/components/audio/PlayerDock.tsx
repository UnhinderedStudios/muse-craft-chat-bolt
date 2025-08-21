import { Play, Pause, SkipBack, SkipForward, Edit3 } from "lucide-react";
import React from "react";

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
  onSeek: (t: number) => void;
  accent?: string;
  disabled?: boolean;
};

function fmt(t: number) {
  if (!t || isNaN(t)) return "0:00";
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

const PlayerDock: React.FC<Props> = ({
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
  disabled
}) => {
  const a = audioRefs.current[currentAudioIndex];
  const duration = a?.duration || 0;
  const pct = duration ? (Math.min(currentTime, duration) / duration) * 100 : 0;
  const clickable = !disabled && duration > 0;

  // Click-to-seek on the waveform bar
  const handleSeekClick: React.MouseEventHandler<HTMLDivElement> = (e) => {
    if (!clickable) return;
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const ratio = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1);
    onSeek(ratio * duration);
  };

  return (
    <div className="w-full">
      {/* WAVEFORM (edge-to-edge, condensed, no border) */}
      <div
        className="w-full h-6 md:h-7 lg:h-8 rounded-none overflow-hidden cursor-pointer"
        onClick={handleSeekClick}
        style={{
          WebkitMaskImage:
            // A condensed bar waveform look that scales with width; no scrolling needed
            "repeating-linear-gradient(90deg, #000 0 2px, transparent 2px 6px)",
          maskImage:
            "repeating-linear-gradient(90deg, #000 0 2px, transparent 2px 6px)",
          background:
            // two layers: played (accent) & unplayed (dim) for a clean progress look
            `linear-gradient(to right, ${accent} ${pct}%, transparent ${pct}%), rgba(255,255,255,0.14)`,
        }}
      />

      {/* META + CONTROLS ROW */}
      <div className="mt-2 flex items-center justify-between gap-3">
        <div className="min-w-0 text-[13px] text-white/85 flex items-center gap-2">
          <span className="truncate">{title || "No track yet"}</span>
          <span className="text-white/40">|</span>
          <span className="tabular-nums text-white/70">
            {fmt(currentTime)} · {fmt(duration)}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            className="h-8 w-8 grid place-items-center rounded-md bg-[#1b1b1b] text-white/90 disabled:opacity-50"
            onClick={onPrev}
            disabled={disabled}
            aria-label="Previous"
          >
            <SkipBack size={16} />
          </button>

          {isPlaying ? (
            <button
              className="h-8 px-3 rounded-md text-white font-medium"
              style={{ backgroundColor: accent }}
              onClick={onPause}
              disabled={disabled}
              aria-label="Pause"
            >
              <Pause size={16} />
            </button>
          ) : (
            <button
              className="h-8 px-3 rounded-md text-white font-medium"
              style={{ backgroundColor: accent }}
              onClick={onPlay}
              disabled={disabled}
              aria-label="Play"
            >
              <Play size={16} />
            </button>
          )}

          <button
            className="h-8 w-8 grid place-items-center rounded-md bg-[#1b1b1b] text-white/90 disabled:opacity-50"
            onClick={onNext}
            disabled={disabled}
            aria-label="Next"
          >
            <SkipForward size={16} />
          </button>

          <button
            className="ml-1 h-8 w-8 grid place-items-center rounded-md bg-[#1b1b1b] text-white/80"
            aria-label="Edit"
          >
            <Edit3 size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default PlayerDock;