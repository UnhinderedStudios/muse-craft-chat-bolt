import { Pencil } from "lucide-react";
import EllipsisMarquee from "@/components/ui/EllipsisMarquee";
import { useState } from "react";

type Props = {
  title: string;
  currentTime: number;
  duration: number;
  albumCoverUrl?: string;
  onFullscreenKaraoke?: () => void;
  onTitleUpdate?: (newTitle: string) => void;
  disabled?: boolean;
};

export default function PlayerTrackInfo({
  title,
  currentTime,
  duration,
  albumCoverUrl,
  onFullscreenKaraoke,
  onTitleUpdate,
  disabled = false,
}: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState("");

  const handleEditStart = () => {
    setEditValue(title);
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

  return (
    <div className="grid grid-cols-[auto_1fr] gap-2 items-center w-48 min-w-0">
      {/* Album cover - fixed width */}
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
      
      {/* Track info - constrained width */}
      <div className="min-w-0 overflow-hidden">
        {/* Title row - fixed height to prevent layout shift */}
        <div className="h-5 flex items-center gap-1 overflow-hidden">
          {isEditing ? (
            <div className="flex items-center gap-1 w-full min-w-0">
              <input
                value={editValue}
                onChange={(e) => setEditValue(e.target.value.slice(0, 50))}
                onBlur={handleEditSave}
                onKeyDown={handleKeyDown}
                className="bg-transparent border-b border-white/30 outline-none text-sm text-white/90 min-w-0 flex-1"
                placeholder="Track title"
                autoFocus
                maxLength={50}
              />
              <span className="text-xs text-white/40 flex-shrink-0">
                {editValue.length}/50
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1 w-full min-w-0">
              <div className="min-w-0 flex-1 overflow-hidden">
                <EllipsisMarquee
                  text={title || "No track yet"}
                  className="text-sm text-white/90"
                />
              </div>
              {onTitleUpdate && (
                <button
                  onClick={handleEditStart}
                  className="p-1 hover:bg-white/10 rounded opacity-60 hover:opacity-100 transition-opacity flex-shrink-0"
                  disabled={disabled}
                >
                  <Pencil size={12} />
                </button>
              )}
            </div>
          )}
        </div>
        
        {/* Time info - fixed height */}
        <div className="h-4 flex items-center">
          <div className="text-[11px] text-white/50 overflow-hidden text-ellipsis whitespace-nowrap">
            {formatTime(currentTime)} • {formatTime(duration)}
          </div>
        </div>
      </div>
    </div>
  );
}

function formatTime(sec?: number) {
  if (!sec || !isFinite(sec)) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}