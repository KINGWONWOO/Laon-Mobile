-- formations 테이블에 video_settings, is_published 컬럼 추가
ALTER TABLE public.formations ADD COLUMN IF NOT EXISTS video_settings jsonb;
ALTER TABLE public.formations ADD COLUMN IF NOT EXISTS is_published boolean DEFAULT false;

-- videos 테이블 choreography_video_url 보장 (이미 있을 수 있음)
ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS choreography_video_url text;
