import React, { useState, useRef, useEffect } from "react";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Filter, Search, X, MoreVertical, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { PlaylistItem } from "./PlaylistItem";
import { CreatePlaylistPrompt } from "./CreatePlaylistPrompt";
import { TrackItem } from "@/types";
import { toast } from "sonner";

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

// Mock data for development
const mockPlaylists: Playlist[] = [
  { id: "fav", name: "Favourites", songCount: 12, isFavorited: false, createdAt: Date.now() - 86400000 },
  { id: "chill", name: "Chill Vibes", songCount: 8, createdAt: Date.now() - 172800000 },
  { id: "workout", name: "Workout Mix", songCount: 15, createdAt: Date.now() - 259200000 },
  { id: "study", name: "Study Focus", songCount: 6, createdAt: Date.now() - 345600000 },
  { id: "party", name: "Party Hits", songCount: 22, createdAt: Date.now() - 432000000 },
];

const mockArtists = [
  { id: "artist1", name: "Synthwave Master", songCount: 5, createdAt: Date.now() - 86400000 },
  { id: "artist2", name: "Jazz Ensemble", songCount: 9, createdAt: Date.now() - 172800000 },
  { id: "artist3", name: "Rock Legend", songCount: 12, createdAt: Date.now() - 259200000 },
];

export function TemplatePanel({ className }: TemplatePanelProps) {
  const [viewMode, setViewMode] = useState<"playlists" | "artists">("playlists");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [showCreatePrompt, setShowCreatePrompt] = useState(false);
  const [playlists, setPlaylists] = useState<Playlist[]>(mockPlaylists);
  const [artists, setArtists] = useState<Playlist[]>(mockArtists);
  
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
  };

  // Clear search and restore original state
  const clearSearch = () => {
    setSearchQuery("");
    setIsSearchMode(false);
    setShowCreatePrompt(false);
  };

  // Create new playlist
  const handleCreatePlaylist = (name: string) => {
    const newPlaylist: Playlist = {
      id: `playlist_${Date.now()}`,
      name,
      songCount: 0,
      createdAt: Date.now()
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

  const displayData = viewMode === "playlists" ? getSortedPlaylists() : filteredData;

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
                isArtist={viewMode === "artists"}
              />
            ))}

            {/* Empty State */}
            {!shouldShowCreatePrompt && displayData.length === 0 && (
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
          </div>
        </div>
      </div>
    </div>
  );
}