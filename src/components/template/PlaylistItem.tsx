import React, { useState, useEffect } from "react";
import { MoreVertical, Music, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { Playlist } from "./TemplatePanel";
import EllipsisMarquee from "@/components/ui/EllipsisMarquee";
import { useDrag } from "@/contexts/DragContext";
import { TrackItem } from "@/types";
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
  isArtist?: boolean;
}

export function PlaylistItem({ playlist, onMenuAction, onTrackAdd, isArtist = false }: PlaylistItemProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isDropReady, setIsDropReady] = useState(false);
  const [showDropSuccess, setShowDropSuccess] = useState(false);
  const { dragState, setActiveDropZone, endDrag } = useDrag();
  
  const handleMenuAction = (action: string) => {
    onMenuAction(playlist.id, action);
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

  // Handle drop
  useEffect(() => {
    if (!dragState.isDragging) return;

    const handleMouseUp = () => {
      if (isDropReady && dragState.draggedTrack && onTrackAdd) {
        console.log('🎵 Track dropped on playlist:', playlist.name, dragState.draggedTrack.title);
        onTrackAdd(playlist.id, dragState.draggedTrack);
        setShowDropSuccess(true);
        console.log('✨ Showing drop success animation for playlist:', playlist.name);
        setTimeout(() => {
          setShowDropSuccess(false);
          console.log('🎯 Drop success animation completed for playlist:', playlist.name);
        }, 1000);
      }
    };

    document.addEventListener('mouseup', handleMouseUp);
    return () => document.removeEventListener('mouseup', handleMouseUp);
  }, [isDropReady, dragState.draggedTrack, playlist.id, onTrackAdd, dragState.isDragging]);

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
          <EllipsisMarquee
            text={playlist.name}
            className="w-full text-sm font-medium text-white"
            speedPxPerSec={70}
            gapPx={32}
            isActive={isHovered}
          />
          <div className="text-xs text-white/60 truncate">
            {playlist.songCount} {playlist.songCount === 1 ? 'song' : 'songs'}
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