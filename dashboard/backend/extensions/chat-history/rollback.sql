-- Rollback: AI Chat History Schema

DROP TRIGGER IF EXISTS trg_ai_message_limit ON {{schemaName}}.ai_messages;
DROP TRIGGER IF EXISTS trg_ai_message_updates_conversation ON {{schemaName}}.ai_messages;
DROP FUNCTION IF EXISTS {{schemaName}}.enforce_message_limit();
DROP FUNCTION IF EXISTS {{schemaName}}.update_conversation_updated_at();
DROP TABLE IF EXISTS {{schemaName}}.ai_messages CASCADE;
DROP TABLE IF EXISTS {{schemaName}}.ai_conversations CASCADE;
DROP TABLE IF EXISTS {{schemaName}}.ai_assistants CASCADE;
