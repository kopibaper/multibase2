-- Stripe Webhooks - Payments Table

CREATE TABLE IF NOT EXISTS {{paymentsTable}} (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id text UNIQUE NOT NULL,
  event_type text NOT NULL,
  amount numeric(12, 2),
  currency text,
  customer_id text,
  subscription_id text,
  status text,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payments_stripe_event_id ON {{paymentsTable}}(stripe_event_id);
CREATE INDEX IF NOT EXISTS idx_payments_customer_id ON {{paymentsTable}}(customer_id);
CREATE INDEX IF NOT EXISTS idx_payments_event_type ON {{paymentsTable}}(event_type);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON {{paymentsTable}}(created_at DESC);
