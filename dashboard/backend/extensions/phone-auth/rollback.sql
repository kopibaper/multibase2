-- Rollback: Phone Auth

DROP TRIGGER IF EXISTS trg_cleanup_expired_otps ON phone_otps;
DROP FUNCTION IF EXISTS cleanup_expired_otps();
DROP TABLE IF EXISTS phone_otps CASCADE;
