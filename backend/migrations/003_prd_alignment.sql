-- Apply after the original schema.
-- Removes product-review features and adds PRD-aligned fields safely.

-- Shop reviews
CREATE TABLE IF NOT EXISTS shop_reviews (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
user_id UUID REFERENCES users(id) ON DELETE SET NULL,
reviewer_name VARCHAR(120) NOT NULL,
body TEXT NOT NULL CHECK(char_length(body) BETWEEN 3 AND 1500),
is_visible BOOLEAN NOT NULL DEFAULT TRUE,
created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Remove product-review features
DROP TABLE IF EXISTS product_review_likes CASCADE;
DROP TABLE IF EXISTS reviews CASCADE;
DROP TABLE IF EXISTS offer_product_discounts CASCADE;

-- Product fields
ALTER TABLE products
ADD COLUMN IF NOT EXISTS manual_tags TEXT[] NOT NULL DEFAULT '{}';

ALTER TABLE products
ADD COLUMN IF NOT EXISTS is_available BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE products
ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE products
ADD COLUMN IF NOT EXISTS featured BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE products
ADD COLUMN IF NOT EXISTS completed_sales INT NOT NULL DEFAULT 0;

-- Reservation fields
ALTER TABLE reservations
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

ALTER TABLE reservations
ADD COLUMN IF NOT EXISTS decline_reason TEXT;

-- Category image and update support
ALTER TABLE categories
ADD COLUMN IF NOT EXISTS image_key TEXT;

ALTER TABLE categories
ADD COLUMN IF NOT EXISTS image_url TEXT;

ALTER TABLE categories
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_shop_reviews_visible
ON shop_reviews(is_visible, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_categories_active_sort
ON categories(is_active, sort_order, name);
