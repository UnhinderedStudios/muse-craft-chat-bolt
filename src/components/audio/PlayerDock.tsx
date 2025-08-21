import { Play, Pause, SkipBack, SkipForward, Heart, Share2, Plus, Volume2 } from "lucide-react";
import BarWaveform from "@/components/audio/BarWaveform";

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


  return (
    <div className="w-full h-full flex flex-col relative z-10">
      <div className="flex-1 bg-transparent">
        {/* Bar Waveform - tall sticks, edge to edge */}
        <BarWaveform
          audio={audioRefs.current[currentAudioIndex] || null}
          currentTime={currentTime}
          onSeek={onSeek}
          accent={accent}
          height={48}        // optimized height to leave more room for controls
          barWidth={3}       // chunky sticks
          barGap={1}
        />

        {/* Controls row */}
        <div className="flex items-center gap-2 md:gap-3 px-3 py-3 md:px-4">
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

            {/* Right: actions - responsive */}
            <div className="flex items-center gap-2 text-white/70">
              <IconBtn disabled={disabled} className="hidden sm:flex"><Plus size={16} /></IconBtn>
              <IconBtn disabled={disabled} className="hidden sm:flex"><Heart size={16} /></IconBtn>
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
  className,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  primary?: boolean;
  className?: string;
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
        className,
      ].filter(Boolean).join(" ")}
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