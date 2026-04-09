-- Address Book Schema
-- Schema: {{schemaName}}

CREATE TABLE IF NOT EXISTS {{schemaName}}.contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  first_name text NOT NULL,
  last_name text,
  company text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS {{schemaName}}.addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES {{schemaName}}.contacts(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'home' CHECK (type IN ('home', 'work', 'other')),
  street text,
  city text,
  state text,
  zip text,
  country text NOT NULL DEFAULT 'DE',
  lat numeric(10, 7),
  lng numeric(10, 7),
  is_default bool NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS {{schemaName}}.phone_numbers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES {{schemaName}}.contacts(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'mobile',
  number text NOT NULL
);

CREATE TABLE IF NOT EXISTS {{schemaName}}.email_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES {{schemaName}}.contacts(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'personal',
  email text NOT NULL,
  is_primary bool NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS {{schemaName}}.contact_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES {{schemaName}}.contacts(id) ON DELETE CASCADE,
  tag text NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_contacts_user_id ON {{schemaName}}.contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_contacts_last_name ON {{schemaName}}.contacts(last_name);
CREATE INDEX IF NOT EXISTS idx_addresses_contact_id ON {{schemaName}}.addresses(contact_id);
CREATE INDEX IF NOT EXISTS idx_phone_numbers_contact_id ON {{schemaName}}.phone_numbers(contact_id);
CREATE INDEX IF NOT EXISTS idx_email_addresses_contact_id ON {{schemaName}}.email_addresses(contact_id);
CREATE INDEX IF NOT EXISTS idx_contact_tags_contact_id ON {{schemaName}}.contact_tags(contact_id);
CREATE INDEX IF NOT EXISTS idx_contact_tags_tag ON {{schemaName}}.contact_tags(tag);

-- Enable RLS
ALTER TABLE {{schemaName}}.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE {{schemaName}}.addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE {{schemaName}}.phone_numbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE {{schemaName}}.email_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE {{schemaName}}.contact_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own contacts" ON {{schemaName}}.contacts
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "Users manage own addresses" ON {{schemaName}}.addresses
  FOR ALL USING (
    contact_id IN (SELECT id FROM {{schemaName}}.contacts WHERE user_id = auth.uid())
  );

CREATE POLICY "Users manage own phone numbers" ON {{schemaName}}.phone_numbers
  FOR ALL USING (
    contact_id IN (SELECT id FROM {{schemaName}}.contacts WHERE user_id = auth.uid())
  );

CREATE POLICY "Users manage own email addresses" ON {{schemaName}}.email_addresses
  FOR ALL USING (
    contact_id IN (SELECT id FROM {{schemaName}}.contacts WHERE user_id = auth.uid())
  );

CREATE POLICY "Users manage own contact tags" ON {{schemaName}}.contact_tags
  FOR ALL USING (
    contact_id IN (SELECT id FROM {{schemaName}}.contacts WHERE user_id = auth.uid())
  );
