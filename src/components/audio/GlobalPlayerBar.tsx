import { useEffect, useMemo, useRef } from "react";
import { SkipBack, SkipForward, Play, Pause, Shuffle, Repeat, Volume2, VolumeX } from "lucide-react";

type Props = {
  title?: string;
  audioRefs: React.MutableRefObject<HTMLAudioElement[]>;
  currentAudioIndex: number;
  isPlaying: boolean;
  currentTime: number;
  onPrev: () => void;
  onNext: () => void;
  onPlay: () => void;
  onPause: () => void;
  onSeek: (t: number) => void;
  accent?: string;    // default #f92c8f
  disabled?: boolean; // render but disable controls
};

export const GlobalPlayerBar = ({
  title = "—",
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
}: Props) => {
  const waveRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<any>(null);

  const audioEl = audioRefs.current?.[currentAudioIndex];
  const duration = audioEl?.duration ?? 0;

  const fmt = (sec: number) => {
    if (!isFinite(sec) || sec <= 0) return "0:00";
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      if (!waveRef.current) return;

      // destroy any previous instance
      if (wavesurferRef.current) {
        try { wavesurferRef.current.destroy(); } catch {}
        wavesurferRef.current = null;
      }

      if (!audioEl) {
        waveRef.current.innerHTML = "";
        return;
      }

      const { default: WaveSurfer } = await import("wavesurfer.js");
      if (cancelled) return;

      const ws = WaveSurfer.create({
        container: waveRef.current!,
        media: audioEl,                // bind to existing <audio>
        height: 56,
        barWidth: 2,
        barGap: 1,
        barRadius: 2,
        waveColor: "#2a2a2a",
        progressColor: accent,
        cursorWidth: 0,
        interact: true,
        dragToSeek: true,
        fillParent: true,
        autoCenter: false,
        normalize: true,
        
      });

      wavesurferRef.current = ws;
    }

    boot();
    return () => {
      cancelled = true;
      if (wavesurferRef.current) {
        try { wavesurferRef.current.destroy(); } catch {}
        wavesurferRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioEl, currentAudioIndex]);

  const handleWavePointer = (e: React.PointerEvent) => {
    if (!audioEl || disabled) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const pct = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    onSeek(pct * (audioEl.duration || 0));
  };

  const pct = useMemo(() => {
    if (!duration) return 0;
    return Math.min(100, Math.max(0, (currentTime / duration) * 100));
  }, [currentTime, duration]);

  return (
    <div className="rounded-xl bg-[#101010] shadow-sm w-full overflow-hidden select-none">
      {/* Waveform — edge to edge */}
      <div className="relative w-full overflow-hidden" onPointerDown={handleWavePointer}>
        <div ref={waveRef} className="w-full h-[56px]" />
        {/* Slim progress line for crisp visibility */}
        <div className="absolute bottom-0 left-0 h-[3px]" style={{ width: `${pct}%`, backgroundColor: accent }} />
      </div>

      {/* Under-wave controls row */}
      <div className="grid grid-cols-[220px_1fr_220px] items-center gap-4 px-4 py-3">
        {/* Left: title + time */}
        <div className="min-w-0">
          <div className="text-[15px] text-white truncate">{title}</div>
          <div className="text-xs text-white/60">{fmt(currentTime)} • {fmt(duration)}</div>
        </div>

        {/* Center: transport */}
        <div className="flex items-center justify-center gap-3">
          <button className="h-9 w-9 grid place-items-center rounded-lg bg-[#1e1e1e] text-white/90 disabled:opacity-40"
                  onClick={onPrev} disabled={disabled} aria-label="Previous">
            <SkipBack size={18} />
          </button>
          <button className={`h-9 w-9 grid place-items-center rounded-lg text-white ${disabled ? "opacity-40" : ""}`}
                  onClick={isPlaying ? onPause : onPlay} disabled={disabled}
                  aria-label={isPlaying ? "Pause" : "Play"}
                  style={{ backgroundColor: isPlaying ? "#e02681" : accent }}>
            {isPlaying ? <Pause size={18} /> : <Play size={18} />}
          </button>
          <button className="h-9 w-9 grid place-items-center rounded-lg bg-[#1e1e1e] text-white/90 disabled:opacity-40"
                  onClick={onNext} disabled={disabled} aria-label="Next">
            <SkipForward size={18} />
          </button>
        </div>

        {/* Right: extra controls (placeholders) */}
        <div className="flex items-center justify-end gap-3 text-white/80">
          <button className="h-9 px-3 rounded-lg bg-[#1e1e1e] disabled:opacity-40" disabled={disabled} aria-label="Shuffle">
            <Shuffle size={16} />
          </button>
          <button className="h-9 px-3 rounded-lg bg-[#1e1e1e] disabled:opacity-40" disabled={disabled} aria-label="Repeat">
            <Repeat size={16} />
          </button>
          <button className="h-9 px-3 rounded-lg bg-[#1e1e1e] disabled:opacity-40" disabled={disabled} aria-label="Volume">
            {audioEl && audioEl.muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>
        </div>
      </div>
    </div>
  );
};