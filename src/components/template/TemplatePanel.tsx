import React, { useState, useRef, useEffect } from "react";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Filter, Search, X, MoreVertical, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { PlaylistItem } from "./PlaylistItem";
import { CreatePlaylistPrompt } from "./CreatePlaylistPrompt";
import { PlaylistOverlay } from "./PlaylistOverlay";
import { TrackItem } from "@/types";
import { toast } from "sonner";
import { usePlaylists, DbPlaylist } from "@/hooks/use-playlists";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

// Legacy interface for compatibility - now using DbPlaylist from hook
export interface Playlist {
  id: string;
  name: string;
  songCount: number;
  isFavorited?: boolean;
  createdAt: number;
}

interface TemplatePanelProps {
  className?: string;
}

// Mock artists for artists view (keeping for now)
const mockArtists: Playlist[] = [
  { id: "artist1", name: "Synthwave Master", songCount: 5, createdAt: Date.now() - 86400000 },
  { id: "artist2", name: "Jazz Ensemble", songCount: 9, createdAt: Date.now() - 172800000 },
  { id: "artist3", name: "Rock Legend", songCount: 12, createdAt: Date.now() - 259200000 },
];

export function TemplatePanel({ className }: TemplatePanelProps) {
  const [viewMode, setViewMode] = useState<"playlists" | "artists">("playlists");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [artists, setArtists] = useState<Playlist[]>(mockArtists);
  
  // Overlay state
  const [selectedPlaylist, setSelectedPlaylist] = useState<DbPlaylist | null>(null);
  const [showOverlay, setShowOverlay] = useState(false);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Use playlist hook for real data
  const { playlists, isLoading, createPlaylist, renamePlaylist, deletePlaylist, addTrackToPlaylist } = usePlaylists();

  // Convert DbPlaylist to legacy Playlist format for compatibility
  const convertedPlaylists: Playlist[] = playlists.map(p => ({
    id: p.id,
    name: p.name,
    songCount: p.song_count || 0,
    isFavorited: p.is_favorites,
    createdAt: new Date(p.created_at).getTime()
  }));

  const currentData = viewMode === "playlists" ? convertedPlaylists : artists;
  
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
    setCurrentPage(1); // Reset to first page when searching
  };

  // Clear search and restore original state
  const clearSearch = () => {
    setSearchQuery("");
    setIsSearchMode(false);
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
  const handleCreatePlaylist = async (name: string) => {
    await createPlaylist(name);
    clearSearch();
  };

  // Handle playlist menu actions
  const handlePlaylistAction = async (playlistId: string, action: string) => {
    const playlist = playlists.find(p => p.id === playlistId);
    if (!playlist) return;

    switch (action) {
      case 'delete':
        if (playlist.is_favorites) {
          toast.error('Cannot delete Favourites playlist');
          return;
        }
        await deletePlaylist(playlistId);
        break;
      default:
        console.log(`Action ${action} on playlist ${playlistId}`);
    }
  };

  // Handle playlist title editing
  const handlePlaylistTitleEdit = async (playlistId: string, newTitle: string) => {
    if (viewMode === "playlists") {
      await renamePlaylist(playlistId, newTitle);
    } else {
      setArtists(prev => prev.map(a => 
        a.id === playlistId ? { ...a, name: newTitle } : a
      ));
    }
  };

  // Handle playlist click to show overlay
  const handlePlaylistClick = (playlist: Playlist) => {
    const dbPlaylist = playlists.find(p => p.id === playlist.id);
    if (dbPlaylist) {
      setSelectedPlaylist(dbPlaylist);
      setShowOverlay(true);
    }
  };

  const handleCloseOverlay = () => {
    setShowOverlay(false);
    setSelectedPlaylist(null);
  };

  // Handle track added to playlist
  const handleTrackAdd = async (playlistId: string, track: TrackItem) => {
    await addTrackToPlaylist(playlistId, track);
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
    <div className={cn("h-full bg-[#151515] rounded-2xl flex flex-col", className)}>
      {/* Header with Toggle */}
      <div className="shrink-0 p-4 pb-3">
        <div className="flex items-center justify-center mb-4">
          <div className="flex items-center gap-3">
            <span className={cn("text-sm", viewMode === "playlists" ? "text-white" : "text-white/60")}>
              Playlists
            </span>
            <Switch
              checked={viewMode === "artists"}
              onCheckedChange={(checked) => {
                setViewMode(checked ? "artists" : "playlists");
                clearSearch(); // Clear search when switching modes
              }}
              className="data-[state=checked]:bg-accent-primary"
            />
            <span className={cn("text-sm", viewMode === "artists" ? "text-white" : "text-white/60")}>
              Artists
            </span>
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

            {/* Loading State */}
            {isLoading && viewMode === "playlists" && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="text-white/60 mb-2">Loading playlists...</div>
              </div>
            )}

            {/* Empty State */}
            {!isLoading && !shouldShowCreatePrompt && sortedData.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="text-white/60 mb-2">
                  {isSearchMode ? 
                    `No ${viewMode} found` : 
                    `No ${viewMode} yet`
                  }
                </div>
                {!isSearchMode && viewMode === "playlists" && (
                  <button
                    onClick={() => {
                      setSearchQuery("New Playlist");
                      setIsSearchMode(true);
                      setTimeout(() => searchInputRef.current?.focus(), 100);
                    }}
                    className="text-sm text-accent-primary hover:text-accent-primary/80 transition-colors flex items-center gap-1"
                  >
                    <Plus className="w-4 h-4" />
                    Create your first playlist
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
      <PlaylistOverlay
        playlist={selectedPlaylist}
        isOpen={showOverlay}
        onClose={handleCloseOverlay}
      />
    </div>
  );
}