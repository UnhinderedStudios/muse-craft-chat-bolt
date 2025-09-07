import React, { useEffect, useState, useRef } from "react";
import { Play, Pause, RotateCw, X, Heart, Redo2, Plus, Trash2, Search, Edit3, MoreVertical, Music, Check } from "lucide-react";
import { TrackItem } from "@/types";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useScrollDelegationHook } from "@/utils/scrollDelegation";
import EllipsisMarquee from "@/components/ui/EllipsisMarquee";
import { useDrag } from "@/contexts/DragContext";
import { cn } from "@/lib/utils";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { TrackLoadingShell } from "./TrackLoadingShell";

type Props = {
  tracks: TrackItem[];
  currentIndex: number;
  playingTrackIndex: number;
  isPlaying: boolean;
  audioRefs: React.MutableRefObject<HTMLAudioElement[]>;
  onPlayPause: (index: number) => void;
  onSeek: (t: number) => void;
  setCurrentIndex: (index: number) => void;
  onTimeUpdate: (audio: HTMLAudioElement) => void;
  onTrackTitleUpdate?: (trackIndex: number, newTitle: string) => void;
  isGenerating?: boolean;
  generationProgress?: number;
  activeJobCount?: number;
  activeGenerations?: Array<{id: string, startTime: number, progress: number, details: any, covers?: { cover1: string; cover2: string } | null}>;
};


