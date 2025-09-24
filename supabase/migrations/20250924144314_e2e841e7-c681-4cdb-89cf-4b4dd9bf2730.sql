-- Create storage buckets for album covers and artist images
INSERT INTO storage.buckets (id, name, public) VALUES 
  ('album-covers', 'album-covers', true),
  ('artist-images', 'artist-images', true);

-- Create table for storing album cover and artist image metadata
CREATE TABLE public.album_covers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  track_id TEXT NOT NULL,
  image_url TEXT NOT NULL,
  image_type TEXT NOT NULL CHECK (image_type IN ('album_cover', 'artist_image')),
  prompt_used TEXT,
  is_selected BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Enable Row Level Security
ALTER TABLE public.album_covers ENABLE ROW LEVEL SECURITY;

-- Create policies for album covers (public read, authenticated write)
CREATE POLICY "Album covers are publicly viewable" 
ON public.album_covers 
FOR SELECT 
USING (true);

CREATE POLICY "Authenticated users can insert album covers" 
ON public.album_covers 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Authenticated users can update album covers" 
ON public.album_covers 
FOR UPDATE 
USING (true);

CREATE POLICY "Authenticated users can delete album covers" 
ON public.album_covers 
FOR DELETE 
USING (true);

-- Create storage policies for album covers bucket
CREATE POLICY "Album covers are publicly accessible" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'album-covers');

CREATE POLICY "Anyone can upload album covers" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'album-covers');

CREATE POLICY "Anyone can update album covers" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'album-covers');

CREATE POLICY "Anyone can delete album covers" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'album-covers');

-- Create storage policies for artist images bucket
CREATE POLICY "Artist images are publicly accessible" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'artist-images');

CREATE POLICY "Anyone can upload artist images" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'artist-images');

CREATE POLICY "Anyone can update artist images" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'artist-images');

CREATE POLICY "Anyone can delete artist images" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'artist-images');

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_album_covers_updated_at
BEFORE UPDATE ON public.album_covers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_album_covers_track_id ON public.album_covers(track_id);
CREATE INDEX idx_album_covers_image_type ON public.album_covers(image_type);
CREATE INDEX idx_album_covers_created_at ON public.album_covers(created_at DESC);