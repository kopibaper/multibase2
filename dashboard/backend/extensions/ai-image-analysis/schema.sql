CREATE TABLE IF NOT EXISTS public.image_analysis (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  storage_path   TEXT NOT NULL UNIQUE,
  bucket         TEXT NOT NULL,
  alt_text       TEXT,
  tags           TEXT[],
  description    TEXT,
  nsfw_score     NUMERIC(4,3) DEFAULT 0,
  is_nsfw        BOOLEAN NOT NULL DEFAULT false,
  objects        JSONB,
  analyzed_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS image_analysis_bucket_idx ON public.image_analysis(bucket);
CREATE INDEX IF NOT EXISTS image_analysis_nsfw_idx   ON public.image_analysis(is_nsfw) WHERE is_nsfw = true;
