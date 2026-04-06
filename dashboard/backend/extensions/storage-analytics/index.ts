import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const STORAGE_LIMIT_BYTES = parseInt("{{storageLimitGb}}" || "100") * 1024 * 1024 * 1024;
const ALERT_WEBHOOK       = "{{alertWebhook}}";

serve(async (_req: Request) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data: buckets, error: bucketsErr } = await supabase.storage.listBuckets();
  if (bucketsErr) return Response.json({ error: bucketsErr.message }, { status: 500 });

  let totalBytesAll = 0;
  const snapshots = [];

  for (const bucket of buckets ?? []) {
    const { data: files } = await supabase.storage.from(bucket.name).list("", { limit: 1000 });
    const fileCount  = files?.length ?? 0;
    const totalBytes = files?.reduce((sum, f) => sum + (f.metadata?.size ?? 0), 0) ?? 0;
    const largest    = files?.sort((a, b) => (b.metadata?.size ?? 0) - (a.metadata?.size ?? 0))[0];

    totalBytesAll += totalBytes;
    snapshots.push({
      bucket_name: bucket.name, file_count: fileCount, total_bytes: totalBytes,
      avg_file_bytes: fileCount > 0 ? Math.round(totalBytes / fileCount) : 0,
      largest_file_path: largest?.name ?? null, largest_file_bytes: largest?.metadata?.size ?? null
    });
  }

  await supabase.from("storage_snapshots").insert(snapshots);

  if (totalBytesAll >= STORAGE_LIMIT_BYTES * 0.8 && ALERT_WEBHOOK) {
    const usedGb = (totalBytesAll / 1024 / 1024 / 1024).toFixed(2);
    const limitGb = (STORAGE_LIMIT_BYTES / 1024 / 1024 / 1024).toFixed(0);
    const message = `Storage usage at ${usedGb} GB / ${limitGb} GB (≥80%)`;

    await supabase.from("storage_alerts").insert({
      bucket_name: "all", alert_type: "storage_limit", message
    });

    if (ALERT_WEBHOOK.startsWith("http")) {
      await fetch(ALERT_WEBHOOK, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: `⚠️ Multibase Storage Alert: ${message}` })
      });
    }
  }

  return Response.json({ success: true, buckets: snapshots.length, total_bytes: totalBytesAll });
});
