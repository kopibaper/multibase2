-- OpenAI Proxy - Usage Tracking Tables

CREATE TABLE IF NOT EXISTS openai_usage (
  id bigserial PRIMARY KEY,
  user_id uuid,
  model text NOT NULL,
  prompt_tokens int NOT NULL DEFAULT 0,
  completion_tokens int NOT NULL DEFAULT 0,
  total_tokens int NOT NULL DEFAULT 0,
  cost_usd numeric(10, 6) NOT NULL DEFAULT 0,
  endpoint text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS openai_budgets (
  user_id uuid PRIMARY KEY,
  monthly_token_limit int NOT NULL DEFAULT {{monthlyTokenBudget}},
  tokens_used_this_month int NOT NULL DEFAULT 0,
  reset_at date NOT NULL DEFAULT date_trunc('month', now())::date
);

CREATE INDEX IF NOT EXISTS idx_openai_usage_user_id ON openai_usage(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_openai_usage_model ON openai_usage(model);
CREATE INDEX IF NOT EXISTS idx_openai_budgets_reset_at ON openai_budgets(reset_at);

-- Function to get cost estimate per model
CREATE OR REPLACE FUNCTION estimate_openai_cost(
  p_model text,
  p_prompt_tokens int,
  p_completion_tokens int
)
RETURNS numeric(10, 6) LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  RETURN CASE
    WHEN p_model LIKE 'gpt-4o%'        THEN (p_prompt_tokens * 0.000005 + p_completion_tokens * 0.000015)
    WHEN p_model LIKE 'gpt-4-turbo%'   THEN (p_prompt_tokens * 0.000010 + p_completion_tokens * 0.000030)
    WHEN p_model LIKE 'gpt-3.5-turbo%' THEN (p_prompt_tokens * 0.0000005 + p_completion_tokens * 0.0000015)
    ELSE (p_prompt_tokens + p_completion_tokens) * 0.000001
  END;
END;
$$;
