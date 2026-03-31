-- ============================================================
--  BDA — RPC admin : changer le mot du Sutom
--  Execute dans Supabase SQL Editor
--
--  Permet aux admins/creators de changer le mot actif
--  de facon securisee (SECURITY DEFINER bypass RLS).
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
