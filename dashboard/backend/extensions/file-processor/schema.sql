-- File Processor Schema

CREATE TABLE IF NOT EXISTS file_metadata (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  storage_path text UNIQUE NOT NULL,
  bucket text NOT NULL,
  original_name text,
  mime_type text,
  file_size bigint,
  is_allowed bool NOT NULL DEFAULT true,
  rejection_reason text,
  metadata jsonb DEFAULT '{}'::jsonb,
  virus_scan_result text,
  processed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_file_metadata_bucket ON file_metadata(bucket);
CREATE INDEX IF NOT EXISTS idx_file_metadata_is_allowed ON file_metadata(is_allowed) WHERE is_allowed = false;
CREATE INDEX IF NOT EXISTS idx_file_metadata_processed_at ON file_metadata(processed_at DESC);
