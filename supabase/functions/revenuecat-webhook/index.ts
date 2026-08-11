import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

const RC_WEBHOOK_SECRET = Deno.env.get('REVENUECAT_WEBHOOK_SECRET') ?? '';

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('OK', { status: 200 });
  }

  const authHeader = req.headers.get('Authorization') ?? '';
  if (!RC_WEBHOOK_SECRET || authHeader !== `Bearer ${RC_WEBHOOK_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response('Bad Request', { status: 400 });
  }

  const event = body?.event;
  if (!event) return new Response('OK', { status: 200 });

  const {
    type,
    app_user_id: userId,
    expiration_at_ms: expirationMs,
  } = event;

  if (!userId) return new Response('OK', { status: 200 });

  console.log(`[RC Webhook] type=${type} userId=${userId} expirationMs=${expirationMs}`);

  switch (type) {
    // 구독 활성화
    case 'INITIAL_PURCHASE':
    case 'RENEWAL':
    case 'UNCANCELLATION': {
      const expiry = expirationMs
        ? new Date(expirationMs).toISOString()
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      await supabase.from('profiles').update({
        subscription_tier: 'pro',
        subscription_start: new Date().toISOString(),
        subscription_expiry: expiry,
      }).eq('id', userId);
      break;
    }

    // 플랜 변경 (업그레이드/다운그레이드)
    case 'PRODUCT_CHANGE': {
      if (expirationMs) {
        await supabase.from('profiles').update({
          subscription_tier: 'pro',
          subscription_expiry: new Date(expirationMs).toISOString(),
        }).eq('id', userId);
      }
      break;
    }

    // 결제 실패 — Google Play 유예 기간(약 3~7일) 동안 pro 유지
    // RevenueCat이 유예 기간 만료 후 EXPIRATION 이벤트를 별도로 발송함
    case 'BILLING_ISSUE': {
      if (expirationMs) {
        await supabase.from('profiles').update({
          subscription_expiry: new Date(expirationMs).toISOString(),
        }).eq('id', userId);
      }
      break;
    }

    // 사용자 취소 — 만료일까지 pro 유지 (선결제 기간 보장)
    case 'CANCELLATION': {
      if (expirationMs) {
        await supabase.from('profiles').update({
          subscription_expiry: new Date(expirationMs).toISOString(),
        }).eq('id', userId);
      } else {
        await supabase.from('profiles').update({
          subscription_tier: 'free',
          subscription_expiry: new Date().toISOString(),
        }).eq('id', userId);
      }
      break;
    }

    // 구독 완전 만료 — 즉시 free로 전환
    case 'EXPIRATION': {
      await supabase.from('profiles').update({
        subscription_tier: 'free',
        subscription_expiry: new Date().toISOString(),
      }).eq('id', userId);
      break;
    }

    // 환불 — 즉시 접근 권한 회수
    case 'REFUND': {
      await supabase.from('profiles').update({
        subscription_tier: 'free',
        subscription_expiry: new Date().toISOString(),
      }).eq('id', userId);
      break;
    }

    // 구독 일시정지 — 만료일까지 pro 유지 후 자동 전환
    case 'SUBSCRIPTION_PAUSED': {
      if (expirationMs) {
        await supabase.from('profiles').update({
          subscription_expiry: new Date(expirationMs).toISOString(),
        }).eq('id', userId);
      }
      break;
    }

    // 구독 기간 연장 (개발자가 수동으로 연장하는 경우)
    case 'SUBSCRIPTION_EXTENDED': {
      if (expirationMs) {
        await supabase.from('profiles').update({
          subscription_tier: 'pro',
          subscription_expiry: new Date(expirationMs).toISOString(),
        }).eq('id', userId);
      }
      break;
    }

    // 계정 이전 — new_app_user_id로 구독 이전
    case 'TRANSFER': {
      const newUserId = event.new_app_user_id;
      if (!newUserId) break;
      const { data } = await supabase
        .from('profiles')
        .select('subscription_tier, subscription_expiry')
        .eq('id', userId)
        .single();
      if (data?.subscription_tier === 'pro') {
        await supabase.from('profiles').update({
          subscription_tier: 'pro',
          subscription_expiry: data.subscription_expiry,
        }).eq('id', newUserId);
        await supabase.from('profiles').update({
          subscription_tier: 'free',
        }).eq('id', userId);
      }
      break;
    }

    default:
      break;
  }

  return new Response('OK', { status: 200 });
});
