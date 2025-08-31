import React from 'react';
import { createPortal } from 'react-dom';
import { TrackItem } from '@/types';
import { Music } from 'lucide-react';

interface DragTrackCloneProps {
  track: TrackItem;
  position: { x: number; y: number };
}

export const DragTrackClone: React.FC<DragTrackCloneProps> = ({ track, position }) => {
  const clone = (
    <div
      className="fixed pointer-events-none z-50 transform transition-transform duration-75"
      style={{
        left: position.x - 60,
        top: position.y - 20,
        transform: 'rotate(-2deg) scale(0.95)',
      }}
    >
      <div className="bg-[#1e1e1e] rounded-xl p-3 border border-white/10 shadow-2xl backdrop-blur-sm bg-opacity-90">
        <div className="flex items-center gap-3">
          <div className="shrink-0 w-10 h-10 rounded-md bg-black/30 overflow-hidden">
            {track.coverUrl ? (
              <img src={track.coverUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-purple-500/20 to-cyan-500/20 flex items-center justify-center">
                <Music className="w-5 h-5 text-white/60" />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs text-white/80 font-medium truncate">
              {track.title || "Song Title"}
            </div>
            <div className="text-xs text-white/50 truncate">
              No Artist
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(clone, document.body);
};