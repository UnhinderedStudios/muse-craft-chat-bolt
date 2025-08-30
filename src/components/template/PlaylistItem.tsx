import React from "react";
import { MoreVertical, Music, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { Playlist } from "./TemplatePanel";
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
  isArtist?: boolean;
}

export function PlaylistItem({ playlist, onMenuAction, isArtist = false }: PlaylistItemProps) {
  const handleMenuAction = (action: string) => {
    onMenuAction(playlist.id, action);
  };

  return (
    <div className="group bg-[#1e1e1e] rounded-xl p-3 cursor-pointer hover:bg-[#252525] transition-colors">
      <div className="flex items-center gap-3">
        {/* Icon */}
        <div className="shrink-0 w-10 h-10 rounded-md bg-black/30 flex items-center justify-center">
          {isArtist ? (
            <User className="w-5 h-5 text-white/60" />
          ) : (
            <Music className="w-5 h-5 text-white/60" />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <div className="overflow-hidden relative">
                <div 
                  className="text-sm text-white font-medium whitespace-nowrap group-hover:animate-text-scroll"
                  title={playlist.name}
                  style={{
                    maskImage: 'linear-gradient(90deg, transparent 0%, black 10%, black 90%, transparent 100%)',
                    WebkitMaskImage: 'linear-gradient(90deg, transparent 0%, black 10%, black 90%, transparent 100%)'
                  }}
                >
                  <span className="inline-block">
                    {playlist.name}
                    {playlist.isFavorited && (
                      <span className="ml-2 text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded">
                        ★
                      </span>
                    )}
                  </span>
                </div>
              </div>
              <div className="text-xs text-white/60">
                {playlist.songCount} {playlist.songCount === 1 ? 'song' : 'songs'}
              </div>
            </div>

            {/* 3-dot Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button 
                  className="opacity-0 group-hover:opacity-100 w-8 h-8 mr-2 flex items-center justify-center text-white/60 hover:text-white transition-all duration-200"
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
      </div>
    </div>
  );
}