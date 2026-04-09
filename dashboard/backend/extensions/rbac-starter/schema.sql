-- RBAC Starter Schema
-- Schema: {{schemaName}}

CREATE TABLE IF NOT EXISTS {{schemaName}}.roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS {{schemaName}}.permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resource text NOT NULL,
  action text NOT NULL,
  description text,
  UNIQUE (resource, action)
);

CREATE TABLE IF NOT EXISTS {{schemaName}}.role_permissions (
  role_id uuid NOT NULL REFERENCES {{schemaName}}.roles(id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES {{schemaName}}.permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS {{schemaName}}.user_roles (
  user_id uuid NOT NULL,
  role_id uuid NOT NULL REFERENCES {{schemaName}}.roles(id) ON DELETE CASCADE,
  granted_by uuid,
  granted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, role_id)
);

-- Default roles
INSERT INTO {{schemaName}}.roles (name, description) VALUES
  ('admin', 'Full access to all resources'),
  ('editor', 'Can create and edit content'),
  ('viewer', 'Read-only access to resources')
ON CONFLICT (name) DO NOTHING;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id ON {{schemaName}}.role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission_id ON {{schemaName}}.role_permissions(permission_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON {{schemaName}}.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON {{schemaName}}.user_roles(role_id);

-- Helper function: check if a user has a given permission
CREATE OR REPLACE FUNCTION {{schemaName}}.has_permission(
  p_user_id uuid,
  p_resource text,
  p_action text
)
RETURNS bool LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1
    FROM {{schemaName}}.user_roles ur
    JOIN {{schemaName}}.role_permissions rp ON rp.role_id = ur.role_id
    JOIN {{schemaName}}.permissions p ON p.id = rp.permission_id
    WHERE ur.user_id = p_user_id
      AND p.resource = p_resource
      AND p.action = p_action
  );
$$;
