DO $$
BEGIN
  EXECUTE format('DROP INDEX IF EXISTS %I', '{{targetTable}}_embedding_idx');
  EXECUTE format('ALTER TABLE IF EXISTS %I.%I DROP COLUMN IF EXISTS embedding', '{{schemaName}}', '{{targetTable}}');
END $$;
