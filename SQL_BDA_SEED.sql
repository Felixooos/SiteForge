-- ============================================================
--  BDA — SEED DATA + ADMIN FIX
--  À exécuter APRÈS SQL_BDA_SETUP.sql
-- ============================================================

-- ============================================================
-- FIX: Allow admins to update OTHER users' solde/profile
-- The default etudiants_update policy only allows self-update.
-- We add an admin-level update policy.
-- ============================================================
CREATE POLICY "etudiants_admin_update" ON etudiants FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM etudiants e2
    WHERE e2.email = auth.jwt() ->> 'email'
    AND e2.site_id = etudiants.site_id
    AND (e2.is_admin = TRUE OR e2.is_super_admin = TRUE)
  )
);

-- ============================================================
-- SEED: 24 cartes normales
-- Images: /bda/images/cards/normal/01.png ... 24.png
-- ============================================================
INSERT INTO bda_cards (site_id, name, description, image_url, rarity, is_shiny, card_number, attack_name, attack_damage) VALUES
  ('bda', 'Flamardor',     'Un reptile de feu flamboyant',         '/bda/images/cards/normal/01.png', 'common',    FALSE, 1,  'Souffle ardent',   30),
  ('bda', 'Aquaserpent',   'Serpent des abysses',                  '/bda/images/cards/normal/02.png', 'common',    FALSE, 2,  'Vague torrentielle', 25),
  ('bda', 'Terrox',        'Golem de pierre ancestral',            '/bda/images/cards/normal/03.png', 'common',    FALSE, 3,  'Séisme',           35),
  ('bda', 'Ventoile',      'Étoile des vents',                     '/bda/images/cards/normal/04.png', 'common',    FALSE, 4,  'Tornade céleste',  20),
  ('bda', 'Fulgurion',     'Lézard électrique',                    '/bda/images/cards/normal/05.png', 'common',    FALSE, 5,  'Éclair foudroyant', 40),
  ('bda', 'Floracine',     'Plante carnivore enchantée',           '/bda/images/cards/normal/06.png', 'common',    FALSE, 6,  'Lianes piégeuses', 20),
  ('bda', 'Glacius',       'Esprit des glaces éternelles',         '/bda/images/cards/normal/07.png', 'rare',      FALSE, 7,  'Blizzard arctique', 45),
  ('bda', 'Ombralis',      'Ombre vivante du crépuscule',          '/bda/images/cards/normal/08.png', 'rare',      FALSE, 8,  'Griffe obscure',   40),
  ('bda', 'Luminex',       'Être de lumière pure',                 '/bda/images/cards/normal/09.png', 'rare',      FALSE, 9,  'Rayon sacré',      50),
  ('bda', 'Pyronix',       'Phoenix de cendres',                   '/bda/images/cards/normal/10.png', 'rare',      FALSE, 10, 'Résurrection flamboyante', 55),
  ('bda', 'Toxirak',       'Arachnide empoisonnée',                '/bda/images/cards/normal/11.png', 'common',    FALSE, 11, 'Venin mortel',     30),
  ('bda', 'Psykora',       'Méduse psychique',                     '/bda/images/cards/normal/12.png', 'rare',      FALSE, 12, 'Onde cérébrale',   45),
  ('bda', 'Chronotik',     'Gardien du temps',                     '/bda/images/cards/normal/13.png', 'epic',      FALSE, 13, 'Distorsion temporelle', 60),
  ('bda', 'Dracofer',      'Dragon blindé',                        '/bda/images/cards/normal/14.png', 'epic',      FALSE, 14, 'Souffle d''acier', 65),
  ('bda', 'Tempestia',     'Déesse de la tempête',                 '/bda/images/cards/normal/15.png', 'epic',      FALSE, 15, 'Foudre divine',    70),
  ('bda', 'Noctalis',      'Loup des ténèbres',                    '/bda/images/cards/normal/16.png', 'rare',      FALSE, 16, 'Hurlement nocturne', 40),
  ('bda', 'Gravirock',     'Titan gravitationnel',                 '/bda/images/cards/normal/17.png', 'common',    FALSE, 17, 'Onde de choc',     25),
  ('bda', 'Mystiflore',    'Fée des forêts anciennes',             '/bda/images/cards/normal/18.png', 'common',    FALSE, 18, 'Pollen magique',   20),
  ('bda', 'Volcanor',      'Tortue volcanique',                    '/bda/images/cards/normal/19.png', 'rare',      FALSE, 19, 'Éruption',         50),
  ('bda', 'Cybertron',     'Robot du futur',                       '/bda/images/cards/normal/20.png', 'epic',      FALSE, 20, 'Laser plasma',     75),
  ('bda', 'Abyssalia',     'Léviathan des profondeurs',            '/bda/images/cards/normal/21.png', 'legendary', FALSE, 21, 'Raz-de-marée',     90),
  ('bda', 'Solarion',      'Titan solaire ancestral',              '/bda/images/cards/normal/22.png', 'legendary', FALSE, 22, 'Nova solaire',     95),
  ('bda', 'Nébulix',       'Entité cosmique primordiale',          '/bda/images/cards/normal/23.png', 'legendary', FALSE, 23, 'Trou noir',        100),
  ('bda', 'Éternalos',     'Le Créateur — carte ultime',           '/bda/images/cards/normal/24.png', 'legendary', FALSE, 24, 'Genèse absolue',   120)
