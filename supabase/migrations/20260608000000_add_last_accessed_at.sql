ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS last_accessed_at timestamp with time zone;
ALTER TABLE public.gallery_items ADD COLUMN IF NOT EXISTS last_accessed_at timestamp with time zone;

UPDATE public.videos SET last_accessed_at = created_at WHERE last_accessed_at IS NULL;
UPDATE public.gallery_items SET last_accessed_at = created_at WHERE last_accessed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_videos_last_accessed_at ON public.videos(last_accessed_at);
CREATE INDEX IF NOT EXISTS idx_gallery_last_accessed_at ON public.gallery_items(last_accessed_at);
