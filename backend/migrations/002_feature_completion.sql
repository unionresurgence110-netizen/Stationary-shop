-- Feature-completion migration. Safe for both fresh and existing installations.
ALTER TABLE products ADD COLUMN IF NOT EXISTS manual_featured BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS manual_best_seller BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS manual_most_liked BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS discount_price NUMERIC(12,2);
ALTER TABLE products ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE suggestions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE TABLE IF NOT EXISTS offer_product_discounts (
 offer_id UUID NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
 product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 PRIMARY KEY(offer_id,product_id)
);
CREATE TABLE IF NOT EXISTS reservation_events (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 reservation_id UUID REFERENCES reservations(id) ON DELETE CASCADE,
 actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
 event VARCHAR(40) NOT NULL,
 note TEXT,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS owner_about (
 id BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK(id=TRUE),
 image_url TEXT,address TEXT,latitude NUMERIC(10,7),longitude NUMERIC(10,7),
 phone TEXT,business_email TEXT,social_links JSONB NOT NULL DEFAULT '{}'::jsonb,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS homepage_sections (
 section_key VARCHAR(60) PRIMARY KEY,
 product_ids UUID[] NOT NULL DEFAULT '{}',
 updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_product_likes_product ON product_likes(product_id);
CREATE INDEX IF NOT EXISTS idx_reservations_user ON reservations(user_id,created_at DESC);
