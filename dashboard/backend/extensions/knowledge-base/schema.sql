-- Knowledge Base Schema
-- Schema: {{schemaName}}

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS {{schemaName}}.kb_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  parent_id uuid REFERENCES {{schemaName}}.kb_categories(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS {{schemaName}}.kb_articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid REFERENCES {{schemaName}}.kb_categories(id) ON DELETE SET NULL,
  title text NOT NULL,
  slug text UNIQUE NOT NULL,
  content text,
  excerpt text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  author_id uuid,
  views int NOT NULL DEFAULT 0,
  helpful_yes int NOT NULL DEFAULT 0,
  helpful_no int NOT NULL DEFAULT 0,
  embedding vector(1536),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  search_vector tsvector GENERATED ALWAYS AS (
    to_tsvector('english', coalesce(title, '') || ' ' || coalesce(content, ''))
  ) STORED
);

CREATE TABLE IF NOT EXISTS {{schemaName}}.kb_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS {{schemaName}}.article_tags (
  article_id uuid NOT NULL REFERENCES {{schemaName}}.kb_articles(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES {{schemaName}}.kb_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (article_id, tag_id)
);

CREATE TABLE IF NOT EXISTS {{schemaName}}.kb_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id uuid NOT NULL REFERENCES {{schemaName}}.kb_articles(id) ON DELETE CASCADE,
  content text NOT NULL,
  changed_by uuid,
  changed_at timestamptz NOT NULL DEFAULT now()
);

-- Full-text search index
CREATE INDEX IF NOT EXISTS idx_kb_articles_search ON {{schemaName}}.kb_articles USING GIN (search_vector);

-- Vector similarity index
CREATE INDEX IF NOT EXISTS idx_kb_articles_embedding ON {{schemaName}}.kb_articles
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Other indexes
CREATE INDEX IF NOT EXISTS idx_kb_articles_category_id ON {{schemaName}}.kb_articles(category_id);
CREATE INDEX IF NOT EXISTS idx_kb_articles_status ON {{schemaName}}.kb_articles(status);
CREATE INDEX IF NOT EXISTS idx_kb_versions_article_id ON {{schemaName}}.kb_versions(article_id, changed_at DESC);

-- Enable RLS
ALTER TABLE {{schemaName}}.kb_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE {{schemaName}}.kb_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view published articles" ON {{schemaName}}.kb_articles
  FOR SELECT USING (status = 'published');

CREATE POLICY "Authors manage own articles" ON {{schemaName}}.kb_articles
  FOR ALL USING (author_id = auth.uid());

CREATE POLICY "Authors view own article versions" ON {{schemaName}}.kb_versions
  FOR SELECT USING (
    article_id IN (SELECT id FROM {{schemaName}}.kb_articles WHERE author_id = auth.uid())
  );
