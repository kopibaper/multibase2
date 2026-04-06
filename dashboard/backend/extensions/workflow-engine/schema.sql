-- Workflow Engine Schema
-- Schema: {{schemaName}}

CREATE TABLE IF NOT EXISTS {{schemaName}}.workflow_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  description text,
  initial_state text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS {{schemaName}}.workflow_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id uuid NOT NULL REFERENCES {{schemaName}}.workflow_definitions(id) ON DELETE CASCADE,
  name text NOT NULL,
  is_terminal bool NOT NULL DEFAULT false,
  UNIQUE (workflow_id, name)
);

CREATE TABLE IF NOT EXISTS {{schemaName}}.workflow_transitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id uuid NOT NULL REFERENCES {{schemaName}}.workflow_definitions(id) ON DELETE CASCADE,
  from_state text NOT NULL,
  to_state text NOT NULL,
  trigger_event text NOT NULL,
  UNIQUE (workflow_id, from_state, trigger_event)
);

CREATE TABLE IF NOT EXISTS {{schemaName}}.workflow_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id uuid NOT NULL REFERENCES {{schemaName}}.workflow_definitions(id) ON DELETE RESTRICT,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  current_state text NOT NULL,
  data jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS {{schemaName}}.instance_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL REFERENCES {{schemaName}}.workflow_instances(id) ON DELETE CASCADE,
  from_state text,
  to_state text NOT NULL,
  trigger_event text,
  actor_id uuid,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_workflow_states_workflow_id ON {{schemaName}}.workflow_states(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_transitions_workflow_id ON {{schemaName}}.workflow_transitions(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_instances_entity ON {{schemaName}}.workflow_instances(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_workflow_instances_workflow_id ON {{schemaName}}.workflow_instances(workflow_id);
CREATE INDEX IF NOT EXISTS idx_instance_history_instance_id ON {{schemaName}}.instance_history(instance_id, occurred_at DESC);

-- Auto-update updated_at on instances
CREATE OR REPLACE FUNCTION {{schemaName}}.update_instance_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_workflow_instances_updated_at
  BEFORE UPDATE ON {{schemaName}}.workflow_instances
  FOR EACH ROW EXECUTE FUNCTION {{schemaName}}.update_instance_updated_at();

-- Enable RLS
ALTER TABLE {{schemaName}}.workflow_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE {{schemaName}}.workflow_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE {{schemaName}}.instance_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view workflow definitions" ON {{schemaName}}.workflow_definitions
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can view instances" ON {{schemaName}}.workflow_instances
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can view history" ON {{schemaName}}.instance_history
  FOR SELECT USING (auth.uid() IS NOT NULL);
