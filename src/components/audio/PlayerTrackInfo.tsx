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
    <div className="w-48 h-16 relative bg-black/10 border border-white/10 rounded">
      {/* Album cover - absolute positioned */}
      {albumCoverUrl && (
        <button
          onClick={onFullscreenKaraoke}
          className="absolute left-2 top-2 w-8 h-8 rounded overflow-hidden border border-white/20 hover:border-white/40 transition-colors"
          disabled={disabled || !onFullscreenKaraoke}
        >
          <img 
            src={albumCoverUrl} 
            alt="Album cover"
            className="w-full h-full object-cover"
          />
        </button>
      )}
      
      {/* Track info - absolute positioned with fixed bounds */}
      <div className="absolute left-12 right-2 top-1 bottom-1 overflow-hidden">
        {/* Title row - strict height and overflow */}
        <div className="h-6 w-full overflow-hidden relative">
          {isEditing ? (
            <div className="flex items-center h-full">
              <input
                value={editValue}
                onChange={(e) => setEditValue(e.target.value.slice(0, 50))}
                onBlur={handleEditSave}
                onKeyDown={handleKeyDown}
                className="bg-transparent border-b border-white/30 outline-none text-sm text-white/90 w-full h-full"
                placeholder="Track title"
                autoFocus
                maxLength={50}
                style={{ 
                  width: '120px',
                  maxWidth: '120px',
                  minWidth: '120px'
                }}
              />
            </div>
          ) : (
            <div className="flex items-center h-full">
              <div 
                className="text-sm text-white/90 overflow-hidden whitespace-nowrap text-ellipsis pr-6"
                style={{ 
                  width: '120px',
                  maxWidth: '120px'
                }}
              >
                {title || "No track yet"}
              </div>
              {onTitleUpdate && (
                <button
                  onClick={handleEditStart}
                  className="absolute right-0 top-0 p-1 hover:bg-white/10 rounded opacity-60 hover:opacity-100 transition-opacity"
                  disabled={disabled}
                >
                  <Pencil size={12} />
                </button>
              )}
            </div>
          )}
        </div>
        
        {/* Time info - strict height */}
        <div 
          className="h-4 w-full overflow-hidden text-ellipsis whitespace-nowrap text-[11px] text-white/50"
          style={{ 
            width: '120px',
            maxWidth: '120px'
          }}
        >
          {formatTime(currentTime)} • {formatTime(duration)}
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