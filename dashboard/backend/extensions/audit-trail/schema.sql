-- Audit Trail Schema
-- Audit Schema: {{auditSchema}}

CREATE SCHEMA IF NOT EXISTS {{auditSchema}};

CREATE TABLE IF NOT EXISTS {{auditSchema}}.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  operation text NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
  old_data jsonb,
  new_data jsonb,
  changed_by uuid,
  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_changed_at ON {{auditSchema}}.audit_log(changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_table_name ON {{auditSchema}}.audit_log(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_log_changed_by ON {{auditSchema}}.audit_log(changed_by);

-- Trigger function for capturing changes
CREATE OR REPLACE FUNCTION {{auditSchema}}.log_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    INSERT INTO {{auditSchema}}.audit_log(table_name, operation, old_data, changed_by)
    VALUES (TG_TABLE_NAME, 'DELETE', row_to_json(OLD)::jsonb, auth.uid());
    RETURN OLD;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO {{auditSchema}}.audit_log(table_name, operation, new_data, changed_by)
    VALUES (TG_TABLE_NAME, 'INSERT', row_to_json(NEW)::jsonb, auth.uid());
    RETURN NEW;
  ELSE
    INSERT INTO {{auditSchema}}.audit_log(table_name, operation, old_data, new_data, changed_by)
    VALUES (TG_TABLE_NAME, 'UPDATE', row_to_json(OLD)::jsonb, row_to_json(NEW)::jsonb, auth.uid());
    RETURN NEW;
  END IF;
END;
$$;

-- Helper function to attach audit trigger to any table
-- Usage: SELECT {{auditSchema}}.attach_audit_trigger('public', 'my_table');
CREATE OR REPLACE FUNCTION {{auditSchema}}.attach_audit_trigger(p_schema text, p_table text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE format(
    'CREATE TRIGGER trg_audit_%1$s
     AFTER INSERT OR UPDATE OR DELETE ON %2$I.%1$I
     FOR EACH ROW EXECUTE FUNCTION {{auditSchema}}.log_change()',
    p_table,
    p_schema
  );
END;
$$;
