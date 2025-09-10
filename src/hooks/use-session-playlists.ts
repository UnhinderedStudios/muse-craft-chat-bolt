import { useState, useEffect, useCallback } from "react";
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

export function useSessionPlaylists() {
  const [playlists, setPlaylists] = useState<SessionPlaylist[]>([]);

  // Load playlists from sessionStorage on mount
  useEffect(() => {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsedPlaylists = JSON.parse(stored);
        setPlaylists(parsedPlaylists);
      } catch (error) {
        console.error("Error parsing stored playlists:", error);
        initializeFavourites();
      }
    } else {
      initializeFavourites();
    }
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

  // Save playlists to sessionStorage
  const savePlaylists = useCallback((newPlaylists: SessionPlaylist[]) => {
    console.log('💾 Saving playlists to sessionStorage:', newPlaylists.map(p => ({ id: p.id, name: p.name, songCount: p.songCount })));
    setPlaylists(newPlaylists);
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(newPlaylists));
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
  }, [playlists, savePlaylists]);

  // Remove track from playlist
  const removeTrackFromPlaylist = useCallback((playlistId: string, trackId: string) => {
    console.log('🗑️ removeTrackFromPlaylist called:', { playlistId, trackId });
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