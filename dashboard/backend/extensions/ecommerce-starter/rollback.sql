-- Rollback: E-commerce Starter Schema
-- Drops all tables in reverse dependency order

DROP TABLE IF EXISTS {{schemaName}}.addresses CASCADE;
DROP TABLE IF EXISTS {{schemaName}}.order_items CASCADE;
DROP TABLE IF EXISTS {{schemaName}}.orders CASCADE;
DROP TABLE IF EXISTS {{schemaName}}.customers CASCADE;
DROP TABLE IF EXISTS {{schemaName}}.products CASCADE;
DROP TABLE IF EXISTS {{schemaName}}.categories CASCADE;
