import React, { useEffect, useState, useRef } from "react";
import { Play, Pause, RotateCw, X, Heart, Shuffle, Repeat, MoreHorizontal, Search } from "lucide-react";
import { TrackItem } from "@/types";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useScrollDelegationHook } from "@/utils/scrollDelegation";
import EllipsisMarquee from "@/components/ui/EllipsisMarquee";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

type Props = {
  tracks: TrackItem[];
  currentIndex: number;
  isPlaying: boolean;
  audioRefs: React.MutableRefObject<HTMLAudioElement[]>;
  onPlayPause: (index: number) => void;
  onSeek: (t: number) => void;
  setCurrentIndex: (index: number) => void;
  onTimeUpdate: (audio: HTMLAudioElement) => void;
};

// Generate 20 test tracks for testing search functionality
const generateTestTracks = (): TrackItem[] => {
  const testTracks: TrackItem[] = [
    { id: "test-1", title: "Midnight Dreams", url: "", coverUrl: "", createdAt: Date.now() - 86400000, params: ["electronic", "ambient", "chill", "night"] },
    { id: "test-2", title: "Summer Vibes", url: "", coverUrl: "", createdAt: Date.now() - 86300000, params: ["pop", "upbeat", "sunny", "dance"] },
    { id: "test-3", title: "Rainy Day Blues", url: "", coverUrl: "", createdAt: Date.now() - 86200000, params: ["blues", "melancholy", "rain", "guitar"] },
    { id: "test-4", title: "Mountain High", url: "", coverUrl: "", createdAt: Date.now() - 86100000, params: ["rock", "epic", "adventure", "powerful"] },
    { id: "test-5", title: "Ocean Waves", url: "", coverUrl: "", createdAt: Date.now() - 86000000, params: ["ambient", "relaxing", "nature", "peaceful"] },
    { id: "test-6", title: "Neon Lights", url: "", coverUrl: "", createdAt: Date.now() - 85900000, params: ["synthwave", "retro", "80s", "neon"] },
    { id: "test-7", title: "Forest Walk", url: "", coverUrl: "", createdAt: Date.now() - 85800000, params: ["acoustic", "folk", "nature", "calm"] },
    { id: "test-8", title: "City Rush", url: "", coverUrl: "", createdAt: Date.now() - 85700000, params: ["urban", "fast", "energy", "modern"] },
    { id: "test-9", title: "Starlight Serenade", url: "", coverUrl: "", createdAt: Date.now() - 85600000, params: ["romantic", "jazz", "smooth", "night"] },
    { id: "test-10", title: "Thunder Storm", url: "", coverUrl: "", createdAt: Date.now() - 85500000, params: ["dramatic", "orchestral", "intense", "storm"] },
    { id: "test-11", title: "Sunrise Hope", url: "", coverUrl: "", createdAt: Date.now() - 85400000, params: ["inspiring", "orchestral", "morning", "hope"] },
    { id: "test-12", title: "Digital Dreams", url: "", coverUrl: "", createdAt: Date.now() - 85300000, params: ["electronic", "futuristic", "cyber", "digital"] },
    { id: "test-13", title: "Desert Wind", url: "", coverUrl: "", createdAt: Date.now() - 85200000, params: ["world", "ethnic", "mystical", "desert"] },
    { id: "test-14", title: "Jazz Cafe", url: "", coverUrl: "", createdAt: Date.now() - 85100000, params: ["jazz", "coffee", "smooth", "relaxing"] },
    { id: "test-15", title: "Rock Anthem", url: "", coverUrl: "", createdAt: Date.now() - 85000000, params: ["rock", "anthem", "powerful", "guitar"] },
    { id: "test-16", title: "Moonlight Waltz", url: "", coverUrl: "", createdAt: Date.now() - 84900000, params: ["classical", "waltz", "elegant", "moonlight"] },
    { id: "test-17", title: "Hip Hop Beats", url: "", coverUrl: "", createdAt: Date.now() - 84800000, params: ["hip-hop", "beats", "rhythm", "urban"] },
    { id: "test-18", title: "Country Road", url: "", coverUrl: "", createdAt: Date.now() - 84700000, params: ["country", "road", "guitar", "storytelling"] },
    { id: "test-19", title: "Electric Pulse", url: "", coverUrl: "", createdAt: Date.now() - 84600000, params: ["edm", "pulse", "electronic", "dance"] },
    { id: "test-20", title: "Peaceful Mind", url: "", coverUrl: "", createdAt: Date.now() - 84500000, params: ["meditation", "peaceful", "zen", "mindful"] }
  ];
  return testTracks;
};

