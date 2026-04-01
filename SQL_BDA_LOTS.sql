-- =============================================
-- BDA LOTS (PRIZES) TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS bda_lots (
  id          TEXT        PRIMARY KEY,
  site_id     TEXT        NOT NULL DEFAULT 'bda',
  name        TEXT        NOT NULL,
  category    TEXT        NOT NULL DEFAULT 'principal'
                          CHECK (category IN ('principal','partenaire','goodies')),
  image_url   TEXT        DEFAULT '',
  qty_total   INTEGER     NOT NULL DEFAULT 1,
  qty_remaining INTEGER   NOT NULL DEFAULT 1,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bda_lots_site ON bda_lots(site_id);

ALTER TABLE bda_lots ENABLE ROW LEVEL SECURITY;

-- Everyone can read lots (to see what's available)
CREATE POLICY "bda_lots_select" ON bda_lots FOR SELECT USING (true);

-- Only admins can insert/update/delete
CREATE POLICY "bda_lots_admin_insert" ON bda_lots FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM etudiants WHERE email = auth.jwt() ->> 'email' AND site_id = bda_lots.site_id AND (is_admin = TRUE OR is_super_admin = TRUE))
);
CREATE POLICY "bda_lots_admin_update" ON bda_lots FOR UPDATE USING (
  EXISTS (SELECT 1 FROM etudiants WHERE email = auth.jwt() ->> 'email' AND site_id = bda_lots.site_id AND (is_admin = TRUE OR is_super_admin = TRUE))
);
CREATE POLICY "bda_lots_admin_delete" ON bda_lots FOR DELETE USING (
  EXISTS (SELECT 1 FROM etudiants WHERE email = auth.jwt() ->> 'email' AND site_id = bda_lots.site_id AND (is_admin = TRUE OR is_super_admin = TRUE))
);

