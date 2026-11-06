-- OM RIDHI SIDHI: demo catalogue + Diwali Kit category
-- Apply after migrations 002 and 003.
-- Safe to run more than once: category is upserted and products are inserted only once by name.

INSERT INTO categories(name, icon, sort_order, is_active)
VALUES ('Diwali Kit', 'gift', 7, TRUE)
ON CONFLICT (name) DO UPDATE
SET icon = EXCLUDED.icon,
    sort_order = EXCLUDED.sort_order,
    is_active = TRUE;

WITH demo_products(name, description, price, category_name, stock_quantity, featured, tags) AS (
    VALUES
      ('Classic Ball Pen', 'Smooth everyday writing pen. Sample listing — confirm price and stock before launch.', 15.00::numeric, 'Pen & Pencils', 30, TRUE, ARRAY['demo','sample','writing']::text[]),
      ('HB Pencil Pack', 'Pack of reliable HB pencils for school and everyday writing. Sample listing.', 40.00::numeric, 'Pen & Pencils', 25, TRUE, ARRAY['demo','sample','writing']::text[]),
      ('Geometry Box', 'Basic geometry set for classroom mathematics. Sample listing.', 160.00::numeric, 'School Kit', 12, TRUE, ARRAY['demo','sample','school']::text[]),
      ('Colour Pencil Set', 'Colour pencils for drawing, colouring and school projects. Sample listing.', 120.00::numeric, 'Art', 15, FALSE, ARRAY['demo','sample','art']::text[]),
      ('Sketch Book', 'Blank pages for sketches, notes and creative ideas. Sample listing.', 100.00::numeric, 'Art', 18, FALSE, ARRAY['demo','sample','art']::text[]),
      ('Kids Puzzle Set', 'A fun beginner puzzle activity for kids. Sample listing.', 180.00::numeric, 'Kids Fun', 8, FALSE, ARRAY['demo','sample','kids']::text[]),
      ('Mini Football', 'A lightweight ball for casual outdoor play. Sample listing.', 280.00::numeric, 'Sports', 6, FALSE, ARRAY['demo','sample','sports']::text[]),
      ('Decorative Sticker Pack', 'Colourful stickers for notebooks, cards and crafts. Sample listing.', 50.00::numeric, 'Decorative', 20, FALSE, ARRAY['demo','sample','decorative']::text[]),
      ('Diwali Gift Stationery Kit', 'A festive sample kit with a notebook, pen, pencil and greeting card. Update contents, price and photo before launch.', 299.00::numeric, 'Diwali Kit', 10, TRUE, ARRAY['demo','sample','diwali','gift']::text[]),
      ('Diwali Greeting Card Set', 'A sample set of festive greeting cards for Diwali gifting. Update price and stock before launch.', 99.00::numeric, 'Diwali Kit', 15, FALSE, ARRAY['demo','sample','diwali','greeting']::text[]),
      ('Diwali Art & Craft Pack', 'A sample festive art pack for creative decorations. Update contents and price before launch.', 199.00::numeric, 'Diwali Kit', 10, FALSE, ARRAY['demo','sample','diwali','art']::text[])
)
INSERT INTO products(name, description, price, category_id, stock_quantity, is_available, is_hidden, featured, manual_tags)
SELECT d.name, d.description, d.price, c.id, d.stock_quantity, TRUE, FALSE, d.featured, d.tags
FROM demo_products d
JOIN categories c ON c.name = d.category_name
WHERE NOT EXISTS (
    SELECT 1 FROM products p WHERE p.name = d.name
);
