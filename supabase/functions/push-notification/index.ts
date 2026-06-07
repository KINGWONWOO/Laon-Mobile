import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type Lang = 'ko' | 'en' | 'es' | 'id' | 'ja' | 'zh' | 'th'
type LangMap = Record<Lang, string>

const titleTemplates: Record<string, LangMap> = {
  notice_new:            { ko: '[{roomName}] 새 공지',          en: '[{roomName}] New Notice',             es: '[{roomName}] Nuevo Aviso',              id: '[{roomName}] Pengumuman Baru',        ja: '[{roomName}] 新しいお知らせ',       zh: '[{roomName}] 新公告',           th: '[{roomName}] ประกาศใหม่' },
  notice_edit:           { ko: '[{roomName}] 공지 수정됨',       en: '[{roomName}] Notice Updated',          es: '[{roomName}] Aviso Actualizado',        id: '[{roomName}] Pengumuman Diperbarui', ja: '[{roomName}] お知らせ更新',         zh: '[{roomName}] 公告已更新',       th: '[{roomName}] อัปเดตประกาศ' },
  notice_comment:        { ko: '[{roomName}] \'{contentTitle}\' 댓글', en: '[{roomName}] Comment on \'{contentTitle}\'', es: '[{roomName}] Comentario en \'{contentTitle}\'', id: '[{roomName}] Komentar di \'{contentTitle}\'', ja: '[{roomName}] \'{contentTitle}\' にコメント', zh: '[{roomName}] \'{contentTitle}\' 新评论', th: '[{roomName}] ความคิดเห็นใน \'{contentTitle}\'' },
  video_new:             { ko: '[{roomName}] 새 영상 피드백',    en: '[{roomName}] New Video Feedback',       es: '[{roomName}] Nuevo Feedback de Video',  id: '[{roomName}] Umpan Balik Video Baru',  ja: '[{roomName}] 新しい動画フィードバック', zh: '[{roomName}] 新视频反馈',       th: '[{roomName}] ฟีดแบควิดีโอใหม่' },
  video_comment:         { ko: '[{roomName}] \'{contentTitle}\' 피드백', en: '[{roomName}] Feedback on \'{contentTitle}\'', es: '[{roomName}] Feedback en \'{contentTitle}\'', id: '[{roomName}] Umpan Balik \'{contentTitle}\'', ja: '[{roomName}] \'{contentTitle}\' フィードバック', zh: '[{roomName}] \'{contentTitle}\' 的反馈', th: '[{roomName}] ฟีดแบค \'{contentTitle}\'' },
  archive_new:           { ko: '[{roomName}] 새 아카이브',       en: '[{roomName}] New Archive',              es: '[{roomName}] Nuevo Archivo',            id: '[{roomName}] Arsip Baru',             ja: '[{roomName}] 新しいアーカイブ',     zh: '[{roomName}] 新归档',           th: '[{roomName}] ไฟล์ใหม่' },
  archive_comment:       { ko: '[{roomName}] 아카이브 댓글',     en: '[{roomName}] Archive Comment',          es: '[{roomName}] Comentario en Archivo',    id: '[{roomName}] Komentar Arsip',         ja: '[{roomName}] アーカイブコメント',   zh: '[{roomName}] 归档评论',         th: '[{roomName}] ความคิดเห็นไฟล์' },
  vote_new:              { ko: '[{roomName}] 새 투표',           en: '[{roomName}] New Vote',                 es: '[{roomName}] Nueva Votación',           id: '[{roomName}] Voting Baru',            ja: '[{roomName}] 新しい投票',           zh: '[{roomName}] 新投票',           th: '[{roomName}] โหวตใหม่' },
  vote_closed:           { ko: '[{roomName}] 투표 종료',         en: '[{roomName}] Vote Ended',               es: '[{roomName}] Votación Terminada',       id: '[{roomName}] Voting Berakhir',        ja: '[{roomName}] 投票終了',             zh: '[{roomName}] 投票结束',         th: '[{roomName}] โหวตสิ้นสุด' },
  schedule_new:          { ko: '[{roomName}] 새 일정 조율',      en: '[{roomName}] New Schedule',             es: '[{roomName}] Nuevo Horario',            id: '[{roomName}] Jadwal Baru',            ja: '[{roomName}] 新しいスケジュール',   zh: '[{roomName}] 新日程',           th: '[{roomName}] ตารางเวลาใหม่' },
  schedule_closed:       { ko: '[{roomName}] 일정 조율 종료',    en: '[{roomName}] Schedule Ended',           es: '[{roomName}] Horario Terminado',        id: '[{roomName}] Jadwal Berakhir',        ja: '[{roomName}] スケジュール終了',     zh: '[{roomName}] 日程结束',         th: '[{roomName}] ตารางเวลาสิ้นสุด' },
  response_request:      { ko: '[{roomName}] 응답 요청',         en: '[{roomName}] Response Needed',          es: '[{roomName}] Respuesta Necesaria',      id: '[{roomName}] Respons Diperlukan',     ja: '[{roomName}] 返答が必要',           zh: '[{roomName}] 需要回应',         th: '[{roomName}] ต้องการการตอบสนอง' },
  schedule_reminder:     { ko: '[{roomName}] 일정 마감 {timeLabel} 전', en: '[{roomName}] Schedule deadline in {timeLabel}', es: '[{roomName}] Fecha límite de horario en {timeLabel}', id: '[{roomName}] Batas jadwal dalam {timeLabel}', ja: '[{roomName}] スケジュール締切まで {timeLabel}', zh: '[{roomName}] 日程截止还有 {timeLabel}', th: '[{roomName}] กำหนดตารางใน {timeLabel}' },
  vote_reminder:         { ko: '[{roomName}] 투표 마감 {timeLabel} 전', en: '[{roomName}] Vote deadline in {timeLabel}',     es: '[{roomName}] Fecha límite de votación en {timeLabel}', id: '[{roomName}] Batas voting dalam {timeLabel}',  ja: '[{roomName}] 投票締切まで {timeLabel}',          zh: '[{roomName}] 投票截止还有 {timeLabel}',  th: '[{roomName}] กำหนดโหวตใน {timeLabel}' },
  unread_reminder_schedule: { ko: '[{roomName}] 읽지 않은 일정', en: '[{roomName}] Unread Schedule',          es: '[{roomName}] Horario No Leído',         id: '[{roomName}] Jadwal Belum Dibaca',    ja: '[{roomName}] 未読スケジュール',      zh: '[{roomName}] 未读日程',         th: '[{roomName}] ตารางที่ยังไม่ได้อ่าน' },
  unread_reminder_vote:  { ko: '[{roomName}] 읽지 않은 투표',   en: '[{roomName}] Unread Vote',              es: '[{roomName}] Votación No Leída',        id: '[{roomName}] Voting Belum Dibaca',    ja: '[{roomName}] 未読投票',              zh: '[{roomName}] 未读投票',         th: '[{roomName}] โหวตที่ยังไม่ได้อ่าน' },
}

