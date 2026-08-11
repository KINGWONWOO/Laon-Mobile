import { AwsClient } from "https://esm.sh/aws4fetch@1.0.19";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ALLOWED_PATHS = ['gallery/', 'profiles/', 'rooms/', 'videos/', 'formations/'];
const ALLOWED_MIME = ['video/mp4', 'image/jpeg', 'image/png', 'audio/mpeg', 'audio/m4a', 'video/quicktime', 'application/octet-stream'];

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

  const unauthorized = () => new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

  try {
    // JWT 인증 검증
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return unauthorized();

    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authError } = await anonClient.auth.getUser();
    if (authError || !user) return unauthorized();

    const body = await req.json();
    const { key, contentType } = body;
    if (!key) throw new Error("업로드할 파일 경로(key)가 없습니다.");

    // 허용 경로 검증
    if (!ALLOWED_PATHS.some(p => key.startsWith(p))) {
      throw new Error("허용되지 않은 업로드 경로입니다.");
    }

    // 허용 MIME 타입 검증
    if (contentType && !ALLOWED_MIME.includes(contentType)) {
      throw new Error("허용되지 않은 파일 형식입니다.");
    }

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
    }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
