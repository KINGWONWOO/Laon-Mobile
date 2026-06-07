-- =============================================
-- 1. pg_cron 및 pg_net 확장 활성화 (이미 활성화되어 있을 수 있음)
-- =============================================
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- =============================================
-- 2. 일정/투표 마감 리마인더 실행을 위한 크론 작업 등록
-- =============================================

-- 주의: Edge Function을 호출하기 위해서는 프로젝트의 URL과 Service Role Key가 필요합니다.
-- 이 값들은 보안상 SQL 파일에 직접 포함하지 않는 것이 좋습니다.
-- 아래 SQL은 로직의 틀을 제공하며, 실제 운영 환경(Supabase Dashboard)의 SQL Editor에서 
-- [YOUR_PROJECT_REF]와 [YOUR_SERVICE_ROLE_KEY]를 실제 값으로 치환하여 실행해야 합니다.

/*
SELECT cron.schedule(
  'deadline-reminder-job',
  '*/5 * * * *', -- 5분마다 실행
  $$
  SELECT net.http_post(
    url := 'https://[YOUR_PROJECT_REF].supabase.co/functions/v1/deadline-reminder',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer [YOUR_SERVICE_ROLE_KEY]'
    ),
    body := '{}'::jsonb
  );
  $$
);
*/

-- 로컬 개발 환경용 (예시)
-- SELECT cron.schedule('deadline-reminder-local', '*/5 * * * *', $$ SELECT net.http_post(url := 'http://host.docker.internal:54321/functions/v1/deadline-reminder', headers := '{"Content-Type": "application/json"}'::jsonb, body := '{}'::jsonb); $$);
