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
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

export interface Song {
  id: string;
  title: string;
  artist: string;
  albumArt: string;
  dateCreated: number;
  duration: number; // in seconds
}

export interface Playlist {
  id: string;
  name: string;
  songCount: number;
  isFavorited?: boolean;
  createdAt: number;
  songs: Song[];
}

interface TemplatePanelProps {
  className?: string;
}

// Mock songs data
const mockSongs: Song[] = [
  { id: "song1", title: "Midnight Dreams", artist: "Synthwave Master", albumArt: "/placeholder.svg", dateCreated: Date.now() - 86400000, duration: 240 },
  { id: "song2", title: "Electric Nights", artist: "Neon Pulse", albumArt: "/placeholder.svg", dateCreated: Date.now() - 172800000, duration: 195 },
  { id: "song3", title: "Cosmic Journey", artist: "Space Echo", albumArt: "/placeholder.svg", dateCreated: Date.now() - 259200000, duration: 320 },
  { id: "song4", title: "Digital Rain", artist: "Cyber Dreams", albumArt: "/placeholder.svg", dateCreated: Date.now() - 345600000, duration: 280 },
  { id: "song5", title: "Neon Glow", artist: "Retro Wave", albumArt: "/placeholder.svg", dateCreated: Date.now() - 432000000, duration: 215 },
  { id: "song6", title: "Chrome Hearts", artist: "Synthwave Master", albumArt: "/placeholder.svg", dateCreated: Date.now() - 518400000, duration: 255 },
  { id: "song7", title: "Virtual Reality", artist: "Tech Noir", albumArt: "/placeholder.svg", dateCreated: Date.now() - 604800000, duration: 305 },
  { id: "song8", title: "City Lights", artist: "Urban Dreams", albumArt: "/placeholder.svg", dateCreated: Date.now() - 691200000, duration: 188 },
];

// Mock data for development
const mockPlaylists: Playlist[] = [
  { 
    id: "fav", 
    name: "Favourites", 
    songCount: 12, 
    isFavorited: false, 
    createdAt: Date.now() - 86400000, 
    songs: mockSongs.slice(0, 4) 
  },
  { 
    id: "chill", 
    name: "Chill Vibes", 
    songCount: 8, 
    createdAt: Date.now() - 172800000, 
    songs: mockSongs.slice(1, 4) 
  },
  { 
    id: "workout", 
    name: "Workout Mix", 
    songCount: 15, 
    createdAt: Date.now() - 259200000, 
    songs: mockSongs.slice(0, 6) 
  },
  { 
    id: "study", 
    name: "Study Focus", 
    songCount: 6, 
    createdAt: Date.now() - 345600000, 
    songs: mockSongs.slice(2, 5) 
  },
  { 
    id: "party", 
    name: "Party Hits", 
    songCount: 22, 
    createdAt: Date.now() - 432000000, 
    songs: mockSongs 
  },
  { 
    id: "road-trip", 
    name: "Road Trip Classics", 
    songCount: 18, 
    createdAt: Date.now() - 518400000, 
    songs: mockSongs.slice(0, 7) 
  },
  { 
    id: "morning", 
    name: "Morning Coffee", 
    songCount: 11, 
    createdAt: Date.now() - 604800000, 
    songs: mockSongs.slice(1, 6) 
  },
  { 
    id: "late-night", 
    name: "Late Night Vibes", 
    songCount: 9, 
    createdAt: Date.now() - 691200000, 
    songs: mockSongs.slice(0, 3) 
  },
  { 
    id: "rock", 
    name: "Rock Anthems", 
    songCount: 24, 
    createdAt: Date.now() - 777600000, 
    songs: mockSongs.slice(2, 8) 
  },
  { 
    id: "jazz", 
    name: "Smooth Jazz", 
    songCount: 13, 
    createdAt: Date.now() - 864000000, 
    songs: mockSongs.slice(0, 5) 
  },
  { 
    id: "electronic", 
    name: "Electronic Beats", 
    songCount: 16, 
    createdAt: Date.now() - 950400000, 
    songs: mockSongs.slice(1, 7) 
  },
  { 
    id: "indie", 
    name: "Indie Discoveries", 
    songCount: 7, 
    createdAt: Date.now() - 1036800000, 
    songs: mockSongs.slice(0, 4) 
  },
  { 
    id: "pop", 
    name: "Pop Hits 2024", 
    songCount: 20, 
    createdAt: Date.now() - 1123200000, 
    songs: mockSongs 
  },
  { 
    id: "acoustic", 
    name: "Acoustic Sessions", 
    songCount: 14, 
    createdAt: Date.now() - 1209600000, 
    songs: mockSongs.slice(2, 7) 
  },
  { 
    id: "hip-hop", 
    name: "Hip Hop Essentials", 
    songCount: 19, 
    createdAt: Date.now() - 1296000000, 
    songs: mockSongs.slice(0, 6) 
  },
  { 
    id: "classical", 
    name: "Classical Favorites", 
    songCount: 10, 
    createdAt: Date.now() - 1382400000, 
    songs: mockSongs.slice(1, 5) 
  },
  { 
    id: "country", 
    name: "Country Roads", 
    songCount: 17, 
    createdAt: Date.now() - 1468800000, 
    songs: mockSongs.slice(0, 7) 
  },
  { 
    id: "blues", 
    name: "Blues Collection", 
    songCount: 12, 
    createdAt: Date.now() - 1555200000, 
    songs: mockSongs.slice(2, 6) 
  },
];

