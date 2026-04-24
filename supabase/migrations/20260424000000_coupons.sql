CREATE TABLE IF NOT EXISTS coupons (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  benefit TEXT NOT NULL DEFAULT 'pro',
  duration_days INTEGER NOT NULL DEFAULT 30,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;

-- 인증된 사용자는 코드로 쿠폰 조회 가능 (삽입/수정/삭제는 대시보드에서만)
CREATE POLICY "authenticated users can read coupons"
  ON coupons FOR SELECT
  TO authenticated
  USING (true);

-- 초기 쿠폰 데이터
INSERT INTO coupons (code, benefit, duration_days, is_active)
VALUES ('ALWAYSLAONZENA', 'pro', 365, true);
