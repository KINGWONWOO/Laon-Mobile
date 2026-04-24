-- 회원 탈퇴 시 모든 연관 데이터를 아예 삭제(CASCADE)하도록 제약 조건 변경

-- 기존의 SET NULL 제약 조건을 삭제하고 CASCADE로 재설정하기 위해 
-- 먼저 기존 외래키 제약 조건의 이름을 파악해야 하지만, 
-- 인라인으로 생성된 경우 보통 '테이블명_컬럼명_fkey' 형식을 따릅니다.

DO $$ 
BEGIN
    -- 1. notices
    ALTER TABLE public.notices DROP CONSTRAINT IF EXISTS notices_user_id_fkey;
    ALTER TABLE public.notices ADD CONSTRAINT notices_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

    -- 2. schedules
    ALTER TABLE public.schedules DROP CONSTRAINT IF EXISTS schedules_user_id_fkey;
    ALTER TABLE public.schedules ADD CONSTRAINT schedules_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

    -- 3. votes
    ALTER TABLE public.votes DROP CONSTRAINT IF EXISTS votes_user_id_fkey;
    ALTER TABLE public.votes ADD CONSTRAINT votes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

    -- 4. videos
    ALTER TABLE public.videos DROP CONSTRAINT IF EXISTS videos_user_id_fkey;
    ALTER TABLE public.videos ADD CONSTRAINT videos_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

    -- 5. video_comments
    ALTER TABLE public.video_comments DROP CONSTRAINT IF EXISTS video_comments_user_id_fkey;
    ALTER TABLE public.video_comments ADD CONSTRAINT video_comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

    -- 6. gallery_items
    ALTER TABLE public.gallery_items DROP CONSTRAINT IF EXISTS gallery_items_user_id_fkey;
    ALTER TABLE public.gallery_items ADD CONSTRAINT gallery_items_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

    -- 7. formations
    ALTER TABLE public.formations DROP CONSTRAINT IF EXISTS formations_user_id_fkey;
    ALTER TABLE public.formations ADD CONSTRAINT formations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

    -- 8. rooms (방장이 탈퇴하면 방 전체 삭제)
    ALTER TABLE public.rooms DROP CONSTRAINT IF EXISTS rooms_leader_id_fkey;
    ALTER TABLE public.rooms ADD CONSTRAINT rooms_leader_id_fkey FOREIGN KEY (leader_id) REFERENCES auth.users(id) ON DELETE CASCADE;

    -- 9. notice_comments
    ALTER TABLE public.notice_comments DROP CONSTRAINT IF EXISTS notice_comments_user_id_fkey;
    ALTER TABLE public.notice_comments ADD CONSTRAINT notice_comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

END $$;

-- 기존에 Drop했던 NOT NULL 제약 조건 복구 (필요한 경우)
-- 삭제 시 열 자체가 사라지므로 NOT NULL이어도 무방함
ALTER TABLE public.notices ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE public.schedules ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE public.votes ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE public.videos ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE public.video_comments ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE public.gallery_items ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE public.formations ALTER COLUMN user_id SET NOT NULL;
