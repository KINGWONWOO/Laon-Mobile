-- 테스트용 1분 cron 제거
SELECT cron.unschedule('cleanup-inactive-files');

-- 매일 UTC 새벽 3시에 30일 미열람 파일 자동 삭제
SELECT cron.schedule('cleanup-inactive-files', '0 3 * * *', $$ SELECT net.http_post(url := 'https://eudjnzonapudhwqaxxym.supabase.co/functions/v1/cleanup-inactive-files', headers := '{"Content-Type": "application/json"}'::jsonb, body := '{}'::jsonb); $$);
