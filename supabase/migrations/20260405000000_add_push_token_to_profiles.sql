-- profiles 테이블에 푸시 토큰 컬럼 추가
alter table public.profiles add column if not exists push_token text;

-- 인덱스 추가 (조회 성능 향상)
create index if not exists idx_profiles_push_token on public.profiles(push_token);
