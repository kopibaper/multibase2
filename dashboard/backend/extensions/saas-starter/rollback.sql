-- Rollback: SaaS Starter Schema

DROP TABLE IF EXISTS {{schemaName}}.invitations CASCADE;
DROP TABLE IF EXISTS {{schemaName}}.feature_flags CASCADE;
DROP TABLE IF EXISTS {{schemaName}}.subscriptions CASCADE;
DROP TABLE IF EXISTS {{schemaName}}.org_members CASCADE;
DROP TABLE IF EXISTS {{schemaName}}.organizations CASCADE;
DROP FUNCTION IF EXISTS {{schemaName}}.is_org_member(uuid, uuid);
