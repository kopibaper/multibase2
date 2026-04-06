import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") || "{{openaiApiKey}}";
const TARGET_TABLE   = "{{targetTable}}";
const TARGET_COLUMN  = "{{targetColumn}}";
const SUMMARY_STYLE  = "{{summaryStyle}}";
const SCHEMA         = "{{schemaName}}";

const STYLE_PROMPTS: Record<string, string> = {
  paragraph:     "Summarize in 2–3 concise sentences.",
  "bullet-points": "Summarize as 3–5 bullet points. Each bullet starts with '• '.",
  tweet:         "Summarize in max 280 characters, no hashtags."
};

serve(async (req: Request) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { recordId, text } = await req.json();
  if (!recordId || !text) return Response.json({ error: "Missing recordId or text" }, { status: 400 });

  const prompt = STYLE_PROMPTS[SUMMARY_STYLE] ?? STYLE_PROMPTS.paragraph;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: prompt },
        { role: "user",   content: text.slice(0, 12000) }
      ],
      max_tokens: 400
    })
  });

  const data = await res.json();
  const summary: string = data.choices?.[0]?.message?.content?.trim() ?? "";

  const { error } = await supabase
    .from(TARGET_TABLE)
    .update({ ai_summary: summary, ai_summary_updated_at: new Date().toISOString() })
    .eq("id", recordId);

  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ success: true, summary });
});
