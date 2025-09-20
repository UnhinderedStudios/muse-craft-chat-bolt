import { Play, Pause, SkipBack, SkipForward, Heart, Share2, Plus, Volume2, Pencil } from "lucide-react";
import BarWaveform from "@/components/audio/BarWaveform";
import EllipsisMarquee from "@/components/ui/EllipsisMarquee";
import { useState } from "react";
import { useGlobalPlayer } from "@/contexts/GlobalPlayerContext";

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
  onTitleUpdate?: (newTitle: string) => void;
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
  onTitleUpdate,
}: Props) {
  const { state: globalState, pauseGlobalPlayer, resumeGlobalPlayer, playNext: globalNext, playPrevious: globalPrev } = useGlobalPlayer();
  
  // Determine active player state - use global if radio mode is active
  const isRadioMode = globalState.isRadioMode && globalState.currentTrack;
  const activeTitle = isRadioMode ? globalState.currentTrack?.title || "No track yet" : title;
  const activeIsPlaying = isRadioMode ? globalState.isPlaying : isPlaying;
  const activeCurrentTime = isRadioMode ? globalState.currentTime : currentTime;
  const activeDuration = isRadioMode ? globalState.duration : (audioRefs.current[currentAudioIndex]?.duration ?? 0);
  const activeAlbumCover = isRadioMode ? globalState.currentTrack?.coverUrl : albumCoverUrl;
  
  const audio = audioRefs.current[currentAudioIndex];
  const duration = audio?.duration ?? 0;
  const progress = activeDuration > 0 ? Math.min((activeCurrentTime / activeDuration) * 100, 100) : 0;

  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState("");

  const handleEditStart = () => {
    setEditValue(activeTitle);
    setIsEditing(true);
  };

  const handleEditSave = () => {
    if (onTitleUpdate && editValue.trim()) {
      onTitleUpdate(editValue.trim());
    }
    setIsEditing(false);
  };

  const handleEditCancel = () => {
    setIsEditing(false);
    setEditValue("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleEditSave();
    } else if (e.key === "Escape") {
      handleEditCancel();
    }
  };

  // Handle play/pause with global awareness
  const handlePlayPause = () => {
    if (isRadioMode) {
      if (activeIsPlaying) {
        pauseGlobalPlayer();
      } else {
        resumeGlobalPlayer();
      }
    } else {
      if (isPlaying) {
        onPause();
      } else {
        onPlay();
      }
    }
  };

  // Handle previous with global awareness
  const handlePrev = () => {
    if (isRadioMode) {
      globalPrev();
    } else {
      onPrev();
    }
  };

  // Handle next with global awareness
  const handleNext = () => {
    if (isRadioMode) {
      globalNext();
    } else {
      onNext();
    }
  };


  return (
    <div className="w-full h-full flex flex-col relative z-10 pt-2">
      <div className="h-[28px] bg-transparent">
        {/* Bar Waveform - tall sticks, edge to edge */}
        <BarWaveform
          audio={isRadioMode ? null : (audioRefs.current[currentAudioIndex] || null)}
          currentTime={activeCurrentTime}
          onSeek={isRadioMode ? () => {} : onSeek}
          accent={accent}
          height={28}        // proportionally reduced with container
          barWidth={3}       // chunky sticks
          barGap={1}
        />
      </div>

      {/* Controls row - centered in remaining space */}
      <div className="flex items-center justify-between pt-1 pb-0 px-3">
        {/* Left: album art + title + time - compact */}
        <div className="flex items-center gap-2 min-w-0 w-48">
          {activeAlbumCover && (
            <button
              onClick={onFullscreenKaraoke}
              className="w-8 h-8 aspect-square rounded overflow-hidden border border-white/20 hover:border-white/40 transition-colors flex-shrink-0"
              disabled={disabled || !onFullscreenKaraoke}
            >
              <img 
                src={activeAlbumCover} 
                alt="Album cover"
                className="w-full h-full object-cover"
              />
            </button>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1 text-sm text-white/90">
              {isEditing ? (
                <input
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value.slice(0, 50))}
                  onBlur={handleEditSave}
                  onKeyDown={handleKeyDown}
                  className="bg-transparent border-b border-white/30 outline-none text-sm text-white/90 w-full max-w-full overflow-hidden text-ellipsis whitespace-nowrap"
                  placeholder="Track title"
                  autoFocus
                  maxLength={50}
                  style={{ width: '100%', maxWidth: '100%' }}
                />
              ) : (
                <>
                  <div className="flex items-center min-w-0 flex-1">
                    <EllipsisMarquee
                      text={activeTitle || "No track yet"}
                      className="text-sm text-white/90"
                      speedPxPerSec={30}
                    />
                    {onTitleUpdate && !isRadioMode && (
                      <button
                        onClick={() => {
                          console.log("Edit button clicked, title:", activeTitle, "onTitleUpdate:", !!onTitleUpdate);
                          handleEditStart();
                        }}
                        className="p-1 hover:bg-white/10 rounded opacity-60 hover:opacity-100 transition-opacity flex-shrink-0 ml-1"
                        disabled={disabled}
                      >
                        <Pencil size={12} />
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
            <div className="text-[11px] text-white/50">
              {formatTime(activeCurrentTime)} • {formatTime(activeDuration)}
            </div>
          </div>
        </div>

        {/* Center: transport - prominent */}
        <div className="flex items-center gap-3">
          <IconBtn onClick={handlePrev} disabled={disabled} className="h-8 w-8"><SkipBack size={16} /></IconBtn>
          {activeIsPlaying ? (
            <IconBtn onClick={handlePlayPause} primary disabled={disabled} className="h-10 w-10"><Pause size={18} /></IconBtn>
          ) : (
            <IconBtn onClick={handlePlayPause} primary disabled={disabled} className="h-10 w-10"><Play size={18} /></IconBtn>
          )}
          <IconBtn onClick={handleNext} disabled={disabled} className="h-8 w-8"><SkipForward size={16} /></IconBtn>
        </div>

        {/* Right: actions - compact */}
        <div className="flex items-center gap-2 text-white/70 w-48 justify-end">
          <IconBtn disabled={disabled} className="hidden sm:flex"><Plus size={14} /></IconBtn>
          <IconBtn disabled={disabled} className="hidden sm:flex"><Heart size={14} /></IconBtn>
          <IconBtn disabled={disabled}><Share2 size={14} /></IconBtn>
          <IconBtn disabled={disabled}><Volume2 size={14} /></IconBtn>
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