CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 name VARCHAR(120) NOT NULL,
 email VARCHAR(255) NOT NULL UNIQUE,
 password_hash TEXT NOT NULL,
 role VARCHAR(20) NOT NULL DEFAULT 'customer' CHECK(role IN ('customer','admin')),
 is_active BOOLEAN NOT NULL DEFAULT TRUE,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS categories (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 name VARCHAR(100) NOT NULL UNIQUE,
 icon VARCHAR(80) DEFAULT 'package',
 is_active BOOLEAN NOT NULL DEFAULT TRUE,
 sort_order INT NOT NULL DEFAULT 0,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS products (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 name VARCHAR(180) NOT NULL,
 description TEXT NOT NULL DEFAULT '',
 price NUMERIC(12,2) NOT NULL CHECK(price>=0),
 category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
 image_key TEXT,
 image_url TEXT,
 stock_quantity INT NOT NULL DEFAULT 0 CHECK(stock_quantity>=0),
 is_available BOOLEAN NOT NULL DEFAULT TRUE,
 is_hidden BOOLEAN NOT NULL DEFAULT FALSE,
 featured BOOLEAN NOT NULL DEFAULT FALSE,
 manual_tags TEXT[] NOT NULL DEFAULT '{}',
 completed_sales INT NOT NULL DEFAULT 0,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS product_likes (
 user_id UUID REFERENCES users(id) ON DELETE CASCADE,
 product_id UUID REFERENCES products(id) ON DELETE CASCADE,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 PRIMARY KEY(user_id,product_id)
);
CREATE TABLE IF NOT EXISTS shop_likes (
 user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS shop_reviews (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id UUID REFERENCES users(id) ON DELETE SET NULL,
 reviewer_name VARCHAR(120) NOT NULL,
 body TEXT NOT NULL CHECK(char_length(body) BETWEEN 3 AND 1500),
 is_visible BOOLEAN NOT NULL DEFAULT TRUE,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS favourites (
 user_id UUID REFERENCES users(id) ON DELETE CASCADE,
 product_id UUID REFERENCES products(id) ON DELETE CASCADE,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 PRIMARY KEY(user_id,product_id)
);
CREATE TABLE IF NOT EXISTS reservations (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id UUID REFERENCES users(id) ON DELETE CASCADE,
 product_id UUID REFERENCES products(id) ON DELETE RESTRICT,
 quantity INT NOT NULL CHECK(quantity>0),
 status VARCHAR(30) NOT NULL DEFAULT 'Request Sent'
  CHECK(status IN ('Request Sent','Reserved','Declined','Cancelled','Expired','Stock Unavailable','Completed')),
 decline_reason TEXT,
 expires_at TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS suggestions (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id UUID REFERENCES users(id) ON DELETE SET NULL,
 title VARCHAR(180) NOT NULL,
 details TEXT DEFAULT '',
 owner_reply TEXT,
 public_status VARCHAR(20) NOT NULL DEFAULT 'private' CHECK(public_status IN ('private','published','hidden')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS suggestion_likes (
 user_id UUID REFERENCES users(id) ON DELETE CASCADE,
 suggestion_id UUID REFERENCES suggestions(id) ON DELETE CASCADE,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 PRIMARY KEY(user_id,suggestion_id)
);
CREATE TABLE IF NOT EXISTS offers (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 title VARCHAR(180) NOT NULL,
 description TEXT DEFAULT '',
 discount_type VARCHAR(12) NOT NULL CHECK(discount_type IN ('percent','fixed')),
 discount_value NUMERIC(12,2) NOT NULL CHECK(discount_value>0),
 starts_at TIMESTAMPTZ NOT NULL,
 ends_at TIMESTAMPTZ NOT NULL,
 show_on_home BOOLEAN NOT NULL DEFAULT FALSE,
 is_hidden BOOLEAN NOT NULL DEFAULT FALSE,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 CHECK(ends_at>starts_at)
);
CREATE TABLE IF NOT EXISTS offer_products (
 offer_id UUID REFERENCES offers(id) ON DELETE CASCADE,
 product_id UUID REFERENCES products(id) ON DELETE CASCADE,
 PRIMARY KEY(offer_id,product_id)
);
CREATE TABLE IF NOT EXISTS notices (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 title VARCHAR(180) NOT NULL,
 body TEXT NOT NULL,
 is_published BOOLEAN NOT NULL DEFAULT FALSE,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS notifications (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id UUID REFERENCES users(id) ON DELETE CASCADE,
 title VARCHAR(180) NOT NULL,
 body TEXT NOT NULL,
 related_type VARCHAR(40),
 related_id UUID,
 is_read BOOLEAN NOT NULL DEFAULT FALSE,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS shop_settings (
 key VARCHAR(100) PRIMARY KEY,
 value JSONB NOT NULL,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_products_public ON products(is_hidden,is_available,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reservations_status ON reservations(status,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id,is_read,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_suggestions_public ON suggestions(public_status,created_at DESC);

INSERT INTO categories(name,icon,sort_order) VALUES
 ('Pen & Pencils','pencil',1),('School Kit','backpack',2),('Kids Fun','toy-brick',3),
 ('Art','palette',4),('Sports','trophy',5),('Decorative','flower-2',6)
ON CONFLICT(name) DO NOTHING;
