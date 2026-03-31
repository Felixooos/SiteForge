-- ============================================================
--  BDA — SUTOM reward RPC
--  Execute dans Supabase SQL Editor
--
--  Permet aux joueurs de recevoir les points du Sutom de facon
--  securisee (SECURITY DEFINER bypass RLS).
-- ============================================================

CREATE OR REPLACE FUNCTION rpc_reward_sutom(p_site_id TEXT, p_day TEXT, p_points INT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT := auth.jwt() ->> 'email';
  v_already INT;
BEGIN
  -- Verifier authentification
  IF v_email IS NULL THEN
    RAISE EXCEPTION 'Non authentifie';
  END IF;

  -- Verifier que les points sont valides (entre 1 et 500)
  IF p_points <= 0 OR p_points > 500 THEN
    RAISE EXCEPTION 'Points invalides';
  END IF;

  -- Verifier que le joueur n a pas deja ete recompense aujourd hui
  SELECT COUNT(*) INTO v_already
  FROM transactions
  WHERE site_id = p_site_id
    AND destinataire_email = v_email
    AND raison = 'Sutom du ' || p_day;

  IF v_already > 0 THEN
    RETURN; -- Deja recompense, on ne fait rien
  END IF;

  -- Insérer la transaction → le trigger fn_sync_solde_on_transaction met à jour etudiants.solde
  INSERT INTO transactions (site_id, destinataire_email, montant, raison, admin_email)
  VALUES (p_site_id, v_email, p_points, 'Sutom du ' || p_day, NULL);
END;
$$;
