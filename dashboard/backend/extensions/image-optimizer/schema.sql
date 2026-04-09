-- Image Optimizer - Metadata Table

CREATE TABLE IF NOT EXISTS image_metadata (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  storage_path text UNIQUE NOT NULL,
  original_size bigint,
  optimized_size bigint,
  width int,
  height int,
  format text,
  thumbnails jsonb DEFAULT '{}'::jsonb,
  processed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_image_metadata_storage_path ON image_metadata(storage_path);
CREATE INDEX IF NOT EXISTS idx_image_metadata_processed_at ON image_metadata(processed_at DESC);
