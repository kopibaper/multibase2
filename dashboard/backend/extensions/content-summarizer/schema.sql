DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = '{{schemaName}}'
      AND table_name   = '{{targetTable}}'
      AND column_name  = 'ai_summary'
  ) THEN
    EXECUTE format('ALTER TABLE %I.%I ADD COLUMN ai_summary TEXT', '{{schemaName}}', '{{targetTable}}');
    EXECUTE format('ALTER TABLE %I.%I ADD COLUMN ai_summary_updated_at TIMESTAMPTZ', '{{schemaName}}', '{{targetTable}}');
  END IF;
END $$;