ON CONFLICT (site_id, card_number, is_shiny) DO NOTHING;

-- ============================================================
-- SEED: 24 cartes shiny (mêmes noms mais shiny)
-- Images: /bda/images/cards/shiny/01.png ... 24.png
-- ============================================================
INSERT INTO bda_cards (site_id, name, description, image_url, rarity, is_shiny, card_number, attack_name, attack_damage) VALUES
  ('bda', 'Flamardor ✨',     'Flamardor en version Shiny !',       '/bda/images/cards/shiny/01.png', 'common',    TRUE, 1,  'Souffle ardent+',   45),
  ('bda', 'Aquaserpent ✨',   'Aquaserpent en version Shiny !',     '/bda/images/cards/shiny/02.png', 'common',    TRUE, 2,  'Vague torrentielle+', 40),
  ('bda', 'Terrox ✨',        'Terrox en version Shiny !',          '/bda/images/cards/shiny/03.png', 'common',    TRUE, 3,  'Séisme+',           50),
  ('bda', 'Ventoile ✨',      'Ventoile en version Shiny !',        '/bda/images/cards/shiny/04.png', 'common',    TRUE, 4,  'Tornade céleste+',  35),
  ('bda', 'Fulgurion ✨',     'Fulgurion en version Shiny !',       '/bda/images/cards/shiny/05.png', 'common',    TRUE, 5,  'Éclair foudroyant+', 55),
  ('bda', 'Floracine ✨',     'Floracine en version Shiny !',       '/bda/images/cards/shiny/06.png', 'common',    TRUE, 6,  'Lianes piégeuses+', 35),
  ('bda', 'Glacius ✨',       'Glacius en version Shiny !',         '/bda/images/cards/shiny/07.png', 'rare',      TRUE, 7,  'Blizzard arctique+', 60),
  ('bda', 'Ombralis ✨',      'Ombralis en version Shiny !',        '/bda/images/cards/shiny/08.png', 'rare',      TRUE, 8,  'Griffe obscure+',   55),
  ('bda', 'Luminex ✨',       'Luminex en version Shiny !',         '/bda/images/cards/shiny/09.png', 'rare',      TRUE, 9,  'Rayon sacré+',      65),
  ('bda', 'Pyronix ✨',       'Pyronix en version Shiny !',         '/bda/images/cards/shiny/10.png', 'rare',      TRUE, 10, 'Résurrection flamboyante+', 70),
  ('bda', 'Toxirak ✨',       'Toxirak en version Shiny !',         '/bda/images/cards/shiny/11.png', 'common',    TRUE, 11, 'Venin mortel+',     45),
  ('bda', 'Psykora ✨',       'Psykora en version Shiny !',         '/bda/images/cards/shiny/12.png', 'rare',      TRUE, 12, 'Onde cérébrale+',   60),
  ('bda', 'Chronotik ✨',     'Chronotik en version Shiny !',       '/bda/images/cards/shiny/13.png', 'epic',      TRUE, 13, 'Distorsion temporelle+', 80),
  ('bda', 'Dracofer ✨',      'Dracofer en version Shiny !',        '/bda/images/cards/shiny/14.png', 'epic',      TRUE, 14, 'Souffle d''acier+', 85),
  ('bda', 'Tempestia ✨',     'Tempestia en version Shiny !',       '/bda/images/cards/shiny/15.png', 'epic',      TRUE, 15, 'Foudre divine+',    90),
  ('bda', 'Noctalis ✨',      'Noctalis en version Shiny !',        '/bda/images/cards/shiny/16.png', 'rare',      TRUE, 16, 'Hurlement nocturne+', 55),
  ('bda', 'Gravirock ✨',     'Gravirock en version Shiny !',       '/bda/images/cards/shiny/17.png', 'common',    TRUE, 17, 'Onde de choc+',     40),
  ('bda', 'Mystiflore ✨',    'Mystiflore en version Shiny !',      '/bda/images/cards/shiny/18.png', 'common',    TRUE, 18, 'Pollen magique+',   35),
  ('bda', 'Volcanor ✨',      'Volcanor en version Shiny !',        '/bda/images/cards/shiny/19.png', 'rare',      TRUE, 19, 'Éruption+',         65),
  ('bda', 'Cybertron ✨',     'Cybertron en version Shiny !',       '/bda/images/cards/shiny/20.png', 'epic',      TRUE, 20, 'Laser plasma+',     95),
  ('bda', 'Abyssalia ✨',     'Abyssalia en version Shiny !',       '/bda/images/cards/shiny/21.png', 'legendary', TRUE, 21, 'Raz-de-marée+',     120),
  ('bda', 'Solarion ✨',      'Solarion en version Shiny !',        '/bda/images/cards/shiny/22.png', 'legendary', TRUE, 22, 'Nova solaire+',     130),
  ('bda', 'Nébulix ✨',       'Nébulix en version Shiny !',         '/bda/images/cards/shiny/23.png', 'legendary', TRUE, 23, 'Trou noir+',        140),
  ('bda', 'Éternalos ✨',     'Éternalos en version Shiny !',       '/bda/images/cards/shiny/24.png', 'legendary', TRUE, 24, 'Genèse absolue+',   160)
