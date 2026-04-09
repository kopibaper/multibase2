// AI Content Moderation
// Supabase Edge Function: moderate-content

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") ?? "{{openaiApiKey}}";
const FLAG_THRESHOLD = parseFloat(Deno.env.get("FLAG_THRESHOLD") ?? "{{flagThreshold}}") || 0.8;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: { text: string; recordId?: string; tableName?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { text, recordId, tableName } = body;

  if (!text) {
    return new Response(JSON.stringify({ error: "text is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Call OpenAI Moderation API
  const moderationResponse = await fetch("https://api.openai.com/v1/moderations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ input: text }),
  });

  if (!moderationResponse.ok) {
    const err = await moderationResponse.text();
    return new Response(JSON.stringify({ error: "OpenAI moderation error", detail: err }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }

  const moderationData = await moderationResponse.json();
  const result = moderationData.results?.[0];

  if (!result) {
    return new Response(JSON.stringify({ error: "No moderation result returned" }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }

  const categories: Record<string, boolean> = result.categories ?? {};
  const scores: Record<string, number> = result.category_scores ?? {};

  // Determine if flagged based on threshold
  const maxScore = Math.max(...Object.values(scores));
  const flagged = result.flagged || maxScore >= FLAG_THRESHOLD;

  // Determine action taken
  let actionTaken: string | null = null;
  if (flagged) {
    actionTaken = "flagged";
  }

  // Log to moderation_log
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { error: insertError } = await supabase.from("moderation_log").insert({
    table_name: tableName ?? "unknown",
    record_id: recordId ?? null,
    content_snippet: text.slice(0, 200),
    flagged,
    categories,
    scores,
    action_taken: actionTaken,
  });

  if (insertError) {
    console.error("Failed to log moderation result:", insertError);
  }

  return new Response(
    JSON.stringify({
      flagged,
      categories,
      scores,
      actionTaken,
      recordId,
      tableName,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
});
