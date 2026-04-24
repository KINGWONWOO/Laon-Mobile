import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-user-token',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const res = (data: any, status = 200) => new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const body = await req.json().catch(() => ({}))
    const userToken = req.headers.get('x-user-token') || body.user_token || ''

    console.log(`[Edge] Received token length: ${userToken.length}`);

    if (!userToken || userToken.length < 50) {
      return res({ success: false, error: '유효한 유저 토큰이 전달되지 않았습니다.' }, 400)
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: { user }, error: authError } = await adminClient.auth.getUser(userToken)

    if (authError || !user) {
      console.error('[Edge] Auth.getUser failure:', authError?.message)
      return res({
        success: false,
        error: '유저 인증 실패: ' + (authError?.message || '토큰이 유효하지 않습니다.'),
        token_prefix: userToken.substring(0, 20)
      }, 401)
    }

    const userId = user.id
    console.log(`[Edge] Verified User: ${userId}. Starting full account deletion...`)

    // user_id NOT NULL + ON DELETE SET NULL 충돌을 피하기 위해
    // auth.users 삭제 전에 관련 데이터를 모두 직접 삭제합니다.

    // 1. 댓글 (부모 테이블보다 먼저 삭제)
    await adminClient.from('notice_comments').delete().eq('user_id', userId)
    await adminClient.from('video_comments').delete().eq('user_id', userId)

    // 2. 콘텐츠 (삭제 시 하위 댓글/옵션/응답 cascade)
    await adminClient.from('notices').delete().eq('user_id', userId)
    await adminClient.from('videos').delete().eq('user_id', userId)
    await adminClient.from('gallery_items').delete().eq('user_id', userId)
    await adminClient.from('formations').delete().eq('user_id', userId)
    await adminClient.from('schedules').delete().eq('user_id', userId)
    await adminClient.from('votes').delete().eq('user_id', userId)

    // 3. 방 멤버십 제거
    await adminClient.from('room_members').delete().eq('user_id', userId)

    // 4. 방장인 방 삭제 (멤버, 콘텐츠 전체 cascade)
    await adminClient.from('rooms').delete().eq('leader_id', userId)

    // 5. 프로필 삭제 (gallery_comments.user_id → profiles(id) ON DELETE CASCADE 처리)
    await adminClient.from('profiles').delete().eq('id', userId)

    // 6. 인증 계정 삭제 (이 시점에 user_id를 참조하는 행이 없음)
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId)
    if (deleteError) throw deleteError

    console.log(`[Edge] User ${userId} fully deleted.`)
    return res({ success: true })

  } catch (err: any) {
    console.error('[Edge] Critical server error:', err)
    return res({ success: false, error: '서버 오류가 발생했습니다.', details: err.message }, 500)
  }
})
