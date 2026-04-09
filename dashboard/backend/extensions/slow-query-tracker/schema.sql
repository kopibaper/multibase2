-- Slow Query Tracker Schema

CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

CREATE TABLE IF NOT EXISTS slow_queries (
  id bigserial PRIMARY KEY,
  query_hash bigint,
  query text,
  calls bigint,
  total_time_ms numeric,
  mean_time_ms numeric,
  rows bigint,
  captured_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_slow_queries_captured_at ON slow_queries(captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_slow_queries_mean_time ON slow_queries(mean_time_ms DESC);

-- View: current slow queries live from pg_stat_statements
CREATE OR REPLACE VIEW current_slow_queries AS
SELECT
  queryid,
  query,
  calls,
  total_exec_time AS total_time_ms,
  mean_exec_time AS mean_time_ms,
  rows
FROM pg_stat_statements
WHERE mean_exec_time > {{thresholdMs}}
ORDER BY mean_exec_time DESC
LIMIT 50;

-- Helper: capture snapshot of current slow queries
CREATE OR REPLACE FUNCTION capture_slow_queries()
RETURNS int LANGUAGE plpgsql AS $$
DECLARE
  inserted int;
BEGIN
  INSERT INTO slow_queries (query_hash, query, calls, total_time_ms, mean_time_ms, rows)
  SELECT
    queryid,
    query,
    calls,
    total_exec_time,
    mean_exec_time,
    rows
  FROM pg_stat_statements
  WHERE mean_exec_time > {{thresholdMs}}
  ORDER BY mean_exec_time DESC
  LIMIT 100;

  GET DIAGNOSTICS inserted = ROW_COUNT;
  RETURN inserted;
END;
$$;
