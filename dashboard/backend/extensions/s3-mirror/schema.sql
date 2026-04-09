CREATE TABLE IF NOT EXISTS public.s3_sync_log (
  id             BIGSERIAL PRIMARY KEY,
  storage_path   TEXT NOT NULL,
  bucket         TEXT NOT NULL,
  s3_key         TEXT,
  operation      TEXT NOT NULL CHECK (operation IN ('upload', 'delete')),
  status         TEXT NOT NULL CHECK (status IN ('success', 'failed')),
  error_message  TEXT,
  file_size      BIGINT,
  synced_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS s3_sync_log_status_idx      ON public.s3_sync_log(status);
CREATE INDEX IF NOT EXISTS s3_sync_log_synced_at_idx   ON public.s3_sync_log(synced_at DESC);
CREATE INDEX IF NOT EXISTS s3_sync_log_storage_path_idx ON public.s3_sync_log(storage_path);
