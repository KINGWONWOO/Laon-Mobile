import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const res = (data: any, status = 200) => new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return res({ error: "Unauthorized" }, 401);

    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authError } = await anonClient.auth.getUser();
    if (authError || !user) return res({ error: "Unauthorized" }, 401);

    const { code } = await req.json();
    if (!code?.trim()) return res({ error: "쿠폰 코드가 없습니다." }, 400);

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: coupon, error: couponError } = await adminClient
      .from("coupons")
      .select("benefit, duration_days")
      .eq("code", code.trim().toUpperCase())
      .eq("is_active", true)
      .maybeSingle();

    if (couponError) {
      console.error("[redeem-coupon] DB error:", couponError);
      return res({ error: "서버 오류가 발생했습니다." }, 500);
    }
    if (!coupon) return res({ error: "INVALID_COUPON" }, 400);

    const now = Date.now();
    const expiry = now + (coupon.duration_days * 24 * 60 * 60 * 1000);
    const { error: updateError } = await adminClient.from("profiles").update({
      subscription_tier: "pro",
      subscription_start: new Date(now).toISOString(),
      subscription_expiry: new Date(expiry).toISOString(),
    }).eq("id", user.id);

    if (updateError) {
      console.error("[redeem-coupon] Update error:", updateError);
      return res({ error: "서버 오류가 발생했습니다." }, 500);
    }

    return res({ success: true, durationDays: coupon.duration_days });
  } catch (err: any) {
    console.error("[redeem-coupon] Error:", err);
    return res({ error: "서버 오류가 발생했습니다." }, 500);
  }
});
