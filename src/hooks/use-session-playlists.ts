import { useState, useEffect, useCallback, useRef } from "react";
import { TrackItem } from "@/types";

export interface SessionPlaylist {
  id: string;
  name: string;
  songCount: number;
  isFavorited?: boolean;
  createdAt: number;
  songs: TrackItem[];
}

const STORAGE_KEY = "session_playlists";
const FAVOURITES_ID = "favourites";
const PLAYLIST_UPDATE_EVENT = "playlist-update";

// Generate unique instance ID for debugging
const generateInstanceId = () => Math.random().toString(36).substr(2, 9);

export function useSessionPlaylists() {
  const [playlists, setPlaylists] = useState<SessionPlaylist[]>([]);
  const instanceId = useRef(generateInstanceId());
  const isUpdatingRef = useRef(false);

  // Load playlists from sessionStorage on mount
  useEffect(() => {
    console.log(`🔧 [${instanceId.current}] Loading playlists from sessionStorage on mount`);
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsedPlaylists = JSON.parse(stored);
        console.log(`📂 [${instanceId.current}] Loaded ${parsedPlaylists.length} playlists from storage`);
        setPlaylists(parsedPlaylists);
      } catch (error) {
        console.error("Error parsing stored playlists:", error);
        initializeFavourites();
      }
    } else {
      console.log(`📂 [${instanceId.current}] No playlists in storage, initializing favourites`);
      initializeFavourites();
    }
  }, []);

  // Listen for playlist updates from other hook instances
  useEffect(() => {
    const handlePlaylistUpdate = (event: CustomEvent) => {
      if (isUpdatingRef.current) {
        console.log(`🔄 [${instanceId.current}] Ignoring playlist update (currently updating)`);
        return;
      }
      
      console.log(`🔄 [${instanceId.current}] Received playlist update event, refreshing from storage`);
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored) {
        try {
          const parsedPlaylists = JSON.parse(stored);
          console.log(`📂 [${instanceId.current}] Synced ${parsedPlaylists.length} playlists from storage`);
          setPlaylists(parsedPlaylists);
        } catch (error) {
          console.error(`❌ [${instanceId.current}] Error parsing synced playlists:`, error);
        }
      }
    };

    // Listen for custom playlist update events
    window.addEventListener(PLAYLIST_UPDATE_EVENT, handlePlaylistUpdate as EventListener);
    
    // Listen for storage events (for cross-tab sync)
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY && event.newValue && !isUpdatingRef.current) {
        console.log(`🔄 [${instanceId.current}] Storage changed externally, syncing`);
        try {
          const parsedPlaylists = JSON.parse(event.newValue);
          setPlaylists(parsedPlaylists);
        } catch (error) {
          console.error(`❌ [${instanceId.current}] Error parsing storage change:`, error);
        }
      }
    };
    
    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener(PLAYLIST_UPDATE_EVENT, handlePlaylistUpdate as EventListener);
      window.removeEventListener('storage', handleStorageChange);
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
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify([favourites]));
  }, []);

  // Save playlists to sessionStorage and notify other instances
  const savePlaylists = useCallback((newPlaylists: SessionPlaylist[]) => {
    isUpdatingRef.current = true;
    console.log(`💾 [${instanceId.current}] Saving playlists to sessionStorage:`, newPlaylists.map(p => ({ id: p.id, name: p.name, songCount: p.songCount })));
    setPlaylists(newPlaylists);
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(newPlaylists));
    
    // Notify other hook instances immediately for better synchronization
    console.log(`📢 [${instanceId.current}] Broadcasting playlist update event`);
    window.dispatchEvent(new CustomEvent(PLAYLIST_UPDATE_EVENT, { detail: { instanceId: instanceId.current } }));
    isUpdatingRef.current = false;
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

  // Add track to playlist
  const addTrackToPlaylist = useCallback((playlistId: string, track: TrackItem) => {
    console.log('🎵 addTrackToPlaylist called:', { playlistId, trackTitle: track.title, trackId: track.id });
    try {
      const updatedPlaylists = playlists.map(playlist => {
        if (playlist.id === playlistId) {
          // Check if track already exists
          if (playlist.songs.some(song => song.id === track.id)) {
            console.log('⚠️ Track already exists in playlist:', playlist.name);
            return playlist;
          }
          
          const updatedSongs = [...playlist.songs, track];
          console.log('✅ Adding track to playlist:', playlist.name, 'New count:', updatedSongs.length);
          return {
            ...playlist,
            songs: updatedSongs,
            songCount: updatedSongs.length
          };
        }
        return playlist;
      });
      
      savePlaylists(updatedPlaylists);
      console.log('💾 Playlists saved to sessionStorage');
    } catch (error) {
      console.error('❌ [addTrackToPlaylist] Error:', error);
      throw error;
    }
  }, [playlists, savePlaylists]);

  // Remove track from playlist
  const removeTrackFromPlaylist = useCallback((playlistId: string, trackId: string) => {
    console.log('🗑️ removeTrackFromPlaylist called:', { playlistId, trackId });
    try {
      const updatedPlaylists = playlists.map(playlist => {
        if (playlist.id === playlistId) {
          const updatedSongs = playlist.songs.filter(song => song.id !== trackId);
          console.log('✅ Removing track from playlist:', playlist.name, 'New count:', updatedSongs.length);
          return {
            ...playlist,
            songs: updatedSongs,
            songCount: updatedSongs.length
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

  // Check if track is in specific playlist
  const isTrackInPlaylist = useCallback((playlistId: string, trackId: string) => {
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

  // Debug helper - logs current sessionStorage state
  const debugSessionStorage = useCallback(() => {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    console.log('🔍 Current sessionStorage state:', stored ? JSON.parse(stored) : 'null');
    console.log('🔍 Current playlists state:', playlists);
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
    debugSessionStorage
  };
}