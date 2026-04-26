-- videos 테이블에 추가 안무 영상 URL 컬럼 추가
ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS choreography_video_url text;
