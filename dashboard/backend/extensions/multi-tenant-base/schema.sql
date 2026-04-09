-- Multi-Tenant Base Schema
-- Schema: {{schemaName}}

-- Function to get current tenant from session variable
CREATE OR REPLACE FUNCTION {{schemaName}}.current_tenant_id()
RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT current_setting('app.tenant_id', true)::uuid;
$$;

-- Tenants table
CREATE TABLE IF NOT EXISTS {{schemaName}}.tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Tenant-user mapping
CREATE TABLE IF NOT EXISTS {{schemaName}}.tenant_users (
  tenant_id uuid NOT NULL REFERENCES {{schemaName}}.tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'member',
  PRIMARY KEY (tenant_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_tenant_users_user_id ON {{schemaName}}.tenant_users(user_id);

-- Example table demonstrating tenant isolation pattern
-- All multi-tenant tables should follow this pattern:
CREATE TABLE IF NOT EXISTS {{schemaName}}.example_table (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL DEFAULT {{schemaName}}.current_tenant_id(),
  data text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_example_table_tenant_id ON {{schemaName}}.example_table(tenant_id);

-- Enable RLS on all tenant tables
ALTER TABLE {{schemaName}}.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE {{schemaName}}.tenant_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE {{schemaName}}.example_table ENABLE ROW LEVEL SECURITY;

-- RLS: users can only see tenants they belong to
CREATE POLICY "Users see own tenants" ON {{schemaName}}.tenants
  FOR SELECT USING (
    id IN (SELECT tenant_id FROM {{schemaName}}.tenant_users WHERE user_id = auth.uid())
  );

CREATE POLICY "Users see own tenant memberships" ON {{schemaName}}.tenant_users
  FOR SELECT USING (user_id = auth.uid());

-- RLS: row-level tenant isolation on example_table
CREATE POLICY "Tenant isolation" ON {{schemaName}}.example_table
  FOR ALL USING (tenant_id = {{schemaName}}.current_tenant_id());

-- Enable row security globally
SET app.config.row_security = on;
