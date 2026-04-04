-- =============================================
-- 동선 관리 (Formation Management) 테이블 추가
-- =============================================

create table if not exists public.formations (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete set null,
  title text not null,
  audio_url text,
  settings jsonb default '{}'::jsonb,
  data jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

-- RLS 활성화
alter table public.formations enable row level security;

-- 정책: 방 멤버만 조회/작성 가능
create policy "멤버만 동선 조회" on public.formations for select using (public.is_room_member(room_id));
create policy "멤버만 동선 작성" on public.formations for insert with check (public.is_room_member(room_id));
create policy "작성자 및 리더만 동선 수정" on public.formations for update using (
  auth.uid() = user_id or 
  exists (select 1 from public.rooms where id = formations.room_id and leader_id = auth.uid())
);
create policy "작성자 및 리더만 동선 삭제" on public.formations for delete using (
  auth.uid() = user_id or 
  exists (select 1 from public.rooms where id = formations.room_id and leader_id = auth.uid())
);
