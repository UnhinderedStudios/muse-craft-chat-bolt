import React, { useEffect, useState } from "react";
import { X, Search, Filter, MoreVertical, Play, Pause, Clock, User, Trash2, RotateCw, Radio } from "lucide-react";
import { SessionPlaylist, useSessionPlaylists } from "@/hooks/use-session-playlists";
import { TrackItem } from "@/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useSessionManager } from "@/hooks/use-session-manager";
import { useGlobalPlayer } from "@/contexts/GlobalPlayerContext";
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
  playlist: SessionPlaylist | null;
  isOpen: boolean;
  onClose: () => void;
  onPlayTrack?: (trackId: string) => void;
  currentlyPlayingTrackId?: string;
  isPlaying?: boolean;
  onAlbumCoverClick?: (track: TrackItem) => void;
}

type SortOption = "newest" | "oldest" | "title" | "artist";

export function PlaylistOverlay({ playlist, isOpen, onClose, onPlayTrack, currentlyPlayingTrackId, isPlaying, onAlbumCoverClick }: PlaylistOverlayProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  
  // Access session playlists for removing tracks and getting current playlist state
  const { removeTrackFromPlaylist, playlists, snapshotToTrack } = useSessionPlaylists();
  const { currentSessionId } = useSessionManager();
  const { state: globalPlayerState, playGlobalTrack, pauseGlobalPlayer, resumeGlobalPlayer } = useGlobalPlayer();
  
  // Get the current playlist from the hook state to ensure real-time updates
  const currentPlaylist = playlist ? playlists.find(p => p.id === playlist.id) || playlist : null;

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

  if (!isOpen || !currentPlaylist) return null;

  // Filter and sort songs
  const filteredSongs = currentPlaylist.songs.filter(song =>
    (song.title || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  const sortedSongs = [...filteredSongs].sort((a, b) => {
    switch (sortBy) {
      case "newest":
        return b.createdAt - a.createdAt;
      case "oldest":
        return a.createdAt - b.createdAt;
      case "title":
        return (a.title || "").localeCompare(b.title || "");
      case "artist":
        return 0; // No artist field in TrackItem
      default:
        return 0;
    }
  });

  // Format date helper
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const handleSongAction = (songId: string, action: string) => {
    if (!currentPlaylist) return;
    
    switch (action) {
      case 'remove':
        removeTrackFromPlaylist(currentPlaylist.id, songId);
        toast.success(`Removed song from "${currentPlaylist.name}"`);
        break;
      case 'play':
        const track = currentPlaylist.songs.find(s => s.id === songId);
        if (!track) return;
        
        const trackItem = snapshotToTrack(track);
        const playlistTracks = currentPlaylist.songs.map(s => snapshotToTrack(s));
        
        // Check if this is cross-session playback (playlist from different session)
        const isCrossSession = currentPlaylist.sessionId !== currentSessionId;
        
        if (isCrossSession) {
          // Enable radio mode for cross-session playback
          playGlobalTrack(trackItem, playlistTracks, currentPlaylist.sessionId);
          toast.success(`Playing "${track.title}" in radio mode`);
        } else if (onPlayTrack) {
          // Normal session playback
          onPlayTrack(songId);
        } else {
          console.log(`Playing song ${songId}`);
        }
        break;
      case 'queue':
        console.log(`Adding song ${songId} to queue`);
        // TODO: Connect to queue system
        break;
      case 'artist':
        console.log(`Going to artist for song ${songId}`);
        // TODO: Navigate to artist view
        break;
      default:
        console.log(`Action ${action} on song ${songId}`);
    }
  };

  // Helper to determine if a song is currently playing
  const isSongPlaying = (songId: string) => {
    // Check both session player and global radio
    const isSessionPlaying = currentlyPlayingTrackId === songId && isPlaying;
    const isGlobalPlaying = globalPlayerState.currentTrack?.id === songId && globalPlayerState.isPlaying;
    return isSessionPlaying || isGlobalPlaying;
  };

  // Check if we're in cross-session mode
  const isCrossSession = currentPlaylist && currentPlaylist.sessionId !== currentSessionId;

  return (
    <div 
      className="fixed inset-0 z-50 backdrop-blur-md"
      onClick={onClose}
    >
      {/* Responsive centered rectangle */}
      <div 
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-black/70 rounded-2xl border border-white/10 w-[95vw] sm:w-[90vw] md:w-[85vw] lg:w-[80vw] xl:min-w-[1200px] xl:max-w-[1800px] max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="shrink-0 p-4 sm:p-6 lg:p-8 pb-4 sm:pb-6 border-b border-white/10">
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 sm:top-6 sm:right-6 w-8 h-8 flex items-center justify-center text-white/60 hover:text-white transition-colors rounded-full hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Playlist info */}
          <div className="text-white mb-4 sm:mb-6">
            <div className="flex items-center gap-3 mb-2 sm:mb-3">
              <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold pr-8">{currentPlaylist.name}</h2>
              {isCrossSession && (
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-purple-500/20 text-purple-400 rounded-full text-sm">
                  <Radio className="w-3 h-3" />
                  <span>Radio Mode</span>
                </div>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-sm sm:text-base text-white/60">
              <span>{currentPlaylist.songs.length} {currentPlaylist.songs.length === 1 ? 'song' : 'songs'}</span>
              <span>•</span>
              <span>Created {formatDate(currentPlaylist.createdAt)}</span>
              {currentPlaylist.isFavorited && (
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
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
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
              <SelectTrigger className="w-full sm:w-[200px] bg-white/5 border-white/20 text-white focus:ring-1 focus:ring-white/30 focus:border-white/30">
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
            <div className="text-xs sm:text-sm text-white/40 mt-2 sm:mt-3">
              {filteredSongs.length} of {currentPlaylist.songs.length} songs
            </div>
          )}
        </div>

        {/* Song List */}
        <div className="flex-1 min-h-0">
          {sortedSongs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-white/60 p-6 sm:p-12">
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
              <div className="p-3 sm:p-6 pt-2 sm:pt-4 space-y-2">
                {/* Header row - hidden on mobile */}
                <div className="hidden lg:grid grid-cols-[48px_1fr_200px_120px_80px_80px] gap-4 px-4 py-2 text-sm text-white/60 border-b border-white/10 mb-2">
                  <div className="text-left col-span-2">Title</div>
                  <div>Artist</div>
                  <div>Date Added</div>
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                  </div>
                  <div>Actions</div>
                </div>

                {/* Song rows */}
                {sortedSongs.map((song, index) => (
                  <div
                    key={song.id}
                    className="lg:grid lg:grid-cols-[48px_1fr_200px_120px_80px_80px] lg:gap-4 flex flex-col lg:flex-row px-3 sm:px-4 py-3 rounded-lg hover:bg-white/5 transition-colors"
                  >
                    {/* Mobile layout */}
                    <div className="flex lg:contents items-center gap-3">
                      {/* Album Art */}
                      <div className="w-12 h-12 rounded-lg overflow-hidden bg-white/10 flex items-center justify-center shrink-0 relative group/album">
                        <img
                          src={song.coverUrl || "/placeholder.svg"}
                          alt={`${song.title} cover`}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                            target.parentElement!.innerHTML = '<div class="w-full h-full bg-white/10 flex items-center justify-center"><Play class="w-4 h-4 text-white/40" /></div>';
                          }}
                        />
                        <div 
                          className="absolute inset-0 rounded-lg overflow-hidden bg-black/50 backdrop-blur-sm opacity-0 group-hover/album:opacity-100 transition-opacity duration-200 flex items-center justify-center cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            onAlbumCoverClick?.(snapshotToTrack(song));
                          }}
                        >
                          <RotateCw className="w-3 h-3 text-white group-hover/album:animate-[spin_0.36s_ease-in-out] transition-transform" />
                        </div>
                      </div>

                      {/* Title & Artist - Mobile */}
                      <div className="flex-1 min-w-0 lg:contents">
                        <div className="lg:flex lg:flex-col lg:justify-center lg:min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-white font-medium truncate text-left">{song.title || "Untitled"}</span>
                            <div className="flex items-center gap-1 lg:hidden">
                              <button 
                                onClick={() => handleSongAction(song.id, 'play')}
                                className="w-6 h-6 flex items-center justify-center text-white/60 hover:text-white transition-colors rounded hover:bg-white/10"
                              >
                                {isSongPlaying(song.id) ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                              </button>
                              <button 
                                onClick={() => handleSongAction(song.id, 'remove')}
                                className="w-6 h-6 flex items-center justify-center text-white/60 hover:text-red-400 transition-colors rounded hover:bg-white/10"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 text-white/60 text-sm lg:hidden">
                            <div className="w-12 h-12 rounded bg-white/10 flex items-center justify-center shrink-0">
                              <User className="w-5 h-5 text-white/40" />
                            </div>
                            <span className="truncate">Generated Song</span>
                          </div>
                        </div>
                        
                        {/* Artist - Desktop */}
                        <div className="hidden lg:flex lg:items-center gap-2 text-white/60 truncate">
                          <div className="w-12 h-12 rounded bg-white/10 flex items-center justify-center shrink-0">
                            <User className="w-5 h-5 text-white/40" />
                          </div>
                          <span>Generated Song</span>
                        </div>

                        {/* Date - Desktop */}
                        <div className="hidden lg:flex lg:items-center text-white/60 text-sm">
                          {formatDate(song.createdAt)}
                        </div>

                        {/* Duration - Desktop */}
                        <div className="hidden lg:flex lg:items-center text-white/60 text-sm">
                          --:--
                        </div>

                        {/* Play & Bin buttons - Desktop */}
                        <div className="hidden lg:flex lg:items-center gap-1">
                          <button 
                            onClick={() => handleSongAction(song.id, 'play')}
                            className="w-8 h-8 flex items-center justify-center text-white/60 hover:text-white transition-colors rounded hover:bg-white/10"
                          >
                            {isSongPlaying(song.id) ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                          </button>
                          <button 
                            onClick={() => handleSongAction(song.id, 'remove')}
                            className="w-8 h-8 flex items-center justify-center text-white/60 hover:text-red-400 transition-colors rounded hover:bg-white/10"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
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
                                {isSongPlaying(song.id) ? <Pause className="w-4 h-4 mr-2" /> : <Play className="w-4 h-4 mr-2" />}
                                {isSongPlaying(song.id) ? 'Pause' : 'Play'}
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

                      {/* Mobile metadata */}
                      <div className="flex lg:hidden items-center gap-3 text-white/60 text-xs">
                        <span>--:--</span>
                        <span>•</span>
                        <span>{formatDate(song.createdAt)}</span>
                      </div>

                      {/* Mobile three-dot menu */}
                      <div className="flex lg:hidden items-center">
                        <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="w-8 h-8 flex items-center justify-center text-white/40 hover:text-white transition-colors rounded">
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
                            {isSongPlaying(song.id) ? <Pause className="w-4 h-4 mr-2" /> : <Play className="w-4 h-4 mr-2" />}
                            {isSongPlaying(song.id) ? 'Pause' : 'Play'}
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