const mockArtists = [
  { id: "artist1", name: "Synthwave Master", songCount: 5, createdAt: Date.now() - 86400000, songs: [] },
  { id: "artist2", name: "Jazz Ensemble", songCount: 9, createdAt: Date.now() - 172800000, songs: [] },
  { id: "artist3", name: "Rock Legend", songCount: 12, createdAt: Date.now() - 259200000, songs: [] },
];

export function TemplatePanel({ className }: TemplatePanelProps) {
  const [viewMode, setViewMode] = useState<"playlists" | "artists">("playlists");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [showCreatePrompt, setShowCreatePrompt] = useState(false);
  const [playlists, setPlaylists] = useState<Playlist[]>(mockPlaylists);
  const [artists, setArtists] = useState<Playlist[]>(mockArtists);
  
  // Overlay state
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);
  const [showOverlay, setShowOverlay] = useState(false);
  
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
    const newPlaylist: Playlist = {
      id: `playlist_${Date.now()}`,
      name,
      songCount: 0,
      createdAt: Date.now(),
      songs: []
    };
    setPlaylists(prev => [...prev, newPlaylist]);
    clearSearch();
  };

  // Handle playlist menu actions
  const handlePlaylistAction = (playlistId: string, action: string) => {
    console.log(`Action ${action} on playlist ${playlistId}`);
    // Add playlist management logic here
  };

  // Handle playlist title editing
  const handlePlaylistTitleEdit = (playlistId: string, newTitle: string) => {
    if (viewMode === "playlists") {
      setPlaylists(prev => prev.map(p => 
        p.id === playlistId ? { ...p, name: newTitle } : p
      ));
    } else {
      setArtists(prev => prev.map(a => 
        a.id === playlistId ? { ...a, name: newTitle } : a
      ));
    }
  };

  // Handle playlist click to show overlay
  const handlePlaylistClick = (playlist: Playlist) => {
    setSelectedPlaylist(playlist);
    setShowOverlay(true);
  };

  const handleCloseOverlay = () => {
    setShowOverlay(false);
    setSelectedPlaylist(null);
  };

  // Handle track added to playlist
  const handleTrackAdd = (playlistId: string, track: TrackItem) => {
    const playlist = playlists.find(p => p.id === playlistId);
    if (playlist) {
      setPlaylists(prev => prev.map(p => 
        p.id === playlistId 
          ? { ...p, songCount: p.songCount + 1 }
          : p
      ));
      
      toast.success(`Added "${track.title}" to "${playlist.name}"`);
    }
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

            {/* Empty State */}
            {!shouldShowCreatePrompt && sortedData.length === 0 && (
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
                      setShowCreatePrompt(true);
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