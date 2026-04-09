-- Booking System Schema
-- Schema: {{schemaName}}

CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE IF NOT EXISTS {{schemaName}}.resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  capacity int NOT NULL DEFAULT 1 CHECK (capacity > 0),
  is_active bool NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS {{schemaName}}.availability_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id uuid NOT NULL REFERENCES {{schemaName}}.resources(id) ON DELETE CASCADE,
  day_of_week int NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time time NOT NULL,
  end_time time NOT NULL,
  CHECK (end_time > start_time)
);

CREATE TABLE IF NOT EXISTS {{schemaName}}.bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id uuid NOT NULL REFERENCES {{schemaName}}.resources(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL,
  title text NOT NULL,
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_at > start_at),
  -- Prevent overlapping bookings for the same resource (only for non-cancelled bookings)
  EXCLUDE USING gist (
    resource_id WITH =,
    tstzrange(start_at, end_at, '[)') WITH &&
  ) WHERE (status != 'cancelled')
);

CREATE TABLE IF NOT EXISTS {{schemaName}}.blackout_dates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id uuid NOT NULL REFERENCES {{schemaName}}.resources(id) ON DELETE CASCADE,
  date date NOT NULL,
  reason text
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_bookings_resource_id ON {{schemaName}}.bookings(resource_id);
CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON {{schemaName}}.bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_start_at ON {{schemaName}}.bookings(start_at);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON {{schemaName}}.bookings(status);
CREATE INDEX IF NOT EXISTS idx_availability_rules_resource_id ON {{schemaName}}.availability_rules(resource_id);
CREATE INDEX IF NOT EXISTS idx_blackout_dates_resource_id ON {{schemaName}}.blackout_dates(resource_id, date);

-- Enable RLS
ALTER TABLE {{schemaName}}.resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE {{schemaName}}.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE {{schemaName}}.availability_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE {{schemaName}}.blackout_dates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active resources" ON {{schemaName}}.resources
  FOR SELECT USING (is_active = true);

CREATE POLICY "Anyone can view availability rules" ON {{schemaName}}.availability_rules
  FOR SELECT USING (true);

CREATE POLICY "Anyone can view blackout dates" ON {{schemaName}}.blackout_dates
  FOR SELECT USING (true);

CREATE POLICY "Users can view own bookings" ON {{schemaName}}.bookings
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can create bookings" ON {{schemaName}}.bookings
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can cancel own bookings" ON {{schemaName}}.bookings
  FOR UPDATE USING (user_id = auth.uid());
