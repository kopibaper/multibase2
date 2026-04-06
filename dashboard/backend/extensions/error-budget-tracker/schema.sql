-- Error Budget / SLO Tracker Schema

CREATE TABLE IF NOT EXISTS slo_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  target_availability numeric(5, 3) NOT NULL DEFAULT {{targetAvailability}},
  window_days int NOT NULL DEFAULT {{windowDays}},
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS slo_measurements (
  id bigserial PRIMARY KEY,
  slo_id uuid NOT NULL REFERENCES slo_definitions(id) ON DELETE CASCADE,
  good_events bigint NOT NULL,
  total_events bigint NOT NULL,
  availability numeric(8, 5) NOT NULL,
  error_budget_remaining numeric(8, 5) NOT NULL,
  measured_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS slo_alerts (
  id bigserial PRIMARY KEY,
  slo_id uuid NOT NULL REFERENCES slo_definitions(id) ON DELETE CASCADE,
  burn_rate numeric(8, 4) NOT NULL,
  alert_type text NOT NULL,
  alerted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_slo_measurements_slo_id ON slo_measurements(slo_id, measured_at DESC);
CREATE INDEX IF NOT EXISTS idx_slo_alerts_slo_id ON slo_alerts(slo_id, alerted_at DESC);
