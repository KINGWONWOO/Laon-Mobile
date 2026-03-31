import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { email } = await req.json()

    if (!email || !email.includes('@')) {
      return json({ error: 'INVALID_EMAIL' }, 400)
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // 1. 데이터베이스 확인 (RPC 존재 여부 확인)
    const { data: exists, error: rpcError } = await supabase.rpc('check_email_registered', { p_email: email })
    if (rpcError) {
      console.error('RPC 에러:', rpcError)
      return json({ error: `DB_RPC_ERROR: ${rpcError.message}` }, 500)
    }
    
    if (exists) {
      return json({ error: 'EMAIL_EXISTS' }, 400)
    }

    // 6자리 인증 코드 + 세션 토큰 생성
    const code = Math.floor(100000 + Math.random() * 900000).toString()
    const sessionToken = crypto.randomUUID()
    const expiresAt = new Date(Date.now() + 60 * 1000).toISOString() // 60초(1분)으로 변경

    // 3. 테이블 삽입 (기존 코드와 상관없이 새로 삽입, check_email_code에서 최신 것만 체크함)
    // 이전 코드를 삭제해도 되고, 기록을 남겨두고 최신 것만 쓰게 해도 됩니다. 여기서는 깔끔하게 삭제 후 삽입합니다.
    await supabase.from('email_verifications').delete().eq('email', email)
    const { error: insertError } = await supabase.from('email_verifications').insert({
      email,
      code,
      session_token: sessionToken,
      expires_at: expiresAt,
    })
    
    if (insertError) {
      console.error('Insert 에러:', insertError)
      return json({ error: `DB_INSERT_ERROR: ${insertError.message}` }, 500)
    }

    // 4. Resend API 키 확인
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
    if (!RESEND_API_KEY) {
      return json({ error: 'MISSING_RESEND_API_KEY' }, 500)
    }

    const FROM_EMAIL = Deno.env.get('FROM_EMAIL') ?? 'onboarding@resend.dev'

    // 5. 이메일 전송 시도
    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [email],
        subject: '[LAON DANCE] 이메일 인증 코드',
        html: buildEmailHtml(code),
      }),
    })

    if (!emailRes.ok) {
      const errorData = await emailRes.json()
      console.error('Resend 상세 오류:', errorData)
      return json({ error: `RESEND_API_ERROR: ${errorData.message || JSON.stringify(errorData)}` }, 500)
    }

    return json({ sessionToken })
  } catch (err: any) {
    console.error('Unexpected Error:', err)
    return json({ error: `SERVER_ERROR: ${err.message}` }, 500)
  }
})

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function buildEmailHtml(code: string) {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="margin:0;padding:0;background:#0E0C1A;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table width="480" cellpadding="0" cellspacing="0" style="background:#16132A;border-radius:20px;overflow:hidden;border:1px solid #2A2740;">
          <tr>
            <td style="background:linear-gradient(135deg,#21F3A3 0%,#6B4DE6 100%);padding:32px;text-align:center;">
              <h1 style="margin:0;color:#fff;font-size:28px;font-weight:900;letter-spacing:3px;">LAON DANCE</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:40px 36px;">
              <h2 style="margin:0 0 16px;color:#21F3A3;font-size:20px;">이메일 인증 코드</h2>
              <div style="background:#0E0C1A;border:2px solid #21F3A3;border-radius:16px;padding:28px;text-align:center;margin:0 0 28px;">
                <span style="font-size:44px;font-weight:900;letter-spacing:12px;color:#21F3A3;">${code}</span>
              </div>
              <p style="margin:0;color:#888;font-size:13px;text-align:center;">이 코드는 10분 후 만료됩니다.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`
}
