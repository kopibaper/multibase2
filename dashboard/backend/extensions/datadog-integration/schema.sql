-- Datadog Integration - Metrics Buffer Table

CREATE TABLE IF NOT EXISTS dd_metrics_buffer (
  id bigserial PRIMARY KEY,
  metric_name text NOT NULL,
  metric_type text NOT NULL CHECK (metric_type IN ('gauge', 'count', 'rate')),
  value numeric NOT NULL,
  tags jsonb DEFAULT '{}'::jsonb,
  timestamp bigint,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dd_metrics_buffer_sent_at ON dd_metrics_buffer(sent_at);
CREATE INDEX IF NOT EXISTS idx_dd_metrics_buffer_pending ON dd_metrics_buffer(created_at)
  WHERE sent_at IS NULL;
