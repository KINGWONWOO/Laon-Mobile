-- Add language preference to profiles for per-user localized push notifications
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS language text DEFAULT 'ko';
