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
  ko: '"{title}" 일정 마감까지 {timeLabel} 남았어요!', en: '"{title}" schedule deadline is in {timeLabel}!',
  es: '¡Quedan {timeLabel} para "{title}"!', id: 'Tersisa {timeLabel} untuk "{title}"!',
  ja: '「{title}」の締切まであと{timeLabel}！', zh: '"{title}" 截止还有 {timeLabel}！', th: '"{title}" เหลือเวลา {timeLabel}!',
}
const voteBodies: Record<Lang, string> = {
  ko: '"{title}" 투표 마감까지 {timeLabel} 남았어요!', en: '"{title}" vote deadline is in {timeLabel}!',
  es: '¡Quedan {timeLabel} para votar "{title}"!', id: 'Tersisa {timeLabel} untuk voting "{title}"!',
  ja: '「{title}」投票締切まであと{timeLabel}！', zh: '"{title}" 投票截止还有 {timeLabel}！', th: '"{title}" โหวตเหลือเวลา {timeLabel}!',
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

async function sendNotifications(
  supabase: any,
  userIds: string[],
  roomName: string,
  roomId: string,
  contentTitle: string,
  reminderBefore: number,
  type: 'schedule' | 'vote',
  targetPath: string
): Promise<string> {
  if (userIds.length === 0) return 'skipped: no userIds'

  const { data: profiles, error: profileErr } = await supabase
    .from('profiles')
    .select('id, push_token, language')
    .in('id', userIds)

  if (profileErr) return `profile query error: ${profileErr.message}`
  if (!profiles || profiles.length === 0) return `no profiles found for userIds`

  const pushMessages: any[] = []
  const dbNotifications: any[] = []

  for (const p of profiles) {
    const lang = ((p.language || 'ko') as Lang)
    const timeLabel = getTimeLabel(lang, reminderBefore)
    const vars = { roomName, title: contentTitle, timeLabel }
    
    const titleTpl = type === 'schedule' ? scheduleTitles[lang] ?? scheduleTitles.ko : voteTitles[lang] ?? voteTitles.ko
    const bodyTpl = type === 'schedule' ? scheduleBodies[lang] ?? scheduleBodies.ko : voteBodies[lang] ?? voteBodies.ko
    
    const finalTitle = fill(titleTpl, vars)
    const finalBody = fill(bodyTpl, vars)

    if (p.push_token) {
      pushMessages.push({
        to: p.push_token,
        sound: 'default',
        title: finalTitle,
        body: finalBody,
        data: { targetPath, roomId },
        channelId: 'default',
      })
    }

    dbNotifications.push({
      user_id: p.id,
      room_id: roomId,
      room_name: roomName,
      type: type === 'schedule' ? 'schedule_reminder' : 'vote_reminder',
      title: finalTitle,
      body: finalBody,
      target_path: targetPath,
    })
  }

  if (dbNotifications.length > 0) {
    const { error: dbErr } = await supabase.from('notifications').insert(dbNotifications)
    if (dbErr) console.error('[deadline-reminder] DB notification error:', dbErr.message)
  }

  if (pushMessages.length > 0) {
    console.log('[Push] Sending to Expo:', JSON.stringify(pushMessages))
    try {
      const expoRes = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Accept': 'application/json', 'Accept-encoding': 'gzip, deflate', 'Content-Type': 'application/json' },
        body: JSON.stringify(pushMessages),
      })
      const expoBody = await expoRes.json()
      console.log('[Push] Expo response:', JSON.stringify(expoBody))
    } catch (e: any) {
      console.error('[Push] Expo fetch error:', e.message)
    }
  }

  return `Processed ${profiles.length} users`
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('[deadline-reminder] Function invoked at', new Date().toISOString())

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
      global: {
        headers: { Authorization: `Bearer ${serviceRoleKey}` },
      },
    })

    const url = new URL(req.url)
    const testMode = url.searchParams.get('test') === 'true'
    const now = new Date()
    const results: string[] = []

    if (testMode) console.log('[deadline-reminder] ⚠️ TEST MODE — 시간 조건 무시')

    // 1. Schedules
    let schedulesQuery = supabase
      .from('schedules')
      .select('id, room_id, title, deadline, reminder_before, reminder_sent')
      .not('reminder_before', 'is', null)
      .gt('reminder_before', 0)

    if (!testMode) {
      schedulesQuery = schedulesQuery
        .not('reminder_sent', 'is', true)
        .not('deadline', 'is', null)
    }

    const { data: schedules, error: schedErr } = await schedulesQuery

    console.log('[deadline-reminder] schedules found:', schedules?.length ?? 0, schedErr ? `error: ${JSON.stringify(schedErr)}` : 'ok')
    results.push(`[진단] schedules_found: ${schedules?.length ?? 0}${schedErr ? `, error: ${JSON.stringify(schedErr)}` : ''}`)

    if (schedules) {
      for (const s of schedules) {
        const deadlineDate = s.deadline ? new Date(s.deadline) : null
        const reminderTime = deadlineDate ? new Date(deadlineDate.getTime() - s.reminder_before * 60 * 1000) : null
        const conditionMet = testMode
          || (!!deadlineDate && !!reminderTime && reminderTime <= now && deadlineDate > now)

        if (conditionMet) {
          const { data: members } = await supabase.from('room_members').select('user_id').eq('room_id', s.room_id)
          const { data: room } = await supabase.from('rooms').select('name').eq('id', s.room_id).single()

          const allMemberIds = members?.map((m: any) => m.user_id) || []
          const roomName = room?.name || '방'

          const result = await sendNotifications(
            supabase, 
            allMemberIds, 
            roomName, 
            s.room_id, 
            s.title, 
            s.reminder_before, 
            'schedule', 
            `/room/${s.room_id}/schedule`
          )
          results.push(`Schedule "${s.title}": ${result}`)
          await supabase.from('schedules').update({ reminder_sent: true }).eq('id', s.id)
        }
      }
    }

    // 2. Votes
    let votesQuery = supabase
      .from('votes')
      .select('id, room_id, question, deadline, reminder_before, reminder_sent')
      .not('reminder_before', 'is', null)
      .gt('reminder_before', 0)

    if (!testMode) {
      votesQuery = votesQuery
        .not('reminder_sent', 'is', true)
        .not('deadline', 'is', null)
    }

    const { data: votes, error: votesErr } = await votesQuery
    results.push(`[진단] votes_found: ${votes?.length ?? 0}${votesErr ? `, error: ${JSON.stringify(votesErr)}` : ''}`)

    if (votesErr) console.error('[deadline-reminder] votes query error:', votesErr.message)

    if (votes) {
      for (const v of votes) {
        const deadlineDate = v.deadline ? new Date(v.deadline) : null
        const reminderTime = deadlineDate ? new Date(deadlineDate.getTime() - v.reminder_before * 60 * 1000) : null
        const conditionMet = testMode
          || (!!deadlineDate && !!reminderTime && reminderTime <= now && deadlineDate > now)

        if (conditionMet) {
          const { data: members } = await supabase.from('room_members').select('user_id').eq('room_id', v.room_id)
          const { data: room } = await supabase.from('rooms').select('name').eq('id', v.room_id).single()

          const allMemberIds = members?.map((m: any) => m.user_id) || []
          const roomName = room?.name || '방'

          const result = await sendNotifications(
            supabase, 
            allMemberIds, 
            roomName, 
            v.room_id, 
            v.question, 
            v.reminder_before, 
            'vote', 
            `/room/${v.room_id}/vote`
          )
          results.push(`Vote "${v.question}": ${result}`)
          await supabase.from('votes').update({ reminder_sent: true }).eq('id', v.id)
        }
      }
    }

    console.log('[deadline-reminder] Done. results:', results)
    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    console.error('[deadline-reminder] Uncaught error:', err.message)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
