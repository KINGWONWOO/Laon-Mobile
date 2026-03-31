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
    const { email, code, sessionToken, password, name, phone } = await req.json()

    if (!email || !code || !sessionToken || !password || !name) {
      return json({ error: 'MISSING_FIELDS' }, 400)
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // 코드 유효성 재확인 (이 세션 토큰 + 이메일 + 코드 조합만 통과)
    const { data: isValid, error: checkError } = await supabase.rpc('check_email_code', {
      p_email: email,
      p_code: code,
      p_session_token: sessionToken,
    })

    if (checkError || !isValid) {
      return json({ error: 'INVALID_CODE' }, 400)
    }

    // admin API로 이메일 인증이 완료된 유저 생성 (자체 인증 완료이므로 email_confirm: true)
    const { data: userData, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, phone: phone ?? '' },
    })

    if (createError) {
      return json({ error: createError.message }, 400)
    }

    // 코드 소비 처리 (재사용 방지)
    await supabase.rpc('consume_email_verification', {
      p_email: email,
      p_session_token: sessionToken,
    })

    return json({ userId: userData.user.id })
  } catch (err: any) {
    console.error(err)
    return json({ error: err.message ?? 'UNKNOWN_ERROR' }, 500)
  }
})

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
