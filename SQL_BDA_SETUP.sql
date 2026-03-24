-- ============================================================
--  BDA — TABLES SPÉCIFIQUES AU JEU DE CARTES
--  À exécuter APRÈS SQL_RESET_FRESH.sql
--  Les tables etudiants, challenges, challenge_validations,
--  transactions existent déjà via le setup principal.
-- ============================================================

-- ============================================================
-- 1. CARTES (définitions des 48 cartes : 24 normales + 24 shiny)
-- ============================================================
CREATE TABLE IF NOT EXISTS bda_cards (
  id          BIGSERIAL PRIMARY KEY,
  site_id     TEXT      NOT NULL,
  name        TEXT      NOT NULL,
  description TEXT      DEFAULT '',
  image_url   TEXT      DEFAULT '',
  rarity      TEXT      NOT NULL DEFAULT 'common'
                        CHECK (rarity IN ('common','rare','epic','legendary')),
  is_shiny    BOOLEAN   NOT NULL DEFAULT FALSE,
  card_number INTEGER   NOT NULL,          -- 1-24
  attack_name TEXT      DEFAULT '',
  attack_damage INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (site_id, card_number, is_shiny)
);

CREATE INDEX idx_bda_cards_site ON bda_cards(site_id);
ALTER TABLE bda_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bda_cards_select" ON bda_cards FOR SELECT USING (true);
CREATE POLICY "bda_cards_admin_insert" ON bda_cards FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM etudiants WHERE email = auth.jwt() ->> 'email' AND site_id = bda_cards.site_id AND (is_admin = TRUE OR is_super_admin = TRUE))
);
CREATE POLICY "bda_cards_admin_update" ON bda_cards FOR UPDATE USING (
  EXISTS (SELECT 1 FROM etudiants WHERE email = auth.jwt() ->> 'email' AND site_id = bda_cards.site_id AND (is_admin = TRUE OR is_super_admin = TRUE))
);
CREATE POLICY "bda_cards_admin_delete" ON bda_cards FOR DELETE USING (
  EXISTS (SELECT 1 FROM etudiants WHERE email = auth.jwt() ->> 'email' AND site_id = bda_cards.site_id AND (is_admin = TRUE OR is_super_admin = TRUE))
);


-- ============================================================
-- 2. INVENTAIRE JOUEUR (cartes obtenues)
-- ============================================================
CREATE TABLE IF NOT EXISTS bda_user_cards (
  id          BIGSERIAL PRIMARY KEY,
  site_id     TEXT      NOT NULL,
  user_email  TEXT      NOT NULL,
  card_id     BIGINT    NOT NULL REFERENCES bda_cards(id) ON DELETE CASCADE,
  obtained_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  obtained_via TEXT     DEFAULT 'pack',    -- 'pack', 'manual', 'admin'

  UNIQUE (site_id, user_email, card_id)
);

CREATE INDEX idx_bda_user_cards_site  ON bda_user_cards(site_id);
CREATE INDEX idx_bda_user_cards_user  ON bda_user_cards(site_id, user_email);
ALTER TABLE bda_user_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bda_uc_select" ON bda_user_cards FOR SELECT USING (true);
CREATE POLICY "bda_uc_insert" ON bda_user_cards FOR INSERT WITH CHECK (
  user_email = auth.jwt() ->> 'email'
  OR EXISTS (SELECT 1 FROM etudiants WHERE email = auth.jwt() ->> 'email' AND site_id = bda_user_cards.site_id AND (is_admin = TRUE OR is_super_admin = TRUE))
);
CREATE POLICY "bda_uc_delete" ON bda_user_cards FOR DELETE USING (
  EXISTS (SELECT 1 FROM etudiants WHERE email = auth.jwt() ->> 'email' AND site_id = bda_user_cards.site_id AND (is_admin = TRUE OR is_super_admin = TRUE))
);


