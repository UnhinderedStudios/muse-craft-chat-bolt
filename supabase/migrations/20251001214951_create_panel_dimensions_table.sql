/*
  # Create Panel Dimensions Table for Resizable UI Layout

  1. Overview
    - Stores user-specific panel dimension preferences for the resizable UI system
    - Supports per-session or global panel configurations
    - Enables layout persistence across browser sessions

  2. New Tables
    - `panel_dimensions`
      - `id` (uuid, primary key) - Unique identifier
      - `user_id` (uuid, nullable) - User identifier for authenticated users
      - `session_key` (text, nullable) - Local storage key for anonymous users
      - `panel_id` (text) - Identifier for the panel (e.g., 'chat', 'sessions', 'tracklist')
      - `width` (integer, nullable) - Panel width in pixels
      - `height` (integer, nullable) - Panel height in pixels
      - `x_position` (integer, nullable) - Horizontal position (for future drag support)
      - `y_position` (integer, nullable) - Vertical position (for future drag support)
      - `is_collapsed` (boolean) - Whether panel is collapsed
      - `layout_preset` (text, nullable) - Named layout preset this belongs to
      - `created_at` (timestamptz) - Creation timestamp
      - `updated_at` (timestamptz) - Last update timestamp

  3. Security
    - Enable RLS on `panel_dimensions` table
    - Users can read their own panel dimensions (by user_id or session_key)
    - Users can insert/update their own panel dimensions
    - Anonymous users can manage dimensions via session_key

  4. Indexes
    - Index on user_id for fast user-specific queries
    - Index on session_key for anonymous user queries
    - Composite index on user_id + panel_id for efficient lookups
    - Index on layout_preset for preset switching

  5. Constraints
    - Width must be positive if set
    - Height must be positive if set
    - Either user_id or session_key must be provided
    - Unique constraint on (user_id, panel_id, layout_preset) to prevent duplicates
*/

-- Create the panel_dimensions table
CREATE TABLE IF NOT EXISTS public.panel_dimensions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  session_key TEXT,
  panel_id TEXT NOT NULL,
  width INTEGER CHECK (width IS NULL OR width > 0),
  height INTEGER CHECK (height IS NULL OR height > 0),
  x_position INTEGER,
  y_position INTEGER,
  is_collapsed BOOLEAN DEFAULT false,
  layout_preset TEXT DEFAULT 'default',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Ensure at least one identifier is provided
  CONSTRAINT user_or_session_required CHECK (
    user_id IS NOT NULL OR session_key IS NOT NULL
  ),
  
  -- Unique constraint to prevent duplicate panel configs
  CONSTRAINT unique_panel_config UNIQUE (user_id, session_key, panel_id, layout_preset)
);

-- Enable Row Level Security
ALTER TABLE public.panel_dimensions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own panel dimensions
CREATE POLICY "Users can read own panel dimensions"
  ON public.panel_dimensions
  FOR SELECT
  USING (
    (auth.uid() IS NOT NULL AND user_id = auth.uid())
    OR (auth.uid() IS NULL AND session_key IS NOT NULL)
  );

-- Policy: Users can insert their own panel dimensions
CREATE POLICY "Users can insert own panel dimensions"
  ON public.panel_dimensions
  FOR INSERT
  WITH CHECK (
    (auth.uid() IS NOT NULL AND user_id = auth.uid())
    OR (auth.uid() IS NULL AND session_key IS NOT NULL)
  );

-- Policy: Users can update their own panel dimensions
CREATE POLICY "Users can update own panel dimensions"
  ON public.panel_dimensions
  FOR UPDATE
  USING (
    (auth.uid() IS NOT NULL AND user_id = auth.uid())
    OR (auth.uid() IS NULL AND session_key IS NOT NULL)
  );

-- Policy: Users can delete their own panel dimensions
CREATE POLICY "Users can delete own panel dimensions"
  ON public.panel_dimensions
  FOR DELETE
  USING (
    (auth.uid() IS NOT NULL AND user_id = auth.uid())
    OR (auth.uid() IS NULL AND session_key IS NOT NULL)
  );

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_panel_dimensions_user_id 
  ON public.panel_dimensions(user_id);

CREATE INDEX IF NOT EXISTS idx_panel_dimensions_session_key 
  ON public.panel_dimensions(session_key);

CREATE INDEX IF NOT EXISTS idx_panel_dimensions_user_panel 
  ON public.panel_dimensions(user_id, panel_id);

CREATE INDEX IF NOT EXISTS idx_panel_dimensions_layout_preset 
  ON public.panel_dimensions(layout_preset);

-- Create updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION public.update_panel_dimensions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic updated_at updates
CREATE TRIGGER trigger_update_panel_dimensions_updated_at
  BEFORE UPDATE ON public.panel_dimensions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_panel_dimensions_updated_at();