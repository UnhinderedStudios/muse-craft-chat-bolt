import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { api } from '@/lib/api';
import { TimestampedWord } from '@/types/audio';

interface KaraokeLyrics {
  words: TimestampedWord[];
  waveformData?: number[];
  hootCer?: number;
  isStreamed?: boolean;
}

export function useKaraokeLyrics(trackId: string, taskId?: string, musicIndex?: number, audioId?: string) {
  const [lyrics, setLyrics] = useState<KaraokeLyrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLyrics = async () => {
    if (!trackId) return;

    setLoading(true);
    setError(null);

    try {
      // First check Supabase cache
      const { data: cachedData, error: fetchError } = await supabase
        .from('karaoke_lyrics')
        .select('*')
        .eq('track_id', trackId)
        .maybeSingle();

      if (!fetchError && cachedData) {
        console.log(`🎤 Using cached karaoke data for ${trackId}`);
        setLyrics({
          words: (cachedData.lyrics_data as unknown) as TimestampedWord[],
          waveformData: (cachedData.waveform_data as unknown) as number[],
          hootCer: cachedData.hoot_cer as number,
          isStreamed: cachedData.is_streamed as boolean
        });
        setLoading(false);
        return;
      }

      // If not cached and we have required params, fetch from API
      if (taskId) {
        console.log(`🎤 Fetching karaoke data for ${trackId}`);
        const result = await api.getTimestampedLyrics({
          taskId,
          audioId,
          musicIndex
        });

        const transformedWords = result.alignedWords.map(word => ({
          word: word.word,
          start: word.start_s,
          end: word.end_s,
          success: word.success,
          p_align: word.p_align
        }));

        setLyrics({
          words: transformedWords,
          waveformData: result.waveformData,
          hootCer: result.hootCer,
          isStreamed: result.isStreamed
        });
      }
    } catch (err) {
      console.error('Error fetching karaoke lyrics:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch lyrics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLyrics();
  }, [trackId, taskId, musicIndex, audioId]);

  return {
    lyrics,
    loading,
    error,
    refetch: fetchLyrics
  };
}