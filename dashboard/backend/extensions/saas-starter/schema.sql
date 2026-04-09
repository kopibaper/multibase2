-- SaaS Starter Schema
-- Schema: {{schemaName}}

CREATE TABLE IF NOT EXISTS {{schemaName}}.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  plan text NOT NULL DEFAULT 'free',
  trial_ends_at timestamptz DEFAULT now() + interval '{{trialDays}} days',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS {{schemaName}}.org_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES {{schemaName}}.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, user_id)
);

CREATE TABLE IF NOT EXISTS {{schemaName}}.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES {{schemaName}}.organizations(id) ON DELETE CASCADE,
  plan text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'past_due')),
  current_period_end timestamptz,
  stripe_subscription_id text UNIQUE
);

CREATE TABLE IF NOT EXISTS {{schemaName}}.feature_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES {{schemaName}}.organizations(id) ON DELETE CASCADE,
  feature text NOT NULL,
  enabled bool NOT NULL DEFAULT false,
  UNIQUE (org_id, feature)
);

CREATE TABLE IF NOT EXISTS {{schemaName}}.invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES {{schemaName}}.organizations(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  token text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '7 days',
  accepted_at timestamptz
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_org_members_org_id ON {{schemaName}}.org_members(org_id);
CREATE INDEX IF NOT EXISTS idx_org_members_user_id ON {{schemaName}}.org_members(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_org_id ON {{schemaName}}.subscriptions(org_id);
CREATE INDEX IF NOT EXISTS idx_feature_flags_org_id ON {{schemaName}}.feature_flags(org_id);
CREATE INDEX IF NOT EXISTS idx_invitations_org_id ON {{schemaName}}.invitations(org_id);
CREATE INDEX IF NOT EXISTS idx_invitations_token ON {{schemaName}}.invitations(token);

-- Enable Row Level Security
ALTER TABLE {{schemaName}}.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE {{schemaName}}.org_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE {{schemaName}}.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE {{schemaName}}.feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE {{schemaName}}.invitations ENABLE ROW LEVEL SECURITY;

-- Helper function: check if user is org member
CREATE OR REPLACE FUNCTION {{schemaName}}.is_org_member(org_id uuid, user_id uuid)
RETURNS bool LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM {{schemaName}}.org_members m
    WHERE m.org_id = $1 AND m.user_id = $2
  );
$$;

-- RLS Policies
CREATE POLICY "Org members can view their org" ON {{schemaName}}.organizations
  FOR SELECT USING ({{schemaName}}.is_org_member(id, auth.uid()));

CREATE POLICY "Org members can view members" ON {{schemaName}}.org_members
  FOR SELECT USING ({{schemaName}}.is_org_member(org_id, auth.uid()));

CREATE POLICY "Org members can view subscriptions" ON {{schemaName}}.subscriptions
  FOR SELECT USING ({{schemaName}}.is_org_member(org_id, auth.uid()));

CREATE POLICY "Org members can view feature flags" ON {{schemaName}}.feature_flags
  FOR SELECT USING ({{schemaName}}.is_org_member(org_id, auth.uid()));

CREATE POLICY "Org members can view invitations" ON {{schemaName}}.invitations
  FOR SELECT USING ({{schemaName}}.is_org_member(org_id, auth.uid()));
