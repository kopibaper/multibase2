-- Rollback: GDPR Toolkit Schema

DROP TABLE IF EXISTS {{schemaName}}.processing_activities CASCADE;
DROP TABLE IF EXISTS {{schemaName}}.data_retention_policies CASCADE;
DROP TABLE IF EXISTS {{schemaName}}.data_requests CASCADE;
DROP TABLE IF EXISTS {{schemaName}}.consent_records CASCADE;
