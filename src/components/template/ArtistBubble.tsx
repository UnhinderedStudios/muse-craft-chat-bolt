import React, { useState } from "react";
import { MoreVertical, User, Edit3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ArtistData } from "@/hooks/use-artist-management";
import EllipsisMarquee from "@/components/ui/EllipsisMarquee";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ArtistBubbleProps {
  artist: ArtistData;
  onMenuAction: (artistId: string, action: string) => void;
  onTitleEdit?: (artistId: string, newTitle: string) => void;
  onArtistClick?: (artist: ArtistData) => void;
  isSelected?: boolean;
}

export function ArtistBubble({ artist, onMenuAction, onTitleEdit, onArtistClick, isSelected = false }: ArtistBubbleProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(artist.name);

  const handleMenuAction = (action: string) => {
    onMenuAction(artist.id, action);
  };

  const handleTitleClick = () => {
    setIsEditing(true);
    setEditTitle(artist.name);
  };

  const handleTitleSubmit = () => {
    if (editTitle.trim() && editTitle.trim() !== artist.name) {
      onTitleEdit?.(artist.id, editTitle.trim());
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleTitleSubmit();
    } else if (e.key === 'Escape') {
      setEditTitle(artist.name);
      setIsEditing(false);
    }
  };

  const handleArtistClick = (e: React.MouseEvent) => {
    if (isEditing) return;
    
    const target = e.target as HTMLElement;
    if (target.closest('[data-radix-collection-item]') || target.closest('button') || target.closest('input')) {
      return;
    }
    
    onArtistClick?.(artist);
  };

  return (
    <div 
      className={cn(
        "group rounded-xl p-3 cursor-pointer transition-all duration-200",
        isSelected 
          ? "bg-[#2a2a2a] border border-accent-primary/50" 
          : "bg-[#1e1e1e] hover:bg-[#252525] border border-transparent"
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleArtistClick}
    >
      <div className="flex items-center gap-3">
        {/* Icon */}
        <div className="flex-none w-10 h-10 rounded-md bg-black/30 flex items-center justify-center overflow-hidden">
          {artist.imageUrl ? (
            <img src={artist.imageUrl} alt={artist.name} className="w-full h-full object-cover" />
          ) : (
            <User className="w-5 h-5 text-white/60" />
          )}
        </div>

        {/* Title area */}
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
              className="flex items-center gap-1 group/title cursor-pointer"
            >
              <EllipsisMarquee
                text={artist.name}
                className="w-full text-sm font-medium text-white"
                speedPxPerSec={70}
                gapPx={32}
                isActive={isHovered}
              />
              <Edit3 className="w-3 h-3 text-white/40 opacity-0 group-hover/title:opacity-100 transition-opacity" />
            </div>
          )}
          <div className="text-xs text-white/60 truncate">
            {artist.songCount} {artist.songCount === 1 ? 'song' : 'songs'}
            {artist.isFavorited && (
              <span className="ml-2 text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded">
                ★
              </span>
            )}
          </div>
        </div>

        {/* 3-dot Menu */}
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
              onClick={() => handleMenuAction('view')}
              className="text-white hover:bg-white/10 focus:bg-white/10"
            >
              View Artist
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => handleMenuAction('rename')}
              className="text-white hover:bg-white/10 focus:bg-white/10"
            >
              Rename
            </DropdownMenuItem>
            {!artist.isFavorited && (
              <DropdownMenuItem 
                onClick={() => handleMenuAction('favorite')}
                className="text-white hover:bg-white/10 focus:bg-white/10"
              >
                Add to Favorites
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator className="bg-white/10" />
            <DropdownMenuItem 
              onClick={() => handleMenuAction('change-image')}
              className="text-white hover:bg-white/10 focus:bg-white/10"
            >
              Change Image
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
