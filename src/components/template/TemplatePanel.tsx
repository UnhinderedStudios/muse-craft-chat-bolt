import React, { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Filter, Search, X, MoveVertical as MoreVertical, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { PlaylistItem } from "./PlaylistItem";
import { CreatePlaylistPrompt } from "./CreatePlaylistPrompt";
import { PlaylistOverlay } from "./PlaylistOverlay";
import { TrackItem } from "@/types";
import { toast } from "sonner";
import { useSessionPlaylists, SessionPlaylist } from "@/hooks/use-session-playlists";
import { useArtistManagement } from "@/hooks/use-artist-management";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { usePanelResize } from "@/hooks/use-panel-resize";
import { ResizeHandle } from "@/components/layout/ResizeHandle";

export interface Song {
  id: string;
  title: string;
  artist: string;
  albumArt: string;
  dateCreated: number;
  duration: number; // in seconds
}

export interface Playlist extends SessionPlaylist {}

interface TemplatePanelProps {
  className?: string;
  onPlaylistClick?: (playlist: Playlist) => void;
  selectedPlaylist?: Playlist | null;
  showPlaylistOverlay?: boolean;
  onClosePlaylistOverlay?: () => void;
  onPlayTrack?: (trackId: string) => void;
  currentlyPlayingTrackId?: string;
  isPlaying?: boolean;
  onAlbumCoverClick?: (track: TrackItem) => void;
}

export function TemplatePanel({
  className,
  onPlaylistClick,
  selectedPlaylist,
  showPlaylistOverlay,
  onClosePlaylistOverlay,
  onPlayTrack,
  currentlyPlayingTrackId,
  isPlaying,
  onAlbumCoverClick
}: TemplatePanelProps) {
  const [viewMode, setViewMode] = useState<"playlists" | "artists">("playlists");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [showCreatePrompt, setShowCreatePrompt] = useState(false);

  // Use panel resize hook
  const {
    dimensions,
    isResizing,
    handleResizeStart,
    canResizeWidth,
    canResizeHeight
  } = usePanelResize("template");
  
  // Use session-based playlists
  const {
    playlists,
    createPlaylist,
    addTrackToPlaylist,
    removeTrackFromPlaylist,
    toggleFavourite,
    isTrackInFavourites,
    renamePlaylist,
    deletePlaylist,
    togglePlaylistFavourite
  } = useSessionPlaylists();

  // Use artist management
  const {
    artists: artistsData,
    createArtist,
    renameArtist,
    deleteArtist,
    toggleArtistFavourite,
    selectArtist
  } = useArtistManagement();

  // Transform artists to match Playlist interface
  const artists: Playlist[] = artistsData.map(artist => ({
    id: artist.id,
    name: artist.name,
    songCount: artist.songCount,
    songs: artist.tracks || [],
    createdAt: artist.createdAt,
    isFavorited: artist.isFavorited || false
  }));
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  
  const searchInputRef = useRef<HTMLInputElement>(null);

  const currentData = viewMode === "playlists" ? playlists : artists;
  
  // Filter data based on search query
  const filteredData = searchQuery.trim() === "" 
    ? currentData 
    : currentData.filter(item => 
        item.name.toLowerCase().includes(searchQuery.toLowerCase())
      );

  // Show create prompt if searching for non-existent playlist
  const shouldShowCreatePrompt = searchQuery.trim() !== "" && 
    filteredData.length === 0 && 
    viewMode === "playlists";

  // Handle search input changes
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setIsSearchMode(value.trim() !== "");
    setShowCreatePrompt(shouldShowCreatePrompt);
    setCurrentPage(1); // Reset to first page when searching
  };

  // Clear search and restore original state
  const clearSearch = () => {
    setSearchQuery("");
    setIsSearchMode(false);
    setShowCreatePrompt(false);
    setCurrentPage(1);
  };

  // Handle page changes
  const handlePageChange = (page: number, totalPages: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  // Reset page when switching view modes
  useEffect(() => {
    setCurrentPage(1);
  }, [viewMode]);

  // Create new playlist
  const handleCreatePlaylist = (name: string) => {
    createPlaylist(name);
    clearSearch();
  };

  // Handle playlist/artist menu actions
  const handlePlaylistAction = (playlistId: string, action: string) => {
    if (viewMode === "artists") {
      switch (action) {
        case "favorite":
          toggleArtistFavourite(playlistId);
          break;
        case "delete":
          deleteArtist(playlistId);
          break;
        default:
          console.log(`Action ${action} on artist ${playlistId}`);
      }
    } else {
      switch (action) {
        case "favorite":
          togglePlaylistFavourite(playlistId);
          break;
        case "delete":
          deletePlaylist(playlistId);
          break;
        default:
          console.log(`Action ${action} on playlist ${playlistId}`);
      }
    }
  };

  // Handle playlist/artist title editing
  const handlePlaylistTitleEdit = (playlistId: string, newTitle: string) => {
    if (viewMode === "playlists") {
      renamePlaylist(playlistId, newTitle);
    } else {
      renameArtist(playlistId, newTitle);
    }
  };

  // Handle playlist click to show overlay
  const handlePlaylistClick = (playlist: Playlist) => {
    // If clicking an artist, select it in the artist management system
    if (viewMode === "artists") {
      selectArtist(playlist.id);
    }
    if (onPlaylistClick) {
      onPlaylistClick(playlist);
    }
  };

  // Handle track added to playlist - silent operation
  const handleTrackAdd = (playlistId: string, track: TrackItem) => {
    // Removed toast notification - silent operation
  };

  // Get sorted playlists (Favourited always first unless searching)
  const getSortedPlaylists = () => {
    if (isSearchMode) return filteredData;
    
    const favourited = filteredData.filter(p => p.isFavorited);
    const others = filteredData.filter(p => !p.isFavorited).sort((a, b) => b.createdAt - a.createdAt);
    return [...favourited, ...others];
  };

  const sortedData = viewMode === "playlists" ? getSortedPlaylists() : filteredData;
  
  // Calculate pagination
  const totalPages = Math.ceil(sortedData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const displayData = sortedData.slice(startIndex, endIndex);

  return (
    <div
      className={cn("bg-[#151515] rounded-2xl flex flex-col relative", className)}
      style={{
        width: dimensions.width ? `${dimensions.width}px` : undefined,
        height: dimensions.height ? `${dimensions.height}px` : undefined,
      }}
    >
      {/* Resize Handles */}
      {canResizeWidth && (
        <ResizeHandle
          direction="left"
          onMouseDown={(e) => handleResizeStart(e, "width")}
          isResizing={isResizing}
        />
      )}
      {canResizeHeight && (
        <ResizeHandle
          direction="bottom"
          onMouseDown={(e) => handleResizeStart(e, "height")}
          isResizing={isResizing}
        />
      )}
      {canResizeWidth && canResizeHeight && (
        <ResizeHandle
          direction="corner"
          onMouseDown={(e) => handleResizeStart(e, "width")}
          isResizing={isResizing}
        />
      )}

      {/* Header with Toggle */}
      <div className="shrink-0 p-4 pb-3">
        <div className="flex items-center mb-3">
          <div className="flex w-full items-center bg-black/30 rounded-md p-0.5 backdrop-blur-sm border border-white/5">
            <button
              onClick={() => {
                setViewMode("playlists");
                clearSearch();
              }}
              className={cn(
                "flex-1 py-1 text-xs font-medium rounded-sm transition-all duration-200",
                viewMode === "playlists"
                  ? "bg-white/10 text-white shadow-sm"
                  : "text-white/60 hover:text-white/80"
              )}
            >
              Playlists
            </button>
            <button
              onClick={() => {
                setViewMode("artists");
                clearSearch();
              }}
              className={cn(
                "flex-1 py-1 text-xs font-medium rounded-sm transition-all duration-200",
                viewMode === "artists"
                  ? "bg-white/10 text-white shadow-sm"
                  : "text-white/60 hover:text-white/80"
              )}
            >
              Artists
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Input
            ref={searchInputRef}
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder={`Search ${viewMode}...`}
            className="w-full bg-[#1e1e1e] border-0 text-white placeholder:text-white/40 focus-visible:ring-1 focus-visible:ring-white/20 pr-20"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
            <button className="text-white/40 hover:text-white/60 transition-colors">
              <Filter className="w-4 h-4" />
            </button>
            <button
              onClick={isSearchMode ? clearSearch : undefined}
              className="text-white/40 hover:text-white/60 transition-colors"
            >
              {isSearchMode ? (
                <X className="w-4 h-4" />
              ) : (
                <Search className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {/* Search Results Count */}
        {isSearchMode && !shouldShowCreatePrompt && (
          <div className="text-xs text-white/40 mt-2">
            {filteredData.length} {viewMode === "playlists" ? "playlist" : "artist"}{filteredData.length !== 1 ? 's' : ''} found
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <div className="h-full overflow-y-auto overflow-x-hidden lyrics-scrollbar">
          <div className="min-h-full flex flex-col justify-start gap-2 px-4 pb-4">
            {/* Create Playlist Prompt */}
            {shouldShowCreatePrompt && (
              <CreatePlaylistPrompt
                searchQuery={searchQuery}
                onCreatePlaylist={handleCreatePlaylist}
              />
            )}

            {/* Template Items */}
            {displayData.map((item) => (
              <PlaylistItem
                key={item.id}
                playlist={item}
                onMenuAction={handlePlaylistAction}
                onTrackAdd={handleTrackAdd}
                onTitleEdit={handlePlaylistTitleEdit}
                onPlaylistClick={handlePlaylistClick}
                isArtist={viewMode === "artists"}
              />
            ))}

            {/* Empty State */}
            {!shouldShowCreatePrompt && sortedData.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="text-white/60 mb-2">
                  {isSearchMode ? 
                    `No ${viewMode} found` : 
                    `No ${viewMode} yet`
                  }
                </div>
                {!isSearchMode && (
                  <button
                    onClick={() => {
                      if (viewMode === "playlists") {
                        setSearchQuery("New Playlist");
                        setIsSearchMode(true);
                        setShowCreatePrompt(true);
                        setTimeout(() => searchInputRef.current?.focus(), 100);
                      } else {
                        createArtist("New Artist");
                        toast.success("Artist created");
                      }
                    }}
                    className="text-sm text-accent-primary hover:text-accent-primary/80 transition-colors flex items-center gap-1"
                  >
                    <Plus className="w-4 h-4" />
                    Create your first {viewMode === "playlists" ? "playlist" : "artist"}
                  </button>
                )}
              </div>
            )}
            
            {/* Pagination */}
            {sortedData.length > itemsPerPage && (
              <div className="mt-2 flex justify-center px-2">
                <Pagination className="w-auto">
                  <PaginationContent className="gap-0.5 text-xs">
                     <PaginationItem>
                       <PaginationPrevious
                         href="#"
                         onClick={(e) => {
                           e.preventDefault();
                           handlePageChange(currentPage - 1, totalPages);
                         }}
                         className={cn(
                           "h-7 px-2 text-xs",
                           currentPage === 1 ? "pointer-events-none text-white/20 hover:text-white/20" : ""
                         )}
                       />
                     </PaginationItem>
                    
                    {Array.from({ length: totalPages }, (_, index) => {
                      const page = index + 1;
                      return (
                         <PaginationItem key={page}>
                           <PaginationLink
                             href="#"
                             onClick={(e) => {
                               e.preventDefault();
                               handlePageChange(page, totalPages);
                             }}
                             isActive={currentPage === page}
                             className="h-7 w-7 text-xs"
                           >
                             {page}
                           </PaginationLink>
                         </PaginationItem>
                      );
                    })}
                    
                     <PaginationItem>
                       <PaginationNext
                         href="#"
                         onClick={(e) => {
                           e.preventDefault();
                           handlePageChange(currentPage + 1, totalPages);
                         }}
                         className={cn(
                           "h-7 px-2 text-xs",
                           currentPage === totalPages ? "pointer-events-none text-white/20 hover:text-white/20" : ""
                         )}
                       />
                     </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Playlist Overlay */}
      {showPlaylistOverlay && (
        <PlaylistOverlay
          playlist={selectedPlaylist}
          isOpen={showPlaylistOverlay}
          onClose={onClosePlaylistOverlay || (() => {})}
          onPlayTrack={onPlayTrack}
          currentlyPlayingTrackId={currentlyPlayingTrackId}
          isPlaying={isPlaying}
          onAlbumCoverClick={onAlbumCoverClick}
        />
      )}
    </div>
  );
}