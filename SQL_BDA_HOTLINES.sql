-- ============================================================
--  BDA — HOTLINES (commandes de nourriture)
-- ============================================================

-- Config hotlines (activation, menu items)
CREATE TABLE IF NOT EXISTS bda_hotlines_config (
  id          BIGSERIAL PRIMARY KEY,
  site_id     TEXT      NOT NULL DEFAULT 'bda',
  is_active   BOOLEAN   NOT NULL DEFAULT FALSE,
  updated_by  TEXT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (site_id)
);

-- Menu items
CREATE TABLE IF NOT EXISTS bda_hotlines_menu (
  id          BIGSERIAL PRIMARY KEY,
  site_id     TEXT      NOT NULL DEFAULT 'bda',
  name        TEXT      NOT NULL,
  description TEXT      DEFAULT '',
  price       NUMERIC(6,2) NOT NULL DEFAULT 0,
  image_url   TEXT      DEFAULT '',
  available   BOOLEAN   NOT NULL DEFAULT TRUE,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_bda_hotlines_menu ON bda_hotlines_menu(site_id, display_order);

-- Orders
CREATE TABLE IF NOT EXISTS bda_hotlines_orders (
  id          BIGSERIAL PRIMARY KEY,
  site_id     TEXT      NOT NULL DEFAULT 'bda',
  user_email  TEXT      NOT NULL,
  nom         TEXT      NOT NULL,
  prenom      TEXT      NOT NULL,
  telephone   TEXT      NOT NULL,
  lieu        TEXT      NOT NULL,
  items       JSONB     NOT NULL DEFAULT '[]',
  total       NUMERIC(8,2) NOT NULL DEFAULT 0,
  status      TEXT      NOT NULL DEFAULT 'pending',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_bda_hotlines_orders ON bda_hotlines_orders(site_id, created_at DESC);

-- RLS
ALTER TABLE bda_hotlines_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE bda_hotlines_menu ENABLE ROW LEVEL SECURITY;
ALTER TABLE bda_hotlines_orders ENABLE ROW LEVEL SECURITY;

-- Config: everyone can read, admins can write
CREATE POLICY "hotlines_config_select" ON bda_hotlines_config FOR SELECT USING (true);
CREATE POLICY "hotlines_config_insert" ON bda_hotlines_config FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM etudiants WHERE email = auth.jwt() ->> 'email' AND site_id = bda_hotlines_config.site_id AND (is_admin = TRUE OR is_super_admin = TRUE OR is_creator = TRUE))
);
CREATE POLICY "hotlines_config_update" ON bda_hotlines_config FOR UPDATE USING (
  EXISTS (SELECT 1 FROM etudiants WHERE email = auth.jwt() ->> 'email' AND site_id = bda_hotlines_config.site_id AND (is_admin = TRUE OR is_super_admin = TRUE OR is_creator = TRUE))
);

-- Menu: everyone can read, admins can write
CREATE POLICY "hotlines_menu_select" ON bda_hotlines_menu FOR SELECT USING (true);
CREATE POLICY "hotlines_menu_insert" ON bda_hotlines_menu FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM etudiants WHERE email = auth.jwt() ->> 'email' AND site_id = bda_hotlines_menu.site_id AND (is_admin = TRUE OR is_super_admin = TRUE OR is_creator = TRUE))
);
CREATE POLICY "hotlines_menu_update" ON bda_hotlines_menu FOR UPDATE USING (
  EXISTS (SELECT 1 FROM etudiants WHERE email = auth.jwt() ->> 'email' AND site_id = bda_hotlines_menu.site_id AND (is_admin = TRUE OR is_super_admin = TRUE OR is_creator = TRUE))
);
CREATE POLICY "hotlines_menu_delete" ON bda_hotlines_menu FOR DELETE USING (
  EXISTS (SELECT 1 FROM etudiants WHERE email = auth.jwt() ->> 'email' AND site_id = bda_hotlines_menu.site_id AND (is_admin = TRUE OR is_super_admin = TRUE OR is_creator = TRUE))
);

-- Orders: users can read their own, admins can read all
CREATE POLICY "hotlines_orders_select" ON bda_hotlines_orders FOR SELECT USING (
  user_email = auth.jwt() ->> 'email'
  OR EXISTS (SELECT 1 FROM etudiants WHERE email = auth.jwt() ->> 'email' AND site_id = bda_hotlines_orders.site_id AND (is_admin = TRUE OR is_super_admin = TRUE OR is_creator = TRUE))
);
CREATE POLICY "hotlines_orders_insert" ON bda_hotlines_orders FOR INSERT WITH CHECK (
  user_email = auth.jwt() ->> 'email'
);
CREATE POLICY "hotlines_orders_update" ON bda_hotlines_orders FOR UPDATE USING (
  EXISTS (SELECT 1 FROM etudiants WHERE email = auth.jwt() ->> 'email' AND site_id = bda_hotlines_orders.site_id AND (is_admin = TRUE OR is_super_admin = TRUE OR is_creator = TRUE))
);

-- Insert default config
INSERT INTO bda_hotlines_config (site_id, is_active) VALUES ('bda', false) ON CONFLICT (site_id) DO NOTHING;
