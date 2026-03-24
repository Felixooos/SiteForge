-- ============================================================
--  BDA — VRAIES CARTES (photos réelles des membres BDA)
--  À exécuter dans Supabase SQL Editor
--
--  Remplace les cartes de test (Flamardor etc.) par les vraies
--  cartes correspondant aux fichiers PNG dans output/bda/images/
-- ============================================================

-- Supprimer les anciennes cartes de test
DELETE FROM bda_user_cards WHERE site_id = 'bda';
DELETE FROM bda_cards       WHERE site_id = 'bda';

-- ============================================================
-- 24 CARTES NORMALES
-- Fichiers : output/bda/images/cards/normal/Carte_PRENOM.png
-- ============================================================
INSERT INTO bda_cards (site_id, name, description, image_url, rarity, is_shiny, card_number, attack_name, attack_damage) VALUES
  ('bda', 'Ambre',      'Carte BDA — Ambre',      '/bda/images/cards/normal/Carte_Ambre.png',      'rare',      FALSE,  1, 'Flamme dorée',      40),
  ('bda', 'Amicie',     'Carte BDA — Amicie',     '/bda/images/cards/normal/Carte_Amicie.png',     'common',    FALSE,  2, 'Éclat solaire',     30),
  ('bda', 'Anaïs',      'Carte BDA — Anaïs',      '/bda/images/cards/normal/Carte_Anais_.png',     'rare',      FALSE,  3, 'Vague cristal',     35),
  ('bda', 'Annaël',     'Carte BDA — Annaël',     '/bda/images/cards/normal/Carte_Annael.png',     'common',    FALSE,  4, 'Vent du nord',      25),
  ('bda', 'Anne',       'Carte BDA — Anne',       '/bda/images/cards/normal/Carte_Anne.png',       'rare',      FALSE,  5, 'Lumière pure',      45),
  ('bda', 'Anouk',      'Carte BDA — Anouk',      '/bda/images/cards/normal/Carte_Anouk.png',      'common',    FALSE,  6, 'Liane sauvage',     20),
  ('bda', 'Bastien',    'Carte BDA — Bastien',    '/bda/images/cards/normal/Carte_Bastien.png',    'epic',      FALSE,  7, 'Coup de tonnerre',  60),
  ('bda', 'Candy',      'Carte BDA — Candy',      '/bda/images/cards/normal/Carte_Candy.png',      'common',    FALSE,  8, 'Pluie sucrée',      20),
  ('bda', 'Cyrielle',   'Carte BDA — Cyrielle',   '/bda/images/cards/normal/Carte_Cyrielle.png',   'rare',      FALSE,  9, 'Tornade rose',      40),
  ('bda', 'Edouard',    'Carte BDA — Edouard',    '/bda/images/cards/normal/Carte_Edouard.png',    'epic',      FALSE, 10, 'Frappe acier',      65),
  ('bda', 'Eliott',     'Carte BDA — Eliott',     '/bda/images/cards/normal/Carte_Eliott.png',     'rare',      FALSE, 11, 'Sprint électrique', 50),
  ('bda', 'Gaëtan',     'Carte BDA — Gaëtan',     '/bda/images/cards/normal/Carte_Gaetan.png',     'legendary', FALSE, 12, 'Séisme ultime',     90),
  ('bda', 'Ingrid',     'Carte BDA — Ingrid',     '/bda/images/cards/normal/Carte_Ingrid.png',     'rare',      FALSE, 13, 'Blizzard nordique', 45),
  ('bda', 'Ismail',     'Carte BDA — Ismail',     '/bda/images/cards/normal/Carte_Ismail.png',     'epic',      FALSE, 14, 'Rayon cosmique',    70),
  ('bda', 'Iuri',       'Carte BDA — Iuri',       '/bda/images/cards/normal/Carte_Iuri.png',       'common',    FALSE, 15, 'Onde sonique',      30),
  ('bda', 'Jade',       'Carte BDA — Jade',       '/bda/images/cards/normal/Carte_Jade.png',       'rare',      FALSE, 16, 'Éclair vert',       40),
  ('bda', 'Kimlee',     'Carte BDA — Kimlee',     '/bda/images/cards/normal/Carte_Kimlee.png',     'common',    FALSE, 17, 'Danse du dragon',   25),
  ('bda', 'Manu',       'Carte BDA — Manu',       '/bda/images/cards/normal/Carte_Manu.png',       'epic',      FALSE, 18, 'Charge titanesque', 75),
  ('bda', 'Marie',      'Carte BDA — Marie',      '/bda/images/cards/normal/Carte_Marie.png',      'rare',      FALSE, 19, 'Flèche lumineuse',  50),
  ('bda', 'Nicolas',    'Carte BDA — Nicolas',    '/bda/images/cards/normal/Carte_Nicolas.png',    'epic',      FALSE, 20, 'Impact céleste',    80),
  ('bda', 'Pauline',    'Carte BDA — Pauline',    '/bda/images/cards/normal/Carte_Pauline.png',    'legendary', FALSE, 21, 'Nova rose',         95),
  ('bda', 'Tanguy',     'Carte BDA — Tanguy',     '/bda/images/cards/normal/Carte_Tanguy.png',     'rare',      FALSE, 22, 'Onde gravitons',    55),
  ('bda', 'Timothée',   'Carte BDA — Timothée',   '/bda/images/cards/normal/Carte_Timothee.png',   'common',    FALSE, 23, 'Esquive parfaite',  20),
  ('bda', 'Yann',       'Carte BDA — Yann',       '/bda/images/cards/normal/Carte_Yann.png',       'legendary', FALSE, 24, 'Genèse absolue',   100)
