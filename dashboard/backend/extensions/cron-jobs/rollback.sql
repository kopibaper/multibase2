-- Rollback: Managed Cron Jobs

-- Unschedule all managed jobs
DO $$
DECLARE
  job_rec RECORD;
BEGIN
  FOR job_rec IN SELECT job_name FROM managed_cron_jobs LOOP
    PERFORM cron.unschedule(job_rec.job_name);
  END LOOP;
EXCEPTION WHEN OTHERS THEN
  -- pg_cron may not be installed; ignore errors
  NULL;
END;
$$;

DROP TABLE IF EXISTS managed_cron_jobs CASCADE;
