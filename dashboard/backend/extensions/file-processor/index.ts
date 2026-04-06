// File Processor
// Supabase Edge Function: process-file
// Triggered by Storage webhook (object.created)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MAX_FILE_SIZE_MB = parseFloat(Deno.env.get("MAX_FILE_SIZE_MB") ?? "{{maxFileSizeMb}}") || 50;
const ALLOWED_MIME_TYPES = (Deno.env.get("ALLOWED_MIME_TYPES") ?? "{{allowedMimeTypes}}")
  .split(",")
  .map((t) => t.trim())
  .filter(Boolean);
const ENABLE_VIRUS_SCAN = (Deno.env.get("ENABLE_VIRUS_SCAN") ?? "{{enableVirusScan}}") === "true";
const CLAMAV_ENDPOINT = Deno.env.get("CLAMAV_ENDPOINT") ?? "";

const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

function isAllowedMimeType(mimeType: string, allowed: string[]): boolean {
  if (allowed.length === 0) return true;
  return allowed.some((pattern) => {
    if (pattern.endsWith("/*")) {
      return mimeType.startsWith(pattern.slice(0, -1));
    }
    return mimeType === pattern;
  });
}

interface StorageWebhookPayload {
  type: string;
  record: {
    name: string;
    bucket_id: string;
    metadata?: {
      size?: number;
      mimetype?: string;
    };
  };
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  let payload: StorageWebhookPayload;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (payload.type !== "object.created") {
    return new Response(JSON.stringify({ skipped: true, reason: "Not object.created" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { record } = payload;
  const storagePath = record.name;
  const bucket = record.bucket_id;
  const mimeType = record.metadata?.mimetype ?? "application/octet-stream";
  const fileSize = record.metadata?.size ?? 0;
  const originalName = storagePath.split("/").pop() ?? storagePath;

  let isAllowed = true;
  let rejectionReason: string | null = null;

  // Check file size
  if (fileSize > MAX_FILE_SIZE_BYTES) {
    isAllowed = false;
    rejectionReason = `File size ${(fileSize / 1024 / 1024).toFixed(1)}MB exceeds limit of ${MAX_FILE_SIZE_MB}MB`;
  }

  // Check MIME type
  if (isAllowed && !isAllowedMimeType(mimeType, ALLOWED_MIME_TYPES)) {
    isAllowed = false;
    rejectionReason = `MIME type '${mimeType}' is not allowed`;
  }

  // Virus scan
  let virusScanResult: string | null = null;
  if (isAllowed && ENABLE_VIRUS_SCAN && CLAMAV_ENDPOINT) {
    try {
      const supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      const { data: fileData } = await supabaseClient.storage.from(bucket).download(storagePath);

      if (fileData) {
        const formData = new FormData();
        formData.append("file", fileData, originalName);

        const scanResponse = await fetch(`${CLAMAV_ENDPOINT}/scan`, {
          method: "POST",
          body: formData,
        });

        if (scanResponse.ok) {
          const scanResult = await scanResponse.json();
          virusScanResult = scanResult.infected ? "infected" : "clean";
          if (scanResult.infected) {
            isAllowed = false;
            rejectionReason = `Virus detected: ${scanResult.viruses?.join(", ") ?? "unknown"}`;
          }
        }
      }
    } catch (err) {
      console.error("Virus scan error:", err);
      virusScanResult = "scan_error";
    }
  }

  const metadata = {
    file_extension: originalName.split(".").pop()?.toLowerCase(),
    size_mb: Math.round((fileSize / 1024 / 1024) * 100) / 100,
  };

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { error } = await supabase.from("file_metadata").upsert(
    {
      storage_path: storagePath,
      bucket,
      original_name: originalName,
      mime_type: mimeType,
      file_size: fileSize,
      is_allowed: isAllowed,
      rejection_reason: rejectionReason,
      metadata,
      virus_scan_result: virusScanResult,
    },
    { onConflict: "storage_path" }
  );

  if (error) {
    console.error("DB error:", error);
    return new Response(JSON.stringify({ error: "Database error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(
    JSON.stringify({ allowed: isAllowed, rejectionReason, mimeType, fileSize, metadata }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
});
