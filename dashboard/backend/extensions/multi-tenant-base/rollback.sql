-- Rollback: Multi-Tenant Base Schema

DROP TABLE IF EXISTS {{schemaName}}.example_table CASCADE;
DROP TABLE IF EXISTS {{schemaName}}.tenant_users CASCADE;
DROP TABLE IF EXISTS {{schemaName}}.tenants CASCADE;
DROP FUNCTION IF EXISTS {{schemaName}}.current_tenant_id();
