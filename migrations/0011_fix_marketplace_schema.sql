
-- Add missing columns to marketplace_orders
ALTER TABLE marketplace_orders 
ADD COLUMN IF NOT EXISTS payment_method VARCHAR,
ADD COLUMN IF NOT EXISTS podpay_transaction_id VARCHAR,
ADD COLUMN IF NOT EXISTS appmax_transaction_id VARCHAR,
ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS refund_requested_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS refund_completed_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS refund_reason TEXT;

-- Add missing columns to marketplace_products
ALTER TABLE marketplace_products 
ADD COLUMN IF NOT EXISTS product_url TEXT;

-- Create seller_wallet table if not exists
CREATE TABLE IF NOT EXISTS seller_wallet (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id VARCHAR NOT NULL UNIQUE REFERENCES users(id),
  balance_pending INTEGER DEFAULT 0,
  balance_available INTEGER DEFAULT 0,
  total_earned INTEGER DEFAULT 0,
  total_withdrawn INTEGER DEFAULT 0,
  pix_key VARCHAR,
  pix_key_type VARCHAR,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create seller_transactions table if not exists
CREATE TABLE IF NOT EXISTS seller_transactions (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id VARCHAR NOT NULL REFERENCES users(id),
  type VARCHAR NOT NULL,
  amount INTEGER NOT NULL,
  order_id VARCHAR REFERENCES marketplace_orders(id),
  status VARCHAR DEFAULT 'pending',
  description TEXT,
  related_id VARCHAR,
  released_at TIMESTAMP,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create cart_items table if not exists
CREATE TABLE IF NOT EXISTS cart_items (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL REFERENCES users(id),
  product_id VARCHAR NOT NULL REFERENCES marketplace_products(id),
  quantity INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, product_id)
);

-- Create indexes for seller tables
CREATE INDEX IF NOT EXISTS IDX_seller_transactions_seller ON seller_transactions(seller_id);
CREATE INDEX IF NOT EXISTS IDX_seller_transactions_type ON seller_transactions(type);
CREATE INDEX IF NOT EXISTS IDX_seller_transactions_order ON seller_transactions(order_id);
CREATE INDEX IF NOT EXISTS IDX_cart_items_user ON cart_items(user_id);
CREATE INDEX IF NOT EXISTS IDX_cart_items_product ON cart_items(product_id);
