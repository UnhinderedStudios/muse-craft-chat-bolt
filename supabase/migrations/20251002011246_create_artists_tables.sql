/*
  # Create Artists Management Tables

  ## Overview
  This migration creates tables for storing artist data and their generation state,
  replacing the current browser storage implementation with persistent Supabase storage.

  ## New Tables
  
  ### `artists`
  Stores core artist information and metadata
  - `id` (uuid, primary key) - Unique identifier for each artist
  - `name` (text) - Artist name
  - `image_url` (text, nullable) - URL to artist's main image
  - `song_count` (integer) - Number of songs associated with this artist
  - `is_favorited` (boolean) - Whether artist is marked as favorite
  - `created_at` (timestamptz) - When the artist was created
  - `updated_at` (timestamptz) - Last update timestamp
  
  ### `artist_generation_state`
  Stores the generation state for the Artist Generator overlay
  - `id` (uuid, primary key) - Unique identifier
  - `artist_id` (uuid, foreign key) - References artists table
  - `generated_images` (jsonb) - Array of generated image URLs
  - `image_prompts` (jsonb) - Array of prompts used for each image
  - `facial_reference` (text, nullable) - Facial reference image URL
  - `clothing_reference` (text, nullable) - Clothing reference image URL
  - `primary_clothing_type` (text, nullable) - Type of clothing detected
  - `selected_color` (text, nullable) - Selected background color hex
  - `artist_count` (integer) - Character count setting (1-3)
  - `is_realistic` (boolean) - Realistic vs Animated mode
  - `created_at` (timestamptz) - Creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ## Security
  - Enable RLS on both tables
  - Create policies allowing public read access (for now, since no auth is implemented)
  - Allow anyone to insert/update/delete (can be restricted later when auth is added)

  ## Indexes
  - Index on artist name for search functionality
  - Index on created_at for sorting
  - Index on is_favorited for filtered queries
  - Foreign key index on artist_generation_state.artist_id
*/

-- Create artists table
CREATE TABLE IF NOT EXISTS public.artists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  image_url TEXT,
  song_count INTEGER NOT NULL DEFAULT 0,
  is_favorited BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create artist_generation_state table
CREATE TABLE IF NOT EXISTS public.artist_generation_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id UUID NOT NULL REFERENCES public.artists(id) ON DELETE CASCADE,
  generated_images JSONB DEFAULT '[]'::jsonb,
  image_prompts JSONB DEFAULT '[]'::jsonb,
  facial_reference TEXT,
  clothing_reference TEXT,
  primary_clothing_type TEXT,
  selected_color TEXT,
  artist_count INTEGER NOT NULL DEFAULT 1,
  is_realistic BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(artist_id)
);

-- Enable Row Level Security
ALTER TABLE public.artists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.artist_generation_state ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for artists table
CREATE POLICY "Artists are publicly viewable"
  ON public.artists
  FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert artists"
  ON public.artists
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update artists"
  ON public.artists
  FOR UPDATE
  USING (true);

CREATE POLICY "Anyone can delete artists"
  ON public.artists
  FOR DELETE
  USING (true);

-- Create RLS policies for artist_generation_state table
CREATE POLICY "Artist generation state is publicly viewable"
  ON public.artist_generation_state
  FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert artist generation state"
  ON public.artist_generation_state
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update artist generation state"
  ON public.artist_generation_state
  FOR UPDATE
  USING (true);

CREATE POLICY "Anyone can delete artist generation state"
  ON public.artist_generation_state
  FOR DELETE
  USING (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_artists_name ON public.artists(name);
CREATE INDEX IF NOT EXISTS idx_artists_created_at ON public.artists(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_artists_is_favorited ON public.artists(is_favorited);
CREATE INDEX IF NOT EXISTS idx_artist_generation_state_artist_id ON public.artist_generation_state(artist_id);

-- Create function for automatic updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_artists_updated_at
  BEFORE UPDATE ON public.artists
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_artist_generation_state_updated_at
  BEFORE UPDATE ON public.artist_generation_state
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
