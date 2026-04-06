-- Rollback: Blog CMS Schema

DROP TRIGGER IF EXISTS trg_posts_updated_at ON {{schemaName}}.posts;
DROP FUNCTION IF EXISTS {{schemaName}}.update_post_updated_at();
DROP TABLE IF EXISTS {{schemaName}}.comments CASCADE;
DROP TABLE IF EXISTS {{schemaName}}.post_categories CASCADE;
DROP TABLE IF EXISTS {{schemaName}}.post_tags CASCADE;
DROP TABLE IF EXISTS {{schemaName}}.posts CASCADE;
DROP TABLE IF EXISTS {{schemaName}}.tags CASCADE;
DROP TABLE IF EXISTS {{schemaName}}.categories CASCADE;
DROP TABLE IF EXISTS {{schemaName}}.authors CASCADE;
