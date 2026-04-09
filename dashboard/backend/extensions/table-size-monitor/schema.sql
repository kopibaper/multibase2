-- Table Size Monitor Schema

CREATE TABLE IF NOT EXISTS table_size_snapshots (
  id bigserial PRIMARY KEY,
  schema_name text NOT NULL,
  table_name text NOT NULL,
  total_bytes bigint,
  table_bytes bigint,
  index_bytes bigint,
  toast_bytes bigint,
  row_count bigint,
  snapped_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_table_size_snapped_at ON table_size_snapshots(snapped_at DESC);
CREATE INDEX IF NOT EXISTS idx_table_size_table ON table_size_snapshots(schema_name, table_name);

-- Live view of current table sizes
CREATE OR REPLACE VIEW table_size_current AS
SELECT
  schemaname AS schema_name,
  tablename AS table_name,
  pg_total_relation_size(schemaname || '.' || tablename) AS total_bytes,
  pg_relation_size(schemaname || '.' || tablename) AS table_bytes,
  pg_indexes_size(schemaname || '.' || tablename) AS index_bytes,
  pg_total_relation_size(schemaname || '.' || tablename)
    - pg_relation_size(schemaname || '.' || tablename)
    - pg_indexes_size(schemaname || '.' || tablename) AS toast_bytes,
  n_live_tup AS row_count
FROM pg_stat_user_tables
ORDER BY pg_total_relation_size(schemaname || '.' || tablename) DESC;

-- Helper: take a snapshot
CREATE OR REPLACE FUNCTION take_table_size_snapshot()
RETURNS int LANGUAGE plpgsql AS $$
DECLARE
  inserted int;
BEGIN
  INSERT INTO table_size_snapshots (schema_name, table_name, total_bytes, table_bytes, index_bytes, toast_bytes, row_count)
  SELECT
    schemaname,
    tablename,
    pg_total_relation_size(schemaname || '.' || tablename),
    pg_relation_size(schemaname || '.' || tablename),
    pg_indexes_size(schemaname || '.' || tablename),
    pg_total_relation_size(schemaname || '.' || tablename)
      - pg_relation_size(schemaname || '.' || tablename)
      - pg_indexes_size(schemaname || '.' || tablename),
    n_live_tup
  FROM pg_stat_user_tables;

  GET DIAGNOSTICS inserted = ROW_COUNT;
  RETURN inserted;
END;
$$;
