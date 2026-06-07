-- Edge Function(deadline-reminder)이 service_role로 테이블에 접근할 수 있도록 권한 부여
GRANT SELECT, UPDATE ON public.schedules TO service_role;
GRANT SELECT, UPDATE ON public.votes TO service_role;
GRANT SELECT ON public.room_members TO service_role;
GRANT SELECT ON public.rooms TO service_role;
GRANT SELECT ON public.profiles TO service_role;
