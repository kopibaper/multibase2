-- Blog CMS Schema
-- Schema: {{schemaName}}

CREATE TABLE IF NOT EXISTS {{schemaName}}.authors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  name text NOT NULL,
  bio text,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS {{schemaName}}.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS {{schemaName}}.tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS {{schemaName}}.posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid REFERENCES {{schemaName}}.authors(id) ON DELETE SET NULL,
  title text NOT NULL,
  slug text UNIQUE NOT NULL,
  content text,
  excerpt text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  search_vector tsvector GENERATED ALWAYS AS (
    to_tsvector('english', coalesce(title, '') || ' ' || coalesce(content, ''))
  ) STORED
);

CREATE TABLE IF NOT EXISTS {{schemaName}}.post_tags (
  post_id uuid NOT NULL REFERENCES {{schemaName}}.posts(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES {{schemaName}}.tags(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, tag_id)
);

CREATE TABLE IF NOT EXISTS {{schemaName}}.post_categories (
  post_id uuid NOT NULL REFERENCES {{schemaName}}.posts(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES {{schemaName}}.categories(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, category_id)
);

CREATE TABLE IF NOT EXISTS {{schemaName}}.comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES {{schemaName}}.posts(id) ON DELETE CASCADE,
  author_name text NOT NULL,
  content text NOT NULL,
  approved bool NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Full-text search index
CREATE INDEX IF NOT EXISTS idx_posts_search_vector ON {{schemaName}}.posts USING GIN (search_vector);
CREATE INDEX IF NOT EXISTS idx_posts_status ON {{schemaName}}.posts(status);
CREATE INDEX IF NOT EXISTS idx_posts_published_at ON {{schemaName}}.posts(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_author_id ON {{schemaName}}.posts(author_id);
CREATE INDEX IF NOT EXISTS idx_comments_post_id ON {{schemaName}}.comments(post_id);

-- Auto-update updated_at on posts
CREATE OR REPLACE FUNCTION {{schemaName}}.update_post_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_posts_updated_at
  BEFORE UPDATE ON {{schemaName}}.posts
  FOR EACH ROW EXECUTE FUNCTION {{schemaName}}.update_post_updated_at();

-- Enable Row Level Security
ALTER TABLE {{schemaName}}.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE {{schemaName}}.comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view published posts" ON {{schemaName}}.posts
  FOR SELECT USING (status = 'published');

CREATE POLICY "Authors can manage own posts" ON {{schemaName}}.posts
  FOR ALL USING (
    author_id IN (SELECT id FROM {{schemaName}}.authors WHERE user_id = auth.uid())
  );

CREATE POLICY "Anyone can view approved comments" ON {{schemaName}}.comments
  FOR SELECT USING (approved = true);

CREATE POLICY "Anyone can insert comments" ON {{schemaName}}.comments
  FOR INSERT WITH CHECK (true);
