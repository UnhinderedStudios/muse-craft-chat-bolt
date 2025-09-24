import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AlbumCover } from '@/types';

interface SupabaseAlbumCover {
  id: string;
  track_id: string;
  image_url: string;
  image_type: string;
  prompt_used: string | null;
  is_selected: boolean;
  created_at: string;
  updated_at: string;
  metadata: any;
}

export function useAlbumCovers() {
  const [loading, setLoading] = useState(false);

  // Fetch album covers by track ID
  const fetchAlbumCovers = useCallback(async (trackId: string): Promise<AlbumCover[]> => {
    try {
      const { data, error } = await supabase
        .from('album_covers')
        .select('*')
        .eq('track_id', trackId)
        .eq('image_type', 'album_cover')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data as SupabaseAlbumCover[] || []).map(cover => ({
        ...cover,
        image_type: cover.image_type as 'album_cover' | 'artist_image'
      }));
    } catch (error) {
      console.error('Error fetching album covers:', error);
      return [];
    }
  }, []);

  // Fetch album covers by IDs
  const fetchAlbumCoversByIds = useCallback(async (coverIds: string[]): Promise<AlbumCover[]> => {
    if (!coverIds.length) return [];
    
    try {
      const { data, error } = await supabase
        .from('album_covers')
        .select('*')
        .in('id', coverIds)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data as SupabaseAlbumCover[] || []).map(cover => ({
        ...cover,
        image_type: cover.image_type as 'album_cover' | 'artist_image'
      }));
    } catch (error) {
      console.error('Error fetching album covers by IDs:', error);
      return [];
    }
  }, []);

  // Update selected cover for a track
  const updateSelectedCover = useCallback(async (trackId: string, newCoverId: string): Promise<void> => {
    try {
      setLoading(true);

      // First, unselect all covers for this track
      await supabase
        .from('album_covers')
        .update({ is_selected: false })
        .eq('track_id', trackId)
        .eq('image_type', 'album_cover');

      // Then select the new cover
      const { error } = await supabase
        .from('album_covers')
        .update({ is_selected: true })
        .eq('id', newCoverId);

      if (error) throw error;
    } catch (error) {
      console.error('Error updating selected cover:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  // Get the current selected cover for a track
  const getSelectedCover = useCallback(async (trackId: string): Promise<AlbumCover | null> => {
    try {
      const { data, error } = await supabase
        .from('album_covers')
        .select('*')
        .eq('track_id', trackId)
        .eq('image_type', 'album_cover')
        .eq('is_selected', true)
        .single();

      if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows returned
      return data ? {
        ...data as SupabaseAlbumCover,
        image_type: data.image_type as 'album_cover' | 'artist_image'
      } : null;
    } catch (error) {
      console.error('Error getting selected cover:', error);
      return null;
    }
  }, []);

  // Delete album cover
  const deleteCover = useCallback(async (coverId: string): Promise<void> => {
    try {
      setLoading(true);

      // Get the cover record to extract the storage path
      const { data: cover, error: fetchError } = await supabase
        .from('album_covers')
        .select('image_url')
        .eq('id', coverId)
        .single();

      if (fetchError) throw fetchError;

      // Extract filename from the URL to delete from storage
      const url = new URL(cover.image_url);
      const path = url.pathname.split('/').pop();
      
      if (path) {
        // Delete from storage
        await supabase.storage
          .from('album-covers')
          .remove([path]);
      }

      // Delete database record
      const { error } = await supabase
        .from('album_covers')
        .delete()
        .eq('id', coverId);

      if (error) throw error;
    } catch (error) {
      console.error('Error deleting cover:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    fetchAlbumCovers,
    fetchAlbumCoversByIds,
    updateSelectedCover,
    getSelectedCover,
    deleteCover
  };
}