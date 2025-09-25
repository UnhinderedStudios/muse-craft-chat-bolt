import React, { useEffect, useState, useRef } from "react";
import { Play, Pause, RotateCw, X, Heart, Download, Plus, Trash2, Search, Edit3, MoreVertical, Music, Check, FileMusic, FileAudio, FileText, ImageIcon, Package } from "lucide-react";
import { TrackItem } from "@/types";
import { Input } from "@/components/ui/input";
import { useScrollDelegationHook } from "@/utils/scrollDelegation";
import EllipsisMarquee from "@/components/ui/EllipsisMarquee";
import { useDrag } from "@/contexts/DragContext";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useSessionPlaylists, SessionPlaylist } from "@/hooks/use-session-playlists";
import JSZip from "jszip";
import { api } from "@/lib/api";
import { wavRegistry, isValidSunoAudioId } from "@/lib/wavRegistry";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { TrackLoadingShell } from "./TrackLoadingShell";
import QuickAlbumCoverGenerator from "@/components/template/QuickAlbumCoverGenerator";

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
  activeGenerations?: Array<{id: string, startTime: number, progress: number, details: any, covers?: { coverUrls: string[] } | null, isCompleting?: boolean}>;
  onPlaylistClick?: (playlist: SessionPlaylist) => void;
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
  activeGenerations = [],
  onPlaylistClick
}: Props) {
  const { toast } = useToast();
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
  
  // Track overlay type (download or delete)
  const [overlayType, setOverlayType] = useState<'download' | 'delete'>('delete');
  
  // Playlist search state
  const [playlistSearchQuery, setPlaylistSearchQuery] = useState("");
  
  // Track which playlists have been clicked (show checkmark)
  const [clickedPlaylists, setClickedPlaylists] = useState<Set<string>>(new Set());
  
  // Debouncing state for playlist operations to prevent race conditions
  const [playlistOperationsPending, setPlaylistOperationsPending] = useState<Set<string>>(new Set());
  
  // Session playlists
  const {
    playlists,
    addTrackToPlaylist,
    removeTrackFromPlaylist,
    toggleFavourite,
    isTrackInFavourites,
    isTrackInPlaylist
  } = useSessionPlaylists();
  
  // Drag functionality
  const { startDrag, dragState } = useDrag();
  
  // Scroll delegation
  const scrollRef = useRef<HTMLDivElement>(null);
  useScrollDelegationHook(scrollRef);
  
  // Group tracks by generation (createdAt) then sort by newest generation first
  const groupedTracks = tracks.reduce((acc, track) => {
    const generationTime = track.createdAt;
    if (!acc[generationTime]) {
      acc[generationTime] = [];
    }
    acc[generationTime].push(track);
    return acc;
  }, {} as Record<number, TrackItem[]>);

  // Flatten groups, showing newest generations first, but tracks within generation in original order
  const allTracks = Object.keys(groupedTracks)
    .sort((a, b) => Number(b) - Number(a)) // Newest generations first
    .flatMap(time => groupedTracks[Number(time)]);
  
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

  // Download utility functions
  const downloadFile = async (url: string, filename: string) => {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error('Download failed');
      
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
      
      return true;
    } catch (error) {
      console.error('Download failed:', error);
      return false;
    }
  };

  const downloadTextFile = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const generateLyricsContent = (track: TrackItem) => {
    if (!track.words || track.words.length === 0) {
      return `Lyrics for: ${track.title || 'Unknown Song'}\n\nNo timestamped lyrics available for this track.`;
    }

    let content = `Lyrics for: ${track.title || 'Unknown Song'}\nGenerated on: ${new Date().toLocaleString()}\n\n`;
    content += "=== TIMESTAMPED LYRICS ===\n\n";
    
    track.words.forEach((word, index) => {
      const startTime = Math.floor(word.start / 60) + ':' + (word.start % 60).toFixed(2).padStart(5, '0');
      const endTime = Math.floor(word.end / 60) + ':' + (word.end % 60).toFixed(2).padStart(5, '0');
      content += `[${startTime} - ${endTime}] ${word.word}\n`;
    });

    content += "\n=== PLAIN TEXT ===\n\n";
    content += track.words.map(w => w.word).join(' ');

    return content;
  };

  const handleDownloadMP3 = async (track: TrackItem) => {
    toast({ title: "Downloading MP3...", description: `Starting download of ${track.title}` });
    
    const filename = `${track.title || 'song'}.mp3`;
    const success = await downloadFile(track.url, filename);
    
    if (success) {
      toast({ title: "Download Complete", description: `${track.title} has been downloaded` });
    } else {
      toast({ title: "Download Failed", description: "Could not download the MP3 file", variant: "destructive" });
    }
  };

  const handleDownloadLyrics = (track: TrackItem) => {
    const content = generateLyricsContent(track);
    const filename = `${track.title || 'song'}_lyrics.txt`;
    downloadTextFile(content, filename);
    
    toast({ 
      title: "Lyrics Downloaded", 
      description: `Lyrics with timestamps saved as ${filename}` 
    });
  };

  const handleDownloadArt = async (track: TrackItem) => {
    if (!track.coverUrl) {
      toast({ title: "No Album Art", description: "This track doesn't have album art available", variant: "destructive" });
      return;
    }

    toast({ title: "Downloading Album Art...", description: `Starting download for ${track.title}` });
    
    const filename = `${track.title || 'song'}_cover.jpg`;
    const success = await downloadFile(track.coverUrl, filename);
    
    if (success) {
      toast({ title: "Download Complete", description: "Album art has been downloaded" });
    } else {
      toast({ title: "Download Failed", description: "Could not download the album art", variant: "destructive" });
    }
  };

  const handleDownloadWAV = async (track: TrackItem) => {
    if (!track.id || track.id.includes('loading') || track.id.includes('placeholder')) {
      toast({ 
        title: "WAV Not Available", 
        description: "WAV conversion is only available for generated songs with valid IDs.", 
        variant: "destructive" 
      });
      return;
    }

    toast({ title: "Converting to WAV...", description: "This may take a few minutes..." });
    
    // Get WAV conversion refs from registry and pass ALL known refs in one call
    const refs = wavRegistry.get(track.id) || {};
    const params: { audioId?: string; taskId?: string; musicIndex?: number } = {};
    if (refs.audioId) params.audioId = refs.audioId;
    if (refs.taskId) params.taskId = refs.taskId;
    if (typeof refs.musicIndex === 'number') params.musicIndex = refs.musicIndex;

    // Fallback: try using the track.id as audioId
    if (Object.keys(params).length === 0) {
      params.audioId = track.id;
    }
    
    try {
      const wavUrl = await api.convertToWav(params);
      if (wavUrl) {
        // Check if the WAV was directly downloaded (blob-based download)
        if (wavUrl === "Downloaded") {
          toast({ title: "Download Complete", description: "WAV file has been downloaded" });
        } else {
          // Fallback: use the URL to download (legacy behavior)
          const filename = `${(track.title || 'song').replace(/[^a-zA-Z0-9\s-_]/g, '')}.wav`;
          const success = await downloadFile(wavUrl, filename);
          
          if (success) {
            toast({ title: "Download Complete", description: "WAV file has been downloaded" });
          } else {
            toast({ title: "Download Failed", description: "Could not download the WAV file", variant: "destructive" });
          }
        }
      } else {
        throw new Error("WAV conversion returned no URL");
      }
    } catch (error) {
      console.error('WAV conversion failed:', error);
      const errorMessage = error instanceof Error ? error.message : "Could not convert to WAV format";
      const isTimeout = errorMessage.includes("timed out");
      
      toast({ 
        title: "WAV Conversion Failed", 
        description: isTimeout 
          ? "Conversion is taking longer than expected. The file may still be processing - please try again in a few minutes."
          : errorMessage,
        variant: "destructive" 
      });
    }
  };

  const handleDownloadAll = async (track: TrackItem) => {
    toast({ title: "Preparing Download...", description: "Creating zip file with all content" });
    
    try {
      const zip = new JSZip();
      const folderName = track.title || 'song';
      
      // Add MP3 file
      try {
        const audioResponse = await fetch(track.url);
        if (audioResponse.ok) {
          const audioBlob = await audioResponse.blob();
          zip.file(`${folderName}/${folderName}.mp3`, audioBlob);
        }
      } catch (error) {
        console.error('Could not add MP3 to zip:', error);
      }
      
      // Add WAV file if available
      if (track.id && !track.id.includes('loading') && !track.id.includes('placeholder')) {
        try {
          toast({ title: "Converting to WAV...", description: "Adding WAV to download package" });
          
          // Build params with all known refs in one call
          const refs = wavRegistry.get(track.id) || {};
          const params: { audioId?: string; taskId?: string; musicIndex?: number } = {};
          if (refs.audioId) params.audioId = refs.audioId;
          if (refs.taskId) params.taskId = refs.taskId;
          if (typeof refs.musicIndex === 'number') params.musicIndex = refs.musicIndex;
          if (Object.keys(params).length === 0) params.audioId = track.id;

          const wavUrl = await api.convertToWav(params);
          
          if (wavUrl) {
            const wavResponse = await fetch(wavUrl);
            if (wavResponse.ok) {
              const wavBlob = await wavResponse.blob();
              zip.file(`${folderName}/${folderName}.wav`, wavBlob);
            }
          }
        } catch (error) {
          console.error('Could not add WAV to zip:', error);
          // Continue without WAV if conversion fails
        }
      }
      
      // Add lyrics file
      const lyricsContent = generateLyricsContent(track);
      zip.file(`${folderName}/${folderName}_lyrics.txt`, lyricsContent);
      
      // Add album art if available
      if (track.coverUrl) {
        try {
          const artResponse = await fetch(track.coverUrl);
          if (artResponse.ok) {
            const artBlob = await artResponse.blob();
            const extension = track.coverUrl.includes('.png') ? 'png' : 'jpg';
            zip.file(`${folderName}/${folderName}_cover.${extension}`, artBlob);
          }
        } catch (error) {
          console.error('Could not add album art to zip:', error);
        }
      }
      
      // Generate and download zip
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = window.URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${folderName}_complete.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast({ title: "Download Complete", description: `${folderName}_complete.zip has been downloaded` });
    } catch (error) {
      console.error('Failed to create zip:', error);
      toast({ title: "Download Failed", description: "Could not create zip file", variant: "destructive" });
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
            
            {/* Show loading shells for active generations, filtered to avoid stale/duplicated shells */}
            {(() => {
              const MAX_AGE_MS = 20 * 60 * 1000; // safety: expire very old jobs
              const jobsToShow = (activeGenerations || []).filter((job) => {
                if (!job) return false;
                const age = Date.now() - (job.startTime || 0);
                if (age > MAX_AGE_MS) return false;
                // Keep shells visible until any tracks for this job are visible (check across all filteredTracks)
                const jobTracksInView = filteredTracks.filter(t => t.jobId === job.id).length;
                console.debug('[TrackListPanel] shell visibility', { jobId: job.id, jobTracksInFiltered: jobTracksInView, totalFiltered: filteredTracks.length });
                return jobTracksInView === 0;
              });
              return jobsToShow.flatMap((job, jobIndex) => [0, 1].map((trackInJob) => {
                const jobProgress = job?.progress || 0;
                const coverUrl = job?.covers?.coverUrls?.[trackInJob] || undefined;
                const listIndex = tracks.length + jobIndex * 2 + trackInJob + 1;
                return (
                  <TrackLoadingShell
                    key={`loading-${job.id}-${trackInJob}`}
                    progress={trackInJob === 0 ? jobProgress : Math.max(0, jobProgress - 25)}
                    trackNumber={listIndex}
                    coverUrl={coverUrl}
                    title={job?.details?.title}
                  />
                );
              }));
            })()}
            
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
                          {(isPlaying && actualIndex === currentIndex) ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
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
                          <button 
                            className={`transition-colors ${
                              isTrackInFavourites(t.id)
                                ? 'text-pink-500 hover:text-pink-400' 
                                : 'text-white/60 hover:text-white'
                            }`}
                            onClick={(e) => {
                              e.stopPropagation();
                              console.log('❤️ Heart button clicked for track:', t.title, t.id);
                              toggleFavourite(t);
                            }}
                          >
                            <Heart className={`w-4 h-4 ${isTrackInFavourites(t.id) ? 'fill-current' : ''}`} />
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
                              setOverlayType('download');
                              setOpenDeleteOverlayTrackId(openDeleteOverlayTrackId === t.id ? null : t.id);
                              setOpenMenuTrackId(null);
                              setOpenAddOverlayTrackId(null);
                            }}
                          >
                            <Download className="w-4 h-4" />
                          </button>
                          <button 
                            className="text-white/60 hover:text-white transition-colors"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOverlayType('delete');
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
                   {(() => {
                     const filtered = (t.params || ["ambient", "chill", "electronic"]).filter(p => !/timestamp/i.test(p));
                     if (filtered.length === 0) return null;
                     return (
                       <div className="-mt-0.5 pr-1">
                         <div className="max-h-[120px] overflow-y-auto lyrics-scrollbar">
                           <div className="flex flex-wrap gap-x-1.5 gap-y-1.5 px-2 pb-2">
                             {filtered.map((p, idx) => (
                               <div key={idx} className="px-3 py-1.5 rounded-full bg-white/25 text-[12px] text-black font-semibold text-center whitespace-nowrap">
                                 {p}
                               </div>
                             ))}
                           </div>
                         </div>
                       </div>
                     );
                   })()}


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
                             {overlayType === 'download' ? (
                               <>
                                 <div className="flex gap-2 w-full">
                                    <button
                                      className="h-6 px-3 rounded-xl bg-gray-500/20 text-gray-300 hover:bg-white/20 hover:text-white transition-colors duration-200 text-xs flex-1 flex items-center justify-center gap-1"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDownloadMP3(t);
                                        }}
                                    >
                                      <FileMusic className="w-3 h-3" />
                                      <span>MP3</span>
                                    </button>
                                     <button
                                       className="h-6 px-3 rounded-xl bg-gray-500/20 text-gray-300 hover:bg-white/20 hover:text-white transition-colors duration-200 text-xs flex-1 flex items-center justify-center gap-1"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDownloadWAV(t);
                                        }}
                                     >
                                      <FileAudio className="w-3 h-3" />
                                      <span>WAV</span>
                                    </button>
                                 </div>
                                 <div className="flex gap-2 w-full">
                                    <button
                                      className="h-6 px-3 rounded-xl bg-gray-500/20 text-gray-300 hover:bg-white/20 hover:text-white transition-colors duration-200 text-xs flex-1 flex items-center justify-center gap-1"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDownloadLyrics(t);
                                        }}
                                    >
                                      <FileText className="w-3 h-3" />
                                      <span>Lyrics</span>
                                    </button>
                                    <button
                                      className="h-6 px-3 rounded-xl bg-gray-500/20 text-gray-300 hover:bg-white/20 hover:text-white transition-colors duration-200 text-xs flex-1 flex items-center justify-center gap-1"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDownloadArt(t);
                                        }}
                                    >
                                      <ImageIcon className="w-3 h-3" />
                                      <span>Art</span>
                                    </button>
                                 </div>
                                  <button
                                    className="h-6 px-4 rounded-xl bg-gray-500/20 text-gray-300 hover:bg-white/20 hover:text-white transition-colors duration-200 text-xs w-full flex items-center justify-center gap-1"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDownloadAll(t);
                                      }}
                                  >
                                    <Package className="w-3 h-3" />
                                    <span>Download All</span>
                                  </button>
                               </>
                             ) : (
                               <>
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
                               </>
                             )}
                           </div>
                       </div>
                     )}

                      {/* Add Overlay */}
                       {openAddOverlayTrackId === t.id && (
                         <div 
                           className="absolute inset-0 backdrop-blur-sm rounded-xl border border-white/[0.06] z-20"
                           style={{ backgroundColor: '#151515CC' }}
                           onClick={() => {
                             setOpenAddOverlayTrackId(null);
                             setClickedPlaylists(new Set());
                           }}
                         >
                           <div 
                             className="h-full flex flex-col"
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
                                   const filteredPlaylists = playlistSearchQuery.trim() === ""
                                     ? playlists
                                     : playlists.filter(playlist =>
                                         playlist.name.toLowerCase().includes(playlistSearchQuery.toLowerCase())
                                       );
                                   return `${filteredPlaylists.length} playlist${filteredPlaylists.length !== 1 ? 's' : ''} found`;
                                 })()}
                                </div>
                              </div>
                            )}

                            {/* Playlists List */}
                            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden lyrics-scrollbar px-3 pb-3" onClick={(e) => e.stopPropagation()}>
                              <div className="space-y-2">
                                {/* Filter playlists based on search */}
                                 {(() => {
                                   const filteredPlaylists = playlistSearchQuery.trim() === ""
                                     ? playlists
                                     : playlists.filter(playlist =>
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
                                      <div 
                                        className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (onPlaylistClick) {
                                            onPlaylistClick(playlist);
                                            setOpenAddOverlayTrackId(null); // Close the add overlay
                                          }
                                        }}
                                      >
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
                                         // Toggle playlist in clicked set
                                         setClickedPlaylists(prev => {
                                           const newSet = new Set(prev);
                                           if (newSet.has(playlist.id)) {
                                             newSet.delete(playlist.id);
                                           } else {
                                             newSet.add(playlist.id);
                                           }
                                           return newSet;
                                          });
                                            
                                            // Create operation key to prevent race conditions
                                            const operationKey = `${playlist.id}-${t.id}`;
                                            console.log('🔍 Starting playlist operation:', { playlistId: playlist.id, trackId: t.id, operationKey });
                                            
                                            // Prevent rapid clicks by checking if operation is already pending
                                            if (playlistOperationsPending.has(operationKey)) {
                                              console.log('⏳ Operation already pending for', operationKey);
                                              return;
                                            }
                                            
                                            // Mark operation as pending
                                            setPlaylistOperationsPending(prev => {
                                              const newSet = new Set(prev).add(operationKey);
                                              console.log('📝 Marked operation as pending:', operationKey, 'Total pending:', newSet.size);
                                              return newSet;
                                            });
                                            
                                            try {
                                              // Add/remove song to/from playlist with proper state checking
                                              const isCurrentlyInPlaylist = isTrackInPlaylist(playlist.id, t.id);
                                              console.log(`🎵 Track ${t.id} in playlist ${playlist.id}:`, isCurrentlyInPlaylist);
                                              console.log('🎯 Available playlist functions:', { 
                                                addTrackToPlaylist: typeof addTrackToPlaylist, 
                                                removeTrackFromPlaylist: typeof removeTrackFromPlaylist,
                                                playlistsLength: playlists.length 
                                              });
                                              
                                              if (isCurrentlyInPlaylist) {
                                                console.log('🗑️ Attempting to remove track from playlist...');
                                                removeTrackFromPlaylist(playlist.id, t.id);
                                                console.log('✅ Successfully removed track from playlist');
                                              } else {
                                                console.log('➕ Attempting to add track to playlist...');
                                                addTrackToPlaylist(playlist.id, t);
                                                console.log('✅ Successfully added track to playlist');
                                              }
                                            } catch (error) {
                                              console.error('❌ Error in playlist operation:', error);
                                              console.error('❌ Error details:', {
                                                message: error.message,
                                                stack: error.stack,
                                                playlistId: playlist.id,
                                                trackId: t.id
                                              });
                                              toast({
                                                variant: "destructive",
                                                description: `Failed to update playlist: ${error.message || 'Unknown error'}`
                                              });
                                            } finally {
                                              // Clear pending operation after a short delay to prevent immediate re-clicks
                                              setTimeout(() => {
                                                setPlaylistOperationsPending(prev => {
                                                  const newSet = new Set(prev);
                                                  newSet.delete(operationKey);
                                                  return newSet;
                                                });
                                              }, 300);
                                            }
                                         }}
                                      >
                                         <div className="relative w-4 h-4">
                                            {(() => {
                                              const operationKey = `${playlist.id}-${t.id}`;
                                              const isPending = playlistOperationsPending.has(operationKey);
                                              const isInPlaylist = isTrackInPlaylist(playlist.id, t.id);
                                              
                                              if (isPending) {
                                                return <div className="w-4 h-4 border-2 border-white/30 border-t-white/60 rounded-full animate-spin" />;
                                              }
                                              
                                              return isInPlaylist ? (
                                                <Check className="w-4 h-4 text-green-400 animate-scale-in" />
                                              ) : (
                                                <Plus className="w-4 h-4 animate-scale-in" />
                                              );
                                            })()}
                                          </div>
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
                      // Audio element created
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
      <QuickAlbumCoverGenerator
        isOpen={showQuickAlbumGenerator}
        onClose={() => setShowQuickAlbumGenerator(false)}
        track={selectedTrackForRegen}
      />
    </aside>
  );
}