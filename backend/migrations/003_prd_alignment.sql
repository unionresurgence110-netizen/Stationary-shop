
-- Apply after the original schema. Removes all product-review features and migrates safely.
CREATE TABLE IF NOT EXISTS shop_reviews (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id UUID REFERENCES users(id) ON DELETE SET NULL,
 reviewer_name VARCHAR(120) NOT NULL,
 body TEXT NOT NULL CHECK(char_length(body) BETWEEN 3 AND 1500),
 is_visible BOOLEAN NOT NULL DEFAULT TRUE,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
DROP TABLE IF EXISTS product_review_likes CASCADE;
DROP TABLE IF EXISTS reviews CASCADE;
DROP TABLE IF EXISTS offer_product_discounts CASCADE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS manual_tags TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_available BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS featured BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS completed_sales INT NOT NULL DEFAULT 0;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS decline_reason TEXT;
CREATE INDEX IF NOT EXISTS idx_shop_reviews_visible ON shop_reviews(is_visible,created_at DESC);
