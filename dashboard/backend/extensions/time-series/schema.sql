-- Time-Series Schema with Partitioning
-- Schema: {{schemaName}}

-- Main partitioned table
CREATE TABLE IF NOT EXISTS {{schemaName}}.ts_data (
  id bigserial,
  metric_name text NOT NULL,
  entity_id text,
  value numeric NOT NULL,
  tags jsonb DEFAULT '{}'::jsonb,
  recorded_at timestamptz NOT NULL DEFAULT now()
) PARTITION BY RANGE (recorded_at);

-- Index on partitioned table
CREATE INDEX IF NOT EXISTS idx_ts_data_metric_recorded ON {{schemaName}}.ts_data(metric_name, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_ts_data_entity ON {{schemaName}}.ts_data(entity_id, recorded_at DESC) WHERE entity_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ts_data_tags ON {{schemaName}}.ts_data USING GIN (tags);

-- Create partition management function
CREATE OR REPLACE FUNCTION {{schemaName}}.create_ts_partition(year int, month int)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  partition_name text;
  start_date date;
  end_date date;
BEGIN
  partition_name := format('ts_data_%s_%s', year, lpad(month::text, 2, '0'));
  start_date := make_date(year, month, 1);
  end_date := start_date + interval '1 month';

  EXECUTE format(
    'CREATE TABLE IF NOT EXISTS {{schemaName}}.%I
     PARTITION OF {{schemaName}}.ts_data
     FOR VALUES FROM (%L) TO (%L)',
    partition_name,
    start_date,
    end_date
  );
END;
$$;

-- Create current month partition
SELECT {{schemaName}}.create_ts_partition(
  EXTRACT(YEAR FROM now())::int,
  EXTRACT(MONTH FROM now())::int
);

-- Create next month partition proactively
SELECT {{schemaName}}.create_ts_partition(
  EXTRACT(YEAR FROM now() + interval '1 month')::int,
  EXTRACT(MONTH FROM now() + interval '1 month')::int
);

-- Hourly aggregate materialized view
CREATE MATERIALIZED VIEW IF NOT EXISTS {{schemaName}}.ts_hourly_agg AS
SELECT
  metric_name,
  entity_id,
  date_trunc('hour', recorded_at) AS hour,
  avg(value) AS avg_value,
  min(value) AS min_value,
  max(value) AS max_value,
  count(*) AS sample_count
FROM {{schemaName}}.ts_data
GROUP BY 1, 2, 3;

CREATE UNIQUE INDEX IF NOT EXISTS idx_ts_hourly_agg_pk
  ON {{schemaName}}.ts_hourly_agg(metric_name, entity_id, hour)
  WHERE entity_id IS NOT NULL;

-- Daily aggregate materialized view
CREATE MATERIALIZED VIEW IF NOT EXISTS {{schemaName}}.ts_daily_agg AS
SELECT
  metric_name,
  entity_id,
  date_trunc('day', recorded_at) AS day,
  avg(value) AS avg_value,
  min(value) AS min_value,
  max(value) AS max_value,
  count(*) AS sample_count
FROM {{schemaName}}.ts_data
GROUP BY 1, 2, 3;

CREATE UNIQUE INDEX IF NOT EXISTS idx_ts_daily_agg_pk
  ON {{schemaName}}.ts_daily_agg(metric_name, entity_id, day)
  WHERE entity_id IS NOT NULL;
