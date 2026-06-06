import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type Lang = 'ko' | 'en' | 'es' | 'id' | 'ja' | 'zh' | 'th'

const scheduleTitles: Record<Lang, string> = {
  ko: '[{roomName}] 일정 마감 {timeLabel} 전', en: '[{roomName}] Schedule deadline in {timeLabel}',
  es: '[{roomName}] Fecha límite de horario en {timeLabel}', id: '[{roomName}] Batas jadwal dalam {timeLabel}',
  ja: '[{roomName}] スケジュール締切まで {timeLabel}', zh: '[{roomName}] 日程截止还有 {timeLabel}', th: '[{roomName}] กำหนดตารางใน {timeLabel}',
}
const voteTitles: Record<Lang, string> = {
  ko: '[{roomName}] 투표 마감 {timeLabel} 전', en: '[{roomName}] Vote deadline in {timeLabel}',
  es: '[{roomName}] Fecha límite de votación en {timeLabel}', id: '[{roomName}] Batas voting dalam {timeLabel}',
  ja: '[{roomName}] 投票締切まで {timeLabel}', zh: '[{roomName}] 投票截止还有 {timeLabel}', th: '[{roomName}] กำหนดโหวตใน {timeLabel}',
}
const scheduleBodies: Record<Lang, string> = {
  ko: '"{title}" 일정 조율에 아직 참여하지 않으셨어요!', en: 'You haven\'t joined the "{title}" schedule yet!',
  es: '¡Aún no te has unido a la coordinación "{title}"!', id: 'Anda belum bergabung dalam koordinasi jadwal "{title}"!',
  ja: '「{title}」のスケジュール調整にまだ参加していません！', zh: '您还没有参加 "{title}" 日程协调！', th: 'คุณยังไม่ได้เข้าร่วมการประสาน "{title}"!',
}
const voteBodies: Record<Lang, string> = {
  ko: '"{title}" 투표에 아직 참여하지 않으셨어요!', en: 'You haven\'t voted in "{title}" yet!',
  es: '¡Aún no has votado en "{title}"!', id: 'Anda belum berpartisipasi dalam voting "{title}"!',
  ja: '「{title}」の投票にまだ参加していません！', zh: '您还没有参加 "{title}" 投票！', th: 'คุณยังไม่ได้โหวตใน "{title}"!',
}

function getTimeLabel(lang: Lang, minutes: number): string {
  const h = Math.floor(minutes / 60), m = minutes % 60
  const labels: Record<Lang, (h: number, m: number) => string> = {
    ko: (h, m) => h > 0 ? `${h}시간` : `${m}분`, en: (h, m) => h > 0 ? `${h}h` : `${m}m`,
    es: (h, m) => h > 0 ? `${h}h` : `${m}min`, id: (h, m) => h > 0 ? `${h} jam` : `${m} menit`,
    ja: (h, m) => h > 0 ? `${h}時間` : `${m}分`, zh: (h, m) => h > 0 ? `${h}小时` : `${m}分钟`,
    th: (h, m) => h > 0 ? `${h} ชม.` : `${m} นาที`,
  }
  return labels[lang]?.(h, m) ?? (h > 0 ? `${h}h` : `${m}m`)
}

function fill(tmpl: string, vars: Record<string, string>): string {
  return tmpl.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '')
}

async function sendExpoPush(
  supabase: any,
  userIds: string[],
  roomName: string,
  contentTitle: string,
  reminderBefore: number,
  type: 'schedule' | 'vote',
  data: Record<string, unknown> = {}
) {
  if (userIds.length === 0) return

  const { data: profiles } = await supabase
    .from('profiles')
    .select('push_token, language')
    .in('id', userIds)
    .not('push_token', 'is', null)

  if (!profiles || profiles.length === 0) return

  const messages = profiles.map((p: { push_token: string; language: string | null }) => {
    const lang = ((p.language || 'ko') as Lang)
    const timeLabel = getTimeLabel(lang, reminderBefore)
    const vars = { roomName, title: contentTitle, timeLabel }
    const titleTpl = type === 'schedule' ? scheduleTitles[lang] ?? scheduleTitles.ko : voteTitles[lang] ?? voteTitles.ko
    const bodyTpl = type === 'schedule' ? scheduleBodies[lang] ?? scheduleBodies.ko : voteBodies[lang] ?? voteBodies.ko
    return {
      to: p.push_token,
      sound: 'default',
      title: fill(titleTpl, vars),
      body: fill(bodyTpl, vars),
      data,
      channelId: 'default',
    }
  })

  await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Accept': 'application/json', 'Accept-encoding': 'gzip, deflate', 'Content-Type': 'application/json' },
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

        // 리마인더 시간이 됐고 마감기한이 아직 지나지 않은 것만 처리
        if (reminderTime <= now && deadlineDate > now) {
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

          const roomName = room?.name || '방'

          if (nonParticipantIds.length > 0) {
            await sendExpoPush(supabase, nonParticipantIds, roomName, s.title, s.reminder_before, 'schedule', { targetPath: `/room/${s.room_id}/schedule`, roomId: s.room_id })
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

        // 리마인더 시간이 됐고 마감기한이 아직 지나지 않은 것만 처리
        if (reminderTime <= now && deadlineDate > now) {
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

          const roomName = room?.name || '방'

          if (nonParticipantIds.length > 0) {
            await sendExpoPush(supabase, nonParticipantIds, roomName, v.question, v.reminder_before, 'vote', { targetPath: `/room/${v.room_id}/vote`, roomId: v.room_id })
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