const bodyTemplates: Record<string, LangMap> = {
  vote_closed: {
    ko: '"{contentTitle}" 투표가 종료되었습니다.',
    en: 'The "{contentTitle}" vote has ended.',
    es: 'La votación "{contentTitle}" ha terminado.',
    id: 'Voting "{contentTitle}" telah berakhir.',
    ja: '「{contentTitle}」の投票が終了しました。',
    zh: '"{contentTitle}" 投票已结束。',
    th: 'โหวต "{contentTitle}" สิ้นสุดแล้ว',
  },
  schedule_closed: {
    ko: '"{contentTitle}" 일정 조율이 종료되었습니다.',
    en: 'The "{contentTitle}" schedule coordination has ended.',
    es: 'La coordinación "{contentTitle}" ha terminado.',
    id: 'Koordinasi jadwal "{contentTitle}" telah berakhir.',
    ja: '「{contentTitle}」のスケジュール調整が終了しました。',
    zh: '"{contentTitle}" 日程协调已结束。',
    th: 'การประสานตาราง "{contentTitle}" สิ้นสุดแล้ว',
  },
  response_request_vote: {
    ko: '"{contentTitle}" 투표에 아직 참여하지 않으셨어요! 확인 부탁드려요!',
    en: 'You haven\'t voted in "{contentTitle}" yet! Please check it!',
    es: '¡Aún no has votado en "{contentTitle}"! ¡Por favor revísalo!',
    id: 'Anda belum berpartisipasi dalam voting "{contentTitle}"! Mohon dicek!',
    ja: '「{contentTitle}」の投票にまだ参加していません！確認してください！',
    zh: '您还没有参加 "{contentTitle}" 投票！请查看！',
    th: 'คุณยังไม่ได้โหวตใน "{contentTitle}"! กรุณาตรวจสอบ!',
  },
  response_request_schedule: {
    ko: '"{contentTitle}" 일정 조율에 아직 참여하지 않으셨어요! 확인 부탁드려요!',
    en: 'You haven\'t joined the "{contentTitle}" schedule yet! Please check it!',
    es: '¡Aún no te has unido a la coordinación "{contentTitle}"! ¡Por favor revísalo!',
    id: 'Anda belum bergabung dalam koordinasi jadwal "{contentTitle}"! Mohon dicek!',
    ja: '「{contentTitle}」のスケジュール調整にまだ参加していません！確認してください！',
    zh: '您还没有参加 "{contentTitle}" 日程协调！请查看！',
    th: 'คุณยังไม่ได้เข้าร่วมการประสาน "{contentTitle}"! กรุณาตรวจสอบ!',
  },
  schedule_reminder: {
    ko: '"{contentTitle}" 일정 조율에 아직 참여하지 않으셨어요!',
    en: 'You haven\'t joined the "{contentTitle}" schedule yet!',
    es: '¡Aún no te has unido a la coordinación "{contentTitle}"!',
    id: 'Anda belum bergabung dalam koordinasi jadwal "{contentTitle}"!',
    ja: '「{contentTitle}」のスケジュール調整にまだ参加していません！',
    zh: '您还没有参加 "{contentTitle}" 日程协调！',
    th: 'คุณยังไม่ได้เข้าร่วมการประสาน "{contentTitle}"!',
  },
  vote_reminder: {
    ko: '"{contentTitle}" 투표에 아직 참여하지 않으셨어요!',
    en: 'You haven\'t voted in "{contentTitle}" yet!',
    es: '¡Aún no has votado en "{contentTitle}"!',
    id: 'Anda belum berpartisipasi dalam voting "{contentTitle}"!',
    ja: '「{contentTitle}」の投票にまだ参加していません！',
    zh: '您还没有参加 "{contentTitle}" 投票！',
    th: 'คุณยังไม่ได้โหวตใน "{contentTitle}"!',
  },
  unread_reminder_schedule: {
    ko: '"{contentTitle}" 일정 조율을 아직 확인하지 않으셨어요!',
    en: 'You haven\'t checked the "{contentTitle}" schedule yet!',
    es: '¡Aún no has revisado el horario "{contentTitle}"!',
    id: 'Anda belum memeriksa jadwal "{contentTitle}"!',
    ja: '「{contentTitle}」のスケジュールをまだ確認していません！',
    zh: '您还没有查看 "{contentTitle}" 日程！',
    th: 'คุณยังไม่ได้ตรวจสอบตาราง "{contentTitle}"!',
  },
  unread_reminder_vote: {
    ko: '"{contentTitle}" 투표를 아직 확인하지 않으셨어요!',
    en: 'You haven\'t checked the "{contentTitle}" vote yet!',
    es: '¡Aún no has revisado la votación "{contentTitle}"!',
    id: 'Anda belum memeriksa voting "{contentTitle}"!',
    ja: '「{contentTitle}」の投票をまだ確認していません！',
    zh: '您还没有查看 "{contentTitle}" 投票！',
    th: 'คุณยังไม่ได้ตรวจสอบโหวต "{contentTitle}"!',
  },
}

