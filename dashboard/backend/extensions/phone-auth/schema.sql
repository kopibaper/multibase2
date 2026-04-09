-- Phone Auth - OTP Table

CREATE TABLE IF NOT EXISTS phone_otps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number text NOT NULL,
  otp_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  attempts int NOT NULL DEFAULT 0,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_phone_otps_phone_expires ON phone_otps(phone_number, expires_at);
CREATE INDEX IF NOT EXISTS idx_phone_otps_expires_at ON phone_otps(expires_at);

-- Cleanup trigger for expired OTPs
CREATE OR REPLACE FUNCTION cleanup_expired_otps()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM phone_otps
  WHERE expires_at < now() - interval '1 hour';
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_cleanup_expired_otps
  AFTER INSERT ON phone_otps
  FOR EACH STATEMENT EXECUTE FUNCTION cleanup_expired_otps();
