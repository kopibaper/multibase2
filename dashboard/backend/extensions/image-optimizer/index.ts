// Image Optimizer
// Supabase Edge Function: optimize-image
// Triggered by Storage webhook (object.created)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GENERATE_THUMBNAILS = (Deno.env.get("GENERATE_THUMBNAILS") ?? "{{generateThumbnails}}") === "true";

const IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
  "image/svg+xml",
]);

interface StorageWebhookPayload {
  type: "object.created" | "object.updated" | "object.deleted";
  record: {
    id: string;
    name: string;
    bucket_id: string;
    metadata?: {
      size?: number;
      mimetype?: string;
      cacheControl?: string;
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
  const mimeType = record.metadata?.mimetype ?? "";
  const originalSize = record.metadata?.size ?? 0;

  if (!IMAGE_TYPES.has(mimeType)) {
    return new Response(
      JSON.stringify({ skipped: true, reason: `Not an image: ${mimeType}` }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Get a public URL for the image
  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(storagePath);
  const publicUrl = urlData?.publicUrl ?? "";

  // Determine format from mime type
  const format = mimeType.split("/")[1] ?? "unknown";

  // Simulate thumbnail metadata (in production you'd call a processing API)
  const thumbnails: Record<string, unknown> = {};
  if (GENERATE_THUMBNAILS) {
    thumbnails["100x100"] = {
      path: `thumbnails/100x100/${storagePath}`,
      url: `${publicUrl}?width=100&height=100`,
    };
    thumbnails["400x300"] = {
      path: `thumbnails/400x300/${storagePath}`,
      url: `${publicUrl}?width=400&height=300`,
    };
    thumbnails["800x600"] = {
      path: `thumbnails/800x600/${storagePath}`,
      url: `${publicUrl}?width=800&height=600`,
    };
  }

  const metadata = {
    storage_path: storagePath,
    original_size: originalSize,
    optimized_size: originalSize, // would be set after actual optimization
    format,
    thumbnails,
    processed_at: new Date().toISOString(),
  };

  const { error } = await supabase.from("image_metadata").upsert(metadata, {
    onConflict: "storage_path",
  });

  if (error) {
    console.error("DB error:", error);
    return new Response(JSON.stringify({ error: "Database error", detail: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(
    JSON.stringify({
      success: true,
      storagePath,
      format,
      originalSize,
      thumbnails: GENERATE_THUMBNAILS ? Object.keys(thumbnails) : [],
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
});
