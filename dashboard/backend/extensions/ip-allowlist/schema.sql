-- IP Allowlist Schema

CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE IF NOT EXISTS ip_allowlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cidr inet NOT NULL,
  description text,
  is_active bool NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ip_block_log (
  id bigserial PRIMARY KEY,
  ip_address inet,
  user_id uuid,
  attempted_at timestamptz NOT NULL DEFAULT now(),
  reason text
);

-- GiST index for efficient CIDR containment queries
CREATE INDEX IF NOT EXISTS idx_ip_allowlist_cidr ON ip_allowlist USING gist (cidr inet_ops);
CREATE INDEX IF NOT EXISTS idx_ip_block_log_attempted_at ON ip_block_log(attempted_at DESC);
CREATE INDEX IF NOT EXISTS idx_ip_block_log_ip ON ip_block_log(ip_address);

-- Insert initial CIDRs from config
-- The {{allowedCidrs}} value (e.g. "192.168.1.0/24,10.0.0.0/8") is expanded at runtime
DO $$
DECLARE
  cidr_entry text;
  cidrs text[] := string_to_array('{{allowedCidrs}}', ',');
BEGIN
  FOREACH cidr_entry IN ARRAY cidrs LOOP
    cidr_entry := trim(cidr_entry);
    IF cidr_entry <> '' AND cidr_entry <> '{{allowedCidrs}}' THEN
      INSERT INTO ip_allowlist (cidr, description)
      VALUES (cidr_entry::inet, 'Initial CIDR from config')
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
END;
$$;