function getTimeLabel(lang: Lang, minutes: number): string {
  const labels: Record<Lang, (h: number, m: number) => string> = {
    ko: (h, m) => h > 0 ? `${h}시간` : `${m}분`,
    en: (h, m) => h > 0 ? `${h}h` : `${m}m`,
    es: (h, m) => h > 0 ? `${h}h` : `${m}min`,
    id: (h, m) => h > 0 ? `${h} jam` : `${m} menit`,
    ja: (h, m) => h > 0 ? `${h}時間` : `${m}分`,
    zh: (h, m) => h > 0 ? `${h}小时` : `${m}分钟`,
    th: (h, m) => h > 0 ? `${h} ชม.` : `${m} นาที`,
  }
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return labels[lang]?.(h, m) ?? (h > 0 ? `${h}h` : `${m}m`)
}

function fillTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? '')
}

function buildTranslatedMessage(
  notificationType: string,
  vars: Record<string, any>,
  lang: Lang
): { title: string; body: string } {
  const safeVars: Record<string, string> = {}
  for (const [k, v] of Object.entries(vars)) {
    safeVars[k] = String(v ?? '')
  }

  if (vars.reminderBefore !== undefined) {
    safeVars.timeLabel = getTimeLabel(lang, Number(vars.reminderBefore))
  }

  const titleMap = titleTemplates[notificationType]
  const title = titleMap ? fillTemplate(titleMap[lang] ?? titleMap.ko, safeVars) : ''

  // Determine body template key (response_request splits by subtype)
  let bodyKey = notificationType
  if (notificationType === 'response_request') {
    bodyKey = vars.subtype === 'vote' ? 'response_request_vote' : 'response_request_schedule'
  }

  const bodyMap = bodyTemplates[bodyKey]
  let body: string
  if (bodyMap) {
    body = fillTemplate(bodyMap[lang] ?? bodyMap.ko, safeVars)
  } else {
    // Default: actorName: content
    body = safeVars.actorName && safeVars.content
      ? `${safeVars.actorName}: ${safeVars.content}`
      : safeVars.content ?? ''
  }

  return { title, body }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Verify caller is authenticated
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

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const payload = await req.json()
    const { user_ids, notification_type, vars, data: notifData, title: rawTitle, body: rawBody } = payload

    // Fallback: resolve room name from DB if missing in vars
    const safeVarsBase: Record<string, any> = vars || {}
    if (notification_type && (!safeVarsBase.roomName || safeVarsBase.roomName === '') && notifData?.roomId) {
      const { data: roomRow } = await supabase.from('rooms').select('name').eq('id', notifData.roomId).single()
      if (roomRow?.name) safeVarsBase.roomName = roomRow.name
    }

    if (!user_ids || !Array.isArray(user_ids) || user_ids.length === 0) {
      return new Response(JSON.stringify({ error: 'No user_ids provided' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Fetch profiles (language is needed for everyone, push_token for those who have it)
    const { data: profiles, error: dbError } = await supabase
      .from('profiles')
      .select('id, push_token, language')
      .in('id', user_ids)

    if (dbError) throw dbError
    if (!profiles || profiles.length === 0) {
      return new Response(JSON.stringify({ success: true, message: 'No profiles found' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const pushMessages: any[] = []
    const dbNotifications: any[] = []

    for (const p of profiles) {
      let title: string
      let body: string

      if (notification_type) {
        const lang = (p.language || 'ko') as Lang
        const translated = buildTranslatedMessage(notification_type, safeVarsBase, lang)
        title = translated.title
        body = translated.body
      } else {
        title = rawTitle || '라온 댄스 알림'
        body = rawBody || ''
      }

      // Add to push messages if token exists
      if (p.push_token) {
        pushMessages.push({
          to: p.push_token,
          sound: 'default',
          title,
          body,
          data: notifData || {},
          channelId: 'default',
        })
      }

      // Add to DB notifications for everyone
      dbNotifications.push({
        user_id: p.id,
        room_id: notifData?.roomId || null,
        room_name: safeVarsBase.roomName || '',
        type: notification_type || 'general',
        title,
        body,
        target_path: notifData?.targetPath || null,
      })
    }

    // Insert into DB notifications
    if (dbNotifications.length > 0) {
      const { error: insertErr } = await supabase.from('notifications').insert(dbNotifications)
      if (insertErr) console.error('[PushFn] DB notification insert error:', insertErr.message)
    }

    // Send push notifications via Expo
    let expoResult = { success: true, sentCount: 0 }
    if (pushMessages.length > 0) {
      const expoRes = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(pushMessages),
      })
      const result = await expoRes.json()
      console.log('[PushFn] Expo API response:', JSON.stringify(result))
      expoResult = result
    }

    return new Response(JSON.stringify(expoResult), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
