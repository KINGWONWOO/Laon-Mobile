import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { AwsClient } from "https://esm.sh/aws4fetch@1.0.19";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEFAULT_INACTIVE_DAYS = 30;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // testMinutes를 body로 넘기면 해당 분 전을 기준으로 삭제 (테스트용)
    const body = await req.json().catch(() => ({}));
    const testMinutes: number | undefined = body?.testMinutes;

    const cutoffMs = testMinutes != null
      ? Date.now() - testMinutes * 60 * 1000
      : Date.now() - DEFAULT_INACTIVE_DAYS * 24 * 60 * 60 * 1000;
    const cutoff = new Date(cutoffMs).toISOString();

    console.log(`[Cleanup] mode=${testMinutes != null ? `test(${testMinutes}min)` : 'prod(30days)'}, cutoff=${cutoff}`);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const R2_ACCOUNT_ID = Deno.env.get("R2_ACCOUNT_ID")?.trim();
    const R2_ACCESS_KEY_ID = Deno.env.get("R2_ACCESS_KEY_ID")?.trim();
    const R2_SECRET_ACCESS_KEY = Deno.env.get("R2_SECRET_ACCESS_KEY")?.trim();
    const R2_BUCKET_NAME = Deno.env.get("R2_BUCKET_NAME")?.trim() || "laon-dance";
    const R2_PUBLIC_URL = Deno.env.get("R2_PUBLIC_URL")?.trim().replace(/\/$/, "") || "";

    const aws = new AwsClient({
      accessKeyId: R2_ACCESS_KEY_ID!,
      secretAccessKey: R2_SECRET_ACCESS_KEY!,
      service: "s3",
      region: "auto",
    });

    const deleteR2File = async (url: string) => {
      if (!url || !R2_PUBLIC_URL || !url.startsWith(R2_PUBLIC_URL)) {
        console.warn(`[Cleanup] R2 skip — url=${url}, R2_PUBLIC_URL=${R2_PUBLIC_URL}`);
        return;
      }
      const key = url.replace(`${R2_PUBLIC_URL}/`, "");
      const deleteUrl = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET_NAME}/${key}`;
      const res = await aws.fetch(deleteUrl, { method: "DELETE" });
      if (res.ok || res.status === 204 || res.status === 404) {
        console.log(`[Cleanup] R2 deleted — key=${key}, status=${res.status}`);
      } else {
        const body = await res.text();
        console.error(`[Cleanup] R2 delete failed — key=${key}, status=${res.status}, body=${body}`);
      }
    };

    const { data: staleVideos, error: videosError } = await supabase
      .from("videos")
      .select("id, storage_path")
      .lt("last_accessed_at", cutoff)
      .not("storage_path", "is", null);

    if (videosError) console.error("[Cleanup] videos query error:", JSON.stringify(videosError));
    console.log(`[Cleanup] stale videos found: ${staleVideos?.length ?? 0}`);

    let deletedVideos = 0;
    for (const video of staleVideos || []) {
      await deleteR2File(video.storage_path);
      const { error: delErr } = await supabase.from("videos").delete().eq("id", video.id);
      if (delErr) console.error("[Cleanup] video delete error:", JSON.stringify(delErr));
      else deletedVideos++;
    }

    const { data: stalePhotos, error: photosError } = await supabase
      .from("gallery_items")
      .select("id, file_path")
      .lt("last_accessed_at", cutoff);

    if (photosError) console.error("[Cleanup] gallery_items query error:", JSON.stringify(photosError));
    console.log(`[Cleanup] stale photos found: ${stalePhotos?.length ?? 0}`);

    let deletedPhotos = 0;
    for (const photo of stalePhotos || []) {
      await deleteR2File(photo.file_path);
      const { error: delErr } = await supabase.from("gallery_items").delete().eq("id", photo.id);
      if (delErr) console.error("[Cleanup] photo delete error:", JSON.stringify(delErr));
      else deletedPhotos++;
    }

    console.log(`[Cleanup] Done — videos: ${deletedVideos}, photos: ${deletedPhotos}`);

    return new Response(
      JSON.stringify({ success: true, deletedVideos, deletedPhotos, cutoff }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[Cleanup] Error:", error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
