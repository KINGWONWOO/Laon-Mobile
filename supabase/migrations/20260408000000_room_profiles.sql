-- 룸별 유저 프로필(닉네임, 프로필 이미지) 관리 테이블
create table if not exists public.room_profiles (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  profile_image text,
  created_at timestamptz default now(),
  unique(room_id, user_id)
);

-- RLS 설정
alter table public.room_profiles enable row level security;

create policy "모두가 룸 프로필 조회 가능" on public.room_profiles for select using (true);
create policy "멤버가 룸 프로필 생성 가능" on public.room_profiles for insert with check (public.is_room_member(room_id));
create policy "본인만 룸 프로필 수정" on public.room_profiles for update using (auth.uid() = user_id);