ON CONFLICT (site_id, card_number, is_shiny) DO NOTHING;


-- ============================================================
-- SEED: UTILISATEURS DE TEST
-- On utilise des pseudos fun, des soldes variés et des avatars
-- générés via ui-avatars.com (service gratuit de génération PDP)
-- ============================================================
INSERT INTO etudiants (site_id, email, pseudo, photo_profil, solde, is_admin, is_super_admin) VALUES
  ('bda', 'admin@bda.fr',      'Admin BDA',     'https://ui-avatars.com/api/?name=Admin+BDA&background=6366f1&color=fff&size=128',     5000,  TRUE,  TRUE),
  ('bda', 'alice@bda.fr',      'Alice',         'https://ui-avatars.com/api/?name=Alice&background=ec4899&color=fff&size=128',          1200,  FALSE, FALSE),
  ('bda', 'bob@bda.fr',        'BoB_Gamer',     'https://ui-avatars.com/api/?name=BoB&background=22c55e&color=fff&size=128',            950,   FALSE, FALSE),
  ('bda', 'charlie@bda.fr',    'CharlieXX',     'https://ui-avatars.com/api/?name=Charlie&background=f59e0b&color=fff&size=128',        800,   FALSE, FALSE),
  ('bda', 'diana@bda.fr',      'DianaLaFury',   'https://ui-avatars.com/api/?name=Diana&background=ef4444&color=fff&size=128',          2100,  FALSE, FALSE),
  ('bda', 'emma@bda.fr',       'EmmaStone',     'https://ui-avatars.com/api/?name=Emma&background=8b5cf6&color=fff&size=128',           600,   FALSE, FALSE),
  ('bda', 'frank@bda.fr',      'FrankTheTank',  'https://ui-avatars.com/api/?name=Frank&background=06b6d4&color=fff&size=128',          1500,  FALSE, FALSE),
  ('bda', 'gaelle@bda.fr',     'Gaëlle',        'https://ui-avatars.com/api/?name=Gaelle&background=d946ef&color=fff&size=128',         350,   FALSE, FALSE),
  ('bda', 'hugo@bda.fr',       'HugoLeBoss',    'https://ui-avatars.com/api/?name=Hugo&background=14b8a6&color=fff&size=128',           3200,  FALSE, FALSE),
  ('bda', 'irene@bda.fr',      'IrèneGG',       'https://ui-avatars.com/api/?name=Irene&background=f97316&color=fff&size=128',          420,   FALSE, FALSE),
  ('bda', 'julien@bda.fr',     'JuJu',          'https://ui-avatars.com/api/?name=Julien&background=3b82f6&color=fff&size=128',         1800,  FALSE, FALSE),
  ('bda', 'karen@bda.fr',      'KarenPro',      'https://ui-avatars.com/api/?name=Karen&background=a855f7&color=fff&size=128',          700,   FALSE, FALSE),
  ('bda', 'leo@bda.fr',        'LéoLeDragon',   'https://ui-avatars.com/api/?name=Leo&background=eab308&color=fff&size=128',            2500,  FALSE, FALSE),
  ('bda', 'marie@bda.fr',      'MariePoppinz',  'https://ui-avatars.com/api/?name=Marie&background=e11d48&color=fff&size=128',          900,   FALSE, FALSE),
  ('bda', 'nathan@bda.fr',     'NathanDrake',   'https://ui-avatars.com/api/?name=Nathan&background=0ea5e9&color=fff&size=128',         1100,  FALSE, FALSE)
