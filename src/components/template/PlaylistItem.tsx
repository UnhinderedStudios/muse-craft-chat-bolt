import React, { useState, useEffect } from "react";
import { MoreVertical, Music, User, Edit3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Playlist } from "./TemplatePanel";
import EllipsisMarquee from "@/components/ui/EllipsisMarquee";
import { useDrag } from "@/contexts/DragContext";
import { TrackItem } from "@/types";
import { useSessionPlaylists } from "@/hooks/use-session-playlists";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface PlaylistItemProps {
  playlist: Playlist;
  onMenuAction: (playlistId: string, action: string) => void;
  onTrackAdd?: (playlistId: string, track: TrackItem) => void;
  onTitleEdit?: (playlistId: string, newTitle: string) => void;
  onPlaylistClick?: (playlist: Playlist) => void;
  isArtist?: boolean;
}

export function PlaylistItem({ playlist, onMenuAction, onTrackAdd, onTitleEdit, onPlaylistClick, isArtist = false }: PlaylistItemProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isDropReady, setIsDropReady] = useState(false);
  const [showDropSuccess, setShowDropSuccess] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(playlist.name);
  const { dragState, setActiveDropZone, endDrag } = useDrag();
  const { addTrackToPlaylist } = useSessionPlaylists();
  
  const handleMenuAction = (action: string) => {
    onMenuAction(playlist.id, action);
  };

  const handleTitleClick = () => {
    // Don't allow editing of Favourites playlist
    if (playlist.id === "favourites") return;
    setIsEditing(true);
    setEditTitle(playlist.name);
  };

  const handleTitleSubmit = () => {
    if (editTitle.trim() && editTitle.trim() !== playlist.name) {
      onTitleEdit?.(playlist.id, editTitle.trim());
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleTitleSubmit();
    } else if (e.key === 'Escape') {
      setEditTitle(playlist.name);
      setIsEditing(false);
    }
  };

  // Handle drag over detection
  useEffect(() => {
    if (!dragState.isDragging) {
      setIsDropReady(false);
      return;
    }

    const element = document.getElementById(`playlist-${playlist.id}`);
    if (!element) return;

    const handleMouseEnter = () => {
      setIsDropReady(true);
      setActiveDropZone(playlist.id);
    };

    const handleMouseLeave = () => {
      setIsDropReady(false);
      setActiveDropZone(null);
    };

    element.addEventListener('mouseenter', handleMouseEnter);
    element.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      element.removeEventListener('mouseenter', handleMouseEnter);
      element.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [dragState.isDragging, playlist.id, setActiveDropZone]);

  // Handle drop robustly using hit-testing at mouseup (capture phase)
  useEffect(() => {
    if (!dragState.isDragging || !dragState.draggedTrack) return;

    const handleMouseUp = (e: MouseEvent) => {
      const el = document.getElementById(`playlist-${playlist.id}`);
      if (!el) return;

      const pointEl = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
      const overThis = !!pointEl && (pointEl.id === `playlist-${playlist.id}` || !!pointEl.closest(`#playlist-${playlist.id}`));

      if (overThis && onTrackAdd) {
        setShowDropSuccess(true);
        addTrackToPlaylist(playlist.id, dragState.draggedTrack);
        onTrackAdd(playlist.id, dragState.draggedTrack);
        setTimeout(() => setShowDropSuccess(false), 2000);
      }
    };

    document.addEventListener('mouseup', handleMouseUp, { capture: true, once: true });
    return () => document.removeEventListener('mouseup', handleMouseUp, { capture: true });
  }, [dragState.isDragging, dragState.draggedTrack, playlist.id, onTrackAdd, addTrackToPlaylist]);

  const handlePlaylistClick = (e: React.MouseEvent) => {
    // Don't trigger if clicking on edit area, dropdown, or during editing
    if (isEditing) return;
    
    const target = e.target as HTMLElement;
    if (target.closest('[data-radix-collection-item]') || target.closest('button') || target.closest('input')) {
      return;
    }
    
    onPlaylistClick?.(playlist);
  };

  return (
    <div 
      id={`playlist-${playlist.id}`}
      className={cn(
        "group bg-[#1e1e1e] rounded-xl p-3 cursor-pointer hover:bg-[#252525] transition-all duration-200",
        isDropReady && "playlist-drop-ready",
        showDropSuccess && "playlist-drop-success"
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handlePlaylistClick}
    >
      <div className="flex items-center gap-3">
        {/* Icon - Fixed width */}
        <div className="flex-none w-10 h-10 rounded-md bg-black/30 flex items-center justify-center">
          {isArtist ? (
            <User className="w-5 h-5 text-white/60" />
          ) : (
            <Music className="w-5 h-5 text-white/60" />
          )}
        </div>

        {/* Title area - Flexible with overflow handling */}
        <div className="flex-1 min-w-0 overflow-hidden">
          {isEditing ? (
            <input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onBlur={handleTitleSubmit}
              onKeyDown={handleKeyDown}
              className="w-full text-sm font-medium bg-transparent border-none outline-none text-white p-0 m-0"
              autoFocus
            />
          ) : (
            <div 
              onClick={handleTitleClick}
              className={cn(
                "flex items-center gap-1 group/title",
                playlist.id === "favourites" ? "cursor-default" : "cursor-pointer"
              )}
            >
              <EllipsisMarquee
                text={playlist.name}
                className="w-full text-sm font-medium text-white"
                speedPxPerSec={70}
                gapPx={32}
                isActive={isHovered}
              />
              {playlist.id !== "favourites" && (
                <Edit3 className="w-3 h-3 text-white/40 opacity-0 group-hover/title:opacity-100 transition-opacity" />
              )}
            </div>
          )}
          <div className="text-xs text-white/60 truncate">
            {playlist.songs.length} {playlist.songs.length === 1 ? 'song' : 'songs'}
            {playlist.isFavorited && (
              <span className="ml-2 text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded">
                ★
              </span>
            )}
          </div>
        </div>

        {/* 3-dot Menu - Fixed width */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button 
              className="flex-none opacity-0 group-hover:opacity-100 w-8 h-8 flex items-center justify-center text-white/60 hover:text-white transition-all duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreVertical className="w-4 h-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent 
            align="end" 
            className="w-48 bg-[#1e1e1e] border-white/10"
          >
            <DropdownMenuItem 
              onClick={() => handleMenuAction('play')}
              className="text-white hover:bg-white/10 focus:bg-white/10"
            >
              {isArtist ? 'Play All Songs' : 'Play Playlist'}
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => handleMenuAction('shuffle')}
              className="text-white hover:bg-white/10 focus:bg-white/10"
            >
              Shuffle Play
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-white/10" />
            <DropdownMenuItem 
              onClick={() => handleMenuAction('rename')}
              className="text-white hover:bg-white/10 focus:bg-white/10"
            >
              Rename
            </DropdownMenuItem>
            {!playlist.isFavorited && (
              <DropdownMenuItem 
                onClick={() => handleMenuAction('favorite')}
                className="text-white hover:bg-white/10 focus:bg-white/10"
              >
                Add to Favorites
              </DropdownMenuItem>
            )}
            <DropdownMenuItem 
              onClick={() => handleMenuAction('duplicate')}
              className="text-white hover:bg-white/10 focus:bg-white/10"
            >
              Duplicate
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-white/10" />
            <DropdownMenuItem 
              onClick={() => handleMenuAction('export')}
              className="text-white hover:bg-white/10 focus:bg-white/10"
            >
              Export
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => handleMenuAction('delete')}
              className="text-red-400 hover:bg-red-500/10 focus:bg-red-500/10"
            >
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}