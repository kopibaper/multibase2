-- Session Manager Schema

CREATE TABLE IF NOT EXISTS user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  session_token_hash text NOT NULL,
  device_name text,
  browser text,
  os text,
  ip_address inet,
  country text,
  city text,
  last_active_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token_hash ON user_sessions(session_token_hash);
CREATE INDEX IF NOT EXISTS idx_user_sessions_last_active ON user_sessions(last_active_at DESC);

-- Enable RLS
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own sessions" ON user_sessions
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can revoke own sessions" ON user_sessions
  FOR UPDATE USING (user_id = auth.uid());

-- View: active sessions only
CREATE OR REPLACE VIEW active_sessions AS
SELECT *
FROM user_sessions
WHERE revoked_at IS NULL
  AND last_active_at > now() - interval '{{sessionExpiryDays}} days';
