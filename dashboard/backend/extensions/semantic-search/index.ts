import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const OPENAI_API_KEY  = Deno.env.get("OPENAI_API_KEY") || "{{openaiApiKey}}";
const TARGET_TABLE    = "{{targetTable}}";
const TARGET_COLUMN   = "{{targetColumn}}";
const SCHEMA          = "{{schemaName}}";

async function embed(text: string): Promise<number[]> {
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { "Authorization": `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "text-embedding-3-small", input: text })
  });
  const data = await res.json();
  return data.data[0].embedding;
}

serve(async (req: Request) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const url = new URL(req.url);
  const action = url.pathname.split("/").pop();

  if (req.method === "POST" && action === "embed") {
    const { recordId, text } = await req.json();
    const embedding = await embed(text ?? "");
    const { error } = await supabase
      .from(TARGET_TABLE)
      .update({ embedding: JSON.stringify(embedding) })
      .eq("id", recordId);
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ success: true });
  }

  if (req.method === "POST" && action === "search") {
    const { query, limit = 10, threshold = 0.7 } = await req.json();
    const queryEmbedding = await embed(query);

    const { data, error } = await supabase.rpc("match_documents", {
      query_embedding: JSON.stringify(queryEmbedding),
      match_threshold: threshold,
      match_count:     limit,
      table_name:      TARGET_TABLE,
      content_column:  TARGET_COLUMN
    });

    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ results: data });
  }

  return Response.json({ error: "POST /embed or POST /search" }, { status: 400 });
});
