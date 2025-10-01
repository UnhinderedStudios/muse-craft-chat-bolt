import { useState, useEffect, useCallback, useRef } from "react";
import { TrackItem } from "@/types";
import { toast } from "sonner";

// Lightweight track snapshot for storage
export interface TrackSnapshot {
  id: string;
  title?: string;
  url: string;
  coverUrl?: string;
  createdAt: number;
  audioId?: string;
  jobId?: string;
}

export interface SessionPlaylist {
  id: string;
  name: string;
  songCount: number;
  isFavorited?: boolean;
  createdAt: number;
  songs: TrackSnapshot[];
}

const STORAGE_KEY = "session_playlists";
const FAVOURITES_ID = "favourites";
const PLAYLIST_UPDATE_EVENT = "playlist-update";

// Generate unique instance ID for debugging
const generateInstanceId = () => Math.random().toString(36).substr(2, 9);

// Convert TrackItem to lightweight snapshot
const trackToSnapshot = (track: TrackItem): TrackSnapshot => ({
  id: track.id,
  title: track.title,
  url: track.url,
  coverUrl: track.coverUrl,
  createdAt: track.createdAt,
  audioId: track.audioId,
  jobId: track.jobId
});

// Convert TrackSnapshot back to TrackItem with default values
const snapshotToTrack = (snapshot: TrackSnapshot): TrackItem => ({
  id: snapshot.id,
  title: snapshot.title,
  url: snapshot.url,
  coverUrl: snapshot.coverUrl,
  createdAt: snapshot.createdAt,
  audioId: snapshot.audioId,
  jobId: snapshot.jobId,
  params: [], // Default empty array
  hasTimestamps: false, // Default false
  hasBeenPlayed: false, // Default false
});

// Safe storage operation with error handling
const safeStorageSet = (key: string, data: any): boolean => {
  try {
    const jsonString = JSON.stringify(data);
    sessionStorage.setItem(key, jsonString);
    return true;
  } catch (error) {
    console.error('Storage quota exceeded, attempting cleanup:', error);

    // Try to free up space by removing old entries
    try {
      const stored = sessionStorage.getItem(key);
      if (stored) {
        const parsedData = JSON.parse(stored);
        if (Array.isArray(parsedData)) {
          // Keep only the first 10 playlists and limit songs per playlist to 50
          const trimmedData = parsedData.slice(0, 10).map(playlist => ({
            ...playlist,
            songs: playlist.songs?.slice(0, 50) || []
          }));
          sessionStorage.setItem(key, JSON.stringify(trimmedData));

          toast.warning("Playlist storage trimmed", {
            description: "Some older playlists were removed due to storage limits.",
            duration: 4000,
          });

          return true;
        }
      }
    } catch (retryError) {
      console.error('Failed to save even after cleanup:', retryError);
      // Fallback to localStorage
      try {
        localStorage.setItem(key, JSON.stringify(data));
        console.log('Saved to localStorage as fallback');
        return true;
      } catch (fallbackError) {
        console.error('All storage methods failed:', fallbackError);

        toast.error("Cannot save playlist", {
          description: "Browser storage is full. Try clearing old data or downloading important tracks.",
          duration: 5000,
        });

        return false;
      }
    }
    return false;
  }
};

