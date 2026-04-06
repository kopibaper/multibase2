-- Rollback: Workflow Engine Schema

DROP TRIGGER IF EXISTS trg_workflow_instances_updated_at ON {{schemaName}}.workflow_instances;
DROP FUNCTION IF EXISTS {{schemaName}}.update_instance_updated_at();
DROP TABLE IF EXISTS {{schemaName}}.instance_history CASCADE;
DROP TABLE IF EXISTS {{schemaName}}.workflow_instances CASCADE;
DROP TABLE IF EXISTS {{schemaName}}.workflow_transitions CASCADE;
DROP TABLE IF EXISTS {{schemaName}}.workflow_states CASCADE;
DROP TABLE IF EXISTS {{schemaName}}.workflow_definitions CASCADE;
