-- Managed Cron Jobs Schema

CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE TABLE IF NOT EXISTS managed_cron_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name text UNIQUE NOT NULL,
  schedule text NOT NULL,
  command text NOT NULL,
  is_active bool NOT NULL DEFAULT true,
  last_run_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Conditionally schedule default jobs based on configuration
DO $$
BEGIN
  -- Cleanup job: remove old audit/notification records
  IF '{{enableCleanupJob}}' = 'true' THEN
    PERFORM cron.schedule(
      'cleanup-old-records',
      '0 3 * * *',
      $$DELETE FROM audit_log WHERE changed_at < now() - interval '90 days'$$
    );

    INSERT INTO managed_cron_jobs (job_name, schedule, command, is_active)
    VALUES (
      'cleanup-old-records',
      '0 3 * * *',
      'DELETE FROM audit_log WHERE changed_at < now() - interval ''90 days''',
      true
    )
    ON CONFLICT (job_name) DO NOTHING;
  END IF;

  -- Stats job: refresh materialized views
  IF '{{enableStatsJob}}' = 'true' THEN
    PERFORM cron.schedule(
      'refresh-stats-views',
      '*/30 * * * *',
      $$REFRESH MATERIALIZED VIEW CONCURRENTLY ts_hourly_agg$$
    );

    INSERT INTO managed_cron_jobs (job_name, schedule, command, is_active)
    VALUES (
      'refresh-stats-views',
      '*/30 * * * *',
      'REFRESH MATERIALIZED VIEW CONCURRENTLY ts_hourly_agg',
      true
    )
    ON CONFLICT (job_name) DO NOTHING;
  END IF;
END;
$$;
