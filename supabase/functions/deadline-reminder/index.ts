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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const now = new Date()
    const thirtyMinsLater = new Date(now.getTime() + 30 * 60 * 1000)
    const thirtyOneMinsLater = new Date(now.getTime() + 31 * 60 * 1000)

    // 1. 마감이 약 30분 남은 일정들 조회
    const { data: schedules } = await supabase
      .from('schedules')
      .select('id, room_id, title, deadline')
      .eq('use_notification', true)
      .gte('deadline', thirtyMinsLater.toISOString())
      .lt('deadline', thirtyOneMinsLater.toISOString())

    // 2. 마감이 약 30분 남은 투표들 조회
    const { data: votes } = await supabase
      .from('votes')
      .select('id, room_id, question, deadline')
      .eq('use_notification', true)
      .gte('deadline', thirtyMinsLater.toISOString())
      .lt('deadline', thirtyOneMinsLater.toISOString())

    const results = []

    // 일정 알림 처리
    if (schedules) {
      for (const s of schedules) {
        // 방 멤버 조회
        const { data: members } = await supabase.from('room_members').select('user_id').eq('room_id', s.room_id)
        // 참여자 조회
        const { data: responses } = await supabase.from('schedule_responses').select('user_id').eq('schedule_id', s.id)
        
        const participantIds = responses?.map(r => r.user_id) || []
        const nonParticipantIds = members?.map(m => m.user_id).filter(id => !participantIds.includes(id)) || []

        if (nonParticipantIds.length > 0) {
          await supabase.functions.invoke('push-notification', {
            body: { user_ids: nonParticipantIds, title: '일정 투표 마감 30분 전', body: `"${s.title}" 투표에 아직 참여하지 않으셨어요!` }
          })
          results.push(`Schedule ${s.id}: Sent to ${nonParticipantIds.length} users`)
        }
      }
    }

    // 투표 알림 처리
    if (votes) {
      for (const v of votes) {
        const { data: members } = await supabase.from('room_members').select('user_id').eq('room_id', v.room_id)
        const { data: responses } = await supabase.from('vote_responses').select('user_id').eq('vote_id', v.id)
        
        const participantIds = responses?.map(r => r.user_id) || []
        const nonParticipantIds = members?.map(m => m.user_id).filter(id => !participantIds.includes(id)) || []

        if (nonParticipantIds.length > 0) {
          await supabase.functions.invoke('push-notification', {
            body: { user_ids: nonParticipantIds, title: '투표 마감 30분 전', body: `"${v.question}" 투표에 아직 참여하지 않으셨어요!` }
          })
          results.push(`Vote ${v.id}: Sent to ${nonParticipantIds.length} users`)
        }
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
