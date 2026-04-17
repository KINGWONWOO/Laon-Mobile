-- 투표 및 일정에 리마인더 관련 컬럼 추가
alter table public.votes add column if not exists reminder_before integer; -- 분 단위
alter table public.votes add column if not exists reminder_sent boolean default false;

alter table public.schedules add column if not exists reminder_before integer; -- 분 단위
alter table public.schedules add column if not exists reminder_sent boolean default false;
