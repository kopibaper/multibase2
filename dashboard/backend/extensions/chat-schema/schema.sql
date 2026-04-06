-- Chat Schema
-- Schema: {{schemaName}}

CREATE TABLE IF NOT EXISTS {{schemaName}}.chat_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text,
  type text NOT NULL DEFAULT 'direct' CHECK (type IN ('direct', 'group', 'channel')),
  created_by uuid,
  is_archived bool NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS {{schemaName}}.room_members (
  room_id uuid NOT NULL REFERENCES {{schemaName}}.chat_rooms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (room_id, user_id)
);

CREATE TABLE IF NOT EXISTS {{schemaName}}.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES {{schemaName}}.chat_rooms(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  content text NOT NULL CHECK (length(content) <= 4000),
  type text NOT NULL DEFAULT 'text' CHECK (type IN ('text', 'image', 'file', 'system')),
  reply_to uuid REFERENCES {{schemaName}}.messages(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  edited_at timestamptz,
  deleted_at timestamptz
);

CREATE TABLE IF NOT EXISTS {{schemaName}}.reactions (
  message_id uuid NOT NULL REFERENCES {{schemaName}}.messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  emoji text NOT NULL,
  PRIMARY KEY (message_id, user_id, emoji)
);

CREATE TABLE IF NOT EXISTS {{schemaName}}.read_receipts (
  room_id uuid NOT NULL REFERENCES {{schemaName}}.chat_rooms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (room_id, user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_messages_room_id_created_at ON {{schemaName}}.messages(room_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON {{schemaName}}.messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_room_members_user_id ON {{schemaName}}.room_members(user_id);
CREATE INDEX IF NOT EXISTS idx_reactions_message_id ON {{schemaName}}.reactions(message_id);

-- Enable RLS
ALTER TABLE {{schemaName}}.chat_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE {{schemaName}}.room_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE {{schemaName}}.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE {{schemaName}}.reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE {{schemaName}}.read_receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Room members can view rooms" ON {{schemaName}}.chat_rooms
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM {{schemaName}}.room_members rm
      WHERE rm.room_id = id AND rm.user_id = auth.uid()
    )
  );

CREATE POLICY "Room members can view members" ON {{schemaName}}.room_members
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM {{schemaName}}.room_members rm
      WHERE rm.room_id = room_id AND rm.user_id = auth.uid()
    )
  );

CREATE POLICY "Room members can view messages" ON {{schemaName}}.messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM {{schemaName}}.room_members rm
      WHERE rm.room_id = room_id AND rm.user_id = auth.uid()
    )
  );

CREATE POLICY "Room members can send messages" ON {{schemaName}}.messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM {{schemaName}}.room_members rm
      WHERE rm.room_id = room_id AND rm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users manage own reactions" ON {{schemaName}}.reactions
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "Room members manage read receipts" ON {{schemaName}}.read_receipts
  FOR ALL USING (user_id = auth.uid());
