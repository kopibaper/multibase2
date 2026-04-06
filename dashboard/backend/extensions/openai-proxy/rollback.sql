-- Rollback: OpenAI Proxy

DROP FUNCTION IF EXISTS estimate_openai_cost(text, int, int);
DROP TABLE IF EXISTS openai_budgets CASCADE;
DROP TABLE IF EXISTS openai_usage CASCADE;
