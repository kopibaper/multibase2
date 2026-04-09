-- Rollback: Chat Schema

DROP TABLE IF EXISTS {{schemaName}}.read_receipts CASCADE;
DROP TABLE IF EXISTS {{schemaName}}.reactions CASCADE;
DROP TABLE IF EXISTS {{schemaName}}.messages CASCADE;
DROP TABLE IF EXISTS {{schemaName}}.room_members CASCADE;
DROP TABLE IF EXISTS {{schemaName}}.chat_rooms CASCADE;
