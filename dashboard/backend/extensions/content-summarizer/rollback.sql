DO $$
BEGIN
  EXECUTE format('ALTER TABLE IF EXISTS %I.%I DROP COLUMN IF EXISTS ai_summary', '{{schemaName}}', '{{targetTable}}');
  EXECUTE format('ALTER TABLE IF EXISTS %I.%I DROP COLUMN IF EXISTS ai_summary_updated_at', '{{schemaName}}', '{{targetTable}}');
END $$;
