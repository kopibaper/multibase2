-- Geo-IP Cache Schema

CREATE TABLE IF NOT EXISTS geo_cache (
  ip_address inet PRIMARY KEY,
  country_code text,
  country_name text,
  region text,
  city text,
  latitude numeric(10, 7),
  longitude numeric(10, 7),
  timezone text,
  isp text,
  cached_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_geo_cache_cached_at ON geo_cache(cached_at);