export default function TrackListPanel({
  tracks,
  currentIndex,
  isPlaying,
  audioRefs,
  onPlayPause,
  onSeek,
  setCurrentIndex,
  onTimeUpdate,
}: Props) {
  const [audioCurrentTimes, setAudioCurrentTimes] = useState<number[]>([]);
  const [showQuickAlbumGenerator, setShowQuickAlbumGenerator] = useState(false);
  const [selectedTrackForRegen, setSelectedTrackForRegen] = useState<TrackItem | null>(null);
  
  // Search functionality state
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchMode, setIsSearchMode] = useState(false);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const tracksPerPage = 15;

  // Track hover states
  const [hoveredTracks, setHoveredTracks] = useState<{ [key: string]: boolean }>({});
  
  // Scroll delegation
  const scrollRef = useRef<HTMLDivElement>(null);
  useScrollDelegationHook(scrollRef);
  
  // Combine original tracks with test tracks for demo
  const allTracks = [...tracks, ...generateTestTracks()];
  
  // Filter tracks based on search query
  const filteredTracks = searchQuery.trim() === "" 
    ? allTracks 
    : allTracks.filter(track => {
        const query = searchQuery.toLowerCase();
        const titleMatch = track.title?.toLowerCase().includes(query);
        const paramsMatch = track.params?.some(param => 
          param.toLowerCase().includes(query)
        );
        return titleMatch || paramsMatch;
      });

  // Calculate pagination
  const totalPages = Math.ceil(filteredTracks.length / tracksPerPage);
  const startIndex = (currentPage - 1) * tracksPerPage;
  const endIndex = startIndex + tracksPerPage;
  const paginatedTracks = filteredTracks.slice(startIndex, endIndex);

  // Handle search input changes
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setIsSearchMode(value.trim() !== "");
    setCurrentPage(1); // Reset to first page when searching
  };

  // Clear search and restore original order
  const clearSearch = () => {
    setSearchQuery("");
    setIsSearchMode(false);
    setCurrentPage(1);
  };

  // Handle page changes
  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  // Initialize audio times array when tracks change
  useEffect(() => {
    setAudioCurrentTimes(new Array(allTracks.length).fill(0));
  }, [allTracks.length]);

  // Reset previous track's time when currentIndex changes
  useEffect(() => {
    setAudioCurrentTimes(prev => {
      const newTimes = [...prev];
      // Reset all other tracks to 0 except current
      for (let i = 0; i < newTimes.length; i++) {
        if (i !== currentIndex) {
          newTimes[i] = 0;
        }
      }
      return newTimes;
    });
  }, [currentIndex]);

  return (
    <aside className="h-full min-h-0 bg-[#151515] rounded-2xl flex flex-col">
      {/* Search Bar */}
      <div className="relative pl-4 pr-6 pt-4 mb-2 shrink-0">
        <div className="relative">
          <Input
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search tracks, genres, keywords..."
            className="w-full bg-[#1e1e1e] border-0 text-white placeholder:text-white/40 focus-visible:ring-1 focus-visible:ring-white/20 pr-10"
          />
          <button
            onClick={isSearchMode ? clearSearch : undefined}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/60 transition-colors"
          >
            {isSearchMode ? (
              <X className="w-4 h-4" />
            ) : (
              <Search className="w-4 h-4" />
            )}
          </button>
        </div>
        {isSearchMode && (
          <div className="text-xs text-white/40 mt-2">
            {filteredTracks.length} track{filteredTracks.length !== 1 ? 's' : ''} found
          </div>
        )}
      </div>

      {/* Scrollable area */}
      <div className="min-h-0 flex-1 overflow-hidden">
        <div ref={scrollRef} className="h-full overflow-y-auto overflow-x-hidden lyrics-scrollbar">
          <div className={`min-h-full flex flex-col justify-start gap-3 px-4 pt-2 pb-4`}>
        {paginatedTracks.map((t, pageIndex) => {
          // Calculate the actual index in the full filtered tracks array
          const actualIndex = filteredTracks.indexOf(t);
          const active = actualIndex === currentIndex;
          return (
            <div
              key={t.id}
              className={`${active ? "" : "rounded-xl bg-[#1e1e1e] p-3 cursor-pointer hover:bg-[#252525] transition-colors"}`}
              onClick={!active ? () => {
                setCurrentIndex(actualIndex);
                onPlayPause(actualIndex);
              } : undefined}
              onMouseEnter={() => setHoveredTracks(prev => ({ ...prev, [t.id]: true }))}
              onMouseLeave={() => setHoveredTracks(prev => ({ ...prev, [t.id]: false }))}
            >
              {!active ? (
                /* Regular track row */
                <div className="flex items-center gap-3">
                  <div className="shrink-0 w-10 h-10 rounded-md bg-black/30 overflow-hidden">
                    {t.coverUrl ? (
                      <img src={t.coverUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-purple-500/20 to-cyan-500/20" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <EllipsisMarquee
                      text={`No Artist – ${t.title || "Song Title"}`}
                      className="text-xs text-white/60"
                      speedPxPerSec={60}
                      gapPx={32}
                      isActive={hoveredTracks[t.id]}
                    />
                    <div
                      className="mt-1 h-1.5 bg-white/10 rounded cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        
                        const audio = audioRefs.current[actualIndex];
                        if (!audio || !audio.duration) return;
                        const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                        const pct = (e.clientX - rect.left) / rect.width;
                        const seek = pct * audio.duration;
                        
                        if (actualIndex !== currentIndex) {
                          setCurrentIndex(actualIndex);
                          onPlayPause(actualIndex);
                        }
                        
                        onSeek(seek);
                      }}
                    >
                       <div
                         className="h-full bg-white/70 rounded"
                         style={{
                            width: (() => {
                              const a = audioRefs.current[actualIndex];
                              if (!a || !a.duration) return "0%";
                              const time = audioCurrentTimes[actualIndex] || 0;
                              return `${(time / a.duration) * 100}%`;
                            })(),
                         }}
                       />
                    </div>
                  </div>

                  <button
                    className="w-8 h-8 shrink-0 flex items-center justify-center text-white/60 hover:text-white transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      onPlayPause(actualIndex);
                    }}
                  >
                    <Play className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                /* Active track - album art hugs left edge */
                <div 
                  className="bg-[#1e1e1e] rounded-xl flex flex-col"
                  onMouseEnter={() => setHoveredTracks(prev => ({ ...prev, [t.id]: true }))}
                  onMouseLeave={() => setHoveredTracks(prev => ({ ...prev, [t.id]: false }))}
                >
                  {/* First row: Album art + Content */}
                  <div className="flex">
                    {/* Album art - flush with container left edge, only top-left corner rounded */}
                    <div className="shrink-0 w-16 h-16 bg-black/30 overflow-hidden rounded-tl-xl relative group">
                      {t.coverUrl ? (
                        <img src={t.coverUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-purple-500/20 to-cyan-500/20" />
                      )}
                      <div 
                        className="absolute inset-0 bg-black/50 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedTrackForRegen(t);
                          setShowQuickAlbumGenerator(true);
                        }}
                      >
                        <RotateCw className="w-4 h-4 text-white group-hover:animate-[spin_0.36s_ease-in-out] transition-transform" />
                      </div>
                    </div>

                    {/* Content area next to album art */}
                    <div className="flex-1 ml-3 flex flex-col justify-start">
                      {/* Title above controls */}
                      <div className="mb-1 mt-1">
                        <EllipsisMarquee
                          text={t.title || "Song Title"}
                          className="text-sm text-white font-medium"
                          speedPxPerSec={60}
                          gapPx={32}
                          isActive={hoveredTracks[t.id]}
                        />
                        <div className="text-xs text-white/60 truncate">No Artist</div>
                      </div>

                      {/* Controls line: Play button + Progress bar + 4 icons */}
                      <div className="flex items-center gap-3 mb-3 -ml-1">
                        {/* Play button */}
                        <button
                          className="w-6 h-6 flex items-center justify-center text-white hover:text-white/80 transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            onPlayPause(actualIndex);
                          }}
                        >
                          {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                        </button>

                        {/* Progress bar */}
                        <div 
                          className="flex-1 h-1.5 bg-white/10 rounded cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            
                            const audio = audioRefs.current[actualIndex];
                            if (!audio || !audio.duration) return;
                            const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                            const pct = (e.clientX - rect.left) / rect.width;
                            const seek = pct * audio.duration;
                            
                            onSeek(seek);
                          }}
                        >
                           <div
                             className="h-full bg-white/70 rounded"
                             style={{
                               width: (() => {
                              const a = audioRefs.current[actualIndex];
                              if (!a || !a.duration) return "0%";
                              const time = audioCurrentTimes[actualIndex] || 0;
                              return `${(time / a.duration) * 100}%`;
                               })(),
                             }}
                           />
                        </div>

                        {/* 4 control icons */}
                        <div className="flex items-center gap-2">
                          <button className="text-white/60 hover:text-white transition-colors">
                            <Heart className="w-4 h-4" />
                          </button>
                          <button className="text-white/60 hover:text-white transition-colors">
                            <Shuffle className="w-4 h-4" />
                          </button>
                          <button className="text-white/60 hover:text-white transition-colors">
                            <Repeat className="w-4 h-4" />
                          </button>
                          <button className="text-white/60 hover:text-white transition-colors">
                            <MoreHorizontal className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Second row: Parameters - full width from album art left edge */}
                  <div className="-mt-0.5 pr-1">
                    <div className="max-h-[120px] overflow-y-auto lyrics-scrollbar">
                      <div className="flex flex-wrap gap-x-1.5 gap-y-1.5 px-2 pb-2">
                        {(t.params || ["ambient", "chill", "electronic"]).map((p, idx) => (
                          <div key={idx} className="px-3 py-1.5 rounded-full bg-white/25 text-[12px] text-black font-semibold text-center whitespace-nowrap">
                            {p}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Hidden audio element per track */}
               <audio
                 src={t.url}
                 preload="auto"
                 className="hidden"
                 crossOrigin="anonymous"
                  ref={(el) => { if (el) audioRefs.current[actualIndex] = el; }}
                  onTimeUpdate={(e) => {
                    const audio = e.currentTarget;
                    // Only update progress for the currently active track
                    if (actualIndex === currentIndex) {
                      setAudioCurrentTimes(prev => {
                        const newTimes = [...prev];
                        newTimes[actualIndex] = audio.currentTime;
                        return newTimes;
                      });
                    }
                    // Call the original onTimeUpdate
                    onTimeUpdate(audio);
                  }}
               />
            </div>
          );
        })}
        
           {filteredTracks.length === 0 && (
             <div className="text-center text-white/40 py-8">
               {isSearchMode ? (
                 <>
                   <div className="text-sm">No matching tracks found</div>
                   <div className="text-xs mt-1">Try different keywords</div>
                 </>
               ) : (
                 <>
                   <div className="text-sm">No tracks yet</div>
                   <div className="text-xs mt-1">Generate a song to see it here</div>
                 </>
               )}
             </div>
           )}
           
           {/* Pagination */}
           {filteredTracks.length > tracksPerPage && (
             <div className="mt-3 flex justify-center">
               <Pagination>
                 <PaginationContent className="gap-1">
                    <PaginationItem>
                      <PaginationPrevious
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          handlePageChange(currentPage - 1);
                        }}
                        className={currentPage === 1 ? "pointer-events-none text-white/20 hover:text-white/20" : ""}
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
                              handlePageChange(page);
                            }}
                            isActive={page === currentPage}
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
                          handlePageChange(currentPage + 1);
                        }}
                        className={currentPage === totalPages ? "pointer-events-none text-white/20 hover:text-white/20" : ""}
                      />
                    </PaginationItem>
                 </PaginationContent>
               </Pagination>
             </div>
           )}
           </div>
        </div>
      </div>

      {/* Quick Album Cover Generator Overlay */}
      <Dialog open={showQuickAlbumGenerator} onOpenChange={setShowQuickAlbumGenerator}>
        <DialogContent className="max-w-none w-full h-full bg-black/10 backdrop-blur border-0 p-0 flex flex-col">
          <div className="relative w-full h-full flex flex-col">
            {/* Custom X button */}
            <button
              className="absolute top-6 right-6 z-10 w-8 h-8 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
              onClick={() => setShowQuickAlbumGenerator(false)}
            >
              <X className="w-6 h-6" />
            </button>
            
            {/* Title */}
            <div className="flex-shrink-0 pt-12 pb-8 text-center">
              <h2 className="text-2xl font-semibold text-white">Quick Album Cover Generator</h2>
              {selectedTrackForRegen && (
                <p className="text-white/60 mt-2">Regenerating cover for "{selectedTrackForRegen.title}"</p>
              )}
            </div>
            
            {/* Content area for future implementation */}
            <div className="flex-1 flex items-center justify-center">
              <div className="text-white/40 text-center">
                <div className="text-lg mb-2">Album cover generation coming soon...</div>
                <div className="text-sm">This feature will allow you to regenerate album covers</div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </aside>
  );
}