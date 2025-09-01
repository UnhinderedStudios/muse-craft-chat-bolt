import React, { useEffect } from "react";
import { X } from "lucide-react";
import { Playlist } from "./TemplatePanel";
import { cn } from "@/lib/utils";

interface PlaylistOverlayProps {
  playlist: Playlist | null;
  isOpen: boolean;
  onClose: () => void;
}

export function PlaylistOverlay({ playlist, isOpen, onClose }: PlaylistOverlayProps) {
  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen || !playlist) return null;

  return (
    <div 
      className="fixed inset-0 z-50 backdrop-blur-md"
      onClick={onClose}
    >
      {/* Centered black rectangle */}
      <div 
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-black/80 rounded-2xl p-8 min-w-[400px] max-w-[600px] w-[90vw] max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center text-white/60 hover:text-white transition-colors rounded-full hover:bg-white/10"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Playlist content */}
        <div className="text-white">
          <h2 className="text-2xl font-bold mb-2">{playlist.name}</h2>
          <p className="text-white/60 mb-6">
            {playlist.songCount} {playlist.songCount === 1 ? 'song' : 'songs'}
          </p>
          
          {playlist.isFavorited && (
            <div className="inline-flex items-center gap-2 mb-4 px-3 py-1 bg-yellow-500/20 text-yellow-400 rounded-full text-sm">
              <span>★</span>
              <span>Favorited</span>
            </div>
          )}

          {/* Placeholder content - you can expand this */}
          <div className="text-white/80">
            <p className="mb-4">This is the playlist details view.</p>
            <p className="text-sm text-white/60">
              Created {new Date(playlist.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}