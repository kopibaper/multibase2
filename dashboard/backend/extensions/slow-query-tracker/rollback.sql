-- Rollback: Slow Query Tracker

DROP FUNCTION IF EXISTS capture_slow_queries();
DROP VIEW IF EXISTS current_slow_queries;
DROP TABLE IF EXISTS slow_queries CASCADE;