ON CONFLICT (site_id, card_number, is_shiny) DO UPDATE
  SET name = EXCLUDED.name,
      description = EXCLUDED.description,
      image_url = EXCLUDED.image_url,
      rarity = EXCLUDED.rarity,
      attack_name = EXCLUDED.attack_name,
      attack_damage = EXCLUDED.attack_damage;

-- ============================================================
-- 24 CARTES SHINY (Collector)
-- Fichiers : output/bda/images/cards/shiny/Collector_PRENOM_.png
-- ============================================================
INSERT INTO bda_cards (site_id, name, description, image_url, rarity, is_shiny, card_number, attack_name, attack_damage) VALUES
  ('bda', 'Ambre ✨',    'Collector BDA — Ambre',    '/bda/images/cards/shiny/Collector_Ambre_.png',    'rare',      TRUE,  1, 'Flamme dorée+',      60),
  ('bda', 'Amicie ✨',   'Collector BDA — Amicie',   '/bda/images/cards/shiny/Collector_Amicie_.png',   'common',    TRUE,  2, 'Éclat solaire+',     45),
  ('bda', 'Anaïs ✨',    'Collector BDA — Anaïs',    '/bda/images/cards/shiny/Collector_Anais_.png',    'rare',      TRUE,  3, 'Vague cristal+',     50),
  ('bda', 'Annaël ✨',   'Collector BDA — Annaël',   '/bda/images/cards/shiny/Collector_Annael_.png',   'common',    TRUE,  4, 'Vent du nord+',      40),
  ('bda', 'Anne ✨',     'Collector BDA — Anne',     '/bda/images/cards/shiny/Collector_Anne_.png',     'rare',      TRUE,  5, 'Lumière pure+',      65),
  ('bda', 'Anouk ✨',    'Collector BDA — Anouk',    '/bda/images/cards/shiny/Collector_Anouk_.png',    'common',    TRUE,  6, 'Liane sauvage+',     35),
  ('bda', 'Bastien ✨',  'Collector BDA — Bastien',  '/bda/images/cards/shiny/Collector_Bastien_.png',  'epic',      TRUE,  7, 'Coup de tonnerre+',  80),
  ('bda', 'Candy ✨',    'Collector BDA — Candy',    '/bda/images/cards/shiny/Collector_Candy_.png',    'common',    TRUE,  8, 'Pluie sucrée+',      35),
  ('bda', 'Cyrielle ✨', 'Collector BDA — Cyrielle', '/bda/images/cards/shiny/Collector_Cyrielle_.png', 'rare',      TRUE,  9, 'Tornade rose+',      60),
  ('bda', 'Edouard ✨',  'Collector BDA — Edouard',  '/bda/images/cards/shiny/Collector_Edouard_.png',  'epic',      TRUE, 10, 'Frappe acier+',      90),
  ('bda', 'Eliott ✨',   'Collector BDA — Eliott',   '/bda/images/cards/shiny/Collector_Eliott_.png',   'rare',      TRUE, 11, 'Sprint électrique+', 70),
  ('bda', 'Gaëtan ✨',   'Collector BDA — Gaëtan',   '/bda/images/cards/shiny/Collector_Gaetan_.png',   'legendary', TRUE, 12, 'Séisme ultime+',    120),
  ('bda', 'Ingrid ✨',   'Collector BDA — Ingrid',   '/bda/images/cards/shiny/Collector_Ingrid_.png',   'rare',      TRUE, 13, 'Blizzard nordique+', 65),
  ('bda', 'Ismail ✨',   'Collector BDA — Ismail',   '/bda/images/cards/shiny/Collector_Ismail_.png',   'epic',      TRUE, 14, 'Rayon cosmique+',    95),
  ('bda', 'Iuri ✨',     'Collector BDA — Iuri',     '/bda/images/cards/shiny/Collector_Iuri_.png',     'common',    TRUE, 15, 'Onde sonique+',      45),
  ('bda', 'Jade ✨',     'Collector BDA — Jade',     '/bda/images/cards/shiny/Collector_Jade_.png',     'rare',      TRUE, 16, 'Éclair vert+',       60),
  ('bda', 'Kimlee ✨',   'Collector BDA — Kimlee',   '/bda/images/cards/shiny/Collector_Kimlee_.png',   'common',    TRUE, 17, 'Danse du dragon+',   40),
  ('bda', 'Manu ✨',     'Collector BDA — Manu',     '/bda/images/cards/shiny/Collector_Manu_.png',     'epic',      TRUE, 18, 'Charge titanesque+', 100),
  ('bda', 'Marie ✨',    'Collector BDA — Marie',    '/bda/images/cards/shiny/Collector_Marie_.png',    'rare',      TRUE, 19, 'Flèche lumineuse+',  70),
  ('bda', 'Nicolas ✨',  'Collector BDA — Nicolas',  '/bda/images/cards/shiny/Collector_Nicolas_.png',  'epic',      TRUE, 20, 'Impact céleste+',    110),
  ('bda', 'Pauline ✨',  'Collector BDA — Pauline',  '/bda/images/cards/shiny/Collector_Pauline_.png',  'legendary', TRUE, 21, 'Nova rose+',         130),
  ('bda', 'Tanguy ✨',   'Collector BDA — Tanguy',   '/bda/images/cards/shiny/Collector_Tanguy_.png',   'rare',      TRUE, 22, 'Onde gravitons+',    75),
  ('bda', 'Timothée ✨', 'Collector BDA — Timothée', '/bda/images/cards/shiny/Collector_Timothee_.png', 'common',    TRUE, 23, 'Esquive parfaite+',  35),
  ('bda', 'Yann ✨',     'Collector BDA — Yann',     '/bda/images/cards/shiny/Collector_Yann_.png',     'legendary', TRUE, 24, 'Genèse absolue+',   140)
ON CONFLICT (site_id, card_number, is_shiny) DO UPDATE
  SET name = EXCLUDED.name,
      description = EXCLUDED.description,
      image_url = EXCLUDED.image_url,
      rarity = EXCLUDED.rarity,
      attack_name = EXCLUDED.attack_name,
      attack_damage = EXCLUDED.attack_damage;

-- ============================================================
-- FIN
-- ============================================================
-- ✅ 24 cartes normales avec vrais fichiers Carte_PRENOM.png
-- ✅ 24 cartes shiny avec vrais fichiers Collector_PRENOM_.png
-- IMPORTANT : les user_cards existantes ont été supprimées aussi
-- (elles référencaient les anciens card_id).
