-- Rollback: Address Book Schema

DROP TABLE IF EXISTS {{schemaName}}.contact_tags CASCADE;
DROP TABLE IF EXISTS {{schemaName}}.email_addresses CASCADE;
DROP TABLE IF EXISTS {{schemaName}}.phone_numbers CASCADE;
DROP TABLE IF EXISTS {{schemaName}}.addresses CASCADE;
DROP TABLE IF EXISTS {{schemaName}}.contacts CASCADE;
