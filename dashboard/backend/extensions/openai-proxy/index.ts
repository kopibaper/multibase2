// OpenAI Proxy with Budget Enforcement
// Supabase Edge Function: openai-proxy

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") ?? "{{openaiApiKey}}";
const ALLOWED_MODELS = (Deno.env.get("ALLOWED_MODELS") ?? "{{allowedModels}}")
  .split(",")
  .map((m) => m.trim())
  .filter(Boolean);

const COST_PER_1K_TOKENS: Record<string, { prompt: number; completion: number }> = {
  "gpt-4o": { prompt: 0.005, completion: 0.015 },
  "gpt-4o-mini": { prompt: 0.00015, completion: 0.0006 },
  "gpt-4-turbo": { prompt: 0.01, completion: 0.03 },
  "gpt-3.5-turbo": { prompt: 0.0005, completion: 0.0015 },
};

function estimateCost(model: string, promptTokens: number, completionTokens: number): number {
  const rates = COST_PER_1K_TOKENS[model] ?? { prompt: 0.001, completion: 0.001 };
  return (promptTokens / 1000) * rates.prompt + (completionTokens / 1000) * rates.completion;
}

async function getUserIdFromAuth(authHeader: string, supabase: ReturnType<typeof createClient>): Promise<string | null> {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.split(" ")[1];
  const { data } = await supabase.auth.getUser(token);
  return data?.user?.id ?? null;
}

async function resetBudgetIfNeeded(
  userId: string,
  supabase: ReturnType<typeof createClient>
): Promise<void> {
  const today = new Date().toISOString().split("T")[0];
  const monthStart = today.substring(0, 7) + "-01";
  await supabase
    .from("openai_budgets")
    .update({ tokens_used_this_month: 0, reset_at: monthStart })
    .eq("user_id", userId)
    .lt("reset_at", monthStart);
}

Deno.serve(async (req: Request) => {
  // Extract path after the function name
  const url = new URL(req.url);
  const pathSuffix = url.pathname.replace(/^\/openai-proxy/, "") || "/v1/chat/completions";
  const openaiUrl = `https://api.openai.com${pathSuffix}`;

  const authHeader = req.headers.get("authorization") ?? "";
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const userId = await getUserIdFromAuth(authHeader, supabase);

  let requestBody: Record<string, unknown> = {};
  if (req.method !== "GET") {
    try {
      requestBody = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  // Validate model
  const requestedModel = requestBody.model as string | undefined;
  if (requestedModel && ALLOWED_MODELS.length > 0 && !ALLOWED_MODELS.includes(requestedModel)) {
    return new Response(
      JSON.stringify({ error: `Model '${requestedModel}' is not allowed. Allowed: ${ALLOWED_MODELS.join(", ")}` }),
      { status: 403, headers: { "Content-Type": "application/json" } }
    );
  }

  // Check budget if user identified
  if (userId) {
    await resetBudgetIfNeeded(userId, supabase);

    const { data: budget } = await supabase
      .from("openai_budgets")
      .select("monthly_token_limit, tokens_used_this_month")
      .eq("user_id", userId)
      .single();

    if (budget && budget.tokens_used_this_month >= budget.monthly_token_limit) {
      return new Response(
        JSON.stringify({ error: "Monthly token budget exceeded" }),
        { status: 429, headers: { "Content-Type": "application/json" } }
      );
    }
  }

  // Forward to OpenAI
  const openaiResponse = await fetch(openaiUrl, {
    method: req.method,
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: req.method !== "GET" ? JSON.stringify(requestBody) : undefined,
  });

  const responseData = await openaiResponse.json();

  // Log usage
  if (responseData.usage && userId) {
    const { prompt_tokens = 0, completion_tokens = 0, total_tokens = 0 } = responseData.usage;
    const model = responseData.model ?? requestedModel ?? "unknown";
    const cost = estimateCost(model, prompt_tokens, completion_tokens);

    await Promise.all([
      supabase.from("openai_usage").insert({
        user_id: userId,
        model,
        prompt_tokens,
        completion_tokens,
        total_tokens,
        cost_usd: cost,
        endpoint: pathSuffix,
      }),
      supabase.rpc("increment_token_usage", { p_user_id: userId, p_tokens: total_tokens })
        .catch(() =>
          // Fallback upsert if RPC not available
          supabase.from("openai_budgets").upsert({
            user_id: userId,
            tokens_used_this_month: total_tokens,
          }, { onConflict: "user_id", ignoreDuplicates: false })
        ),
    ]);
  }

  return new Response(JSON.stringify(responseData), {
    status: openaiResponse.status,
    headers: { "Content-Type": "application/json" },
  });
});
