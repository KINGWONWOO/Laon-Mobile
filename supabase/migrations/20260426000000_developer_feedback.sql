create table if not exists public.developer_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  type text not null check (type in ('bug', 'feature', 'other')),
  content text not null,
  created_at timestamptz not null default now()
);

alter table public.developer_feedback enable row level security;

-- 누구나 insert 가능 (인증된 사용자)
create policy "Users can submit feedback"
  on public.developer_feedback for insert
  to authenticated
  with check (auth.uid() = user_id);

-- 본인 피드백만 조회
create policy "Users can view own feedback"
  on public.developer_feedback for select
  to authenticated
  using (auth.uid() = user_id);