-- Lot wins history
CREATE TABLE IF NOT EXISTS bda_lot_wins (
  id          BIGSERIAL   PRIMARY KEY,
  site_id     TEXT        NOT NULL DEFAULT 'bda',
  user_email  TEXT        NOT NULL,
  lot_id      TEXT        NOT NULL REFERENCES bda_lots(id),
  won_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bda_lot_wins_site ON bda_lot_wins(site_id);
CREATE INDEX IF NOT EXISTS idx_bda_lot_wins_user ON bda_lot_wins(user_email);

ALTER TABLE bda_lot_wins ENABLE ROW LEVEL SECURITY;

-- Users can see their own wins
CREATE POLICY "bda_lot_wins_select_own" ON bda_lot_wins FOR SELECT USING (
  auth.jwt() ->> 'email' = user_email
);
-- Admins can see all wins
CREATE POLICY "bda_lot_wins_select_admin" ON bda_lot_wins FOR SELECT USING (
  EXISTS (SELECT 1 FROM etudiants WHERE email = auth.jwt() ->> 'email' AND site_id = bda_lot_wins.site_id AND (is_admin = TRUE OR is_super_admin = TRUE))
);
-- System inserts (via service role or authenticated user winning)
CREATE POLICY "bda_lot_wins_insert" ON bda_lot_wins FOR INSERT WITH CHECK (
  auth.jwt() ->> 'email' = user_email
);

-- =============================================
-- RPC: Atomic lot claim (decrement + record win)
-- Prevents race conditions
-- =============================================
CREATE OR REPLACE FUNCTION bda_claim_lot(p_site_id TEXT, p_user_email TEXT, p_lot_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_remaining INTEGER;
  v_name TEXT;
BEGIN
  -- Lock the row and check remaining
  SELECT qty_remaining, name INTO v_remaining, v_name
  FROM bda_lots
  WHERE id = p_lot_id AND site_id = p_site_id
  FOR UPDATE;

  IF v_remaining IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Lot introuvable');
  END IF;

  IF v_remaining <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Plus de stock');
  END IF;

  -- Decrement
  UPDATE bda_lots SET qty_remaining = qty_remaining - 1
  WHERE id = p_lot_id AND site_id = p_site_id;

  -- Record win
  INSERT INTO bda_lot_wins (site_id, user_email, lot_id)
  VALUES (p_site_id, p_user_email, p_lot_id);

  RETURN jsonb_build_object('success', true, 'lot_name', v_name, 'remaining', v_remaining - 1);
END;
$$;

-- =============================================
-- SEED DATA
-- =============================================
INSERT INTO bda_lots (id, site_id, name, category, image_url, qty_total, qty_remaining) VALUES
  -- Lots principaux
  ('pass_royale',     'bda', 'Pass Royale',                    'principal',  'images/lots/pass_royale.png',     7, 7),
  ('uber_eats',       'bda', 'Carte Uber Eats 20€',           'principal',  'images/lots/uber_eats.png',       4, 4),
  ('jbl_go2',         'bda', 'JBL Go 2',                       'principal',  'images/lots/jbl_go2.png',         1, 1),
  ('cinema',          'bda', 'Cartes cinéma 24€',             'principal',  'images/lots/cinema.png',          2, 2),
  ('fnac',            'bda', 'Carte Fnac 20€',                'principal',  'images/lots/fnac.png',            2, 2),
  ('ruban_led',       'bda', 'Ruban Led Philips',              'principal',  'images/lots/ruban_led.png',       2, 2),
  -- Lots partenaires
  ('lush',            'bda', 'Lush — Bombes de bain, massage bars & savons', 'partenaire', 'images/lots/lush.png', 1, 1),
  ('ngo_shoes',       'bda', 'NGo Shoes — 5 paires + 15% pendant 1 an',     'partenaire', 'images/lots/ngo_shoes.png', 1, 1),
  ('goolfy',          'bda', 'Goolfy Lille — 3 entrées mini golf',           'partenaire', 'images/lots/goolfy.png', 1, 1),
  ('weembi',          'bda', 'Weembi — 10 bons de réduc simulateur de chute libre', 'partenaire', 'images/lots/weembi.png', 1, 1),
  ('weezpark',        'bda', 'Weezpark — 2 places LaserWeez + 2 places WeezJump',   'partenaire', 'images/lots/weezpark.png', 1, 1),
  ('team_break',      'bda', 'Team Break — Code réduc escape game',                  'partenaire', 'images/lots/team_break.png', 1, 1),
  ('metrobowling',    'bda', 'Métrobowling — 6 places bowling + tarifs préférentiels', 'partenaire', 'images/lots/metrobowling.png', 1, 1),
  ('starship_laser',  'bda', 'Starship Laser Lille — 4 places laser game',            'partenaire', 'images/lots/starship_laser.png', 1, 1),
  ('planet_bowling',  'bda', 'Planet Bowling — Places',                                'partenaire', 'images/lots/planet_bowling.png', 1, 1),
  ('musee_piscine',   'bda', 'Musée La Piscine Roubaix — 4 places',                   'partenaire', 'images/lots/musee_piscine.png', 1, 1),
  ('eve_co',          'bda', 'Eve & Co — -25%',                                        'partenaire', 'images/lots/eve_co.png', 1, 1),
  ('garten',          'bda', 'Garten on the Beach — Réduc festival',                   'partenaire', 'images/lots/garten.png', 1, 1),
  -- Lots goodies
  ('sticker_collector','bda', 'Sticker Collector',  'goodies', 'images/goodies/Sticker_Collector.png', 20, 20),
  ('ecocup_collector', 'bda', 'Ecocup Collector',   'goodies', 'images/goodies/Ecocup_Collector.png',  20, 20)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  image_url = EXCLUDED.image_url,
  qty_total = EXCLUDED.qty_total;

-- =============================================
-- RPC: Get lot winners (privacy-safe, no emails)
-- =============================================
CREATE OR REPLACE FUNCTION bda_get_lot_winners(p_site_id TEXT)
RETURNS TABLE(lot_id TEXT, pseudo TEXT, won_at TIMESTAMPTZ)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT lw.lot_id, COALESCE(e.pseudo, 'Joueur') as pseudo, lw.won_at
  FROM bda_lot_wins lw
  LEFT JOIN etudiants e ON e.email = lw.user_email AND e.site_id = lw.site_id
  WHERE lw.site_id = p_site_id
  ORDER BY lw.won_at DESC;
$$;
