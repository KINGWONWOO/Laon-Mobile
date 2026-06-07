SELECT cron.unschedule(10);

SELECT cron.schedule('deadline-reminder', '*/10 * * * *', $$ SELECT net.http_post(url := 'https://eudjnzonapudhwqaxxym.supabase.co/functions/v1/deadline-reminder', headers := '{"Content-Type": "application/json"}'::jsonb, body := '{}'::jsonb); $$);
