-- AI Chat History Schema
-- Schema: {{schemaName}}

CREATE TABLE IF NOT EXISTS {{schemaName}}.ai_assistants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  system_prompt text,
  model text NOT NULL DEFAULT 'gpt-4o',
  temperature numeric(3, 2) NOT NULL DEFAULT 0.7 CHECK (temperature BETWEEN 0 AND 2),
  max_tokens int NOT NULL DEFAULT 2000,
  is_active bool NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS {{schemaName}}.ai_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  assistant_id text NOT NULL DEFAULT 'default',
  title text,
  model text NOT NULL DEFAULT 'gpt-4o',
  total_tokens int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS {{schemaName}}.ai_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES {{schemaName}}.ai_conversations(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('system', 'user', 'assistant')),
  content text NOT NULL,
  tokens int,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ai_conversations_user_id ON {{schemaName}}.ai_conversations(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation_id ON {{schemaName}}.ai_messages(conversation_id, created_at ASC);

-- Auto-update updated_at on conversations
CREATE OR REPLACE FUNCTION {{schemaName}}.update_conversation_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE {{schemaName}}.ai_conversations
  SET updated_at = now()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_ai_message_updates_conversation
  AFTER INSERT ON {{schemaName}}.ai_messages
  FOR EACH ROW EXECUTE FUNCTION {{schemaName}}.update_conversation_updated_at();

-- Limit messages per conversation
CREATE OR REPLACE FUNCTION {{schemaName}}.enforce_message_limit()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  msg_count int;
BEGIN
  SELECT COUNT(*) INTO msg_count
  FROM {{schemaName}}.ai_messages
  WHERE conversation_id = NEW.conversation_id;

  IF msg_count >= {{maxMessagesPerConversation}} THEN
    -- Delete oldest message (beyond the limit)
    DELETE FROM {{schemaName}}.ai_messages
    WHERE id = (
      SELECT id FROM {{schemaName}}.ai_messages
      WHERE conversation_id = NEW.conversation_id
      ORDER BY created_at ASC
      LIMIT 1
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_ai_message_limit
  AFTER INSERT ON {{schemaName}}.ai_messages
  FOR EACH ROW EXECUTE FUNCTION {{schemaName}}.enforce_message_limit();

-- Enable RLS
ALTER TABLE {{schemaName}}.ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE {{schemaName}}.ai_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own conversations" ON {{schemaName}}.ai_conversations
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "Users manage messages in own conversations" ON {{schemaName}}.ai_messages
  FOR ALL USING (
    conversation_id IN (
      SELECT id FROM {{schemaName}}.ai_conversations WHERE user_id = auth.uid()
    )
  );
