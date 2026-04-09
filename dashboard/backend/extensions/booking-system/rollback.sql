-- Rollback: Booking System Schema

DROP TABLE IF EXISTS {{schemaName}}.blackout_dates CASCADE;
DROP TABLE IF EXISTS {{schemaName}}.bookings CASCADE;
DROP TABLE IF EXISTS {{schemaName}}.availability_rules CASCADE;
DROP TABLE IF EXISTS {{schemaName}}.resources CASCADE;
