import { Play, Pause, SkipBack, SkipForward, Heart, Share2, Plus, Volume2 } from "lucide-react";
import { useMemo } from "react";

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

export default function PlayerDock({
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
}: Props) {
  const audio = audioRefs.current[currentAudioIndex];
  const duration = audio?.duration ?? 0;
  const progress = duration > 0 ? Math.min((currentTime / duration) * 100, 100) : 0;

  // A condensed "template waveform" (no real samples) that matches the ref look.
  // It's just repeating bars with an accent overlay for progress.
  const barStyle = useMemo(() => ({
    backgroundImage:
      "repeating-linear-gradient(90deg, rgba(255,255,255,0.16) 0, rgba(255,255,255,0.16) 2px, transparent 2px, transparent 6px)",
  }), []);

  return (
    <div className="w-full h-full flex flex-col relative z-10">
      <div className="flex-1 bg-transparent">
        {/* Waveform (edge-to-edge, condensed, no scroll) */}
        <div
          className="h-6 w-full overflow-hidden cursor-pointer bg-black relative z-10"
            style={barStyle}
            onClick={(e) => {
              if (disabled) return;
              const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
              const ratio = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1);
              if (duration > 0) onSeek(ratio * duration);
            }}
          >
            {/* progress overlay */}
            <div
              className="h-full"
              style={{
                width: `${progress}%`,
                background:
                  `repeating-linear-gradient(90deg, ${accent} 0, ${accent} 2px, transparent 2px, transparent 6px)`,
                mixBlendMode: "normal",
              }}
            />
        </div>

        {/* Controls row */}
        <div className="flex items-center gap-4 px-3 py-2 md:px-4">
            {/* Left: title + time */}
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm text-white/90">{title || "No track yet"}</div>
              <div className="text-[11px] text-white/50">
                {formatTime(currentTime)} • {formatTime(duration)}
              </div>
            </div>

            {/* Center: transport */}
            <div className="flex items-center gap-2">
              <IconBtn onClick={onPrev} disabled={disabled}><SkipBack size={16} /></IconBtn>
              {isPlaying ? (
                <IconBtn onClick={onPause} primary disabled={disabled}><Pause size={16} /></IconBtn>
              ) : (
                <IconBtn onClick={onPlay} primary disabled={disabled}><Play size={16} /></IconBtn>
              )}
              <IconBtn onClick={onNext} disabled={disabled}><SkipForward size={16} /></IconBtn>
            </div>

            {/* Right: actions */}
            <div className="flex items-center gap-3 text-white/70">
              <IconBtn disabled={disabled}><Plus size={16} /></IconBtn>
              <IconBtn disabled={disabled}><Heart size={16} /></IconBtn>
              <IconBtn disabled={disabled}><Share2 size={16} /></IconBtn>
              <IconBtn disabled={disabled}><Volume2 size={16} /></IconBtn>
          </div>
        </div>
      </div>
    </div>
  );
}

function IconBtn({
  children,
  onClick,
  disabled,
  primary,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      aria-disabled={disabled}
      className={[
        "grid h-8 w-8 place-items-center rounded-md",
        primary ? "bg-[#f92c8f] text-white" : "bg-white/5 text-white",
        disabled ? "opacity-40 cursor-not-allowed" : "hover:bg-white/10",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function formatTime(sec?: number) {
  if (!sec || !isFinite(sec)) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}