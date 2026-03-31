-- =============================================
-- email_verifications 테이블 (이메일 인증 코드 저장)
-- =============================================
CREATE TABLE IF NOT EXISTS public.email_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  code TEXT NOT NULL,
  session_token UUID NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS 비활성화: service_role 및 SECURITY DEFINER 함수로만 접근
ALTER TABLE public.email_verifications DISABLE ROW LEVEL SECURITY;

-- 10분 지난 사용된 코드 자동 정리 인덱스
CREATE INDEX IF NOT EXISTS idx_email_verifications_email ON public.email_verifications (email);
CREATE INDEX IF NOT EXISTS idx_email_verifications_expires ON public.email_verifications (expires_at);


-- =============================================
-- check_email_registered: auth.users 에서 이메일 존재 여부 확인
-- =============================================
CREATE OR REPLACE FUNCTION public.check_email_registered(p_email TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public
AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM auth.users WHERE email = p_email);
END;
$$;

-- 비로그인 상태에서도 호출 가능 (회원가입 전)
GRANT EXECUTE ON FUNCTION public.check_email_registered TO anon, authenticated;


-- =============================================
-- check_email_code: 코드 유효성 확인 (읽기 전용, 부작용 없음)
-- =============================================
CREATE OR REPLACE FUNCTION public.check_email_code(
  p_email TEXT,
  p_code TEXT,
  p_session_token UUID
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.email_verifications
    WHERE email = p_email
      AND code = p_code
      AND session_token = p_session_token
      AND used = FALSE
      AND expires_at > NOW()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_email_code TO anon, authenticated;


-- =============================================
-- consume_email_verification: 코드 사용 처리 (회원 생성 후 호출)
-- service_role에서만 호출 (Edge Function 내부)
-- =============================================
CREATE OR REPLACE FUNCTION public.consume_email_verification(
  p_email TEXT,
  p_session_token UUID
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.email_verifications
  SET used = TRUE
  WHERE email = p_email
    AND session_token = p_session_token
    AND used = FALSE;
END;
$$;
-- anon에게 GRANT하지 않음 → Edge Function(service_role)에서만 호출 가능
