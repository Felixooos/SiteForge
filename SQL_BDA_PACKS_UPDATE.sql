-- ============================================================
-- BDA — Mise a jour des packs + lots
-- A executer dans Supabase SQL Editor
-- ============================================================

-- Pack 1 (basique) : 500 coins, 1% shiny
UPDATE bda_packs
SET price = 500, shiny_chance = 0.01
WHERE site_id = 'bda'
  AND id = (SELECT id FROM bda_packs WHERE site_id = 'bda' ORDER BY price ASC LIMIT 1 OFFSET 0);

-- Pack 2 (moyen) : 1500 coins, 5% shiny
UPDATE bda_packs
SET price = 1500, shiny_chance = 0.05
WHERE site_id = 'bda'
  AND id = (SELECT id FROM bda_packs WHERE site_id = 'bda' ORDER BY price ASC LIMIT 1 OFFSET 1);

-- Pack 3 (rare) : 3000 coins, 10% shiny
UPDATE bda_packs
SET price = 3000, shiny_chance = 0.10
WHERE site_id = 'bda'
  AND id = (SELECT id FROM bda_packs WHERE site_id = 'bda' ORDER BY price ASC LIMIT 1 OFFSET 2);

-- ============================================================
-- LOTS : Separer en quantites individuelles
-- ============================================================

-- Starship Laser : 4 x 1 place
UPDATE bda_lots
SET name = 'Starship Laser Lille — 1 place laser game',
    qty_total = 4, qty_remaining = 4
WHERE id = 'starship_laser' AND site_id = 'bda';

-- Musee La Piscine Roubaix : 4 x 1 place
UPDATE bda_lots
SET name = 'Musee La Piscine Roubaix — 1 place',
    qty_total = 4, qty_remaining = 4
WHERE id = 'musee_piscine' AND site_id = 'bda';

-- Metrobowling : 6 x 1 place bowling
UPDATE bda_lots
SET name = 'Metrobowling — 1 place bowling',
    qty_total = 6, qty_remaining = 6
WHERE id = 'metrobowling' AND site_id = 'bda';

-- Weembi : 10 bons de reduc -> 10 x 1 bon (1 deja gagne, on garde le win)
UPDATE bda_lots
SET name = 'Weembi — 1 bon de reduc chute libre',
    qty_total = 10, qty_remaining = 9
WHERE id = 'weembi' AND site_id = 'bda';

-- Weezpark : supprimer l'ancien lot combine
DELETE FROM bda_lots WHERE id = 'weezpark' AND site_id = 'bda'
  AND NOT EXISTS (SELECT 1 FROM bda_lot_wins WHERE lot_id = 'weezpark');

-- Weezpark split : 2 x 1 place LaserWeez
INSERT INTO bda_lots (id, site_id, name, category, image_url, qty_total, qty_remaining)
VALUES ('weezpark_laser', 'bda', 'Weezpark — 1 place LaserWeez', 'partenaire', 'images/lots/weezpark.png', 2, 2)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, qty_total = EXCLUDED.qty_total, qty_remaining = EXCLUDED.qty_remaining;

-- Weezpark split : 2 x 1 place WeezJump
INSERT INTO bda_lots (id, site_id, name, category, image_url, qty_total, qty_remaining)
VALUES ('weezpark_jump', 'bda', 'Weezpark — 1 place WeezJump', 'partenaire', 'images/lots/weezpark.png', 2, 2)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, qty_total = EXCLUDED.qty_total, qty_remaining = EXCLUDED.qty_remaining;

-- NGO Shoes : 5 x 1 paire (1 deja gagnee)
UPDATE bda_lots
SET name = 'NGo Shoes — 1 paire de chaussures',
    qty_total = 5, qty_remaining = 4
WHERE id = 'ngo_shoes' AND site_id = 'bda';

-- NGO Shoes reduc : 1 x -15%
INSERT INTO bda_lots (id, site_id, name, category, image_url, qty_total, qty_remaining)
VALUES ('ngo_shoes_reduc', 'bda', 'NGo Shoes — -15% pendant 1 an', 'partenaire', 'images/lots/ngo_shoes.png', 1, 1)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, qty_total = EXCLUDED.qty_total, qty_remaining = EXCLUDED.qty_remaining;

-- Goolfy : 3 x 1 place
UPDATE bda_lots
SET name = 'Goolfy Lille — 1 place mini golf',
    qty_total = 3, qty_remaining = 3
WHERE id = 'goolfy' AND site_id = 'bda';

-- Verification
SELECT id, name, price, shiny_chance FROM bda_packs WHERE site_id = 'bda' ORDER BY price;
SELECT id, name, qty_total, qty_remaining FROM bda_lots WHERE site_id = 'bda' ORDER BY category, name;
