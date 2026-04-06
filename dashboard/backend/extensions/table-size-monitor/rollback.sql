-- Rollback: Table Size Monitor

DROP FUNCTION IF EXISTS take_table_size_snapshot();
DROP VIEW IF EXISTS table_size_current;
DROP TABLE IF EXISTS table_size_snapshots CASCADE;
