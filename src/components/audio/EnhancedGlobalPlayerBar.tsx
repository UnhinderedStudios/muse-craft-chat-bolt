import { useEffect, useMemo, useRef } from "react";
import { SkipBack, SkipForward, Play, Pause, Shuffle, Repeat, Volume2, VolumeX, Radio, X } from "lucide-react";
import { useGlobalPlayer } from "@/contexts/GlobalPlayerContext";

type Props = {
  // Session player props
  title?: string;
  audioRefs?: React.MutableRefObject<HTMLAudioElement[]>;
  currentAudioIndex?: number;
  isPlaying?: boolean;
  currentTime?: number;
  onPrev?: () => void;
  onNext?: () => void;
  onPlay?: () => void;
  onPause?: () => void;
  onSeek?: (t: number) => void;
  accent?: string;
  disabled?: boolean;
  
  // Additional props for enhanced functionality
  showGlobalPlayer?: boolean;
};

export const EnhancedGlobalPlayerBar = ({
  title = "—",
  audioRefs,
  currentAudioIndex = 0,
  isPlaying = false,
  currentTime = 0,
  onPrev,
  onNext,
  onPlay,
  onPause,
  onSeek,
  accent = "#f92c8f",
  disabled = false,
  showGlobalPlayer = true,
}: Props) => {
  const waveRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<any>(null);
  const { state: globalState, pauseGlobalPlayer, resumeGlobalPlayer, stopGlobalPlayer, seekGlobal, playNext: globalNext, playPrevious: globalPrev } = useGlobalPlayer();

  // Determine which player to show - global takes priority when active
  const useGlobalPlayerMode = showGlobalPlayer && globalState.isRadioMode && globalState.currentTrack;
  
  // Get appropriate values based on active player
  const activeTitle = useGlobalPlayerMode ? (globalState.currentTrack?.title || "Radio") : title;
  const activeIsPlaying = useGlobalPlayerMode ? globalState.isPlaying : isPlaying;
  const activeCurrentTime = useGlobalPlayerMode ? globalState.currentTime : currentTime;
  const activeDuration = useGlobalPlayerMode ? globalState.duration : (audioRefs?.current[currentAudioIndex]?.duration || 0);
  
  // Audio element for waveform
  const audioEl = useGlobalPlayerMode ? null : audioRefs?.current[currentAudioIndex];

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

      if (!audioEl || useGlobalPlayerMode) {
        waveRef.current.innerHTML = "";
        return;
      }

      const { default: WaveSurfer } = await import("wavesurfer.js");
      if (cancelled) return;

      const ws = WaveSurfer.create({
        container: waveRef.current!,
        media: audioEl,
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
  }, [audioEl, currentAudioIndex, useGlobalPlayerMode]);

  const handleWavePointer = (e: React.PointerEvent) => {
    if (disabled) return;
    
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const pct = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    
    if (useGlobalPlayerMode) {
      seekGlobal(pct * activeDuration);
    } else if (audioEl && onSeek) {
      onSeek(pct * (audioEl.duration || 0));
    }
  };

  const handlePlayPause = () => {
    if (disabled) return;
    
    if (useGlobalPlayerMode) {
      if (activeIsPlaying) {
        pauseGlobalPlayer();
      } else {
        resumeGlobalPlayer();
      }
    } else {
      if (activeIsPlaying && onPause) {
        onPause();
      } else if (!activeIsPlaying && onPlay) {
        onPlay();
      }
    }
  };

  const handlePrev = () => {
    if (disabled) return;
    
    if (useGlobalPlayerMode) {
      globalPrev();
    } else if (onPrev) {
      onPrev();
    }
  };

  const handleNext = () => {
    if (disabled) return;
    
    if (useGlobalPlayerMode) {
      globalNext();
    } else if (onNext) {
      onNext();
    }
  };

  const pct = useMemo(() => {
    if (!activeDuration) return 0;
    return Math.min(100, Math.max(0, (activeCurrentTime / activeDuration) * 100));
  }, [activeCurrentTime, activeDuration]);

  return (
    <div className="rounded-xl bg-[#101010] shadow-sm w-full overflow-hidden select-none">
      {/* Radio mode indicator */}
      {useGlobalPlayerMode && (
        <div className="flex items-center justify-between px-4 py-2 bg-purple-500/10 border-b border-purple-500/20">
          <div className="flex items-center gap-2 text-purple-400 text-sm">
            <Radio className="w-4 h-4" />
            <span>Radio Mode • Playing from {globalState.originatingSessionId}</span>
          </div>
          <button 
            onClick={stopGlobalPlayer}
            className="text-purple-400 hover:text-white transition-colors"
            aria-label="Stop radio"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Waveform — edge to edge */}
      <div className="relative w-full overflow-hidden" onPointerDown={handleWavePointer}>
        <div ref={waveRef} className="w-full h-[56px]" />
        {/* Slim progress line for crisp visibility */}
        <div className="absolute bottom-0 left-0 h-[3px]" style={{ width: `${pct}%`, backgroundColor: useGlobalPlayerMode ? "#a855f7" : accent }} />
      </div>

      {/* Under-wave controls row */}
      <div className="grid grid-cols-[220px_1fr_220px] items-center gap-4 px-4 py-3">
        {/* Left: title + time */}
        <div className="min-w-0">
          <div className="text-[15px] text-white truncate">{activeTitle}</div>
          <div className="text-xs text-white/60">{fmt(activeCurrentTime)} • {fmt(activeDuration)}</div>
        </div>

        {/* Center: transport */}
        <div className="flex items-center justify-center gap-3">
          <button className="h-9 w-9 grid place-items-center rounded-lg bg-[#1e1e1e] text-white/90 disabled:opacity-40"
                  onClick={handlePrev} disabled={disabled} aria-label="Previous">
            <SkipBack size={18} />
          </button>
          <button className={`h-9 w-9 grid place-items-center rounded-lg text-white ${disabled ? "opacity-40" : ""}`}
                  onClick={handlePlayPause} disabled={disabled}
                  aria-label={activeIsPlaying ? "Pause" : "Play"}
                  style={{ backgroundColor: activeIsPlaying ? "#e02681" : (useGlobalPlayerMode ? "#a855f7" : accent) }}>
            {activeIsPlaying ? <Pause size={18} /> : <Play size={18} />}
          </button>
          <button className="h-9 w-9 grid place-items-center rounded-lg bg-[#1e1e1e] text-white/90 disabled:opacity-40"
                  onClick={handleNext} disabled={disabled} aria-label="Next">
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
            {useGlobalPlayerMode ? <Volume2 size={16} /> : (audioEl && audioEl.muted ? <VolumeX size={16} /> : <Volume2 size={16} />)}
          </button>
        </div>
      </div>
    </div>
  );
};