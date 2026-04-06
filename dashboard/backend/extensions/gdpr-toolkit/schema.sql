-- GDPR Toolkit Schema
-- Schema: {{schemaName}}

CREATE TABLE IF NOT EXISTS {{schemaName}}.consent_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  purpose text NOT NULL,
  version text NOT NULL,
  given_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  ip_address inet,
  user_agent text
);

CREATE TABLE IF NOT EXISTS {{schemaName}}.data_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL CHECK (type IN ('access', 'deletion', 'portability', 'rectification')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'rejected')),
  requested_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  notes text
);

CREATE TABLE IF NOT EXISTS {{schemaName}}.data_retention_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text UNIQUE NOT NULL,
  retention_days int NOT NULL DEFAULT {{defaultRetentionDays}},
  last_cleanup_at timestamptz
);

CREATE TABLE IF NOT EXISTS {{schemaName}}.processing_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  purpose text NOT NULL,
  legal_basis text NOT NULL,
  data_categories text[] NOT NULL DEFAULT '{}',
  retention_days int NOT NULL,
  is_active bool NOT NULL DEFAULT true
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_consent_records_user_id ON {{schemaName}}.consent_records(user_id);
CREATE INDEX IF NOT EXISTS idx_consent_records_purpose ON {{schemaName}}.consent_records(purpose);
CREATE INDEX IF NOT EXISTS idx_data_requests_user_id ON {{schemaName}}.data_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_data_requests_status ON {{schemaName}}.data_requests(status);

-- Enable RLS
ALTER TABLE {{schemaName}}.consent_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE {{schemaName}}.data_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own consent records" ON {{schemaName}}.consent_records
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users insert own consent records" ON {{schemaName}}.consent_records
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users view own data requests" ON {{schemaName}}.data_requests
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users create own data requests" ON {{schemaName}}.data_requests
  FOR INSERT WITH CHECK (user_id = auth.uid());
