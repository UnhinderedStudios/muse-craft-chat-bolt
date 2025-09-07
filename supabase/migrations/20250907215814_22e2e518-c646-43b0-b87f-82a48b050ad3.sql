-- Create playlists table for user playlists
CREATE TABLE public.playlists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  is_favorites BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT unique_favorites_per_user UNIQUE (user_id, is_favorites) DEFERRABLE INITIALLY DEFERRED
);

-- Create playlist_items table for tracks within playlists
CREATE TABLE public.playlist_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  playlist_id UUID NOT NULL REFERENCES public.playlists(id) ON DELETE CASCADE,
  track_id TEXT NOT NULL,
  track_title TEXT,
  track_url TEXT,
  track_cover_url TEXT,
  track_params TEXT[],
  added_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT unique_track_per_playlist UNIQUE (playlist_id, track_id)
);

-- Enable Row Level Security
ALTER TABLE public.playlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playlist_items ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for playlists
CREATE POLICY "Users can view their own playlists" 
ON public.playlists 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own playlists" 
ON public.playlists 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own playlists" 
ON public.playlists 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own playlists" 
ON public.playlists 
FOR DELETE 
USING (auth.uid() = user_id AND is_favorites = false);

-- Create RLS policies for playlist_items
CREATE POLICY "Users can view their own playlist items" 
ON public.playlist_items 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.playlists 
  WHERE playlists.id = playlist_items.playlist_id 
  AND playlists.user_id = auth.uid()
));

CREATE POLICY "Users can add items to their own playlists" 
ON public.playlist_items 
FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM public.playlists 
  WHERE playlists.id = playlist_items.playlist_id 
  AND playlists.user_id = auth.uid()
));

CREATE POLICY "Users can update items in their own playlists" 
ON public.playlist_items 
FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM public.playlists 
  WHERE playlists.id = playlist_items.playlist_id 
  AND playlists.user_id = auth.uid()
));

CREATE POLICY "Users can remove items from their own playlists" 
ON public.playlist_items 
FOR DELETE 
USING (EXISTS (
  SELECT 1 FROM public.playlists 
  WHERE playlists.id = playlist_items.playlist_id 
  AND playlists.user_id = auth.uid()
));

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_playlists_updated_at
BEFORE UPDATE ON public.playlists
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to automatically create favorites playlist for new users
CREATE OR REPLACE FUNCTION public.create_favorites_playlist()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.playlists (user_id, name, is_favorites)
  VALUES (NEW.id, 'Favourites', true);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger to create favorites playlist when user signs up
CREATE TRIGGER on_auth_user_created_create_favorites
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.create_favorites_playlist();