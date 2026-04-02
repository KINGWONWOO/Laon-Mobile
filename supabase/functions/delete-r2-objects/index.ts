import { AwsClient } from "https://esm.sh/aws4fetch@1.0.19";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { bucket, prefix } = await req.json();
    if (!prefix) throw new Error("삭제할 경로(prefix)가 지정되지 않았습니다.");

    const R2_ACCOUNT_ID = Deno.env.get("R2_ACCOUNT_ID")?.trim();
    const R2_ACCESS_KEY_ID = Deno.env.get("R2_ACCESS_KEY_ID")?.trim();
    const R2_SECRET_ACCESS_KEY = Deno.env.get("R2_SECRET_ACCESS_KEY")?.trim();
    const R2_BUCKET_NAME = bucket || Deno.env.get("R2_BUCKET_NAME")?.trim() || "laon-dance";

    const aws = new AwsClient({
      accessKeyId: R2_ACCESS_KEY_ID!,
      secretAccessKey: R2_SECRET_ACCESS_KEY!,
      service: "s3",
      region: "auto",
    });

    // 1. 해당 prefix를 가진 파일 목록 조회 (List Objects)
    console.log(`[Edge] Listing objects with prefix: ${prefix}`);
    const listUrl = new URL(`https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET_NAME}`);
    listUrl.searchParams.set("prefix", prefix);
    
    const listResponse = await aws.fetch(listUrl.toString());
    const listXml = await listResponse.text();
    
    // XML에서 Key값들 추출 (단순 파싱)
    const keys = [...listXml.matchAll(/<Key>(.*?)<\/Key>/g)].map(match => match[1]);

    if (keys.length === 0) {
      return new Response(JSON.stringify({ message: "삭제할 파일이 없습니다." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. 파일 삭제 (Delete Objects)
    console.log(`[Edge] Deleting ${keys.length} objects...`);
    for (const key of keys) {
      const deleteUrl = new URL(`https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET_NAME}/${key}`);
      await aws.fetch(deleteUrl.toString(), { method: "DELETE" });
    }

    return new Response(JSON.stringify({ 
      success: true, 
      deletedCount: keys.length,
      deletedKeys: keys 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
