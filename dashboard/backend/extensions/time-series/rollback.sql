-- Rollback: Time-Series Schema

DROP MATERIALIZED VIEW IF EXISTS {{schemaName}}.ts_daily_agg;
DROP MATERIALIZED VIEW IF EXISTS {{schemaName}}.ts_hourly_agg;
DROP FUNCTION IF EXISTS {{schemaName}}.create_ts_partition(int, int);
DROP TABLE IF EXISTS {{schemaName}}.ts_data CASCADE;
