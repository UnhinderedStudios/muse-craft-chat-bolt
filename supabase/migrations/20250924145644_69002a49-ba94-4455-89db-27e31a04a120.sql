-- Create karaoke_lyrics table for permanent storage of timestamped lyrics
CREATE TABLE public.karaoke_lyrics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  track_id TEXT NOT NULL,
  task_id TEXT,
  music_index INTEGER DEFAULT 0,
  audio_id TEXT,
  lyrics_data JSONB NOT NULL,
  waveform_data JSONB,
  hoot_cer NUMERIC,
  is_streamed BOOLEAN DEFAULT false,
  fetch_attempts INTEGER DEFAULT 1,
  last_fetch_error TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.karaoke_lyrics ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (karaoke data can be viewed by everyone)
CREATE POLICY "Karaoke lyrics are publicly viewable" 
ON public.karaoke_lyrics 
FOR SELECT 
USING (true);

CREATE POLICY "Authenticated users can insert karaoke lyrics" 
ON public.karaoke_lyrics 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Authenticated users can update karaoke lyrics" 
ON public.karaoke_lyrics 
FOR UPDATE 
USING (true);

-- Create indexes for efficient queries
CREATE INDEX idx_karaoke_lyrics_track_id ON public.karaoke_lyrics(track_id);
CREATE INDEX idx_karaoke_lyrics_task_id_music_index ON public.karaoke_lyrics(task_id, music_index);
CREATE INDEX idx_karaoke_lyrics_audio_id ON public.karaoke_lyrics(audio_id);

-- Create unique constraint to prevent duplicates
CREATE UNIQUE INDEX idx_karaoke_lyrics_unique_track ON public.karaoke_lyrics(track_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_karaoke_lyrics_updated_at
BEFORE UPDATE ON public.karaoke_lyrics
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();