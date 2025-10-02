import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ArtistData {
  id: string;
  name: string;
  imageUrl?: string;
  songCount: number;
  createdAt: number;
  isFavorited?: boolean;
  tracks: any[];
  chatMessages: any[];
  activeGenerations: any[];
  generatedImages?: string[];
  imagePrompts?: string[];
  facialReference?: string;
  clothingReference?: string;
  primaryClothingType?: string;
  selectedColor?: string;
  generationSettings?: {
    artistCount: number[];
    isRealistic: boolean;
  };
}

const SELECTED_KEY = "artist_selected_id";

export const useArtistManagement = () => {
  const [artists, setArtists] = useState<ArtistData[]>([]);
  const [selectedArtistId, setSelectedArtistId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadArtists = useCallback(async () => {
    try {
      const { data: artistsData, error: artistsError } = await supabase
        .from('artists')
        .select('*')
        .order('created_at', { ascending: false });

      if (artistsError) throw artistsError;

      if (artistsData) {
        const { data: generationStates, error: statesError } = await supabase
          .from('artist_generation_state')
          .select('*');

        if (statesError) throw statesError;

        const stateMap = new Map(
          generationStates?.map(state => [state.artist_id, state]) || []
        );

        const enrichedArtists: ArtistData[] = artistsData.map(artist => {
          const state = stateMap.get(artist.id);
          return {
            id: artist.id,
            name: artist.name,
            imageUrl: artist.image_url || undefined,
            songCount: artist.song_count,
            createdAt: new Date(artist.created_at).getTime(),
            isFavorited: artist.is_favorited,
            tracks: [],
            chatMessages: [
              { role: "assistant", content: "Hey! I can help write and generate a song. What vibe are you going for?" },
            ],
            activeGenerations: [],
            generatedImages: state?.generated_images as string[] || undefined,
            imagePrompts: state?.image_prompts as string[] || undefined,
            facialReference: state?.facial_reference || undefined,
            clothingReference: state?.clothing_reference || undefined,
            primaryClothingType: state?.primary_clothing_type || undefined,
            selectedColor: state?.selected_color || undefined,
            generationSettings: state ? {
              artistCount: [state.artist_count],
              isRealistic: state.is_realistic,
            } : undefined,
          };
        });

        setArtists(enrichedArtists);
      }
    } catch (error) {
      console.error('Failed to load artists:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadArtists();

    const selectedRaw = localStorage.getItem(SELECTED_KEY);
    if (selectedRaw) {
      try {
        const parsedSelected = JSON.parse(selectedRaw);
        setSelectedArtistId(parsedSelected ?? null);
      } catch (err) {
        console.warn("Failed to parse selected artist id", err);
      }
    }

    const channel = supabase
      .channel('artists_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'artists' }, () => {
        loadArtists();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'artist_generation_state' }, () => {
        loadArtists();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadArtists]);

  const createArtist = async (name: string, imageUrl?: string) => {
    try {
      const { data, error } = await supabase
        .from('artists')
        .insert({
          name,
          image_url: imageUrl,
          song_count: 0,
          is_favorited: false,
        })
        .select()
        .single();

      if (error) throw error;

      await supabase
        .from('artist_generation_state')
        .insert({
          artist_id: data.id,
          generated_images: [],
          image_prompts: [],
          artist_count: 1,
          is_realistic: true,
        });

      const newArtist: ArtistData = {
        id: data.id,
        name: data.name,
        imageUrl: data.image_url || undefined,
        songCount: data.song_count,
        createdAt: new Date(data.created_at).getTime(),
        isFavorited: data.is_favorited,
        tracks: [],
        chatMessages: [
          { role: "assistant", content: "Hey! I can help write and generate a song. What vibe are you going for?" },
        ],
        activeGenerations: [],
      };

      setArtists((prev) => [newArtist, ...prev]);
      selectArtist(data.id);
      return newArtist;
    } catch (error) {
      console.error('Failed to create artist:', error);
      throw error;
    }
  };

  const renameArtist = async (artistId: string, newName: string) => {
    try {
      const { error } = await supabase
        .from('artists')
        .update({ name: newName })
        .eq('id', artistId);

      if (error) throw error;

      setArtists((prev) =>
        prev.map((artist) =>
          artist.id === artistId ? { ...artist, name: newName } : artist
        )
      );
    } catch (error) {
      console.error('Failed to rename artist:', error);
      throw error;
    }
  };

  const deleteArtist = async (artistId: string) => {
    try {
      const { error } = await supabase
        .from('artists')
        .delete()
        .eq('id', artistId);

      if (error) throw error;

      setArtists((prev) => prev.filter((artist) => artist.id !== artistId));

      if (selectedArtistId === artistId) {
        setSelectedArtistId(null);
        localStorage.removeItem(SELECTED_KEY);
      }
    } catch (error) {
      console.error('Failed to delete artist:', error);
      throw error;
    }
  };

  const toggleArtistFavourite = async (artistId: string) => {
    try {
      const artist = artists.find(a => a.id === artistId);
      if (!artist) return;

      const { error } = await supabase
        .from('artists')
        .update({ is_favorited: !artist.isFavorited })
        .eq('id', artistId);

      if (error) throw error;

      setArtists((prev) =>
        prev.map((artist) =>
          artist.id === artistId
            ? { ...artist, isFavorited: !artist.isFavorited }
            : artist
        )
      );
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
      throw error;
    }
  };

  const updateArtistImage = async (artistId: string, imageUrl: string) => {
    try {
      const { error } = await supabase
        .from('artists')
        .update({ image_url: imageUrl })
        .eq('id', artistId);

      if (error) throw error;

      setArtists((prev) =>
        prev.map((artist) =>
          artist.id === artistId ? { ...artist, imageUrl } : artist
        )
      );
    } catch (error) {
      console.error('Failed to update artist image:', error);
      throw error;
    }
  };

  const selectArtist = (artistId: string | null) => {
    setSelectedArtistId(artistId);
    try {
      localStorage.setItem(SELECTED_KEY, JSON.stringify(artistId));
    } catch (e) {
      console.warn("Failed to persist selected artist id", e);
    }
  };

  const selectedArtist = selectedArtistId
    ? artists.find(a => a.id === selectedArtistId)
    : null;

  const addTrackToArtist = async (artistId: string, track: any) => {
    try {
      const artist = artists.find(a => a.id === artistId);
      if (!artist) return;

      const { error } = await supabase
        .from('artists')
        .update({ song_count: artist.songCount + 1 })
        .eq('id', artistId);

      if (error) throw error;

      setArtists((prev) =>
        prev.map((artist) =>
          artist.id === artistId
            ? { ...artist, tracks: [...artist.tracks, track], songCount: artist.songCount + 1 }
            : artist
        )
      );
    } catch (error) {
      console.error('Failed to add track to artist:', error);
      throw error;
    }
  };

  const updateArtistChat = (artistId: string, messages: any[]) => {
    setArtists((prev) =>
      prev.map((artist) =>
        artist.id === artistId ? { ...artist, chatMessages: messages } : artist
      )
    );
  };

  const updateArtistGenerationState = async (
    artistId: string,
    generationState: Partial<Pick<ArtistData, 'generatedImages' | 'imagePrompts' | 'facialReference' | 'clothingReference' | 'primaryClothingType' | 'selectedColor' | 'generationSettings'>>
  ) => {
    try {
      const updateData: any = {};

      if (generationState.generatedImages !== undefined) {
        updateData.generated_images = generationState.generatedImages;
      }
      if (generationState.imagePrompts !== undefined) {
        updateData.image_prompts = generationState.imagePrompts;
      }
      if (generationState.facialReference !== undefined) {
        updateData.facial_reference = generationState.facialReference;
      }
      if (generationState.clothingReference !== undefined) {
        updateData.clothing_reference = generationState.clothingReference;
      }
      if (generationState.primaryClothingType !== undefined) {
        updateData.primary_clothing_type = generationState.primaryClothingType;
      }
      if (generationState.selectedColor !== undefined) {
        updateData.selected_color = generationState.selectedColor;
      }
      if (generationState.generationSettings !== undefined) {
        updateData.artist_count = generationState.generationSettings.artistCount[0];
        updateData.is_realistic = generationState.generationSettings.isRealistic;
      }

      const { error } = await supabase
        .from('artist_generation_state')
        .upsert({
          artist_id: artistId,
          ...updateData,
        }, {
          onConflict: 'artist_id'
        });

      if (error) throw error;

      setArtists((prev) =>
        prev.map((artist) =>
          artist.id === artistId ? { ...artist, ...generationState } : artist
        )
      );
    } catch (error) {
      console.error('Failed to update artist generation state:', error);
      throw error;
    }
  };

  return {
    artists,
    selectedArtistId,
    selectedArtist,
    loading,
    createArtist,
    renameArtist,
    deleteArtist,
    toggleArtistFavourite,
    updateArtistImage,
    selectArtist,
    addTrackToArtist,
    updateArtistChat,
    updateArtistGenerationState,
  };
};
