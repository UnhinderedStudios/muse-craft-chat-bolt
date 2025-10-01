import React, { useState, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Search, X, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { ArtistBubble } from "./ArtistBubble";
import { useArtistManagement, ArtistData } from "@/hooks/use-artist-management";
import { toast } from "sonner";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

interface ArtistManagementPanelProps {
  className?: string;
  onArtistClick?: (artist: ArtistData) => void;
}

export function ArtistManagementPanel({ className, onArtistClick }: ArtistManagementPanelProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;
  
  const searchInputRef = useRef<HTMLInputElement>(null);
  const {
    artists,
    selectedArtistId,
    createArtist,
    renameArtist,
    deleteArtist,
    toggleArtistFavourite,
    selectArtist,
  } = useArtistManagement();

  // Handle artist click to select
  const handleArtistClick = (artist: ArtistData) => {
    selectArtist(artist.id);
    onArtistClick?.(artist);
  };

  // Filter artists based on search query
  const filteredArtists = searchQuery.trim() === "" 
    ? artists 
    : artists.filter(artist => 
        artist.name.toLowerCase().includes(searchQuery.toLowerCase())
      );

  // Handle search input changes
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setIsSearchMode(value.trim() !== "");
    setCurrentPage(1);
  };

  // Clear search
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

  // Handle artist menu actions
  const handleArtistAction = (artistId: string, action: string) => {
    switch (action) {
      case "favorite":
        toggleArtistFavourite(artistId);
        toast.success("Artist favorited");
        break;
      case "delete":
        deleteArtist(artistId);
        toast.success("Artist deleted");
        break;
      case "rename":
        // Handled by onTitleEdit
        break;
      default:
        console.log(`Action ${action} on artist ${artistId}`);
    }
  };

  // Handle artist title editing
  const handleArtistTitleEdit = (artistId: string, newTitle: string) => {
    renameArtist(artistId, newTitle);
    toast.success("Artist renamed");
  };

  // Handle new artist creation
  const handleCreateArtist = () => {
    const newArtistName = `Artist ${artists.length + 1}`;
    createArtist(newArtistName);
    toast.success(`Created "${newArtistName}"`);
  };

  // Get sorted artists (Favourited first)
  const getSortedArtists = () => {
    if (isSearchMode) return filteredArtists;
    
    const favourited = filteredArtists.filter(a => a.isFavorited);
    const others = filteredArtists.filter(a => !a.isFavorited).sort((a, b) => b.createdAt - a.createdAt);
    return [...favourited, ...others];
  };

  const sortedArtists = getSortedArtists();
  
  // Calculate pagination
  const totalPages = Math.ceil(sortedArtists.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const displayArtists = sortedArtists.slice(startIndex, endIndex);

  return (
    <div className={cn("h-full bg-[#151515] rounded-lg flex flex-col", className)}>
      {/* Header */}
      <div className="shrink-0 p-4 pb-3">
        <div className="text-sm text-white font-medium mb-3">Artists</div>

        {/* Search Bar */}
        <div className="relative mb-2">
          <Input
            ref={searchInputRef}
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search artists..."
            className="w-full bg-[#1e1e1e] border-0 text-white placeholder:text-white/40 focus-visible:ring-1 focus-visible:ring-white/20 pr-10 text-sm h-9"
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2">
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

        {/* New Artists Button */}
        <button
          onClick={handleCreateArtist}
          className="w-full flex items-center justify-center gap-2 bg-[#1e1e1e] hover:bg-[#252525] text-white/80 hover:text-white transition-all duration-200 rounded-lg py-2 text-sm"
        >
          <Plus className="w-4 h-4" />
          New Artists +
        </button>

        {/* Search Results Count */}
        {isSearchMode && (
          <div className="text-xs text-white/40 mt-2">
            {filteredArtists.length} artist{filteredArtists.length !== 1 ? 's' : ''} found
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <div className="h-full overflow-y-auto overflow-x-hidden lyrics-scrollbar">
          <div className="min-h-full flex flex-col justify-start gap-2 px-4 pb-4">
            {/* Artist Bubbles */}
            {displayArtists.map((artist) => (
              <ArtistBubble
                key={artist.id}
                artist={artist}
                onMenuAction={handleArtistAction}
                onTitleEdit={handleArtistTitleEdit}
                onArtistClick={handleArtistClick}
                isSelected={artist.id === selectedArtistId}
              />
            ))}

            {/* Empty State */}
            {sortedArtists.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="text-white/60 mb-2">
                  {isSearchMode ? 'No artists found' : 'No artists yet'}
                </div>
                {!isSearchMode && (
                  <button
                    onClick={handleCreateArtist}
                    className="text-sm text-accent-primary hover:text-accent-primary/80 transition-colors flex items-center gap-1"
                  >
                    <Plus className="w-4 h-4" />
                    Create your first artist
                  </button>
                )}
              </div>
            )}
            
            {/* Pagination */}
            {sortedArtists.length > itemsPerPage && (
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
    </div>
  );
}
