-- Rollback: Session Manager

DROP VIEW IF EXISTS active_sessions;
DROP TABLE IF EXISTS user_sessions CASCADE;
