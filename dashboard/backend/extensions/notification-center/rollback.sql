-- Rollback: Notification Center Schema

DROP FUNCTION IF EXISTS {{schemaName}}.cleanup_old_notifications();
DROP TABLE IF EXISTS {{schemaName}}.notification_channels CASCADE;
DROP TABLE IF EXISTS {{schemaName}}.notification_preferences CASCADE;
DROP TABLE IF EXISTS {{schemaName}}.notifications CASCADE;
