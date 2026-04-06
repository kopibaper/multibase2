-- E-commerce Starter Schema
-- Schema: {{schemaName}}

CREATE TABLE IF NOT EXISTS {{schemaName}}.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  parent_id uuid REFERENCES {{schemaName}}.categories(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS {{schemaName}}.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  price numeric(12, 2) NOT NULL CHECK (price >= 0),
  stock_qty int NOT NULL DEFAULT 0 CHECK (stock_qty >= 0),
  category_id uuid REFERENCES {{schemaName}}.categories(id) ON DELETE SET NULL,
  images jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS {{schemaName}}.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  email text NOT NULL,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS {{schemaName}}.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES {{schemaName}}.customers(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','shipped','delivered','cancelled')),
  total numeric(12, 2) NOT NULL DEFAULT 0 CHECK (total >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS {{schemaName}}.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES {{schemaName}}.orders(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES {{schemaName}}.products(id) ON DELETE RESTRICT,
  qty int NOT NULL CHECK (qty > 0),
  unit_price numeric(12, 2) NOT NULL CHECK (unit_price >= 0)
);

CREATE TABLE IF NOT EXISTS {{schemaName}}.addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES {{schemaName}}.customers(id) ON DELETE CASCADE,
  street text NOT NULL,
  city text NOT NULL,
  zip text NOT NULL,
  country text NOT NULL DEFAULT 'DE',
  is_default bool NOT NULL DEFAULT false
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_products_category_id ON {{schemaName}}.products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_created_at ON {{schemaName}}.products(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON {{schemaName}}.orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON {{schemaName}}.orders(status);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON {{schemaName}}.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON {{schemaName}}.order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_addresses_customer_id ON {{schemaName}}.addresses(customer_id);

-- Enable Row Level Security
ALTER TABLE {{schemaName}}.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE {{schemaName}}.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE {{schemaName}}.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE {{schemaName}}.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE {{schemaName}}.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE {{schemaName}}.addresses ENABLE ROW LEVEL SECURITY;

-- RLS Policies: public read for products/categories, authenticated users manage own data
CREATE POLICY "Anyone can view categories" ON {{schemaName}}.categories FOR SELECT USING (true);
CREATE POLICY "Anyone can view products" ON {{schemaName}}.products FOR SELECT USING (true);
CREATE POLICY "Customers can view own data" ON {{schemaName}}.customers FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Customers can update own data" ON {{schemaName}}.customers FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Customers can view own orders" ON {{schemaName}}.orders FOR SELECT USING (
  customer_id IN (SELECT id FROM {{schemaName}}.customers WHERE user_id = auth.uid())
);
CREATE POLICY "Customers can view own order items" ON {{schemaName}}.order_items FOR SELECT USING (
  order_id IN (
    SELECT o.id FROM {{schemaName}}.orders o
    JOIN {{schemaName}}.customers c ON c.id = o.customer_id
    WHERE c.user_id = auth.uid()
  )
);
CREATE POLICY "Customers can manage own addresses" ON {{schemaName}}.addresses FOR ALL USING (
  customer_id IN (SELECT id FROM {{schemaName}}.customers WHERE user_id = auth.uid())
);
