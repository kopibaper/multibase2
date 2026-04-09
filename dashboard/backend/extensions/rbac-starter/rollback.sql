-- Rollback: RBAC Starter Schema

DROP FUNCTION IF EXISTS {{schemaName}}.has_permission(uuid, text, text);
DROP TABLE IF EXISTS {{schemaName}}.user_roles CASCADE;
DROP TABLE IF EXISTS {{schemaName}}.role_permissions CASCADE;
DROP TABLE IF EXISTS {{schemaName}}.permissions CASCADE;
DROP TABLE IF EXISTS {{schemaName}}.roles CASCADE;
