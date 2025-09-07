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
    const updatedPlaylists = playlists.map(playlist => {
      if (playlist.id === playlistId) {
        // Check if track already exists
        if (playlist.songs.some(song => song.id === track.id)) {
          return playlist;
        }
        
        const updatedSongs = [...playlist.songs, track];
        return {
          ...playlist,
          songs: updatedSongs,
          songCount: updatedSongs.length
        };
      }
      return playlist;
    });
    
    savePlaylists(updatedPlaylists);
  }, [playlists, savePlaylists]);

  // Remove track from playlist
  const removeTrackFromPlaylist = useCallback((playlistId: string, trackId: string) => {
    const updatedPlaylists = playlists.map(playlist => {
      if (playlist.id === playlistId) {
        const updatedSongs = playlist.songs.filter(song => song.id !== trackId);
        return {
          ...playlist,
          songs: updatedSongs,
          songCount: updatedSongs.length
        };
      }
      return playlist;
    });
    
    savePlaylists(updatedPlaylists);
  }, [playlists, savePlaylists]);

  // Add/remove track from favourites
  const toggleFavourite = useCallback((track: TrackItem) => {
    const favouritesPlaylist = playlists.find(p => p.id === FAVOURITES_ID);
    if (!favouritesPlaylist) return;

    const isInFavourites = favouritesPlaylist.songs.some(song => song.id === track.id);
    
    if (isInFavourites) {
      removeTrackFromPlaylist(FAVOURITES_ID, track.id);
    } else {
      addTrackToPlaylist(FAVOURITES_ID, track);
    }
  }, [playlists, addTrackToPlaylist, removeTrackFromPlaylist]);

  // Check if track is in favourites
  const isTrackInFavourites = useCallback((trackId: string) => {
    const favouritesPlaylist = playlists.find(p => p.id === FAVOURITES_ID);
    return favouritesPlaylist?.songs.some(song => song.id === trackId) || false;
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

  return {
    playlists,
    createPlaylist,
    addTrackToPlaylist,
    removeTrackFromPlaylist,
    toggleFavourite,
    isTrackInFavourites,
    renamePlaylist,
    deletePlaylist,
    togglePlaylistFavourite
  };
}