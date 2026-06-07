-- cleanup-inactive-files Edge Function이 service_role로 접근할 수 있도록 권한 부여
GRANT SELECT, DELETE ON public.videos TO service_role;
GRANT SELECT, DELETE ON public.gallery_items TO service_role;
