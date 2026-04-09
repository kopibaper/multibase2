-- Short URL Schema

CREATE TABLE IF NOT EXISTS short_urls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  original_url text NOT NULL,
  created_by uuid,
  expires_at timestamptz,
  click_count int NOT NULL DEFAULT 0,
  is_active bool NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS url_clicks (
  id bigserial PRIMARY KEY,
  slug text NOT NULL,
  referrer text,
  user_agent text,
  country text,
  clicked_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_short_urls_slug ON short_urls(slug);
CREATE INDEX IF NOT EXISTS idx_short_urls_created_by ON short_urls(created_by);
CREATE INDEX IF NOT EXISTS idx_url_clicks_slug ON url_clicks(slug);
CREATE INDEX IF NOT EXISTS idx_url_clicks_clicked_at ON url_clicks(clicked_at DESC);
