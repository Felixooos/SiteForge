-- ============================================================
--  BDA — FONCTIONS RPC (SECURITY DEFINER)
--  Ces fonctions bypass RLS et permettent aux admins
--  d'effectuer des opérations sur d'autres utilisateurs.
--  À exécuter dans Supabase SQL Editor.
-- ============================================================

-- ============================================================
-- 1. Ajouter des points à un joueur (admin only)
-- ============================================================
CREATE OR REPLACE FUNCTION bda_add_points(
  p_site_id    TEXT,
  p_target_email TEXT,
  p_points     INTEGER
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_email TEXT;
  v_is_admin    BOOLEAN;
  v_new_solde   INTEGER;
BEGIN
  v_admin_email := auth.jwt() ->> 'email';

  -- Vérifier que le caller est admin
  SELECT (is_admin OR is_super_admin) INTO v_is_admin
  FROM etudiants
  WHERE email = v_admin_email AND site_id = p_site_id;

  IF NOT COALESCE(v_is_admin, FALSE) THEN
    RETURN jsonb_build_object('error', 'Not authorized');
  END IF;

  -- Mettre à jour le solde
  UPDATE etudiants
  SET solde = solde + p_points
  WHERE email = p_target_email AND site_id = p_site_id
  RETURNING solde INTO v_new_solde;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'User not found');
  END IF;

  -- Log transaction
  INSERT INTO transactions (site_id, destinataire_email, montant, raison, admin_email)
  VALUES (p_site_id, p_target_email, p_points, 'Attribution manuelle', v_admin_email);

  RETURN jsonb_build_object('success', TRUE, 'new_solde', v_new_solde);
END;
$$;


-- ============================================================
-- 2. Valider un défi pour un joueur (admin only)
-- ============================================================
CREATE OR REPLACE FUNCTION bda_validate_challenge(
  p_site_id      TEXT,
  p_challenge_id BIGINT,
  p_target_email TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_email TEXT;
  v_is_admin    BOOLEAN;
  v_ch          challenges%ROWTYPE;
BEGIN
  v_admin_email := auth.jwt() ->> 'email';

  -- Vérifier que le caller est admin
  SELECT (is_admin OR is_super_admin) INTO v_is_admin
  FROM etudiants
  WHERE email = v_admin_email AND site_id = p_site_id;

  IF NOT COALESCE(v_is_admin, FALSE) THEN
    RETURN jsonb_build_object('error', 'Not authorized');
  END IF;

  -- Récupérer le défi
  SELECT * INTO v_ch FROM challenges
  WHERE id = p_challenge_id AND site_id = p_site_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Challenge not found');
  END IF;

  -- Insérer la validation (unique constraint gère le doublon)
  BEGIN
    INSERT INTO challenge_validations (site_id, challenge_id, user_email, validated_by_admin)
    VALUES (p_site_id, p_challenge_id, p_target_email, v_admin_email);
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('error', 'already_validated');
  END;

  -- Ajouter les points au joueur
  UPDATE etudiants
  SET solde = solde + v_ch.points
  WHERE email = p_target_email AND site_id = p_site_id;

  -- Log transaction
  INSERT INTO transactions (site_id, destinataire_email, montant, raison, admin_email)
  VALUES (p_site_id, p_target_email, v_ch.points, 'Défi: ' || v_ch.titre, v_admin_email);

  RETURN jsonb_build_object('success', TRUE, 'points_added', v_ch.points, 'challenge', v_ch.titre);
END;
$$;


-- ============================================================
-- FIN
-- ============================================================
-- ✅ bda_add_points(site_id, target_email, points)
-- ✅ bda_validate_challenge(site_id, challenge_id, target_email)
-- Utilisation côté client : supabase.rpc('bda_add_points', {...})
