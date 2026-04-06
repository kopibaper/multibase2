import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const S3_ENDPOINT        = "{{s3Endpoint}}" || "https://s3.amazonaws.com";
const S3_BUCKET          = "{{s3Bucket}}";
const S3_ACCESS_KEY_ID   = Deno.env.get("S3_ACCESS_KEY_ID")   || "{{s3AccessKeyId}}";
const S3_SECRET_KEY      = Deno.env.get("S3_SECRET_KEY")      || "{{s3SecretAccessKey}}";
const S3_REGION          = "{{s3Region}}" || "eu-central-1";

async function hmacSign(key: CryptoKey, data: string): Promise<string> {
  const enc = new TextEncoder();
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function getSigningKey(secret: string, date: string, region: string, service: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode("AWS4" + secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const dateKey    = await crypto.subtle.importKey("raw", new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(date))), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const regionKey  = await crypto.subtle.importKey("raw", new Uint8Array(await crypto.subtle.sign("HMAC", dateKey, enc.encode(region))), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const serviceKey = await crypto.subtle.importKey("raw", new Uint8Array(await crypto.subtle.sign("HMAC", regionKey, enc.encode(service))), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return crypto.subtle.importKey("raw", new Uint8Array(await crypto.subtle.sign("HMAC", serviceKey, enc.encode("aws4_request"))), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
}

serve(async (req: Request) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const payload = await req.json();
  const eventType:   string = payload?.type ?? "INSERT";
  const storagePath: string = payload?.record?.name ?? payload.storagePath;
  const bucket:      string = payload?.record?.bucket_id ?? payload.bucket ?? "public";

  if (!storagePath) return Response.json({ error: "Missing storagePath" }, { status: 400 });

  const s3Key = `${bucket}/${storagePath}`;
  let status = "success";
  let errorMessage: string | null = null;
  let fileSize: number | null = null;

  try {
    if (eventType === "DELETE") {
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
      const signingKey = await getSigningKey(S3_SECRET_KEY, dateStr, S3_REGION, "s3");
      const signature = await hmacSign(signingKey, `DELETE\n\n\n\n/${S3_BUCKET}/${s3Key}`);

      await fetch(`${S3_ENDPOINT}/${S3_BUCKET}/${s3Key}`, {
        method: "DELETE",
        headers: { "Authorization": `AWS ${S3_ACCESS_KEY_ID}:${signature}` }
      });
    } else {
      const { data: fileData, error: dlErr } = await supabase.storage.from(bucket).download(storagePath);
      if (dlErr) throw new Error(dlErr.message);

      const body = await fileData.arrayBuffer();
      fileSize = body.byteLength;

      await fetch(`${S3_ENDPOINT}/${S3_BUCKET}/${s3Key}`, {
        method: "PUT",
        headers: {
          "Content-Type": fileData.type || "application/octet-stream",
          "Content-Length": String(fileSize)
        },
        body
      });
    }
  } catch (err) {
    status = "failed";
    errorMessage = String(err);
  }

  await supabase.from("s3_sync_log").insert({
    storage_path: storagePath, bucket, s3_key: s3Key,
    operation: eventType === "DELETE" ? "delete" : "upload",
    status, error_message: errorMessage, file_size: fileSize
  });

  return Response.json({ success: status === "success", s3_key: s3Key });
});
