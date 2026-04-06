import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") || "{{openaiApiKey}}";
const ENABLE_NSFW_FILTER = "{{enableNsfwFilter}}" === "true";
const GENERATE_ALT_TEXT = "{{generateAltText}}" === "true";

serve(async (req: Request) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const payload = await req.json();
  const storagePath: string = payload?.record?.name ?? payload.storagePath;
  const bucket: string = payload?.record?.bucket_id ?? payload.bucket ?? "public";

  if (!storagePath) return Response.json({ error: "Missing storagePath" }, { status: 400 });

  const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(storagePath);

  const prompt = [
    GENERATE_ALT_TEXT ? "Write a concise alt text (max 125 chars)." : "",
    "List up to 10 relevant search tags as JSON array.",
    "Write a 1-sentence description.",
    ENABLE_NSFW_FILTER ? "Rate NSFW probability 0.0–1.0." : "",
    "List detected objects as JSON array.",
    'Respond ONLY with JSON: {"alt_text":"...","tags":[...],"description":"...","nsfw_score":0.0,"objects":[]}'
  ].filter(Boolean).join(" ");

  const visionRes = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [{ role: "user", content: [
        { type: "text", text: prompt },
        { type: "image_url", image_url: { url: publicUrl } }
      ]}],
      max_tokens: 300
    })
  });

  const visionData = await visionRes.json();
  let analysis = { alt_text: "", tags: [], description: "", nsfw_score: 0, objects: [] };
  try { analysis = JSON.parse(visionData.choices[0].message.content); } catch { /**/ }

  const isNsfw = (analysis.nsfw_score ?? 0) >= 0.7;

  await supabase.from("image_analysis").upsert({
    storage_path: storagePath, bucket, ...analysis, is_nsfw: isNsfw
  });

  if (isNsfw && ENABLE_NSFW_FILTER) {
    await supabase.storage.from(bucket).move(storagePath, `quarantine/${storagePath}`);
  }

  return Response.json({ success: true, analysis, is_nsfw: isNsfw });
});
