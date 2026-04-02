-- 1. gallery_items 테이블 업데이트
ALTER TABLE public.gallery_items ADD COLUMN IF NOT EXISTS description text;

-- 2. 갤러리 댓글 테이블 생성 (SNS 스타일)
CREATE TABLE IF NOT EXISTS public.gallery_comments (
    id uuid default gen_random_uuid() primary key,
    gallery_item_id uuid not null references public.gallery_items(id) on delete cascade,
    user_id uuid not null references public.profiles(id) on delete cascade,
    text text not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

ALTER TABLE public.gallery_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "방 멤버만 갤러리 댓글 조회" ON public.gallery_comments FOR SELECT USING (
  exists (
    select 1 from public.gallery_items gi
    where gi.id = gallery_item_id and public.is_room_member(gi.room_id)
  )
);
CREATE POLICY "방 멤버만 갤러리 댓글 작성" ON public.gallery_comments FOR INSERT WITH CHECK (
  exists (
    select 1 from public.gallery_items gi
    where gi.id = gallery_item_id and public.is_room_member(gi.room_id)
  )
);

-- 3. 보관 정책 (30일 자동 삭제)
-- pg_cron 익스텐션 활성화 (Supabase 대시보드에서 켜져있어야 함)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 30일이 지난 영상을 삭제하는 함수 (DB에서 지워지면 R2 파일도 지워야 함)
-- 이 부분은 DB 내에서 직접 수행하기 어려우므로, Edge Function으로 Webhook을 걸거나
-- DB 상에서 삭제 후 트리거로 외부 호출을 할 수 있습니다. 
-- 가장 간단한 방법: pg_net을 통해 R2 삭제 Edge Function 호출
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public.cleanup_old_files()
RETURNS void AS $$
DECLARE
    r record;
BEGIN
    -- 1. 30일 지난 비디오 삭제 호출
    FOR r IN SELECT id, room_id, storage_path FROM public.videos WHERE created_at < NOW() - INTERVAL '30 days' LOOP
        IF r.storage_path IS NOT NULL THEN
            -- Edge Function 호출 (API 키 필요, 여기서는 로직만 작성하고 실제 삭제는 앱/크론에서 주기적으로 호출)
            -- 생략: 실제 환경에서는 net.http_post 호출을 구성하거나 별도의 서버 크론으로 해결
        END IF;
        DELETE FROM public.videos WHERE id = r.id;
    END LOOP;

    -- 2. 30일 지난 갤러리 아이템 삭제
    FOR r IN SELECT id, room_id, file_path FROM public.gallery_items WHERE created_at < NOW() - INTERVAL '30 days' LOOP
        DELETE FROM public.gallery_items WHERE id = r.id;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 매일 새벽 3시(UTC)에 청소 함수 실행하도록 pg_cron 예약
-- SELECT cron.schedule('cleanup_job', '0 3 * * *', 'SELECT public.cleanup_old_files()');

-- * 임시로 모든 유저가 권한 제약 없이 쓸 수 있도록 DISABLE (개발용)
ALTER TABLE public.gallery_comments DISABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE public.gallery_comments TO authenticated;