ON CONFLICT (site_id, email) DO NOTHING;


-- ============================================================
-- SEED: Quelques badges attribués aux utilisateurs de test
-- ============================================================
-- On attribue des badges de façon réaliste
INSERT INTO bda_user_badges (site_id, user_email, badge_id)
SELECT 'bda', 'hugo@bda.fr', id FROM bda_badges WHERE site_id='bda' AND condition_type='cards_collected' AND condition_value=5
ON CONFLICT DO NOTHING;

INSERT INTO bda_user_badges (site_id, user_email, badge_id)
SELECT 'bda', 'hugo@bda.fr', id FROM bda_badges WHERE site_id='bda' AND condition_type='cards_collected' AND condition_value=15
ON CONFLICT DO NOTHING;

INSERT INTO bda_user_badges (site_id, user_email, badge_id)
SELECT 'bda', 'diana@bda.fr', id FROM bda_badges WHERE site_id='bda' AND condition_type='cards_collected' AND condition_value=5
ON CONFLICT DO NOTHING;

INSERT INTO bda_user_badges (site_id, user_email, badge_id)
SELECT 'bda', 'leo@bda.fr', id FROM bda_badges WHERE site_id='bda' AND condition_type='cards_collected' AND condition_value=5
ON CONFLICT DO NOTHING;

INSERT INTO bda_user_badges (site_id, user_email, badge_id)
SELECT 'bda', 'leo@bda.fr', id FROM bda_badges WHERE site_id='bda' AND condition_type='shiny_collected' AND condition_value=3
ON CONFLICT DO NOTHING;

INSERT INTO bda_user_badges (site_id, user_email, badge_id)
SELECT 'bda', 'alice@bda.fr', id FROM bda_badges WHERE site_id='bda' AND condition_type='cards_collected' AND condition_value=5
ON CONFLICT DO NOTHING;

INSERT INTO bda_user_badges (site_id, user_email, badge_id)
SELECT 'bda', 'frank@bda.fr', id FROM bda_badges WHERE site_id='bda' AND condition_type='cards_collected' AND condition_value=5
ON CONFLICT DO NOTHING;

INSERT INTO bda_user_badges (site_id, user_email, badge_id)
SELECT 'bda', 'frank@bda.fr', id FROM bda_badges WHERE site_id='bda' AND condition_type='cards_collected' AND condition_value=15
ON CONFLICT DO NOTHING;

INSERT INTO bda_user_badges (site_id, user_email, badge_id)
SELECT 'bda', 'frank@bda.fr', id FROM bda_badges WHERE site_id='bda' AND condition_type='shiny_collected' AND condition_value=3
ON CONFLICT DO NOTHING;


-- ============================================================
-- SEED: Quelques défis de test
-- ============================================================
INSERT INTO challenges (site_id, titre, description, points, difficulte, published, created_by) VALUES
  ('bda', 'Premier pas',        'Connecte-toi pour la première fois',                   50,  'facile',    TRUE, 'admin@bda.fr'),
  ('bda', 'Social Butterfly',   'Ajoute une photo de profil',                           50,  'facile',    TRUE, 'admin@bda.fr'),
  ('bda', 'Collectionneur',     'Obtiens 5 cartes différentes',                         150, 'moyen',     TRUE, 'admin@bda.fr'),
  ('bda', 'Chasseur de Shiny',  'Obtiens ta première carte Shiny',                      150, 'moyen',     TRUE, 'admin@bda.fr'),
  ('bda', 'Maître du Pokédex',  'Obtiens les 24 cartes normales',                       300, 'difficile', TRUE, 'admin@bda.fr'),
  ('bda', 'Créateur de Carte',  'Soumets une carte personnalisée',                      50,  'facile',    TRUE, 'admin@bda.fr'),
  ('bda', 'Top 3',              'Atteins le Top 3 du classement',                       300, 'difficile', TRUE, 'admin@bda.fr')
ON CONFLICT DO NOTHING;


-- ============================================================
-- FIN
-- ============================================================
-- Résumé :
-- ✅ Policy admin update sur etudiants (fix admin modifier solde d'un autre)
-- ✅ 24 cartes normales + 24 shiny insérées dans bda_cards
-- ✅ 15 utilisateurs de test avec pseudo, PDP (ui-avatars), solde varié
-- ✅ Badges attribués à certains testeurs
-- ✅ 7 défis de test publiés
-- 
-- IMAGES :
--   Place tes images de cartes dans :
--   output/bda/images/cards/normal/01.png .. 24.png
--   output/bda/images/cards/shiny/01.png .. 24.png
