-- Rollback: Survey Builder Schema

DROP TABLE IF EXISTS {{schemaName}}.answers CASCADE;
DROP TABLE IF EXISTS {{schemaName}}.responses CASCADE;
DROP TABLE IF EXISTS {{schemaName}}.questions CASCADE;
DROP TABLE IF EXISTS {{schemaName}}.surveys CASCADE;
