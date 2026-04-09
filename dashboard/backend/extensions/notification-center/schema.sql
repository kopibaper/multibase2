-- Notification Center Schema
-- Schema: {{schemaName}}

CREATE TABLE IF NOT EXISTS {{schemaName}}.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  data jsonb DEFAULT '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS {{schemaName}}.notification_preferences (
  user_id uuid PRIMARY KEY,
  email_enabled bool NOT NULL DEFAULT true,
  push_enabled bool NOT NULL DEFAULT true,
  in_app_enabled bool NOT NULL DEFAULT true,
  quiet_hours_start time,
  quiet_hours_end time
);

CREATE TABLE IF NOT EXISTS {{schemaName}}.notification_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL CHECK (type IN ('email', 'push', 'slack')),
  target text NOT NULL,
  is_active bool NOT NULL DEFAULT true
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON {{schemaName}}.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read_at ON {{schemaName}}.notifications(user_id, read_at);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON {{schemaName}}.notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_channels_user_id ON {{schemaName}}.notification_channels(user_id);

-- Enable RLS
ALTER TABLE {{schemaName}}.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE {{schemaName}}.notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE {{schemaName}}.notification_channels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own notifications" ON {{schemaName}}.notifications
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "Users manage own preferences" ON {{schemaName}}.notification_preferences
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "Users manage own channels" ON {{schemaName}}.notification_channels
  FOR ALL USING (user_id = auth.uid());

-- Auto-delete old notifications trigger
CREATE OR REPLACE FUNCTION {{schemaName}}.cleanup_old_notifications()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM {{schemaName}}.notifications
  WHERE created_at < now() - interval '{{retentionDays}} days';
END;
$$;
