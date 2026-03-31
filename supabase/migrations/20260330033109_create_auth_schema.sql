-- =============================================
-- profiles 테이블 (auth.users 와 1:1 연동)
-- =============================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  name text,
  phone text,
  profile_image text,
  created_at timestamptz default now()
);

-- RLS 활성화
alter table public.profiles enable row level security;

-- 이메일 중복 확인용: 이메일만 공개 조회 허용
create policy "이메일 중복 확인" on public.profiles
  for select using (true);

-- 본인 프로필만 수정 가능
create policy "본인 프로필 수정" on public.profiles
  for update using (auth.uid() = id);

-- auth.users 에 신규 유저 생성 시 자동으로 profiles 생성하는 트리거
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  user_name text;
  user_email text;
begin
  user_name := coalesce(new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'full_name', '댄서');
  user_email := coalesce(new.email, new.raw_user_meta_data->>'email');
  
  insert into public.profiles (id, email, name, phone)
  values (
    new.id,
    user_email,
    user_name,
    new.raw_user_meta_data->>'phone'
  )
  on conflict (id) do update
  set 
    email = excluded.email,
    name = coalesce(public.profiles.name, excluded.name);
    
  return new;
end;
$$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- =============================================
-- rooms 테이블
-- =============================================
create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  passcode text not null,
  image_uri text,
  leader_id uuid references auth.users(id) on delete set null,
  created_at timestamptz default now()
);

alter table public.rooms enable row level security;

-- 방 멤버만 조회 가능
create policy "방 멤버 조회" on public.rooms
  for select using (
    exists (
      select 1 from public.room_members
      where room_members.room_id = rooms.id
        and room_members.user_id = auth.uid()
    )
  );

-- 로그인한 유저면 방 생성 가능
create policy "방 생성" on public.rooms
  for insert with check (auth.uid() is not null);

-- 방장만 수정/삭제 가능
create policy "방장 수정" on public.rooms
  for update using (auth.uid() = leader_id);

create policy "방장 삭제" on public.rooms
  for delete using (auth.uid() = leader_id);


-- =============================================
-- room_members 테이블
-- =============================================
create table if not exists public.room_members (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz default now(),
  unique(room_id, user_id)
);

alter table public.room_members enable row level security;

-- 본인 멤버십만 조회 가능
create policy "본인 멤버십 조회" on public.room_members
  for select using (auth.uid() = user_id);

-- 로그인한 유저면 멤버 추가 가능
create policy "멤버 추가" on public.room_members
  for insert with check (auth.uid() is not null);

-- 본인 멤버십만 삭제 가능
create policy "본인 멤버십 삭제" on public.room_members
  for delete using (auth.uid() = user_id);