export function useSessionPlaylists() {
  const [playlists, setPlaylists] = useState<SessionPlaylist[]>([]);
  const instanceId = useRef(generateInstanceId());
  const pendingOperations = useRef(new Set<string>());

  // Load playlists from sessionStorage on mount
  useEffect(() => {
    console.log(`🔧 [${instanceId.current}] Loading playlists from sessionStorage on mount`);
    let stored = sessionStorage.getItem(STORAGE_KEY);
    
    // Fallback to localStorage if sessionStorage is empty
    if (!stored) {
      stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        console.log(`📂 [${instanceId.current}] Found data in localStorage, migrating to sessionStorage`);
        safeStorageSet(STORAGE_KEY, JSON.parse(stored));
        localStorage.removeItem(STORAGE_KEY);
      }
    }
    
    if (stored) {
      try {
        const parsedPlaylists = JSON.parse(stored);
        console.log(`📂 [${instanceId.current}] Loaded ${parsedPlaylists.length} playlists from storage`);
        
        // Migrate legacy data if needed (check if songs contain full TrackItems)
        const migratedPlaylists = parsedPlaylists.map(playlist => {
          if (playlist.songs && playlist.songs.length > 0) {
            const firstSong = playlist.songs[0];
            // Check if this is a legacy full TrackItem (has params or words fields)
            if (firstSong.params || firstSong.words || firstSong.hasTimestamps !== undefined) {
              console.log(`🔄 [${instanceId.current}] Migrating legacy playlist: ${playlist.name}`);
              return {
                ...playlist,
                songs: playlist.songs.map(trackToSnapshot)
              };
            }
          }
          return playlist;
        });
        
        setPlaylists(migratedPlaylists);
        
        // Save migrated data if changes were made
        if (JSON.stringify(migratedPlaylists) !== stored) {
          safeStorageSet(STORAGE_KEY, migratedPlaylists);
        }
      } catch (error) {
        console.error("Error parsing stored playlists:", error);
        initializeFavourites();
      }
    } else {
      console.log(`📂 [${instanceId.current}] No playlists in storage, initializing favourites`);
      initializeFavourites();
    }
  }, []);

  // Storage sync for cross-tab functionality and same-tab real-time updates
  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY && event.newValue) {
        console.log(`🔄 [${instanceId.current}] Storage changed externally, syncing`);
        try {
          const parsedPlaylists = JSON.parse(event.newValue);
          setPlaylists(parsedPlaylists);
        } catch (error) {
          console.error(`❌ [${instanceId.current}] Error parsing storage change:`, error);
        }
      }
    };
    
    const handlePlaylistUpdate = (event: CustomEvent) => {
      console.log(`🔄 [${instanceId.current}] Playlist update event received`);
      setPlaylists(event.detail);
    };
    
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener(PLAYLIST_UPDATE_EVENT, handlePlaylistUpdate as EventListener);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener(PLAYLIST_UPDATE_EVENT, handlePlaylistUpdate as EventListener);
    };
  }, []);

  // Initialize with Favourites playlist
  const initializeFavourites = useCallback(() => {
    const favourites: SessionPlaylist = {
      id: FAVOURITES_ID,
      name: "Favourites",
      songCount: 0,
      isFavorited: false,
      createdAt: Date.now(),
      songs: []
    };
    setPlaylists([favourites]);
    safeStorageSet(STORAGE_KEY, [favourites]);
  }, []);

  // Save playlists to sessionStorage with immediate state update
  const savePlaylists = useCallback((newPlaylists: SessionPlaylist[]) => {
    // Ensure songCount always matches actual songs array length
    const normalizedPlaylists = newPlaylists.map(playlist => ({
      ...playlist,
      songCount: playlist.songs?.length || 0
    }));
    
    console.log(`💾 [${instanceId.current}] Saving playlists:`, normalizedPlaylists.map(p => ({ id: p.id, name: p.name, songCount: p.songCount, actualSongs: p.songs?.length })));
    
    // Update state immediately for responsive UI
    setPlaylists(normalizedPlaylists);
    
    // Save to storage
    const saveSuccess = safeStorageSet(STORAGE_KEY, normalizedPlaylists);
    
    // Dispatch event for same-tab sync
    window.dispatchEvent(new CustomEvent(PLAYLIST_UPDATE_EVENT, { 
      detail: normalizedPlaylists 
    }));
    
    if (!saveSuccess) {
      console.warn('Failed to save playlists to storage - continuing with in-memory state');
    }
  }, []);

  // Create a new playlist
  const createPlaylist = useCallback((name: string) => {
    const newPlaylist: SessionPlaylist = {
      id: `playlist_${Date.now()}`,
      name: name.trim(),
      songCount: 0,
      createdAt: Date.now(),
      songs: []
    };
    
    const updatedPlaylists = [...playlists, newPlaylist];
    savePlaylists(updatedPlaylists);
    return newPlaylist;
  }, [playlists, savePlaylists]);

  // Add track to playlist with operation tracking
  const addTrackToPlaylist = useCallback((playlistId: string, track: TrackItem) => {
    const operationKey = `${playlistId}-${track.id}`;
    
    // Prevent duplicate operations
    if (pendingOperations.current.has(operationKey)) {
      console.log('⚠️ Operation already pending:', operationKey);
      return;
    }
    
    console.log('🎵 addTrackToPlaylist called:', { playlistId, trackTitle: track.title, trackId: track.id });
    pendingOperations.current.add(operationKey);
    
    try {
      const trackSnapshot = trackToSnapshot(track);
      const updatedPlaylists = playlists.map(playlist => {
        if (playlist.id === playlistId) {
          // Check if track already exists
          if (playlist.songs.some(song => song.id === track.id)) {
            console.log('⚠️ Track already exists in playlist:', playlist.name);
            return playlist;
          }
          
          const updatedSongs = [...playlist.songs, trackSnapshot];
          console.log('✅ Adding track to playlist:', playlist.name, 'New count:', updatedSongs.length);
          return {
            ...playlist,
            songs: updatedSongs
            // songCount will be calculated in savePlaylists
          };
        }
        return playlist;
      });
      
      // Use setTimeout to ensure state is updated atomically
      setTimeout(() => {
        savePlaylists(updatedPlaylists);
        pendingOperations.current.delete(operationKey);
        console.log('💾 Track added successfully');
      }, 0);
      
    } catch (error) {
      pendingOperations.current.delete(operationKey);
      console.error('❌ [addTrackToPlaylist] Error:', error);
      throw new Error('Failed to update playlist');
    }
  }, [playlists, savePlaylists]);

  // Remove track from playlist
  const removeTrackFromPlaylist = useCallback((playlistId: string, trackId: string) => {
    console.log('🗑️ removeTrackFromPlaylist called:', { playlistId, trackId });
    try {
      const updatedPlaylists = playlists.map(playlist => {
        if (playlist.id === playlistId) {
          const updatedSongs = playlist.songs.filter(song => song.id !== trackId);
          console.log('✅ Removing track from playlist:', playlist.name, 'Songs before:', playlist.songs.length, 'Songs after:', updatedSongs.length);
          return {
            ...playlist,
            songs: updatedSongs
            // songCount will be calculated in savePlaylists
          };
        }
        return playlist;
      });
      
      savePlaylists(updatedPlaylists);
      console.log('💾 Playlists saved to sessionStorage');
    } catch (error) {
      console.error('❌ [removeTrackFromPlaylist] Error:', error);
      throw error;
    }
  }, [playlists, savePlaylists]);

  // Add/remove track from favourites
  const toggleFavourite = useCallback((track: TrackItem) => {
    console.log('❤️ toggleFavourite called for track:', track.title, track.id);
    const favouritesPlaylist = playlists.find(p => p.id === FAVOURITES_ID);
    if (!favouritesPlaylist) {
      console.log('❌ Favourites playlist not found!');
      return;
    }

    const isInFavourites = favouritesPlaylist.songs.some(song => song.id === track.id);
    console.log('❤️ Track is currently in favourites:', isInFavourites);
    
    if (isInFavourites) {
      console.log('💔 Removing from favourites');
      removeTrackFromPlaylist(FAVOURITES_ID, track.id);
    } else {
      console.log('💖 Adding to favourites');
      addTrackToPlaylist(FAVOURITES_ID, track);
    }
  }, [playlists, addTrackToPlaylist, removeTrackFromPlaylist]);

  // Check if track is in favourites
  const isTrackInFavourites = useCallback((trackId: string) => {
    const favouritesPlaylist = playlists.find(p => p.id === FAVOURITES_ID);
    return favouritesPlaylist?.songs.some(song => song.id === trackId) || false;
  }, [playlists]);

  // Check if track is in specific playlist with pending operation check
  const isTrackInPlaylist = useCallback((playlistId: string, trackId: string) => {
    const operationKey = `${playlistId}-${trackId}`;
    
    // If operation is pending, assume track will be added
    if (pendingOperations.current.has(operationKey)) {
      return true;
    }
    
    const playlist = playlists.find(p => p.id === playlistId);
    return playlist?.songs.some(song => song.id === trackId) || false;
  }, [playlists]);

  // Rename playlist
  const renamePlaylist = useCallback((playlistId: string, newName: string) => {
    const updatedPlaylists = playlists.map(playlist => 
      playlist.id === playlistId 
        ? { ...playlist, name: newName.trim() }
        : playlist
    );
    savePlaylists(updatedPlaylists);
  }, [playlists, savePlaylists]);

  // Delete playlist (except Favourites)
  const deletePlaylist = useCallback((playlistId: string) => {
    if (playlistId === FAVOURITES_ID) return;
    
    const updatedPlaylists = playlists.filter(playlist => playlist.id !== playlistId);
    savePlaylists(updatedPlaylists);
  }, [playlists, savePlaylists]);

  // Toggle playlist favourite status
  const togglePlaylistFavourite = useCallback((playlistId: string) => {
    const updatedPlaylists = playlists.map(playlist => 
      playlist.id === playlistId 
        ? { ...playlist, isFavorited: !playlist.isFavorited }
        : playlist
    );
    savePlaylists(updatedPlaylists);
  }, [playlists, savePlaylists]);

  // Debug helper - logs current sessionStorage state (development only)
  const debugSessionStorage = useCallback(() => {
    if (process.env.NODE_ENV === 'development') {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      console.log('🔍 Current sessionStorage state:', stored ? JSON.parse(stored) : 'null');
      console.log('🔍 Current playlists state:', playlists);
    }
  }, [playlists]);

  return {
    playlists,
    createPlaylist,
    addTrackToPlaylist,
    removeTrackFromPlaylist,
    toggleFavourite,
    isTrackInFavourites,
    isTrackInPlaylist,
    renamePlaylist,
    deletePlaylist,
    togglePlaylistFavourite,
    debugSessionStorage,
    snapshotToTrack
  };
}