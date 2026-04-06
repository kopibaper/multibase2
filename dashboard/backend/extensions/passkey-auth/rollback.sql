-- Rollback: Passkey Auth

DROP TABLE IF EXISTS passkey_challenges CASCADE;
DROP TABLE IF EXISTS passkey_credentials CASCADE;
