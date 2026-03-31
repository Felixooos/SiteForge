-- ============================================================
-- BDA — Mise a jour des packs : prix + shiny_chance
-- A executer dans Supabase SQL Editor
-- ============================================================

-- Pack 1 (basique) : 100 coins, 1% shiny
UPDATE bda_packs
SET price = 100, shiny_chance = 0.01
WHERE site_id = 'bda'
  AND id = (SELECT id FROM bda_packs WHERE site_id = 'bda' ORDER BY price ASC LIMIT 1 OFFSET 0);

-- Pack 2 (moyen) : 200 coins, 5% shiny
UPDATE bda_packs
SET price = 200, shiny_chance = 0.05
WHERE site_id = 'bda'
  AND id = (SELECT id FROM bda_packs WHERE site_id = 'bda' ORDER BY price ASC LIMIT 1 OFFSET 1);

-- Pack 3 (rare) : 300 coins, 10% shiny
UPDATE bda_packs
SET price = 300, shiny_chance = 0.10
WHERE site_id = 'bda'
  AND id = (SELECT id FROM bda_packs WHERE site_id = 'bda' ORDER BY price ASC LIMIT 1 OFFSET 2);

-- Verification
SELECT id, name, price, shiny_chance, cards_count FROM bda_packs WHERE site_id = 'bda' ORDER BY price;
