-- Rollback: Inventory Manager Schema

DROP TRIGGER IF EXISTS trg_stock_movement_apply ON {{schemaName}}.stock_movements;
DROP FUNCTION IF EXISTS {{schemaName}}.apply_stock_movement();
DROP TABLE IF EXISTS {{schemaName}}.purchase_orders CASCADE;
DROP TABLE IF EXISTS {{schemaName}}.suppliers CASCADE;
DROP TABLE IF EXISTS {{schemaName}}.stock_movements CASCADE;
DROP TABLE IF EXISTS {{schemaName}}.stock_levels CASCADE;
DROP TABLE IF EXISTS {{schemaName}}.products CASCADE;
DROP TABLE IF EXISTS {{schemaName}}.warehouses CASCADE;
