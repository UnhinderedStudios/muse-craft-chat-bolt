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
  albumCoverUrl?: string;
  onFullscreenKaraoke?: () => void;
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
  albumCoverUrl,
  onFullscreenKaraoke,
}: Props) {
  const audio = audioRefs.current[currentAudioIndex];
  const duration = audio?.duration ?? 0;
  const progress = duration > 0 ? Math.min((currentTime / duration) * 100, 100) : 0;


  return (
    <div className="w-full h-full flex flex-col relative z-10 pt-2">
      <div className="h-[28px] bg-transparent">
        {/* Bar Waveform - tall sticks, edge to edge */}
        <BarWaveform
          audio={audioRefs.current[currentAudioIndex] || null}
          currentTime={currentTime}
          onSeek={onSeek}
          accent={accent}
          height={28}        // proportionally reduced with container
          barWidth={3}       // chunky sticks
          barGap={1}
        />
      </div>

      {/* Controls row - centered in remaining space */}
      <div className="flex items-center justify-center pt-1 pb-0">
        <div className="flex items-center gap-2 md:gap-3 px-3 w-full max-w-full">
          {/* Left: album art + title + time */}
          <div className="min-w-0 flex-1 flex items-center gap-2">
            {albumCoverUrl && (
              <button
                onClick={onFullscreenKaraoke}
                className="w-8 h-8 aspect-square rounded overflow-hidden border border-white/20 hover:border-white/40 transition-colors flex-shrink-0"
                disabled={disabled || !onFullscreenKaraoke}
              >
                <img 
                  src={albumCoverUrl} 
                  alt="Album cover"
                  className="w-full h-full object-cover"
                />
              </button>
            )}
            <div className="min-w-0">
              <div className="truncate text-sm text-white/90">{title || "No track yet"}</div>
              <div className="text-[11px] text-white/50">
                {formatTime(currentTime)} • {formatTime(duration)}
              </div>
            </div>
          </div>

          {/* Center: transport */}
          <div className="flex items-center gap-2">
            <IconBtn onClick={onPrev} disabled={disabled}><SkipBack size={14} /></IconBtn>
            {isPlaying ? (
              <IconBtn onClick={onPause} primary disabled={disabled}><Pause size={14} /></IconBtn>
            ) : (
              <IconBtn onClick={onPlay} primary disabled={disabled}><Play size={14} /></IconBtn>
            )}
            <IconBtn onClick={onNext} disabled={disabled}><SkipForward size={14} /></IconBtn>
          </div>

          {/* Right: actions - responsive */}
          <div className="flex items-center gap-2 text-white/70">
            <IconBtn disabled={disabled} className="hidden sm:flex"><Plus size={14} /></IconBtn>
            <IconBtn disabled={disabled} className="hidden sm:flex"><Heart size={14} /></IconBtn>
            <IconBtn disabled={disabled}><Share2 size={14} /></IconBtn>
            <IconBtn disabled={disabled}><Volume2 size={14} /></IconBtn>
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
        "grid h-7 w-7 place-items-center rounded-md",
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