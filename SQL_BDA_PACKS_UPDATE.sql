-- ============================================================
-- BDA — Mise a jour des packs : prix + shiny_chance
-- A executer dans Supabase SQL Editor
-- ============================================================

-- Pack 1 (basique) : 500 coins, 1% shiny
UPDATE bda_packs
SET price = 500, shiny_chance = 0.01
WHERE site_id = 'bda'
  AND id = (SELECT id FROM bda_packs WHERE site_id = 'bda' ORDER BY price ASC LIMIT 1 OFFSET 0);

-- Pack 2 (moyen) : 1000 coins, 5% shiny
UPDATE bda_packs
SET price = 1000, shiny_chance = 0.05
WHERE site_id = 'bda'
  AND id = (SELECT id FROM bda_packs WHERE site_id = 'bda' ORDER BY price ASC LIMIT 1 OFFSET 1);

-- Pack 3 (rare) : 1500 coins, 10% shiny
UPDATE bda_packs
SET price = 1500, shiny_chance = 0.10
WHERE site_id = 'bda'
  AND id = (SELECT id FROM bda_packs WHERE site_id = 'bda' ORDER BY price ASC LIMIT 1 OFFSET 2);

-- ============================================================
-- LOTS : NGO Shoes -> 5 paires + 1x -15%
-- (1 paire deja gagnee, on garde le win existant)
-- ============================================================
UPDATE bda_lots
SET name = 'NGo Shoes — 1 paire de chaussures',
    qty_total = 5,
    qty_remaining = 4
WHERE id = 'ngo_shoes' AND site_id = 'bda';

INSERT INTO bda_lots (id, site_id, name, category, image_url, qty_total, qty_remaining)
VALUES ('ngo_shoes_reduc', 'bda', 'NGo Shoes — -15% pendant 1 an', 'partenaire', 'images/lots/ngo_shoes.png', 1, 1)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  qty_total = EXCLUDED.qty_total,
  qty_remaining = EXCLUDED.qty_remaining;

-- ============================================================
-- LOTS : Goolfy -> 3 x 1 place
-- ============================================================
UPDATE bda_lots
SET name = 'Goolfy Lille — 1 place mini golf',
    qty_total = 3,
    qty_remaining = 3
WHERE id = 'goolfy' AND site_id = 'bda';

-- Verification
SELECT id, name, price, shiny_chance, cards_count FROM bda_packs WHERE site_id = 'bda' ORDER BY price;
SELECT id, name, qty_total, qty_remaining FROM bda_lots WHERE site_id = 'bda' ORDER BY category, name;
