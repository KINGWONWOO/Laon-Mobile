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
    // 호출자 JWT 검증 — anon key만으로는 통과 불가
    const authHeader = req.headers.get('Authorization') ?? ''
    const callerToken = authHeader.replace('Bearer ', '').trim()

    const verifier = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!
    )
    const { data: { user: caller }, error: authError } = await verifier.auth.getUser(callerToken)
    if (authError || !caller) {
      return new Response(JSON.stringify({ error: '인증된 사용자만 호출할 수 있습니다.' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    console.log('[PushFn] Service role key loaded:', !!serviceKey)

    const { user_ids, title, body, data } = await req.json()
    console.log('[PushFn] Request — user_ids:', user_ids, 'title:', title, 'body:', body)

    if (!user_ids || !Array.isArray(user_ids) || user_ids.length === 0) {
      console.warn('[PushFn] Rejected: no user_ids provided')
      return new Response(JSON.stringify({ error: 'No user_ids provided' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: profiles, error: dbError } = await supabase
      .from('profiles')
      .select('id, push_token')
      .in('id', user_ids)
      .not('push_token', 'is', null)

    console.log('[PushFn] DB lookup — queried ids:', user_ids.length, '/ profiles with token:', profiles?.length ?? 0)
    if (dbError) {
      console.error('[PushFn] DB error:', dbError)
      throw dbError
    }
    if (!profiles || profiles.length === 0) {
      console.warn('[PushFn] No push tokens found for user_ids:', user_ids)
      return new Response(JSON.stringify({ success: true, message: 'No valid push tokens found' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const tokens = profiles.map(p => p.push_token)
    console.log('[PushFn] Sending to tokens:', tokens)

    const messages = tokens.map(token => ({
      to: token,
      sound: 'default',
      title: title || '라온 댄스 알림',
      body: body || '',
      data: data || {},
      channelId: 'default',
    }))

    const expoRes = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    })

    const result = await expoRes.json()
    console.log('[PushFn] Expo API response:', JSON.stringify(result))

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
