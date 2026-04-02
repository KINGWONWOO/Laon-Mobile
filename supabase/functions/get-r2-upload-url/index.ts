import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { S3Client, PutObjectCommand } from "https://esm.sh/@aws-sdk/client-s3@3.341.0";
import { getSignedUrl } from "https://esm.sh/@aws-sdk/s3-request-presigner@3.341.0";

const R2_ACCOUNT_ID = Deno.env.get("R2_ACCOUNT_ID") || "";
const R2_ACCESS_KEY_ID = Deno.env.get("R2_ACCESS_KEY_ID") || "";
const R2_SECRET_ACCESS_KEY = Deno.env.get("R2_SECRET_ACCESS_KEY") || "";
const R2_BUCKET_NAME = Deno.env.get("R2_BUCKET_NAME") || "laon-dance";
const R2_PUBLIC_URL = Deno.env.get("R2_PUBLIC_URL") || "";

console.log("[Edge] Function initialized");
console.log("[Edge] R2_ACCOUNT_ID length:", R2_ACCOUNT_ID.length);
console.log("[Edge] R2_ACCESS_KEY_ID length:", R2_ACCESS_KEY_ID.length);
console.log("[Edge] R2_SECRET_ACCESS_KEY length:", R2_SECRET_ACCESS_KEY.length);

// S3Client는 한 번만 초기화하지만, 변수가 있을 때만 유효하게 동작하도록 합니다.
const createS3Client = () => {
  return new S3Client({
    region: "auto",
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
  });
};

serve(async (req) => {
  // CORS 처리
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  try {
    const body = await req.json();
    const { bucket, key, contentType } = body;
    console.log("[Edge] Request Body:", JSON.stringify({ bucket, key, contentType }));

    const missingVars = [];
    if (!R2_ACCOUNT_ID) missingVars.push("R2_ACCOUNT_ID");
    if (!R2_ACCESS_KEY_ID) missingVars.push("R2_ACCESS_KEY_ID");
    if (!R2_SECRET_ACCESS_KEY) missingVars.push("R2_SECRET_ACCESS_KEY");

    if (missingVars.length > 0) {
      throw new Error(`R2 설정(환경 변수)이 누락되었습니다: ${missingVars.join(", ")}`);
    }

    const s3 = createS3Client();
    const command = new PutObjectCommand({
      Bucket: bucket || R2_BUCKET_NAME,
      Key: key,
      ContentType: contentType,
    });

    console.log("[Edge] Generating signed URL...");
    // 1시간(3600초) 유효한 업로드용 pre-signed URL 생성
    const signedUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });
    console.log("[Edge] Signed URL generated successfully");

    return new Response(JSON.stringify({ signedUrl, publicUrl: `${R2_PUBLIC_URL}/${key}` }), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  } catch (error: any) {
    console.error("[Edge] Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
});
