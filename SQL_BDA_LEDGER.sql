-- ============================================================
--  BDA — LEDGER : solde piloté par les transactions
--  À exécuter dans Supabase SQL Editor
--
--  Principe : la table `transactions` est la source de vérité.
--  Chaque INSERT dans `transactions` met automatiquement à jour
--  etudiants.solde via un trigger.
--  Les RPCs admin n'ont plus besoin de toucher etudiants.
-- ============================================================


-- ============================================================
-- 1. TRIGGER : synchronise automatiquement etudiants.solde
--    Appelé après chaque INSERT dans transactions.
--    Logique incrémentale : solde += NEW.montant
--    (montant positif = gain, montant négatif = dépense)
-- ============================================================
CREATE OR REPLACE FUNCTION fn_sync_solde_on_transaction()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE etudiants
  SET solde = solde + NEW.montant
  WHERE site_id = NEW.site_id
    AND email   = NEW.destinataire_email;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_solde_after_transaction ON transactions;
CREATE TRIGGER trg_sync_solde_after_transaction
AFTER INSERT ON transactions
FOR EACH ROW EXECUTE FUNCTION fn_sync_solde_on_transaction();


-- ============================================================
-- 2. RLS TRANSACTIONS : autoriser aussi les achats utilisateur
--    (transactions en négatif pour soi-même = achat de pack)
-- ============================================================
DROP POLICY IF EXISTS "transactions_insert" ON transactions;
CREATE POLICY "transactions_insert" ON transactions FOR INSERT WITH CHECK (
  -- Admins : peuvent insérer des gains pour n'importe qui
  (admin_email IS NOT NULL AND EXISTS (
    SELECT 1 FROM etudiants
    WHERE email   = auth.jwt() ->> 'email'
    AND   site_id = transactions.site_id
    AND   (is_admin = TRUE OR is_super_admin = TRUE)
  ))
  OR
  -- Utilisateurs : peuvent insérer leurs propres dépenses (achat pack, etc.)
  (admin_email IS NULL
   AND destinataire_email = auth.jwt() ->> 'email'
   AND montant < 0)
);


-- ============================================================
-- 3. MISE À JOUR : bda_add_points
--    Plus de UPDATE etudiants — le trigger gère ça.
-- ============================================================
CREATE OR REPLACE FUNCTION bda_add_points(
  p_site_id      TEXT,
  p_target_email TEXT,
  p_points       INTEGER
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_email TEXT;
  v_is_admin    BOOLEAN;
BEGIN
  v_admin_email := auth.jwt() ->> 'email';

  -- Vérifier que le caller est admin
  SELECT (is_admin OR is_super_admin) INTO v_is_admin
  FROM etudiants
  WHERE email = v_admin_email AND site_id = p_site_id;

  IF NOT COALESCE(v_is_admin, FALSE) THEN
    RETURN jsonb_build_object('error', 'Not authorized');
  END IF;

  -- Vérifier que l'utilisateur cible existe
  IF NOT EXISTS (SELECT 1 FROM etudiants WHERE email = p_target_email AND site_id = p_site_id) THEN
    RETURN jsonb_build_object('error', 'User not found');
  END IF;

  -- Insérer la transaction → le trigger met à jour etudiants.solde automatiquement
  INSERT INTO transactions (site_id, destinataire_email, montant, raison, admin_email)
  VALUES (p_site_id, p_target_email, p_points, 'Attribution manuelle', v_admin_email);

  RETURN jsonb_build_object(
    'success', TRUE,
    'new_solde', (SELECT solde FROM etudiants WHERE email = p_target_email AND site_id = p_site_id)
  );
END;
$$;


-- ============================================================
-- 4. MISE À JOUR : bda_validate_challenge
--    Plus de UPDATE etudiants — le trigger gère ça.
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

  -- Insérer la transaction → le trigger met à jour etudiants.solde automatiquement
  INSERT INTO transactions (site_id, destinataire_email, montant, raison, admin_email)
  VALUES (p_site_id, p_target_email, v_ch.points, 'Défi: ' || v_ch.titre, v_admin_email);

  RETURN jsonb_build_object(
    'success', TRUE,
    'points_added', v_ch.points,
    'challenge', v_ch.titre
  );
END;
$$;


-- ============================================================
-- FIN
-- ============================================================
-- ✅ Trigger fn_sync_solde_on_transaction sur transactions INSERT
-- ✅ RLS transactions mis à jour : admin gains + user dépenses
-- ✅ bda_add_points  : insère transaction seulement (trigger ← solde)
-- ✅ bda_validate_challenge : idem
-- 
-- CÔTÉ CLIENT (main.js) :
--   Achats de pack → INSERT dans transactions (montant négatif)
--   Plus de mise à jour directe de etudiants.solde
