-- 2FA Enforcement Extension
CREATE TABLE IF NOT EXISTS public.totp_registrations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL UNIQUE,
  secret      TEXT NOT NULL,
  verified    BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.totp_backup_codes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.totp_registrations(user_id) ON DELETE CASCADE,
  code_hash   TEXT NOT NULL,
  used_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.mfa_grace_periods (
  user_id     UUID PRIMARY KEY,
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT now() + (interval '1 day' * {{graceperiodDays}}),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.totp_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.totp_backup_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own TOTP" ON public.totp_registrations
  USING (user_id = auth.uid());

CREATE POLICY "Users manage own backup codes" ON public.totp_backup_codes
  USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS totp_registrations_user_id_idx ON public.totp_registrations(user_id);
