import React, { useEffect, useState } from "react";
import { X, Search, Filter, MoreVertical, Play, Clock } from "lucide-react";
import { Playlist, Song } from "./TemplatePanel";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";

interface PlaylistOverlayProps {
  playlist: Playlist | null;
  isOpen: boolean;
  onClose: () => void;
}

type SortOption = "newest" | "oldest" | "title" | "artist";

export function PlaylistOverlay({ playlist, isOpen, onClose }: PlaylistOverlayProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("newest");

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

  // Reset state when overlay closes
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery("");
      setSortBy("newest");
    }
  }, [isOpen]);

  if (!isOpen || !playlist) return null;

  // Filter and sort songs
  const filteredSongs = playlist.songs.filter(song =>
    song.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    song.artist.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const sortedSongs = [...filteredSongs].sort((a, b) => {
    switch (sortBy) {
      case "newest":
        return b.dateCreated - a.dateCreated;
      case "oldest":
        return a.dateCreated - b.dateCreated;
      case "title":
        return a.title.localeCompare(b.title);
      case "artist":
        return a.artist.localeCompare(b.artist);
      default:
        return 0;
    }
  });

  // Format duration helper
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Format date helper
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const handleSongAction = (songId: string, action: string) => {
    console.log(`Action ${action} on song ${songId}`);
    // Handle song actions here
  };

  return (
    <div 
      className="fixed inset-0 z-50 backdrop-blur-md"
      onClick={onClose}
    >
      {/* 3x Larger centered rectangle */}
      <div 
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-black/90 rounded-2xl border border-white/10 min-w-[1200px] max-w-[1800px] w-[90vw] max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="shrink-0 p-8 pb-6 border-b border-white/10">
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-6 right-6 w-8 h-8 flex items-center justify-center text-white/60 hover:text-white transition-colors rounded-full hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Playlist info */}
          <div className="text-white mb-6">
            <h2 className="text-3xl font-bold mb-3">{playlist.name}</h2>
            <div className="flex items-center gap-4 text-white/60">
              <span>{playlist.songCount} {playlist.songCount === 1 ? 'song' : 'songs'}</span>
              <span>•</span>
              <span>Created {formatDate(playlist.createdAt)}</span>
              {playlist.isFavorited && (
                <>
                  <span>•</span>
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-yellow-500/20 text-yellow-400 rounded-full text-sm">
                    <span>★</span>
                    <span>Favorited</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Search and Filter */}
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search songs..."
                className="w-full bg-white/5 border-white/20 text-white placeholder:text-white/40 focus-visible:ring-1 focus-visible:ring-white/30 focus-visible:border-white/30 pr-10"
              />
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
            </div>
            
            <Select value={sortBy} onValueChange={(value: SortOption) => setSortBy(value)}>
              <SelectTrigger className="w-[200px] bg-white/5 border-white/20 text-white focus:ring-1 focus:ring-white/30 focus:border-white/30">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-black/90 border-white/20 text-white">
                <SelectItem value="newest">Newest First</SelectItem>
                <SelectItem value="oldest">Oldest First</SelectItem>
                <SelectItem value="title">Title A-Z</SelectItem>
                <SelectItem value="artist">Artist A-Z</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Search results count */}
          {searchQuery && (
            <div className="text-sm text-white/40 mt-3">
              {filteredSongs.length} of {playlist.songs.length} songs
            </div>
          )}
        </div>

        {/* Song List */}
        <div className="flex-1 min-h-0">
          {sortedSongs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-white/60 p-12">
              {searchQuery ? (
                <>
                  <Search className="w-12 h-12 mb-4 opacity-50" />
                  <p className="text-lg mb-2">No songs found</p>
                  <p className="text-sm">Try searching with different keywords</p>
                </>
              ) : (
                <>
                  <div className="w-12 h-12 mb-4 rounded-lg bg-white/10 flex items-center justify-center">
                    <Play className="w-6 h-6" />
                  </div>
                  <p className="text-lg mb-2">This playlist is empty</p>
                  <p className="text-sm">Add some songs to get started</p>
                </>
              )}
            </div>
          ) : (
            <ScrollArea className="h-full">
              <div className="p-6 pt-4 space-y-2">
                {/* Header row */}
                <div className="grid grid-cols-[48px_1fr_200px_120px_80px_40px] gap-4 px-4 py-2 text-sm text-white/60 border-b border-white/10 mb-2">
                  <div></div>
                  <div>Title</div>
                  <div>Artist</div>
                  <div>Date Added</div>
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                  </div>
                  <div></div>
                </div>

                {/* Song rows */}
                {sortedSongs.map((song, index) => (
                  <div
                    key={song.id}
                    className="group grid grid-cols-[48px_1fr_200px_120px_80px_40px] gap-4 px-4 py-3 rounded-lg hover:bg-white/5 transition-colors"
                  >
                    {/* Album Art */}
                    <div className="w-12 h-12 rounded-lg overflow-hidden bg-white/10 flex items-center justify-center">
                      <img 
                        src={song.albumArt} 
                        alt={`${song.title} cover`}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          target.parentElement!.innerHTML = '<div class="w-full h-full bg-white/10 flex items-center justify-center"><Play class="w-4 h-4 text-white/40" /></div>';
                        }}
                      />
                    </div>

                    {/* Title */}
                    <div className="flex flex-col justify-center min-w-0">
                      <div className="text-white font-medium truncate">{song.title}</div>
                    </div>

                    {/* Artist */}
                    <div className="flex items-center text-white/60 truncate">
                      {song.artist}
                    </div>

                    {/* Date */}
                    <div className="flex items-center text-white/60 text-sm">
                      {formatDate(song.dateCreated)}
                    </div>

                    {/* Duration */}
                    <div className="flex items-center text-white/60 text-sm">
                      {formatDuration(song.duration)}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="w-8 h-8 flex items-center justify-center text-white/40 hover:text-white transition-colors rounded opacity-0 group-hover:opacity-100">
                            <MoreVertical className="w-4 h-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent 
                          align="end" 
                          className="bg-black/90 border-white/20 text-white min-w-[180px]"
                        >
                          <DropdownMenuItem 
                            onClick={() => handleSongAction(song.id, 'play')}
                            className="hover:bg-white/10 focus:bg-white/10"
                          >
                            <Play className="w-4 h-4 mr-2" />
                            Play
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleSongAction(song.id, 'queue')}
                            className="hover:bg-white/10 focus:bg-white/10"
                          >
                            Add to Queue
                          </DropdownMenuItem>
                          <DropdownMenuSeparator className="bg-white/20" />
                          <DropdownMenuItem 
                            onClick={() => handleSongAction(song.id, 'artist')}
                            className="hover:bg-white/10 focus:bg-white/10"
                          >
                            Go to Artist
                          </DropdownMenuItem>
                          <DropdownMenuSeparator className="bg-white/20" />
                          <DropdownMenuItem 
                            onClick={() => handleSongAction(song.id, 'remove')}
                            className="hover:bg-white/10 focus:bg-white/10 text-red-400"
                          >
                            Remove from Playlist
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      </div>
    </div>
  );
}