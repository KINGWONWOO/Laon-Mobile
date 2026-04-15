-- 알림 관련 컬럼 추가
alter table public.notices add column if not exists use_notification boolean default true;
alter table public.schedules add column if not exists use_notification boolean default true;
alter table public.schedules add column if not exists deadline timestamptz;
alter table public.votes add column if not exists use_notification boolean default true;
alter table public.videos add column if not exists use_notification boolean default true;
alter table public.gallery_items add column if not exists use_notification boolean default true;

-- 대댓글을 위한 parent_id 추가
alter table public.notice_comments add column if not exists parent_id uuid references public.notice_comments(id) on delete cascade;
alter table public.video_comments add column if not exists parent_id uuid references public.video_comments(id) on delete cascade;

-- (선택) 알림 기록 테이블 (나중에 스케줄러에서 중복 발송 방지용으로 사용 가능)
create table if not exists public.notification_logs (
  id uuid primary key default gen_random_uuid(),
  target_type text not null, -- 'schedule', 'vote'
  target_id uuid not null,
  notification_type text not null, -- 'deadline_30m'
  created_at timestamptz default now()
);
