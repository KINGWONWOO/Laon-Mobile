-- 공지사항 댓글 테이블
create table if not exists public.notice_comments (
  id uuid primary key default gen_random_uuid(),
  notice_id uuid not null references public.notices(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete set null,
  text text not null,
  created_at timestamptz default now()
);

-- RLS 활성화
alter table public.notice_comments enable row level security;

-- 정책: 방 멤버만 조회/작성 가능
create policy "멤버만 공지 댓글 조회" on public.notice_comments for select using (
  exists (
    select 1 from public.notices n
    where n.id = notice_comments.notice_id
      and public.is_room_member(n.room_id)
  )
);

create policy "멤버만 공지 댓글 작성" on public.notice_comments for insert with check (
  exists (
    select 1 from public.notices n
    where n.id = notice_comments.notice_id
      and public.is_room_member(n.room_id)
  )
);

create policy "작성자만 공지 댓글 삭제" on public.notice_comments for delete using (auth.uid() = user_id);
