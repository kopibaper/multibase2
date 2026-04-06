CREATE TABLE IF NOT EXISTS public.storage_snapshots (
  id              BIGSERIAL PRIMARY KEY,
  bucket_name     TEXT NOT NULL,
  file_count      BIGINT NOT NULL DEFAULT 0,
  total_bytes     BIGINT NOT NULL DEFAULT 0,
  avg_file_bytes  BIGINT,
  largest_file_path  TEXT,
  largest_file_bytes BIGINT,
  snapped_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.storage_alerts (
  id           BIGSERIAL PRIMARY KEY,
  bucket_name  TEXT NOT NULL,
  alert_type   TEXT NOT NULL,
  message      TEXT NOT NULL,
  alerted_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS storage_snapshots_snapped_at_idx  ON public.storage_snapshots(snapped_at DESC);
CREATE INDEX IF NOT EXISTS storage_snapshots_bucket_idx      ON public.storage_snapshots(bucket_name);
