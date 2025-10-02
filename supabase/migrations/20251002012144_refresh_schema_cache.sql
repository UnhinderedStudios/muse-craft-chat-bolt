/*
  # Force Schema Cache Refresh

  This migration forces PostgREST to reload the schema cache by making a trivial
  change to the artists table (adding and removing a comment).
*/

-- Add a comment to force schema reload
COMMENT ON TABLE public.artists IS 'Artist profiles with metadata';

-- Notify PostgREST to reload
NOTIFY pgrst, 'reload schema';
