import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function sendExpoPush(
  supabase: any,
  userIds: string[],
  title: string,
  body: string,
  data: Record<string, unknown> = {}
) {
  if (userIds.length === 0) return

  const { data: profiles } = await supabase
    .from('profiles')
    .select('push_token')
    .in('id', userIds)
    .not('push_token', 'is', null)

  if (!profiles || profiles.length === 0) return

  const messages = profiles.map((p: { push_token: string }) => ({
    to: p.push_token,
    sound: 'default',
    title,
    body,
    data,
    channelId: 'default',
  }))

  await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Accept-encoding': 'gzip, deflate',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(messages),
  })
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
    const results: string[] = []

    // 마감 전 알림이 필요한 일정들 조회 (reminder_sent가 null이거나 false인 것)
    const { data: schedules } = await supabase
      .from('schedules')
      .select('id, room_id, title, deadline, reminder_before, reminder_sent')
      .eq('use_notification', true)
      .or('reminder_sent.is.null,reminder_sent.eq.false')
      .not('deadline', 'is', null)
      .not('reminder_before', 'is', null)
      .gt('reminder_before', 0)

    // 마감 전 알림이 필요한 투표들 조회
    const { data: votes } = await supabase
      .from('votes')
      .select('id, room_id, question, deadline, reminder_before, reminder_sent')
      .eq('use_notification', true)
      .or('reminder_sent.is.null,reminder_sent.eq.false')
      .not('deadline', 'is', null)
      .not('reminder_before', 'is', null)
      .gt('reminder_before', 0)

    // 일정 알림 처리
    if (schedules) {
      for (const s of schedules) {
        const deadlineDate = new Date(s.deadline)
        const reminderTime = new Date(deadlineDate.getTime() - s.reminder_before * 60 * 1000)

        if (reminderTime <= now) {
          const { data: members } = await supabase
            .from('room_members')
            .select('user_id')
            .eq('room_id', s.room_id)

          const { data: responses } = await supabase
            .from('schedule_responses')
            .select('user_id')
            .eq('schedule_id', s.id)

          const { data: room } = await supabase
            .from('rooms')
            .select('name')
            .eq('id', s.room_id)
            .single()

          const participantIds = responses?.map((r: any) => r.user_id) || []
          const nonParticipantIds = members
            ?.map((m: any) => m.user_id)
            .filter((id: string) => !participantIds.includes(id)) || []

          const timeLabel = s.reminder_before >= 60
            ? `${s.reminder_before / 60}시간 전`
            : `${s.reminder_before}분 전`
          const roomName = room?.name || '방'

          if (nonParticipantIds.length > 0) {
            await sendExpoPush(
              supabase,
              nonParticipantIds,
              `[${roomName}] 일정 조율 마감 ${timeLabel}`,
              `"${s.title}" 일정 조율에 아직 참여하지 않으셨어요!`,
              { targetPath: `/room/${s.room_id}/schedule`, roomId: s.room_id }
            )
            results.push(`Schedule ${s.id}: Reminder sent to ${nonParticipantIds.length} members`)
          }

          await supabase.from('schedules').update({ reminder_sent: true }).eq('id', s.id)
        }
      }
    }

    // 투표 알림 처리
    if (votes) {
      for (const v of votes) {
        const deadlineDate = new Date(v.deadline)
        const reminderTime = new Date(deadlineDate.getTime() - v.reminder_before * 60 * 1000)

        if (reminderTime <= now) {
          const { data: members } = await supabase
            .from('room_members')
            .select('user_id')
            .eq('room_id', v.room_id)

          const { data: responses } = await supabase
            .from('vote_responses')
            .select('user_id')
            .eq('vote_id', v.id)

          const { data: room } = await supabase
            .from('rooms')
            .select('name')
            .eq('id', v.room_id)
            .single()

          const participantIds = responses?.map((r: any) => r.user_id) || []
          const nonParticipantIds = members
            ?.map((m: any) => m.user_id)
            .filter((id: string) => !participantIds.includes(id)) || []

          const timeLabel = v.reminder_before >= 60
            ? `${v.reminder_before / 60}시간 전`
            : `${v.reminder_before}분 전`
          const roomName = room?.name || '방'

          if (nonParticipantIds.length > 0) {
            await sendExpoPush(
              supabase,
              nonParticipantIds,
              `[${roomName}] 투표 마감 ${timeLabel}`,
              `"${v.question}" 투표에 아직 참여하지 않으셨어요!`,
              { targetPath: `/room/${v.room_id}/vote`, roomId: v.room_id }
            )
            results.push(`Vote ${v.id}: Reminder sent to ${nonParticipantIds.length} members`)
          }

          await supabase.from('votes').update({ reminder_sent: true }).eq('id', v.id)
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
