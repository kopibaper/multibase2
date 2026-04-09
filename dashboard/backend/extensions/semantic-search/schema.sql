CREATE EXTENSION IF NOT EXISTS vector;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = '{{schemaName}}'
      AND table_name   = '{{targetTable}}'
      AND column_name  = 'embedding'
  ) THEN
    EXECUTE format('ALTER TABLE %I.%I ADD COLUMN embedding VECTOR(1536)', '{{schemaName}}', '{{targetTable}}');
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON %I.%I USING ivfflat (embedding vector_cosine_ops)',
      '{{targetTable}}_embedding_idx', '{{schemaName}}', '{{targetTable}}'
    );
  END IF;
END $$;
