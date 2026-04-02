import { AwsClient } from "https://esm.sh/aws4fetch@1.0.19";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// 💡 1. 전역(Global) 스코프에 설정값과 클라이언트 캐싱 (Edge Function 최적화)
let awsClient: AwsClient | null = null;
let cachedAccountId = "";
let cachedBucketName = "";
let cachedPublicUrl = "";

function getAwsClient() {
  if (awsClient) return awsClient;

  const R2_ACCOUNT_ID = Deno.env.get("R2_ACCOUNT_ID")?.trim();
  const R2_ACCESS_KEY_ID = Deno.env.get("R2_ACCESS_KEY_ID")?.trim();
  const R2_SECRET_ACCESS_KEY = Deno.env.get("R2_SECRET_ACCESS_KEY")?.trim();
  
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
    throw new Error("R2 서버 설정(환경 변수)이 누락되었습니다.");
  }

  cachedAccountId = R2_ACCOUNT_ID;
  cachedBucketName = Deno.env.get("R2_BUCKET_NAME")?.trim() || "laon-dance";
  cachedPublicUrl = (Deno.env.get("R2_PUBLIC_URL") || "").trim().replace(/\/$/, "");

  awsClient = new AwsClient({
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
    service: "s3",
    region: "auto",
  });

  return awsClient;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    const { key, contentType } = body;
    if (!key) throw new Error("업로드할 파일 경로(key)가 없습니다.");

    // 💡 2. 재사용 가능한 전역 클라이언트 호출
    const aws = getAwsClient();

    const url = new URL(`https://${cachedAccountId}.r2.cloudflarestorage.com/${cachedBucketName}/${key}`);
    
    const signedRequest = await aws.sign(url, {
      method: "PUT",
      aws: { signQuery: true },
      headers: {
        "Content-Type": contentType || "application/octet-stream",
      }
    });

    return new Response(JSON.stringify({ 
      signedUrl: signedRequest.url, 
      publicUrl: `${cachedPublicUrl}/${key}` 
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("[Edge Error]", error);
    return new Response(JSON.stringify({ 
      error: error.message || "서버 에러",
      details: error.stack 
    }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
