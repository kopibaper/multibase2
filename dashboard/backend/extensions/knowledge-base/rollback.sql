-- Rollback: Knowledge Base Schema

DROP TABLE IF EXISTS {{schemaName}}.kb_versions CASCADE;
DROP TABLE IF EXISTS {{schemaName}}.article_tags CASCADE;
DROP TABLE IF EXISTS {{schemaName}}.kb_tags CASCADE;
DROP TABLE IF EXISTS {{schemaName}}.kb_articles CASCADE;
DROP TABLE IF EXISTS {{schemaName}}.kb_categories CASCADE;
