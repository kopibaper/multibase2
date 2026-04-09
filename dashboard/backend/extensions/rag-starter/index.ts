import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const OPENAI_API_KEY  = Deno.env.get("OPENAI_API_KEY")  || "{{openaiApiKey}}";
const EMBEDDING_MODEL = "{{embeddingModel}}" || "text-embedding-3-small";
const CHUNK_SIZE      = parseInt("{{chunkSize}}" || "512");

async function embed(texts: string[]): Promise<number[][]> {
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { "Authorization": `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: EMBEDDING_MODEL, input: texts })
  });
  const data = await res.json();
  return data.data.map((d: { embedding: number[] }) => d.embedding);
}

function chunkText(text: string, maxTokens: number): string[] {
  const words = text.split(/\s+/);
  const chunks: string[] = [];
  for (let i = 0; i < words.length; i += maxTokens) {
    chunks.push(words.slice(i, i + maxTokens).join(" "));
  }
  return chunks;
}

serve(async (req: Request) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const url = new URL(req.url);
  const action = url.pathname.split("/").pop();

  if (req.method === "POST" && action === "ingest") {
    const { title, text, sourceUrl, metadata } = await req.json();

    const { data: doc, error: docErr } = await supabase
      .from("rag_documents")
      .insert({ title, source_url: sourceUrl, metadata })
      .select("id").single();
    if (docErr) return Response.json({ error: docErr.message }, { status: 500 });

    const chunks = chunkText(text, CHUNK_SIZE);
    const embeddings = await embed(chunks);

    const rows = chunks.map((content, i) => ({
      document_id: doc.id, content,
      embedding: JSON.stringify(embeddings[i]),
      chunk_index: i, token_count: content.split(/\s+/).length
    }));

    const { error: chunkErr } = await supabase.from("rag_chunks").insert(rows);
    if (chunkErr) return Response.json({ error: chunkErr.message }, { status: 500 });

    return Response.json({ success: true, document_id: doc.id, chunks: chunks.length });
  }

  if (req.method === "POST" && action === "search") {
    const { query, limit = 5 } = await req.json();
    const [queryEmbedding] = await embed([query]);

    const { data, error } = await supabase.rpc("match_rag_chunks", {
      query_embedding: JSON.stringify(queryEmbedding),
      match_threshold: 0.7,
      match_count: limit
    });

    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ results: data });
  }

  return Response.json({ error: "Use POST /ingest or POST /search" }, { status: 400 });
});
