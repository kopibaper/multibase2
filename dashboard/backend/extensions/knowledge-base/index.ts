// Knowledge Base - Auto-embedding function
// Supabase Edge Function: kb-embed

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") ?? "{{openaiApiKey}}";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const { articleId, text } = await req.json();

    if (!articleId || !text) {
      return new Response(
        JSON.stringify({ error: "articleId and text are required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Generate embedding via OpenAI
    const embeddingResponse = await fetch(
      "https://api.openai.com/v1/embeddings",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "text-embedding-3-small",
          input: text,
        }),
      }
    );

    if (!embeddingResponse.ok) {
      const err = await embeddingResponse.text();
      throw new Error(`OpenAI embeddings error: ${err}`);
    }

    const embeddingData = await embeddingResponse.json();
    const embedding: number[] = embeddingData.data[0].embedding;

    // Update the kb_articles table
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { error } = await supabase
      .from("kb_articles")
      .update({
        embedding: JSON.stringify(embedding),
      })
      .eq("id", articleId);

    if (error) throw error;

    return new Response(JSON.stringify({ success: true, articleId }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("kb-embed error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
