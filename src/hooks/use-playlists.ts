import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { TrackItem } from "@/types";
import { useToast } from "@/hooks/use-toast";

export interface DbPlaylist {
  id: string;
  name: string;
  is_favorites: boolean;
  created_at: string;
  updated_at: string;
  song_count?: number;
}

export interface DbPlaylistItem {
  id: string;
  playlist_id: string;
  track_id: string;
  track_title: string | null;
  track_url: string | null;
  track_cover_url: string | null;
  track_params: string[] | null;
  added_at: string;
}

export function usePlaylists() {
  const [playlists, setPlaylists] = useState<DbPlaylist[]>([]);
  const [playlistItems, setPlaylistItems] = useState<{ [playlistId: string]: DbPlaylistItem[] }>({});
  const [favoritedTracks, setFavoritedTracks] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  // Get current user
  const getCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
  };

  // Load playlists and favorites
  const loadPlaylists = async () => {
    try {
      const user = await getCurrentUser();
      if (!user) {
        setIsLoading(false);
        return;
      }

      // Load playlists with song counts
      const { data: playlistsData, error: playlistsError } = await supabase
        .from('playlists')
        .select(`
          id,
          name,
          is_favorites,
          created_at,
          updated_at,
          playlist_items(count)
        `)
        .order('is_favorites', { ascending: false })
        .order('created_at', { ascending: false });

      if (playlistsError) throw playlistsError;

      // Transform data to DbPlaylist with song_count
      const playlistsWithCounts: DbPlaylist[] = (playlistsData || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        is_favorites: p.is_favorites,
        created_at: p.created_at,
        updated_at: p.updated_at,
        song_count: Array.isArray(p.playlist_items) ? p.playlist_items.length : (p.playlist_items as any)?.count || 0,
      }));
      if (!playlistsWithCounts.some(p => p.is_favorites)) {
        const { data: createdFav, error: favErr } = await supabase
          .from('playlists')
          .insert([{ user_id: user.id, name: 'Favourites', is_favorites: true }])
          .select()
          .single();
        if (!favErr && createdFav) {
          playlistsWithCounts.unshift({ ...createdFav, song_count: 0 });
        }
      }

      setPlaylists(playlistsWithCounts);

      // Load favorites
      const favoritesPlaylist = playlistsWithCounts.find(p => p.is_favorites);
      if (favoritesPlaylist) {
        const { data: favoritesData } = await supabase
          .from('playlist_items')
          .select('track_id')
          .eq('playlist_id', favoritesPlaylist.id);

        if (favoritesData) {
          setFavoritedTracks(new Set(favoritesData.map(item => item.track_id)));
        }
      }

    } catch (error) {
      console.error('Error loading playlists:', error);
      toast({ title: 'Failed to load playlists', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  // Load playlist items for a specific playlist
  const loadPlaylistItems = async (playlistId: string) => {
    try {
      const { data, error } = await supabase
        .from('playlist_items')
        .select('*')
        .eq('playlist_id', playlistId)
        .order('added_at', { ascending: false });

      if (error) throw error;

      setPlaylistItems(prev => ({
        ...prev,
        [playlistId]: data || []
      }));

      return data || [];
    } catch (error) {
      console.error('Error loading playlist items:', error);
      toast({ title: 'Failed to load playlist items', variant: 'destructive' });
      return [];
    }
  };

  // Create a new playlist
  const createPlaylist = async (name: string) => {
    try {
      const user = await getCurrentUser();
      if (!user) {
        toast({ title: 'Please log in to create playlists', variant: 'destructive' });
        return null;
      }

      const { data, error } = await supabase
        .from('playlists')
        .insert([{
          user_id: user.id,
          name,
          is_favorites: false
        }])
        .select()
        .single();

      if (error) throw error;

      const newPlaylist = { ...data, song_count: 0 };
      setPlaylists(prev => [...prev, newPlaylist]);
      toast({ title: `Created playlist "${name}"` });
      
      return newPlaylist;
    } catch (error) {
      console.error('Error creating playlist:', error);
      toast({ title: 'Failed to create playlist', variant: 'destructive' });
      return null;
    }
  };

  // Add track to playlist
  const addTrackToPlaylist = async (playlistId: string, track: TrackItem) => {
    try {
      const user = await getCurrentUser();
      if (!user) {
        toast({ title: 'Please log in to add tracks to playlists', variant: 'destructive' });
        return false;
      }

      const { error } = await supabase
        .from('playlist_items')
        .insert([{
          playlist_id: playlistId,
          track_id: track.id,
          track_title: track.title,
          track_url: track.url,
          track_cover_url: track.coverUrl,
          track_params: track.params
        }]);

      if (error) {
        if ((error as any).code === '23505') {
          toast({ title: 'Track is already in this playlist', variant: 'destructive' });
          return false;
        }
        throw error;
      }

      // Update song count
      setPlaylists(prev => prev.map(p => 
        p.id === playlistId 
          ? { ...p, song_count: (p.song_count || 0) + 1 }
          : p
      ));

      // Update playlist items if loaded
      if (playlistItems[playlistId]) {
        const newItem: DbPlaylistItem = {
          id: crypto.randomUUID(),
          playlist_id: playlistId,
          track_id: track.id,
          track_title: track.title || null,
          track_url: track.url,
          track_cover_url: track.coverUrl || null,
          track_params: track.params,
          added_at: new Date().toISOString()
        };

        setPlaylistItems(prev => ({
          ...prev,
          [playlistId]: [newItem, ...prev[playlistId]]
        }));
      }

      const playlist = playlists.find(p => p.id === playlistId);
      toast({ title: `Added "${track.title}" to "${playlist?.name}"` });
      
      return true;
    } catch (error) {
      console.error('Error adding track to playlist:', error);
      toast({ title: 'Failed to add track to playlist', variant: 'destructive' });
      return false;
    }
  };

  // Remove track from playlist
  const removeTrackFromPlaylist = async (playlistId: string, trackId: string) => {
    try {
      const { error } = await supabase
        .from('playlist_items')
        .delete()
        .eq('playlist_id', playlistId)
        .eq('track_id', trackId);

      if (error) throw error;

      // Update song count
      setPlaylists(prev => prev.map(p => 
        p.id === playlistId 
          ? { ...p, song_count: Math.max(0, (p.song_count || 0) - 1) }
          : p
      ));

      // Update playlist items if loaded
      if (playlistItems[playlistId]) {
        setPlaylistItems(prev => ({
          ...prev,
          [playlistId]: prev[playlistId].filter(item => item.track_id !== trackId)
        }));
      }

      toast({ title: 'Track removed from playlist' });
      return true;
    } catch (error) {
      console.error('Error removing track from playlist:', error);
      toast({ title: 'Failed to remove track from playlist', variant: 'destructive' });
      return false;
    }
  };

  // Toggle favorite
  const toggleFavorite = async (track: TrackItem) => {
    let favoritesPlaylist = playlists.find(p => p.is_favorites);

    if (!favoritesPlaylist) {
      const user = await getCurrentUser();
      if (!user) {
        toast({ title: 'Please log in to use Favourites', variant: 'destructive' });
        return false;
      }
      const { data: createdFav, error: favErr } = await supabase
        .from('playlists')
        .insert([{ user_id: user.id, name: 'Favourites', is_favorites: true }])
        .select()
        .single();
      if (favErr || !createdFav) {
        toast({ title: 'Failed to create Favourites playlist', variant: 'destructive' });
        return false;
      }
      const favDb: DbPlaylist = { ...createdFav, song_count: 0 };
      setPlaylists(prev => [favDb, ...prev]);
      favoritesPlaylist = favDb;
    }

    const isFavorited = favoritedTracks.has(track.id);

    if (isFavorited) {
      const success = await removeTrackFromPlaylist(favoritesPlaylist.id, track.id);
      if (success) {
        setFavoritedTracks(prev => {
          const newSet = new Set(prev);
          newSet.delete(track.id);
          return newSet;
        });
      }
      return success;
    } else {
      const success = await addTrackToPlaylist(favoritesPlaylist.id, track);
      if (success) {
        setFavoritedTracks(prev => new Set([...prev, track.id]));
      }
      return success;
    }
  };

  // Rename playlist
  const renamePlaylist = async (playlistId: string, newName: string) => {
    try {
      const { error } = await supabase
        .from('playlists')
        .update({ name: newName })
        .eq('id', playlistId);

      if (error) throw error;

      setPlaylists(prev => prev.map(p => 
        p.id === playlistId ? { ...p, name: newName } : p
      ));

      toast({ title: `Playlist renamed to "${newName}"` });
      return true;
    } catch (error) {
      console.error('Error renaming playlist:', error);
      toast({ title: 'Failed to rename playlist', variant: 'destructive' });
      return false;
    }
  };

  // Delete playlist
  const deletePlaylist = async (playlistId: string) => {
    try {
      const playlist = playlists.find(p => p.id === playlistId);
      if (playlist?.is_favorites) {
        toast({ title: 'Cannot delete Favourites playlist', variant: 'destructive' });
        return false;
      }

      const { error } = await supabase
        .from('playlists')
        .delete()
        .eq('id', playlistId);

      if (error) throw error;

      setPlaylists(prev => prev.filter(p => p.id !== playlistId));
      setPlaylistItems(prev => {
        const newItems = { ...prev };
        delete newItems[playlistId];
        return newItems;
      });

      toast({ title: 'Playlist deleted' });
      return true;
    } catch (error) {
      console.error('Error deleting playlist:', error);
      toast({ title: 'Failed to delete playlist', variant: 'destructive' });
      return false;
    }
  };

  // Set up real-time subscriptions
  useEffect(() => {
    const setupSubscriptions = async () => {
      const user = await getCurrentUser();
      if (!user) return;

      // Subscribe to playlist changes
      const playlistsSubscription = supabase
        .channel('playlists-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'playlists',
            filter: `user_id=eq.${user.id}`
          },
          () => {
            loadPlaylists();
          }
        )
        .subscribe();

      // Subscribe to playlist items changes
      const itemsSubscription = supabase
        .channel('playlist-items-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'playlist_items'
          },
          () => {
            loadPlaylists();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(playlistsSubscription);
        supabase.removeChannel(itemsSubscription);
      };
    };

    setupSubscriptions();
  }, []);

  // Initial load
  useEffect(() => {
    loadPlaylists();
  }, []);

  return {
    playlists,
    playlistItems,
    favoritedTracks,
    isLoading,
    loadPlaylistItems,
    createPlaylist,
    addTrackToPlaylist,
    removeTrackFromPlaylist,
    toggleFavorite,
    renamePlaylist,
    deletePlaylist,
    refreshPlaylists: loadPlaylists
  };
}