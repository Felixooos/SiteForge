-- ============================================================
--  BDA — TABLE bda_sutom_words + RPC admin
--  Execute dans Supabase SQL Editor
-- ============================================================

-- 1) Creer la table si elle n existe pas
CREATE TABLE IF NOT EXISTS bda_sutom_words (
  id          BIGSERIAL PRIMARY KEY,
  site_id     TEXT        NOT NULL DEFAULT 'bda',
  play_date   DATE        NOT NULL,
  word        TEXT        NOT NULL,
  points      INTEGER     NOT NULL DEFAULT 120,
  created_by  TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (site_id, play_date)
);

CREATE INDEX IF NOT EXISTS idx_bda_sutom_words_date ON bda_sutom_words(site_id, play_date);

-- 2) Activer RLS
ALTER TABLE bda_sutom_words ENABLE ROW LEVEL SECURITY;

-- 3) Politique lecture : tout le monde
DROP POLICY IF EXISTS "bda_sutom_select" ON bda_sutom_words;
CREATE POLICY "bda_sutom_select" ON bda_sutom_words FOR SELECT USING (true);

-- 4) Politiques ecriture : admins seulement
DROP POLICY IF EXISTS "bda_sutom_insert" ON bda_sutom_words;
CREATE POLICY "bda_sutom_insert" ON bda_sutom_words FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM etudiants WHERE email = auth.jwt() ->> 'email' AND site_id = bda_sutom_words.site_id AND (is_creator OR is_admin OR is_super_admin))
);
DROP POLICY IF EXISTS "bda_sutom_update" ON bda_sutom_words;
CREATE POLICY "bda_sutom_update" ON bda_sutom_words FOR UPDATE USING (
  EXISTS (SELECT 1 FROM etudiants WHERE email = auth.jwt() ->> 'email' AND site_id = bda_sutom_words.site_id AND (is_creator OR is_admin OR is_super_admin))
);
DROP POLICY IF EXISTS "bda_sutom_delete" ON bda_sutom_words;
CREATE POLICY "bda_sutom_delete" ON bda_sutom_words FOR DELETE USING (
  EXISTS (SELECT 1 FROM etudiants WHERE email = auth.jwt() ->> 'email' AND site_id = bda_sutom_words.site_id AND (is_creator OR is_admin OR is_super_admin))
);

-- 5) RPC admin pour changer le mot (SECURITY DEFINER)
-- ============================================================

CREATE OR REPLACE FUNCTION rpc_admin_set_sutom_word(
  p_site_id TEXT,
  p_word    TEXT,
  p_points  INT,
  p_date    TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT := auth.jwt() ->> 'email';
  v_date  DATE := COALESCE(p_date::DATE, CURRENT_DATE);
  v_is_admin BOOLEAN;
BEGIN
  -- Verifier authentification
  IF v_email IS NULL THEN
    RAISE EXCEPTION 'Non authentifie';
  END IF;

  -- Verifier que l utilisateur est admin/creator
  SELECT (is_admin OR is_super_admin OR is_creator) INTO v_is_admin
  FROM etudiants
  WHERE email = v_email AND site_id = p_site_id;

  IF NOT COALESCE(v_is_admin, FALSE) THEN
    RAISE EXCEPTION 'Permission refusee';
  END IF;

  -- Valider le mot
  IF LENGTH(TRIM(p_word)) < 4 THEN
    RAISE EXCEPTION 'Mot trop court (min 4 lettres)';
  END IF;

  -- Valider les points
  IF p_points < 10 OR p_points > 1000 THEN
    RAISE EXCEPTION 'Points invalides (10-1000)';
  END IF;

  -- Upsert le mot du jour
  INSERT INTO bda_sutom_words (site_id, play_date, word, points, created_by)
  VALUES (p_site_id, v_date, UPPER(TRIM(p_word)), p_points, v_email)
  ON CONFLICT (site_id, play_date)
  DO UPDATE SET
    word       = EXCLUDED.word,
    points     = EXCLUDED.points,
    created_by = EXCLUDED.created_by,
    created_at = NOW();
END;
$$;

-- Accorder l execution a tous les utilisateurs authentifies
-- (la verification admin se fait dans la fonction elle-meme)
GRANT EXECUTE ON FUNCTION rpc_admin_set_sutom_word(TEXT, TEXT, INT, TEXT) TO authenticated;
