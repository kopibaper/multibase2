-- AI Moderation Schema

CREATE TABLE IF NOT EXISTS moderation_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  record_id uuid,
  content_snippet text,
  flagged bool NOT NULL DEFAULT false,
  categories jsonb DEFAULT '{}'::jsonb,
  scores jsonb DEFAULT '{}'::jsonb,
  action_taken text,
  moderated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_moderation_log_table_record ON moderation_log(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_moderation_log_flagged ON moderation_log(flagged) WHERE flagged = true;
CREATE INDEX IF NOT EXISTS idx_moderation_log_moderated_at ON moderation_log(moderated_at DESC);
