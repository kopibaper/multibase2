-- Inventory Manager Schema
-- Schema: {{schemaName}}

CREATE TABLE IF NOT EXISTS {{schemaName}}.warehouses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  location text,
  is_active bool NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS {{schemaName}}.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  unit_cost numeric(12, 4) NOT NULL DEFAULT 0,
  reorder_point int NOT NULL DEFAULT {{lowStockThreshold}},
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS {{schemaName}}.stock_levels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES {{schemaName}}.products(id) ON DELETE CASCADE,
  warehouse_id uuid NOT NULL REFERENCES {{schemaName}}.warehouses(id) ON DELETE CASCADE,
  qty_available int NOT NULL DEFAULT 0 CHECK (qty_available >= 0),
  qty_reserved int NOT NULL DEFAULT 0 CHECK (qty_reserved >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, warehouse_id)
);

CREATE TABLE IF NOT EXISTS {{schemaName}}.stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES {{schemaName}}.products(id) ON DELETE RESTRICT,
  warehouse_id uuid NOT NULL REFERENCES {{schemaName}}.warehouses(id) ON DELETE RESTRICT,
  type text NOT NULL CHECK (type IN ('in', 'out', 'transfer', 'adjustment')),
  qty int NOT NULL,
  reference text,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS {{schemaName}}.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  contact_email text,
  contact_phone text,
  address text
);

CREATE TABLE IF NOT EXISTS {{schemaName}}.purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES {{schemaName}}.suppliers(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'ordered', 'received', 'cancelled')),
  total_cost numeric(12, 2) NOT NULL DEFAULT 0,
  ordered_at timestamptz,
  received_at timestamptz,
  notes text
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_stock_levels_product_id ON {{schemaName}}.stock_levels(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_levels_warehouse_id ON {{schemaName}}.stock_levels(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_product_id ON {{schemaName}}.stock_movements(product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_movements_warehouse_id ON {{schemaName}}.stock_movements(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier_id ON {{schemaName}}.purchase_orders(supplier_id);

-- Trigger: update stock_levels.qty_available after stock movement
CREATE OR REPLACE FUNCTION {{schemaName}}.apply_stock_movement()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- Ensure stock_levels row exists
  INSERT INTO {{schemaName}}.stock_levels (product_id, warehouse_id, qty_available)
  VALUES (NEW.product_id, NEW.warehouse_id, 0)
  ON CONFLICT (product_id, warehouse_id) DO NOTHING;

  IF NEW.type IN ('in', 'adjustment') THEN
    UPDATE {{schemaName}}.stock_levels
    SET qty_available = qty_available + NEW.qty,
        updated_at = now()
    WHERE product_id = NEW.product_id AND warehouse_id = NEW.warehouse_id;
  ELSIF NEW.type = 'out' THEN
    UPDATE {{schemaName}}.stock_levels
    SET qty_available = qty_available - NEW.qty,
        updated_at = now()
    WHERE product_id = NEW.product_id AND warehouse_id = NEW.warehouse_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_stock_movement_apply
  AFTER INSERT ON {{schemaName}}.stock_movements
  FOR EACH ROW EXECUTE FUNCTION {{schemaName}}.apply_stock_movement();

-- Enable RLS
ALTER TABLE {{schemaName}}.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE {{schemaName}}.stock_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE {{schemaName}}.stock_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users view inventory" ON {{schemaName}}.products
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users view stock" ON {{schemaName}}.stock_levels
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users view movements" ON {{schemaName}}.stock_movements
  FOR SELECT USING (auth.uid() IS NOT NULL);