-- ============================================================
-- 3. TYPES DE PACKS (œufs / loot boxes)
-- ============================================================
CREATE TABLE IF NOT EXISTS bda_packs (
  id              BIGSERIAL PRIMARY KEY,
  site_id         TEXT      NOT NULL,
  name            TEXT      NOT NULL,
  description     TEXT      DEFAULT '',
  price           INTEGER   NOT NULL DEFAULT 100,
  image_url       TEXT      DEFAULT '',
  cards_count     INTEGER   NOT NULL DEFAULT 3,      -- nb cartes par ouverture
  shiny_chance    REAL      NOT NULL DEFAULT 0.10,    -- % chance shiny (0.0-1.0)
  rarity_weights  JSONB     NOT NULL DEFAULT '{"common":60,"rare":25,"epic":10,"legendary":5}',
  enabled         BOOLEAN   NOT NULL DEFAULT TRUE,
  display_order   INTEGER   NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_bda_packs_site ON bda_packs(site_id);
ALTER TABLE bda_packs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bda_packs_select" ON bda_packs FOR SELECT USING (true);
CREATE POLICY "bda_packs_admin_insert" ON bda_packs FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM etudiants WHERE email = auth.jwt() ->> 'email' AND site_id = bda_packs.site_id AND (is_admin = TRUE OR is_super_admin = TRUE))
);
CREATE POLICY "bda_packs_admin_update" ON bda_packs FOR UPDATE USING (
  EXISTS (SELECT 1 FROM etudiants WHERE email = auth.jwt() ->> 'email' AND site_id = bda_packs.site_id AND (is_admin = TRUE OR is_super_admin = TRUE))
);
CREATE POLICY "bda_packs_admin_delete" ON bda_packs FOR DELETE USING (
  EXISTS (SELECT 1 FROM etudiants WHERE email = auth.jwt() ->> 'email' AND site_id = bda_packs.site_id AND (is_admin = TRUE OR is_super_admin = TRUE))
);


-- ============================================================
-- 4. HISTORIQUE D'OUVERTURE DE PACKS
-- ============================================================
CREATE TABLE IF NOT EXISTS bda_pack_openings (
  id          BIGSERIAL PRIMARY KEY,
  site_id     TEXT      NOT NULL,
  user_email  TEXT      NOT NULL,
  pack_id     BIGINT    NOT NULL REFERENCES bda_packs(id) ON DELETE CASCADE,
  cards_drawn JSONB     NOT NULL DEFAULT '[]',   -- [{card_id, name, rarity, is_shiny}]
  price_paid  INTEGER   NOT NULL,
  opened_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_bda_po_site ON bda_pack_openings(site_id);
CREATE INDEX idx_bda_po_user ON bda_pack_openings(site_id, user_email);
ALTER TABLE bda_pack_openings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bda_po_select" ON bda_pack_openings FOR SELECT USING (true);
CREATE POLICY "bda_po_insert" ON bda_pack_openings FOR INSERT WITH CHECK (
  user_email = auth.jwt() ->> 'email'
);


-- ============================================================
-- 5. BADGES (succès)
-- ============================================================
CREATE TABLE IF NOT EXISTS bda_badges (
  id          BIGSERIAL PRIMARY KEY,
  site_id     TEXT      NOT NULL,
  name        TEXT      NOT NULL,
  description TEXT      DEFAULT '',
  icon        TEXT      DEFAULT '🏆',
  condition_type TEXT   NOT NULL DEFAULT 'cards_collected',
    -- 'cards_collected', 'shiny_collected', 'all_normal', 'all_shiny', 'all_cards', 'custom'
  condition_value INTEGER DEFAULT 0,     -- ex: 3 = "obtenir 3 cartes shiny"
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_bda_badges_site ON bda_badges(site_id);
ALTER TABLE bda_badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bda_badges_select" ON bda_badges FOR SELECT USING (true);
CREATE POLICY "bda_badges_admin_insert" ON bda_badges FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM etudiants WHERE email = auth.jwt() ->> 'email' AND site_id = bda_badges.site_id AND (is_admin = TRUE OR is_super_admin = TRUE))
);
CREATE POLICY "bda_badges_admin_update" ON bda_badges FOR UPDATE USING (
  EXISTS (SELECT 1 FROM etudiants WHERE email = auth.jwt() ->> 'email' AND site_id = bda_badges.site_id AND (is_admin = TRUE OR is_super_admin = TRUE))
);
CREATE POLICY "bda_badges_admin_delete" ON bda_badges FOR DELETE USING (
  EXISTS (SELECT 1 FROM etudiants WHERE email = auth.jwt() ->> 'email' AND site_id = bda_badges.site_id AND (is_admin = TRUE OR is_super_admin = TRUE))
);


-- ============================================================
-- 6. BADGES OBTENUS PAR LES JOUEURS
-- ============================================================
CREATE TABLE IF NOT EXISTS bda_user_badges (
  id          BIGSERIAL PRIMARY KEY,
  site_id     TEXT      NOT NULL,
  user_email  TEXT      NOT NULL,
  badge_id    BIGINT    NOT NULL REFERENCES bda_badges(id) ON DELETE CASCADE,
  earned_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (site_id, user_email, badge_id)
);

CREATE INDEX idx_bda_ub_site ON bda_user_badges(site_id);
CREATE INDEX idx_bda_ub_user ON bda_user_badges(site_id, user_email);
ALTER TABLE bda_user_badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bda_ub_select" ON bda_user_badges FOR SELECT USING (true);
CREATE POLICY "bda_ub_insert" ON bda_user_badges FOR INSERT WITH CHECK (
  user_email = auth.jwt() ->> 'email'
  OR EXISTS (SELECT 1 FROM etudiants WHERE email = auth.jwt() ->> 'email' AND site_id = bda_user_badges.site_id AND (is_admin = TRUE OR is_super_admin = TRUE))
);


