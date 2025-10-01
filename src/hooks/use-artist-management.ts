import { useState, useEffect } from "react";

export interface ArtistData {
  id: string;
  name: string;
  imageUrl?: string;
  songCount: number;
  createdAt: number;
  isFavorited?: boolean;
  tracks: any[]; // TrackItem[] - isolated tracks per artist
  chatMessages: any[]; // ChatMessage[] - isolated chat per artist
  activeGenerations: any[]; // Active generation jobs for this artist
}

const STORAGE_KEY = "artist_management_data";
const STORAGE_EVENT = "artist_update_event";

// Safe storage setter with fallback
const safeStorageSet = (key: string, value: any) => {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn("Session storage full, falling back to localStorage", e);
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (localError) {
      console.error("Both storage options failed", localError);
    }
  }
};

export const useArtistManagement = () => {
  const [artists, setArtists] = useState<ArtistData[]>([]);
  const [selectedArtistId, setSelectedArtistId] = useState<string | null>(null);

  // Load artists from storage on mount
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY) || localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setArtists(Array.isArray(parsed) ? parsed : []);
      }
    } catch (e) {
      console.error("Failed to load artists", e);
    }
  }, []);

  // Save to storage whenever artists change
  useEffect(() => {
    if (artists.length >= 0) {
      safeStorageSet(STORAGE_KEY, artists);
      // Dispatch custom event for cross-component sync
      window.dispatchEvent(new CustomEvent(STORAGE_EVENT, { detail: artists }));
    }
  }, [artists]);

  // Listen for storage events (cross-tab sync)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          setArtists(Array.isArray(parsed) ? parsed : []);
        } catch (error) {
          console.error("Failed to parse storage event", error);
        }
      }
    };

    const handleCustomEvent = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail && Array.isArray(customEvent.detail)) {
        setArtists(customEvent.detail);
      }
    };

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener(STORAGE_EVENT, handleCustomEvent);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener(STORAGE_EVENT, handleCustomEvent);
    };
  }, []);

  const createArtist = (name: string, imageUrl?: string) => {
    const newArtist: ArtistData = {
      id: `artist_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name,
      imageUrl,
      songCount: 0,
      createdAt: Date.now(),
      isFavorited: false,
      tracks: [],
      chatMessages: [
        { role: "assistant", content: "Hey! I can help write and generate a song. What vibe are you going for?" },
      ],
      activeGenerations: [],
    };
    setArtists((prev) => [newArtist, ...prev]);
    // Auto-select the newly created artist
    setSelectedArtistId(newArtist.id);
    return newArtist;
  };

  const renameArtist = (artistId: string, newName: string) => {
    setArtists((prev) =>
      prev.map((artist) =>
        artist.id === artistId ? { ...artist, name: newName } : artist
      )
    );
  };

  const deleteArtist = (artistId: string) => {
    setArtists((prev) => prev.filter((artist) => artist.id !== artistId));
  };

  const toggleArtistFavourite = (artistId: string) => {
    setArtists((prev) =>
      prev.map((artist) =>
        artist.id === artistId
          ? { ...artist, isFavorited: !artist.isFavorited }
          : artist
      )
    );
  };

  const updateArtistImage = (artistId: string, imageUrl: string) => {
    setArtists((prev) =>
      prev.map((artist) =>
        artist.id === artistId ? { ...artist, imageUrl } : artist
      )
    );
  };

  const selectArtist = (artistId: string | null) => {
    setSelectedArtistId(artistId);
  };

  const selectedArtist = selectedArtistId 
    ? artists.find(a => a.id === selectedArtistId) 
    : null;

  const addTrackToArtist = (artistId: string, track: any) => {
    setArtists((prev) =>
      prev.map((artist) =>
        artist.id === artistId 
          ? { ...artist, tracks: [...artist.tracks, track], songCount: artist.songCount + 1 }
          : artist
      )
    );
  };

  const updateArtistChat = (artistId: string, messages: any[]) => {
    setArtists((prev) =>
      prev.map((artist) =>
        artist.id === artistId ? { ...artist, chatMessages: messages } : artist
      )
    );
  };

  return {
    artists,
    selectedArtistId,
    selectedArtist,
    createArtist,
    renameArtist,
    deleteArtist,
    toggleArtistFavourite,
    updateArtistImage,
    selectArtist,
    addTrackToArtist,
    updateArtistChat,
  };
};
