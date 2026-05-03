-- 1. 콘텐츠 신고 테이블 생성
create table if not exists public.content_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references auth.users(id) on delete set null,
  content_id uuid not null,
  content_type text not null, -- 'video', 'notice', 'comment', 'photo', etc.
  reason text,
  status text not null default 'pending', -- 'pending', 'reviewed', 'resolved'
  created_at timestamptz not null default now()
);

-- 2. RLS 활성화
alter table public.content_reports enable row level security;

-- 3. 정책 설정
-- 로그인한 사용자라면 누구나 신고 가능
create policy "Authenticated users can create reports"
  on public.content_reports for insert
  to authenticated
  with check (auth.uid() = reporter_id);

-- 신고자는 자신의 신고 내역 조회 가능
create policy "Users can view their own reports"
  on public.content_reports for select
  to authenticated
  using (auth.uid() = reporter_id);