export default function TrackListPanel({
  tracks,
  currentIndex,
  playingTrackIndex,
  isPlaying,
  audioRefs,
  onPlayPause,
  onSeek,
  setCurrentIndex,
  onTimeUpdate,
  onTrackTitleUpdate,
  isGenerating = false,
  generationProgress = 0,
  activeJobCount = 0,
  activeGenerations = []
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
  const [dragStartTrack, setDragStartTrack] = useState<{ track: TrackItem; startPos: { x: number; y: number } } | null>(null);
  
  // Title editing state for selected track
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  
  // Menu overlay state
  const [openMenuTrackId, setOpenMenuTrackId] = useState<string | null>(null);
  
  // Delete and Add overlay states
  const [openDeleteOverlayTrackId, setOpenDeleteOverlayTrackId] = useState<string | null>(null);
  const [openAddOverlayTrackId, setOpenAddOverlayTrackId] = useState<string | null>(null);
  
  // Playlist search state
  const [playlistSearchQuery, setPlaylistSearchQuery] = useState("");
  
  // Drag functionality
  const { startDrag, dragState } = useDrag();
  
  // Scroll delegation
  const scrollRef = useRef<HTMLDivElement>(null);
  useScrollDelegationHook(scrollRef);
  
  // Sort real tracks by newest first
  const allTracks = [...tracks].sort((a, b) => b.createdAt - a.createdAt);
  
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

  // Clear playlist search when overlay closes
  useEffect(() => {
    if (!openAddOverlayTrackId) {
      setPlaylistSearchQuery("");
    }
  }, [openAddOverlayTrackId]);

  // Handle page changes
  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  // Title editing functions
  const handleTitleClick = (trackIndex: number) => {
    setIsEditingTitle(true);
    setEditTitle(filteredTracks[trackIndex]?.title || "");
  };

  const handleTitleSubmit = (trackIndex: number) => {
    if (editTitle.trim() && editTitle.trim() !== filteredTracks[trackIndex]?.title && onTrackTitleUpdate) {
      onTrackTitleUpdate(trackIndex, editTitle.trim());
    }
    setIsEditingTitle(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent, trackIndex: number) => {
    if (e.key === 'Enter') {
      handleTitleSubmit(trackIndex);
    } else if (e.key === 'Escape') {
      setEditTitle(filteredTracks[trackIndex]?.title || "");
      setIsEditingTitle(false);
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
            
            {/* Show loading shells for each active generation */}
            {activeJobCount > 0 && Array.from({ length: activeJobCount * 2 }, (_, i) => {
              const jobIndex = Math.floor(i / 2);
              const trackInJob = i % 2;
              // Use job-specific progress from activeGenerations
              const job = activeGenerations[jobIndex];
              const jobProgress = job?.progress || 0;
              const coverUrl = job?.covers ? (trackInJob === 0 ? job.covers.cover1 : job.covers.cover2) : undefined;
              return (
                <TrackLoadingShell 
                  key={`loading-${jobIndex}-${trackInJob}`}
                  progress={trackInJob === 0 ? jobProgress : Math.max(0, jobProgress - 25)} 
                  trackNumber={tracks.length + i + 1}
                  coverUrl={coverUrl}
                  title={job?.details?.title}
                />
              );
            })}
            
            {paginatedTracks.map((t, pageIndex) => {
          // Calculate the actual index in the original tracks array
          const actualIndex = tracks.findIndex(track => track.id === t.id);
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
                <div 
                  className={cn(
                    "flex items-center gap-3 relative",
                    dragStartTrack?.track.id === t.id && "track-detaching"
                  )}
                  onMouseDown={(e) => {
                    // Only start drag detection for non-selected tracks
                    if (!active) {
                      setDragStartTrack({ 
                        track: t, 
                        startPos: { x: e.clientX, y: e.clientY } 
                      });
                      startDrag(t, e);
                    }
                  }}
                  onMouseUp={() => {
                    setDragStartTrack(null);
                  }}
                >
                  {/* New track indicator - pink glowing ball */}
                  {t.createdAt && Date.now() - t.createdAt < 24 * 60 * 60 * 1000 && !t.hasBeenPlayed && (
                    <div className="absolute -top-1 -right-1 w-1.5 h-1.5 rounded-full bg-pink-500 z-10" 
                         style={{
                           boxShadow: '0 0 8px rgba(236, 72, 153, 0.6), 0 0 4px rgba(236, 72, 153, 0.8)'
                         }} />
                  )}
                  
                  <div className="shrink-0 w-10 h-10 rounded-md bg-black/30 overflow-hidden">
                    {t.coverUrl ? (
                      <img src={t.coverUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-pink-500/20 to-rose-500/20" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <EllipsisMarquee
                      text={`No Artist – ${t.title || "Song Title"}`}
                      className="text-xs text-white/60"
                      speedPxPerSec={70}
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
                  className="bg-[#1e1e1e] rounded-xl flex flex-col relative"
                  onMouseEnter={() => setHoveredTracks(prev => ({ ...prev, [t.id]: true }))}
                  onMouseLeave={() => setHoveredTracks(prev => ({ ...prev, [t.id]: false }))}
                >
                  {/* First row: Album art + Content */}
                  <div className="flex relative">
                    {/* Top-right menu icon */}
                    <button 
                      className="absolute top-1 right-2 text-white/60 hover:text-white transition-colors z-30 w-6 h-6 flex items-center justify-center"
                       onClick={(e) => {
                         e.stopPropagation();
                         // If any overlay is open, close all overlays
                         if (openMenuTrackId === t.id || openDeleteOverlayTrackId === t.id || openAddOverlayTrackId === t.id) {
                           setOpenMenuTrackId(null);
                           setOpenDeleteOverlayTrackId(null);
                           setOpenAddOverlayTrackId(null);
                         } else {
                           // If no overlays are open, toggle the menu
                           setOpenMenuTrackId(openMenuTrackId === t.id ? null : t.id);
                         }
                       }}
                    >
                      <div className="relative w-4 h-4">
                        <MoreVertical 
                          className={`w-4 h-4 absolute transition-all duration-200 ease-in-out ${
                            openMenuTrackId === t.id || openDeleteOverlayTrackId === t.id || openAddOverlayTrackId === t.id
                              ? 'opacity-0 rotate-90 scale-75' 
                              : 'opacity-100 rotate-0 scale-100'
                          }`}
                        />
                        <X 
                          className={`w-4 h-4 absolute transition-all duration-200 ease-in-out ${
                            openMenuTrackId === t.id || openDeleteOverlayTrackId === t.id || openAddOverlayTrackId === t.id
                              ? 'opacity-100 rotate-0 scale-100' 
                              : 'opacity-0 rotate-90 scale-75'
                          }`}
                        />
                      </div>
                    </button>
                    {/* Album art - flush with container left edge, only top-left corner rounded */}
                    <div className="shrink-0 w-16 h-16 bg-black/30 overflow-hidden rounded-tl-xl rounded-br-xl relative group">
                      {t.coverUrl ? (
                        <img src={t.coverUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-pink-500/20 to-rose-500/20" />
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
                     <div className="flex-1 ml-3 mr-3 flex flex-col justify-start min-w-0">
                      {/* Title above controls */}
                      <div className="mb-1 mt-1">
                        {isEditingTitle ? (
                          <input
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            onBlur={() => handleTitleSubmit(actualIndex)}
                            onKeyDown={(e) => handleKeyDown(e, actualIndex)}
                            className="w-[90%] text-sm font-medium bg-transparent border-none outline-none text-white p-0 m-0"
                            autoFocus
                          />
                        ) : (
                          <div 
                            onClick={() => handleTitleClick(actualIndex)}
                            className="cursor-pointer group/title w-full overflow-hidden"
                          >
                             <div className="flex items-baseline gap-1 w-full min-w-0">
                               <div className="min-w-0 w-[90%] flex items-baseline">
                                 <EllipsisMarquee
                                   text={t.title || "Song Title"}
                                   className="text-sm text-white font-medium"
                                   speedPxPerSec={30}
                                   gapPx={32}
                                   isActive={hoveredTracks[t.id]}
                                 />
                                 <Edit3 className="w-3 h-3 text-white/40 opacity-0 group-hover/title:opacity-100 transition-opacity shrink-0 ml-1" />
                               </div>
                             </div>
                          </div>
                        )}
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
                            <Redo2 className="w-4 h-4" />
                          </button>
                          <button 
                            className="text-white/60 hover:text-white transition-colors"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenAddOverlayTrackId(openAddOverlayTrackId === t.id ? null : t.id);
                              setOpenMenuTrackId(null);
                              setOpenDeleteOverlayTrackId(null);
                            }}
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                          <button 
                            className="text-white/60 hover:text-white transition-colors"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenDeleteOverlayTrackId(openDeleteOverlayTrackId === t.id ? null : t.id);
                              setOpenMenuTrackId(null);
                              setOpenAddOverlayTrackId(null);
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
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

                     {/* Overlay Menu */}
                     {openMenuTrackId === t.id && (
                       <div 
                          className="absolute inset-0 backdrop-blur-sm rounded-xl border border-white/[0.06] z-20"
                         style={{ backgroundColor: '#151515CC' }}
                         onClick={(e) => {
                           e.stopPropagation();
                           setOpenMenuTrackId(null);
                         }}
                       >
                       </div>
                     )}

                     {/* Delete Overlay */}
                     {openDeleteOverlayTrackId === t.id && (
                       <div 
                          className="absolute inset-0 backdrop-blur-sm rounded-xl border border-white/[0.06] z-20"
                         style={{ backgroundColor: '#151515CC' }}
                         onClick={(e) => {
                           e.stopPropagation();
                           setOpenDeleteOverlayTrackId(null);
                         }}
                       >
                          <div className="h-full flex flex-col items-center justify-center gap-2 px-4">
                            <p className="text-gray-400 text-xs mb-1">Caution: Deletion is permanent</p>
                            <div className="flex gap-3 w-full mt-2">
                              <button
                                className="relative h-6 px-4 rounded-xl bg-gray-500/20 text-gray-300 hover:text-white transition-all duration-200 text-xs flex-1 overflow-hidden group"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  // TODO: Handle hide functionality
                                  setOpenDeleteOverlayTrackId(null);
                                }}
                              >
                                <div className="absolute inset-0 bg-gray-500/80 scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left"></div>
                                <span className="relative z-10">Hide</span>
                              </button>
                              <button
                                className="relative h-6 px-4 rounded-xl bg-gray-500/20 text-gray-300 hover:text-white transition-all duration-200 text-xs flex-1 overflow-hidden group"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  // TODO: Handle delete functionality
                                  setOpenDeleteOverlayTrackId(null);
                                }}
                              >
                                <div className="absolute inset-0 bg-red-500/80 scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left"></div>
                                <span className="relative z-10">Delete</span>
                              </button>
                            </div>
                          </div>
                       </div>
                     )}

                      {/* Add Overlay */}
                       {openAddOverlayTrackId === t.id && (
                         <div 
                           className="absolute inset-0 backdrop-blur-sm rounded-xl border border-white/[0.06] z-20"
                           style={{ backgroundColor: '#151515CC' }}
                           onClick={(e) => {
                             // Only close if clicking on the backdrop, not the content
                             if (e.target === e.currentTarget) {
                               setOpenAddOverlayTrackId(null);
                             }
                           }}
                         >
                           <div 
                             className="h-full flex flex-col"
                             onClick={(e) => e.stopPropagation()}
                           >
                            {/* Search Bar */}
                            <div className="flex justify-center p-3 pb-2">
                              <div className="relative w-4/5">
                                <input
                                  type="text"
                                  value={playlistSearchQuery}
                                  onChange={(e) => setPlaylistSearchQuery(e.target.value)}
                                  placeholder="Search playlists..."
                                  className="w-full bg-[#1e1e1e] border-0 text-white placeholder:text-white/40 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-white/20 pr-10"
                                  onClick={(e) => e.stopPropagation()}
                                />
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (playlistSearchQuery) {
                                      setPlaylistSearchQuery("");
                                    }
                                  }}
                                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/60 transition-colors"
                                >
                                  {playlistSearchQuery ? (
                                    <X className="w-4 h-4" />
                                  ) : (
                                    <Search className="w-4 h-4" />
                                  )}
                                </button>
                              </div>
                            </div>

                            {/* Search Results Info */}
                            {playlistSearchQuery && (
                              <div className="flex justify-center">
                                <div className="w-4/5 text-xs text-white/40 px-3 pb-2">
                                  {(() => {
                                    const mockPlaylists = [
                                      { id: "fav", name: "Favourites", songCount: 12 },
                                      { id: "chill", name: "Chill Vibes", songCount: 8 },
                                      { id: "workout", name: "Workout Mix", songCount: 15 },
                                      { id: "focus", name: "Deep Focus", songCount: 6 },
                                      { id: "party", name: "Party Hits", songCount: 24 }
                                    ];
                                    const filteredPlaylists = playlistSearchQuery.trim() === ""
                                      ? mockPlaylists
                                      : mockPlaylists.filter(playlist =>
                                          playlist.name.toLowerCase().includes(playlistSearchQuery.toLowerCase())
                                        );
                                    return `${filteredPlaylists.length} playlist${filteredPlaylists.length !== 1 ? 's' : ''} found`;
                                  })()}
                                </div>
                              </div>
                            )}

                            {/* Playlists List */}
                            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden lyrics-scrollbar px-3 pb-3">
                              <div className="space-y-2">
                                {/* Filter playlists based on search */}
                                {(() => {
                                  const mockPlaylists = [
                                    { id: "fav", name: "Favourites", songCount: 12 },
                                    { id: "chill", name: "Chill Vibes", songCount: 8 },
                                    { id: "workout", name: "Workout Mix", songCount: 15 },
                                    { id: "focus", name: "Deep Focus", songCount: 6 },
                                    { id: "party", name: "Party Hits", songCount: 24 }
                                  ];
                                  
                                  const filteredPlaylists = playlistSearchQuery.trim() === ""
                                    ? mockPlaylists
                                    : mockPlaylists.filter(playlist =>
                                        playlist.name.toLowerCase().includes(playlistSearchQuery.toLowerCase())
                                      );
                                  
                                  if (filteredPlaylists.length === 0) {
                                    return (
                                      <div className="text-center py-8">
                                        <Music className="w-8 h-8 text-white/20 mx-auto mb-2" />
                                        <p className="text-white/40 text-sm">No playlists found</p>
                                        <p className="text-white/20 text-xs mt-1">Try a different search term</p>
                                      </div>
                                    );
                                  }
                                  
                                  return (
                                    <>
                                      {filteredPlaylists.map((playlist) => (
                                  <div
                                    key={playlist.id}
                                    className="flex items-center justify-between p-2 rounded-lg bg-[#1e1e1e] hover:bg-[#2a2a2a] transition-colors cursor-pointer group"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-pink-500/20 to-rose-500/20 flex items-center justify-center shrink-0">
                                        <Music className="w-4 h-4 text-white/60" />
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-white text-sm font-medium truncate">{playlist.name}</p>
                                        <p className="text-white/40 text-xs">{playlist.songCount} songs</p>
                                      </div>
                                    </div>
                                     <button
                                       className="text-white/40 hover:text-white hover:scale-110 transition-all duration-200"
                                       onClick={(e) => {
                                         e.stopPropagation();
                                         // TODO: Add song to playlist
                                         console.log(`Adding song "${t.title}" to playlist "${playlist.name}"`);
                                         setOpenAddOverlayTrackId(null);
                                       }}
                                     >
                                       <Plus className="w-4 h-4" />
                                     </button>
                                        </div>
                                      ))}
                                    </>
                                  );
                                })()}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                </div>
              )}

              {/* Hidden audio element per track */}
               <audio
                 src={t.url}
                 preload="auto"
                 autoPlay={false}
                 muted={false}
                 className="hidden"
                 crossOrigin="anonymous"
                  ref={(el) => { 
                    if (el) {
                      audioRefs.current[actualIndex] = el;
                      // CRITICAL: Ensure no auto-play when element is created
                      el.autoplay = false;
                      console.log(`[AUDIO DEBUG] Created audio element at index ${actualIndex}, autoplay disabled`);
                    }
                  }}
                  onTimeUpdate={(e) => {
                    const audio = e.currentTarget;
                    // CRITICAL: Only update if this is the currently playing track AND playing
                    if (actualIndex === playingTrackIndex && isPlaying && !audio.paused) {
                      setAudioCurrentTimes(prev => {
                        const newTimes = [...prev];
                        newTimes[actualIndex] = audio.currentTime;
                        return newTimes;
                      });
                      // Call the original onTimeUpdate only for playing track
                      onTimeUpdate(audio);
                    }
                  }}
                  onPlay={(e) => {
                    // Pause all other audio elements when this one starts playing
                    const currentAudio = e.currentTarget;
                    audioRefs.current.forEach((audio, index) => {
                      if (audio && audio !== currentAudio && !audio.paused) {
                        console.log(`[AUDIO DEBUG] Pausing conflicting audio at index ${index}`);
                        audio.pause();
                      }
                    });
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