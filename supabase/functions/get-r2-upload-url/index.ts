import { AwsClient } from "https://esm.sh/aws4fetch@1.0.19";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // 1. CORS 처리
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // 2. 환경 변수 로드
    const R2_ACCOUNT_ID = Deno.env.get("R2_ACCOUNT_ID")?.trim();
    const R2_ACCESS_KEY_ID = Deno.env.get("R2_ACCESS_KEY_ID")?.trim();
    const R2_SECRET_ACCESS_KEY = Deno.env.get("R2_SECRET_ACCESS_KEY")?.trim();
    const R2_BUCKET_NAME = Deno.env.get("R2_BUCKET_NAME")?.trim() || "laon-dance";
    const R2_PUBLIC_URL = (Deno.env.get("R2_PUBLIC_URL") || "").trim().replace(/\/$/, "");

    if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
      throw new Error("R2 서버 설정(환경 변수)이 누락되었습니다.");
    }

    // 3. 데이터 파싱
    const body = await req.json();
    const { key, contentType } = body;
    if (!key) throw new Error("업로드할 파일 경로(key)가 없습니다.");

    console.log(`[Edge] Generating ultra-light presigned URL for: ${key}`);

    // 4. 초경량 aws4fetch 클라이언트 초기화 (무거운 SDK 로딩 없음!)
    const aws = new AwsClient({
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
      service: "s3",
      region: "auto",
    });

    // R2 업로드용 엔드포인트 생성
    const url = new URL(`https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET_NAME}/${key}`);
    
    // 5. URL 서명 (쿼리 파라미터 방식)
    const signedRequest = await aws.sign(url, {
      method: "PUT",
      aws: { signQuery: true }, // URL 자체에 서명을 포함
      headers: {
        "Content-Type": contentType || "application/octet-stream",
      }
    });

    console.log("[Edge] URL successfully signed using aws4fetch.");

    // 6. 성공 응답
    return new Response(JSON.stringify({ 
      signedUrl: signedRequest.url, 
      publicUrl: `${R2_PUBLIC_URL}/${key}` 
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
      status: 400, // 500 에러 원천 차단
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
