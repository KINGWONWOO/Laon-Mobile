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
    const { user_ids, title, body, data } = await req.json()

    if (!user_ids || !Array.isArray(user_ids) || user_ids.length === 0) {
      return new Response(JSON.stringify({ error: 'No user_ids provided' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // 1. 유저들의 푸시 토큰 조회
    const { data: profiles, error: dbError } = await supabase
      .from('profiles')
      .select('push_token')
      .in('id', user_ids)
      .not('push_token', 'is', null)

    if (dbError) throw dbError
    if (!profiles || profiles.length === 0) {
      return new Response(JSON.stringify({ success: true, message: 'No valid push tokens found' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const tokens = profiles.map(p => p.push_token)

    // 2. Expo Push API 호출
    const messages = tokens.map(token => ({
      to: token,
      sound: 'default',
      title: title || '라온 댄스 알림',
      body: body || '',
      data: data || {},
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
