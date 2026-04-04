-- videos 테이블의 youtube_id를 null 허용으로 변경 (R2 업로드 영상 대응)
ALTER TABLE public.videos ALTER COLUMN youtube_id DROP NOT NULL;

-- gallery_items 테이블에 description 컬럼이 혹시라도 없는 경우를 대비해 추가 (이미 이전 마이그레이션에 있지만 안전을 위해)
ALTER TABLE public.gallery_items ADD COLUMN IF NOT EXISTS description text;
