-- =============================================
-- BDA Defis table (admin-managed challenges)
-- =============================================

CREATE TABLE IF NOT EXISTS bda_defis (
  id          BIGSERIAL   PRIMARY KEY,
  site_id     TEXT        NOT NULL DEFAULT 'bda',
  level_id    TEXT        NOT NULL,
  points      INTEGER     NOT NULL,
  title       TEXT        NOT NULL,
  tag         TEXT        NOT NULL DEFAULT 'Standard',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bda_defis_site ON bda_defis(site_id);

ALTER TABLE bda_defis ENABLE ROW LEVEL SECURITY;

-- Everyone can read defis
CREATE POLICY "bda_defis_select" ON bda_defis FOR SELECT USING (true);

-- Admins can insert
CREATE POLICY "bda_defis_admin_insert" ON bda_defis FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM etudiants WHERE email = auth.jwt() ->> 'email' AND site_id = bda_defis.site_id AND (is_admin = TRUE OR is_super_admin = TRUE))
);

-- Admins can update
CREATE POLICY "bda_defis_admin_update" ON bda_defis FOR UPDATE USING (
  EXISTS (SELECT 1 FROM etudiants WHERE email = auth.jwt() ->> 'email' AND site_id = bda_defis.site_id AND (is_admin = TRUE OR is_super_admin = TRUE))
);

-- Admins can delete
CREATE POLICY "bda_defis_admin_delete" ON bda_defis FOR DELETE USING (
  EXISTS (SELECT 1 FROM etudiants WHERE email = auth.jwt() ->> 'email' AND site_id = bda_defis.site_id AND (is_admin = TRUE OR is_super_admin = TRUE))
);

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
