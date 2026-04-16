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

    // 1. 마감 전 알림이 필요한 일정들 조회
    const { data: schedules } = await supabase
      .from('schedules')
      .select('id, room_id, title, deadline, reminder_before, reminder_sent')
      .eq('use_notification', true)
      .is('reminder_sent', false)
      .not('deadline', 'is', null)
      .not('reminder_before', 'is', null)

    // 2. 마감 전 알림이 필요한 투표들 조회
    const { data: votes } = await supabase
      .from('votes')
      .select('id, room_id, question, deadline, reminder_before, reminder_sent')
      .eq('use_notification', true)
      .is('reminder_sent', false)
      .not('deadline', 'is', null)
      .not('reminder_before', 'is', null)

    const results = []

    // 일정 알림 처리
    if (schedules) {
      for (const s of schedules) {
        const deadlineDate = new Date(s.deadline)
        const reminderTime = new Date(deadlineDate.getTime() - s.reminder_before * 60 * 1000)
        
        if (reminderTime <= now) {
          const { data: members } = await supabase.from('room_members').select('user_id').eq('room_id', s.room_id)
          const { data: responses } = await supabase.from('schedule_responses').select('user_id').eq('schedule_id', s.id)
          
          const participantIds = responses?.map(r => r.user_id) || []
          const nonParticipantIds = members?.map(m => m.user_id).filter(id => !participantIds.includes(id)) || []

          if (nonParticipantIds.length > 0) {
            const timeLabel = s.reminder_before >= 60 ? `${s.reminder_before/60}시간 전` : `${s.reminder_before}분 전`
            await supabase.functions.invoke('push-notification', {
              body: { user_ids: nonParticipantIds, title: `일정 조율 마감 ${timeLabel}`, body: `"${s.title}" 일정 조율에 아직 참여하지 않으셨어요!` }
            })
            await supabase.from('schedules').update({ reminder_sent: true }).eq('id', s.id)
            results.push(`Schedule ${s.id}: Reminder sent`)
          } else {
            await supabase.from('schedules').update({ reminder_sent: true }).eq('id', s.id)
          }
        }
      }
    }

    // 투표 알림 처리
    if (votes) {
      for (const v of votes) {
        const deadlineDate = new Date(v.deadline)
        const reminderTime = new Date(deadlineDate.getTime() - v.reminder_before * 60 * 1000)

        if (reminderTime <= now) {
          const { data: members } = await supabase.from('room_members').select('user_id').eq('room_id', v.room_id)
          const { data: responses } = await supabase.from('vote_responses').select('user_id').eq('vote_id', v.id)
          
          const participantIds = responses?.map(r => r.user_id) || []
          const nonParticipantIds = members?.map(m => m.user_id).filter(id => !participantIds.includes(id)) || []

          if (nonParticipantIds.length > 0) {
            const timeLabel = v.reminder_before >= 60 ? `${v.reminder_before/60}시간 전` : `${v.reminder_before}분 전`
            await supabase.functions.invoke('push-notification', {
              body: { user_ids: nonParticipantIds, title: `투표 마감 ${timeLabel}`, body: `"${v.question}" 투표에 아직 참여하지 않으셨어요!` }
            })
            await supabase.from('votes').update({ reminder_sent: true }).eq('id', v.id)
            results.push(`Vote ${v.id}: Reminder sent`)
          } else {
            await supabase.from('votes').update({ reminder_sent: true }).eq('id', v.id)
          }
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
