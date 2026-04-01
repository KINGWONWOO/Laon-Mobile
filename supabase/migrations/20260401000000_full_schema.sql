-- =============================================
-- 1. 기초 정보 (이미 존재하는 테이블에 대한 추가 처리 및 신규 테이블)
-- =============================================

-- 공지사항 (notices)
create table if not exists public.notices (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete set null,
  title text not null,
  content text not null,
  is_pinned boolean default false,
  image_urls text[] default '{}',
  viewed_by uuid[] default '{}',
  created_at timestamptz default now()
);

-- 일정 (schedules)
create table if not exists public.schedules (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete set null,
  title text not null,
  start_date date,
  end_date date,
  viewed_by uuid[] default '{}',
  created_at timestamptz default now()
);

-- 일정 옵션 (예: 2026-04-01 18:00)
create table if not exists public.schedule_options (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references public.schedules(id) on delete cascade,
  date_time text not null
);

-- 일정 응답 (누가 어떤 옵션을 선택했나)
create table if not exists public.schedule_responses (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references public.schedules(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  option_ids uuid[] default '{}',
  updated_at timestamptz default now(),
  unique(schedule_id, user_id)
);

-- 투표 (votes)
create table if not exists public.votes (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete set null,
  question text not null,
  is_anonymous boolean default false,
  allow_multiple boolean default false,
  deadline timestamptz,
  viewed_by uuid[] default '{}',
  created_at timestamptz default now()
);

-- 투표 옵션
create table if not exists public.vote_options (
  id uuid primary key default gen_random_uuid(),
  vote_id uuid not null references public.votes(id) on delete cascade,
  text text not null
);

-- 투표 응답
create table if not exists public.vote_responses (
  id uuid primary key default gen_random_uuid(),
  vote_id uuid not null references public.votes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  option_ids uuid[] default '{}',
  updated_at timestamptz default now(),
  unique(vote_id, user_id)
);

-- =============================================
-- 2. 유튜브 영상 및 피드백 (videos)
-- =============================================

create table if not exists public.videos (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete set null,
  title text not null,
  youtube_url text,
  youtube_id text not null,
  storage_path text, -- 일반 영상 업로드 대비
  created_at timestamptz default now()
);

create table if not exists public.video_comments (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.videos(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete set null,
  text text not null,
  timestamp_millis integer not null,
  created_at timestamptz default now()
);

-- =============================================
-- 3. 갤러리/아카이브 (gallery)
-- =============================================

create table if not exists public.gallery_items (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete set null,
  file_path text not null,
  file_type text not null, -- 'image' or 'video'
  file_size integer not null,
  created_at timestamptz default now()
);

-- =============================================
-- 4. RLS 설정
-- =============================================

alter table public.notices enable row level security;
alter table public.schedules enable row level security;
alter table public.schedule_options enable row level security;
alter table public.schedule_responses enable row level security;
alter table public.votes enable row level security;
alter table public.vote_options enable row level security;
alter table public.vote_responses enable row level security;
alter table public.videos enable row level security;
alter table public.video_comments enable row level security;
alter table public.gallery_items enable row level security;

-- 공통 정책: 방 멤버만 조회/작성 가능
-- (이미 rooms 테이블에 대해 멤버십 확인 로직이 있으므로 이를 활용)

-- 방 멤버 확인 함수
create or replace function public.is_room_member(room_id uuid)
returns boolean as $$
begin
  return exists (
    select 1 from public.room_members
    where room_members.room_id = is_room_member.room_id
      and room_members.user_id = auth.uid()
  );
end;
$$ language plpgsql security definer;

-- 정책 적용 (예시: notices)
create policy "멤버만 공지 조회" on public.notices for select using (public.is_room_member(room_id));
create policy "멤버만 공지 작성" on public.notices for insert with check (public.is_room_member(room_id));
create policy "작성자만 공지 수정" on public.notices for update using (auth.uid() = user_id);
create policy "작성자만 공지 삭제" on public.notices for delete using (auth.uid() = user_id);

-- 나머지 테이블들도 유사하게 적용 (편의상 통합 멤버 정책 사용 가능)
create policy "멤버만 일정 조회" on public.schedules for select using (public.is_room_member(room_id));
create policy "멤버만 일정 작성" on public.schedules for insert with check (public.is_room_member(room_id));
create policy "작성자만 일정 관리" on public.schedules for all using (auth.uid() = user_id);

create policy "멤버만 일정 옵션 조회" on public.schedule_options for select using (
  exists (select 1 from public.schedules where id = schedule_id and public.is_room_member(room_id))
);

create policy "멤버만 일정 응답" on public.schedule_responses for all using (
  exists (select 1 from public.schedules where id = schedule_id and public.is_room_member(room_id))
);

create policy "멤버만 투표 조회" on public.votes for select using (public.is_room_member(room_id));
create policy "멤버만 투표 작성" on public.votes for insert with check (public.is_room_member(room_id));

create policy "멤버만 투표 옵션 조회" on public.vote_options for select using (
  exists (select 1 from public.votes where id = vote_id and public.is_room_member(room_id))
);

create policy "멤버만 투표 응답" on public.vote_responses for all using (
  exists (select 1 from public.votes where id = vote_id and public.is_room_member(room_id))
);

create policy "멤버만 영상 조회" on public.videos for select using (public.is_room_member(room_id));
create policy "멤버만 영상 업로드" on public.videos for insert with check (public.is_room_member(room_id));

create policy "멤버만 영상 피드백" on public.video_comments for all using (
  exists (select 1 from public.videos where id = video_id and public.is_room_member(room_id))
);

create policy "멤버만 갤러리 조회" on public.gallery_items for select using (public.is_room_member(room_id));
create policy "멤버만 갤러리 업로드" on public.gallery_items for insert with check (public.is_room_member(room_id));


-- =============================================
-- 5. Storage Buckets 및 정책
-- =============================================

-- 버킷 생성 (SQL에서 직접 생성은 지원되지 않을 수 있으나 가이드용)
-- insert into storage.buckets (id, name, public) values ('profiles', 'profiles', true);
-- insert into storage.buckets (id, name, public) values ('rooms', 'rooms', true);
-- insert into storage.buckets (id, name, public) values ('gallery', 'gallery', true);

-- Storage 정책 (RLS가 활성화되어 있어야 함)
-- 갤러리 아이템 20개 제한 트리거 (DB 레벨 보안)
create or replace function public.check_gallery_limit()
returns trigger as $$
begin
  if (select count(*) from public.gallery_items where room_id = new.room_id) >= 20 then
    raise exception '갤러리에는 최대 20개까지만 업로드할 수 있습니다.';
  end if;
  return new;
end;
$$ language plpgsql;

create trigger trg_check_gallery_limit
before insert on public.gallery_items
for each row execute procedure public.check_gallery_limit();
