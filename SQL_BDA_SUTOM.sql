-- ============================================================
--  BDA — TABLE SUTOM (mots du jour planifiés par les créateurs)
-- ============================================================

CREATE TABLE IF NOT EXISTS bda_sutom_words (
  id          BIGSERIAL PRIMARY KEY,
  site_id     TEXT      NOT NULL DEFAULT 'bda',
  play_date   DATE      NOT NULL,
  word        TEXT      NOT NULL,
  points      INTEGER   NOT NULL DEFAULT 120,
  created_by  TEXT      NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (site_id, play_date)
);

CREATE INDEX idx_bda_sutom_words_date ON bda_sutom_words(site_id, play_date);
ALTER TABLE bda_sutom_words ENABLE ROW LEVEL SECURITY;

-- Tout le monde peut lire (le mot n'est pas exposé directement côté client, 
-- on ne renvoie que la longueur et la 1re lettre)
-- En fait on DOIT renvoyer le mot pour vérifier les essais côté client.
-- C'est un jeu casual, pas de problème de sécurité ici.
CREATE POLICY "bda_sutom_select" ON bda_sutom_words FOR SELECT USING (true);

-- Seuls les créateurs/admins peuvent insérer/modifier
CREATE POLICY "bda_sutom_insert" ON bda_sutom_words FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM etudiants 
    WHERE email = auth.jwt() ->> 'email' 
      AND site_id = bda_sutom_words.site_id 
      AND (is_creator = TRUE OR is_admin = TRUE OR is_super_admin = TRUE)
  )
);

CREATE POLICY "bda_sutom_update" ON bda_sutom_words FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM etudiants 
    WHERE email = auth.jwt() ->> 'email' 
      AND site_id = bda_sutom_words.site_id 
      AND (is_creator = TRUE OR is_admin = TRUE OR is_super_admin = TRUE)
  )
);

CREATE POLICY "bda_sutom_delete" ON bda_sutom_words FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM etudiants 
    WHERE email = auth.jwt() ->> 'email' 
      AND site_id = bda_sutom_words.site_id 
      AND (is_creator = TRUE OR is_admin = TRUE OR is_super_admin = TRUE)
  )
);