-- ============================================================
-- 7. CARTES PERSONNALISÉES (créées par les joueurs)
-- ============================================================
CREATE TABLE IF NOT EXISTS bda_custom_cards (
  id              BIGSERIAL PRIMARY KEY,
  site_id         TEXT      NOT NULL,
  creator_email   TEXT      NOT NULL,
  name            TEXT      NOT NULL,
  description     TEXT      DEFAULT '',
  image_url       TEXT      DEFAULT '',
  attack_name     TEXT      DEFAULT '',
  attack_damage   INTEGER   DEFAULT 0,
  approved        BOOLEAN   NOT NULL DEFAULT FALSE,  -- admin doit approuver
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_bda_cc_site ON bda_custom_cards(site_id);
CREATE INDEX idx_bda_cc_creator ON bda_custom_cards(site_id, creator_email);
ALTER TABLE bda_custom_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bda_cc_select" ON bda_custom_cards FOR SELECT USING (true);
CREATE POLICY "bda_cc_insert" ON bda_custom_cards FOR INSERT WITH CHECK (
  creator_email = auth.jwt() ->> 'email'
);
CREATE POLICY "bda_cc_update" ON bda_custom_cards FOR UPDATE USING (
  creator_email = auth.jwt() ->> 'email'
  OR EXISTS (SELECT 1 FROM etudiants WHERE email = auth.jwt() ->> 'email' AND site_id = bda_custom_cards.site_id AND (is_admin = TRUE OR is_super_admin = TRUE))
);


-- ============================================================
-- 8. SEED : 3 TYPES DE PACKS PAR DÉFAUT
-- ============================================================
-- Ces inserts utilisent 'bda' comme site_id. Adapter si besoin.
INSERT INTO bda_packs (site_id, name, description, price, cards_count, shiny_chance, rarity_weights, display_order) VALUES
  ('bda', '🥚 Œuf Basique', '2 cartes — 10% chance Shiny', 100, 2, 0.10, '{"common":60,"rare":30,"epic":8,"legendary":2}', 0),
  ('bda', '🥚 Œuf Rare', '3 cartes — 20% chance Shiny', 250, 3, 0.20, '{"common":35,"rare":35,"epic":20,"legendary":10}', 1),
  ('bda', '🥚 Œuf Légendaire', '5 cartes — 40% chance Shiny', 500, 5, 0.40, '{"common":15,"rare":25,"epic":30,"legendary":30}', 2)
ON CONFLICT DO NOTHING;


-- ============================================================
-- 9. SEED : BADGES PAR DÉFAUT
-- ============================================================
INSERT INTO bda_badges (site_id, name, description, icon, condition_type, condition_value) VALUES
  ('bda', 'Collectionneur Débutant', 'Obtenir 5 cartes normales', '⭐', 'cards_collected', 5),
  ('bda', 'Collectionneur Confirmé', 'Obtenir 15 cartes normales', '🌟', 'cards_collected', 15),
  ('bda', 'Maître Collectionneur', 'Obtenir toutes les 24 cartes normales', '👑', 'all_normal', 24),
  ('bda', 'Chasseur de Shiny', 'Obtenir 3 cartes Shiny', '✨', 'shiny_collected', 3),
  ('bda', 'Légende Shiny', 'Obtenir 5 cartes Shiny', '💎', 'shiny_collected', 5),
  ('bda', 'Shiny Master', 'Obtenir toutes les 24 cartes Shiny', '🌈', 'all_shiny', 24),
  ('bda', 'Pokédex Complet', 'Obtenir les 48 cartes (normales + shiny)', '🏆', 'all_cards', 48)
ON CONFLICT DO NOTHING;


-- ============================================================
-- FIN — Résumé des nouvelles tables BDA
-- ============================================================
-- ✅ bda_cards           (id, site_id, name, rarity, is_shiny, card_number, attack_*)
-- ✅ bda_user_cards      (id, site_id, user_email, card_id, obtained_via)
-- ✅ bda_packs           (id, site_id, name, price, cards_count, shiny_chance, rarity_weights)
-- ✅ bda_pack_openings   (id, site_id, user_email, pack_id, cards_drawn, price_paid)
-- ✅ bda_badges          (id, site_id, name, icon, condition_type, condition_value)
-- ✅ bda_user_badges     (id, site_id, user_email, badge_id)
-- ✅ bda_custom_cards    (id, site_id, creator_email, name, image_url, approved)
-- + Réutilisation : etudiants, challenges, challenge_validations, transactions
