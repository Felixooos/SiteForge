-- ============================================================
--  SITEFORGE — RESET COMPLET BASE DE DONNÉES
--  À exécuter dans Supabase SQL Editor (onglet SQL)
--  ⚠️  Ce script supprime TOUTES les données existantes ⚠️
-- ============================================================
-- Chaque table possède un champ `site_id` (TEXT) qui correspond
-- à l'identifiant du projet SiteForge (ex: 'wild-ember', 'mon-projet').
-- Cela permet à plusieurs sites de cohabiter sur le même Supabase.
-- ============================================================


-- ============================================================
-- 0. SUPPRESSION DES ANCIENNES TABLES (dans l'ordre correct)
-- ============================================================
DROP TABLE IF EXISTS challenge_validations CASCADE;
DROP TABLE IF EXISTS challenges          CASCADE;
DROP TABLE IF EXISTS achats              CASCADE;
DROP TABLE IF EXISTS objets_boutique     CASCADE;
DROP TABLE IF EXISTS transactions        CASCADE;
DROP TABLE IF EXISTS nfc_tags            CASCADE;
DROP TABLE IF EXISTS etudiants           CASCADE;

DROP FUNCTION IF EXISTS tirer_gagnant_tombola(BIGINT, TEXT);
DROP FUNCTION IF EXISTS tirer_gagnant_tombola(BIGINT);


-- ============================================================
-- 1. TABLE ETUDIANTS (utilisateurs / comptes)
-- ============================================================
CREATE TABLE etudiants (
  id                  BIGSERIAL PRIMARY KEY,
  site_id             TEXT        NOT NULL,          -- ID du projet SiteForge
  email               TEXT        NOT NULL,
  code_perso          TEXT,                          -- mot de passe (code OTP initial ou personnalisé)
  pseudo              TEXT,
  photo_profil        TEXT,
  solde               INTEGER     NOT NULL DEFAULT 0,
  is_admin            BOOLEAN     NOT NULL DEFAULT FALSE,
  is_boutique_manager BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (site_id, email)   -- un email unique PAR site
);

CREATE INDEX idx_etudiants_site        ON etudiants(site_id);
CREATE INDEX idx_etudiants_site_email  ON etudiants(site_id, email);

ALTER TABLE etudiants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "etudiants_select"        ON etudiants FOR SELECT  USING (true);
CREATE POLICY "etudiants_insert"        ON etudiants FOR INSERT  WITH CHECK (
  auth.jwt() ->> 'email' = email
  AND (is_admin IS NULL OR is_admin = FALSE)
  AND (is_boutique_manager IS NULL OR is_boutique_manager = FALSE)
);
CREATE POLICY "etudiants_update"        ON etudiants FOR UPDATE
  USING    (auth.jwt() ->> 'email' = email)
  WITH CHECK (
    auth.jwt() ->> 'email' = email
    AND is_admin            = (SELECT is_admin            FROM etudiants WHERE email = auth.jwt() ->> 'email' AND site_id = etudiants.site_id)
    AND is_boutique_manager = (SELECT is_boutique_manager FROM etudiants WHERE email = auth.jwt() ->> 'email' AND site_id = etudiants.site_id)
  );
CREATE POLICY "etudiants_delete_block"  ON etudiants FOR DELETE  USING (false);


-- ============================================================
-- 2. TABLE TRANSACTIONS (historique des gains de points)
-- ============================================================
CREATE TABLE transactions (
  id                  BIGSERIAL   PRIMARY KEY,
  site_id             TEXT        NOT NULL,
  destinataire_email  TEXT        NOT NULL,
  montant             INTEGER     NOT NULL,
  raison              TEXT,
  admin_email         TEXT,                          -- NULL si transaction système
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_transactions_site           ON transactions(site_id);
CREATE INDEX idx_transactions_site_dest      ON transactions(site_id, destinataire_email);

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "transactions_select"  ON transactions FOR SELECT USING (true);
CREATE POLICY "transactions_insert"  ON transactions FOR INSERT WITH CHECK (
  admin_email IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM etudiants
    WHERE email   = auth.jwt() ->> 'email'
    AND   site_id = transactions.site_id
    AND   is_admin = TRUE
  )
);
CREATE POLICY "transactions_update_block"  ON transactions FOR UPDATE USING (false);
CREATE POLICY "transactions_delete"        ON transactions FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM etudiants
    WHERE email   = auth.jwt() ->> 'email'
    AND   site_id = transactions.site_id
    AND   is_admin = TRUE
  )
);


-- ============================================================
-- 3. TABLE OBJETS_BOUTIQUE (catalogue de la boutique)
-- ============================================================
CREATE TABLE objets_boutique (
  id               BIGSERIAL   PRIMARY KEY,
  site_id          TEXT        NOT NULL,
  nom              TEXT        NOT NULL,
  prix             INTEGER     NOT NULL DEFAULT 0,
  image_url        TEXT,
  taille           TEXT        NOT NULL DEFAULT 'petit' CHECK (taille IN ('petit','moyen','gros')),
  quantite         INTEGER     NOT NULL DEFAULT 1,
  is_tombola       BOOLEAN     NOT NULL DEFAULT FALSE,
  tombola_terminee BOOLEAN     NOT NULL DEFAULT FALSE,
  is_published     BOOLEAN     NOT NULL DEFAULT FALSE,
  admin_deleted    BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_boutique_site             ON objets_boutique(site_id);
CREATE INDEX idx_boutique_site_published   ON objets_boutique(site_id, is_published, admin_deleted);

ALTER TABLE objets_boutique ENABLE ROW LEVEL SECURITY;

CREATE POLICY "boutique_select"  ON objets_boutique FOR SELECT USING (true);
CREATE POLICY "boutique_insert"  ON objets_boutique FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM etudiants
    WHERE email   = auth.jwt() ->> 'email'
    AND   site_id = objets_boutique.site_id
    AND   (is_boutique_manager = TRUE OR is_admin = TRUE)
  )
);
CREATE POLICY "boutique_update"  ON objets_boutique FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM etudiants
    WHERE email   = auth.jwt() ->> 'email'
    AND   site_id = objets_boutique.site_id
    AND   (is_boutique_manager = TRUE OR is_admin = TRUE)
  )
);
CREATE POLICY "boutique_delete"  ON objets_boutique FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM etudiants
    WHERE email   = auth.jwt() ->> 'email'
    AND   site_id = objets_boutique.site_id
    AND   (is_boutique_manager = TRUE OR is_admin = TRUE)
  )
);


-- ============================================================
-- 4. TABLE ACHATS (historique des achats)
-- ============================================================
CREATE TABLE achats (
  id             BIGSERIAL   PRIMARY KEY,
  site_id        TEXT        NOT NULL,
  acheteur_email TEXT        NOT NULL,
  objet_id       BIGINT      REFERENCES objets_boutique(id) ON DELETE SET NULL,
  nom            TEXT        NOT NULL,              -- copie du nom au moment de l'achat
  prix_paye      INTEGER     NOT NULL,
  est_gagnant    BOOLEAN     DEFAULT NULL,          -- NULL = achat normal, TRUE/FALSE = tombola
  date_tirage    TIMESTAMPTZ DEFAULT NULL,
  date_achat     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_achats_site              ON achats(site_id);
CREATE INDEX idx_achats_site_acheteur     ON achats(site_id, acheteur_email);
CREATE INDEX idx_achats_objet             ON achats(objet_id);

ALTER TABLE achats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "achats_select"  ON achats FOR SELECT USING (true);
CREATE POLICY "achats_insert"  ON achats FOR INSERT WITH CHECK (
  acheteur_email = auth.jwt() ->> 'email'
  OR EXISTS (
    SELECT 1 FROM etudiants
    WHERE email   = auth.jwt() ->> 'email'
    AND   site_id = achats.site_id
    AND   (is_boutique_manager = TRUE OR is_admin = TRUE)
  )
);
CREATE POLICY "achats_update"  ON achats FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM etudiants
    WHERE email   = auth.jwt() ->> 'email'
    AND   site_id = achats.site_id
    AND   (is_boutique_manager = TRUE OR is_admin = TRUE)
  )
);
CREATE POLICY "achats_delete"  ON achats FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM etudiants
    WHERE email   = auth.jwt() ->> 'email'
    AND   site_id = achats.site_id
    AND   (is_boutique_manager = TRUE OR is_admin = TRUE)
  )
);


-- ============================================================
-- 5. TABLE CHALLENGES
-- ============================================================
CREATE TABLE challenges (
  id          BIGSERIAL   PRIMARY KEY,
  site_id     TEXT        NOT NULL,
  titre       TEXT        NOT NULL,
  description TEXT        NOT NULL,
  points      INTEGER     NOT NULL CHECK (points > 0),
  difficulte  TEXT        NOT NULL CHECK (difficulte IN ('facile','moyen','difficile')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_challenges_site       ON challenges(site_id);
CREATE INDEX idx_challenges_difficulte ON challenges(site_id, difficulte);

ALTER TABLE challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "challenges_select"  ON challenges FOR SELECT USING (true);
CREATE POLICY "challenges_insert"  ON challenges FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM etudiants
    WHERE email   = auth.jwt() ->> 'email'
    AND   site_id = challenges.site_id
    AND   is_admin = TRUE
  )
);
CREATE POLICY "challenges_update"  ON challenges FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM etudiants
    WHERE email   = auth.jwt() ->> 'email'
    AND   site_id = challenges.site_id
    AND   is_admin = TRUE
  )
);
CREATE POLICY "challenges_delete"  ON challenges FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM etudiants
    WHERE email   = auth.jwt() ->> 'email'
    AND   site_id = challenges.site_id
    AND   is_admin = TRUE
  )
);


-- ============================================================
-- 6. TABLE CHALLENGE_VALIDATIONS
-- ============================================================
CREATE TABLE challenge_validations (
  id                 BIGSERIAL   PRIMARY KEY,
  site_id            TEXT        NOT NULL,
  challenge_id       BIGINT      NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  user_email         TEXT        NOT NULL,
  validated_by_admin TEXT        NOT NULL,
  validated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (site_id, challenge_id, user_email)
);

CREATE INDEX idx_cv_site          ON challenge_validations(site_id);
CREATE INDEX idx_cv_challenge     ON challenge_validations(challenge_id);
CREATE INDEX idx_cv_user_email    ON challenge_validations(site_id, user_email);

ALTER TABLE challenge_validations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cv_select"  ON challenge_validations FOR SELECT USING (true);
CREATE POLICY "cv_insert"  ON challenge_validations FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM etudiants
    WHERE email   = auth.jwt() ->> 'email'
    AND   site_id = challenge_validations.site_id
    AND   is_admin = TRUE
  )
);
CREATE POLICY "cv_delete"  ON challenge_validations FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM etudiants
    WHERE email   = auth.jwt() ->> 'email'
    AND   site_id = challenge_validations.site_id
    AND   is_admin = TRUE
  )
);


-- ============================================================
-- 7. TABLE NFC_TAGS (tags NFC pour attribution de points)
-- ============================================================
CREATE TABLE nfc_tags (
  id          BIGSERIAL   PRIMARY KEY,
  site_id     TEXT        NOT NULL,
  tag_id      TEXT        NOT NULL,              -- identifiant physique du tag
  label       TEXT,                              -- description lisible
  points      INTEGER     NOT NULL DEFAULT 0,
  one_shot    BOOLEAN     NOT NULL DEFAULT FALSE, -- si TRUE : utilisable une seule fois
  used        BOOLEAN     NOT NULL DEFAULT FALSE,
  used_by     TEXT,
  used_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (site_id, tag_id)
);

CREATE INDEX idx_nfc_site     ON nfc_tags(site_id);
CREATE INDEX idx_nfc_tag_id   ON nfc_tags(site_id, tag_id);

ALTER TABLE nfc_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "nfc_select"  ON nfc_tags FOR SELECT USING (true);
CREATE POLICY "nfc_insert"  ON nfc_tags FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM etudiants
    WHERE email   = auth.jwt() ->> 'email'
    AND   site_id = nfc_tags.site_id
    AND   is_admin = TRUE
  )
);
CREATE POLICY "nfc_update"  ON nfc_tags FOR UPDATE USING (true);
CREATE POLICY "nfc_delete"  ON nfc_tags FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM etudiants
    WHERE email   = auth.jwt() ->> 'email'
    AND   site_id = nfc_tags.site_id
    AND   is_admin = TRUE
  )
);


-- ============================================================
-- 8. FONCTION : TOMBOLA — TIRER LE GAGNANT
-- ============================================================
CREATE OR REPLACE FUNCTION tirer_gagnant_tombola(
  p_objet_id  BIGINT,
  p_site_id   TEXT
)
RETURNS TABLE (
  gagnant_email TEXT,
  nombre_participants BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  achat_gagnant achats%ROWTYPE;
  nb_participants BIGINT;
BEGIN
  -- Vérifier que l'objet existe, appartient au site et est une tombola
  IF NOT EXISTS (
    SELECT 1 FROM objets_boutique
    WHERE id = p_objet_id
      AND site_id = p_site_id
      AND is_tombola = TRUE
  ) THEN
    RAISE EXCEPTION 'Objet introuvable ou pas une tombola';
  END IF;

  -- Compter les participants
  SELECT COUNT(*) INTO nb_participants
  FROM achats
  WHERE objet_id = p_objet_id AND site_id = p_site_id;

  IF nb_participants = 0 THEN
    RAISE EXCEPTION 'Aucun participant pour cette tombola';
  END IF;

  -- Sélectionner un gagnant au hasard
  SELECT * INTO achat_gagnant
  FROM achats
  WHERE objet_id = p_objet_id AND site_id = p_site_id
  ORDER BY RANDOM()
  LIMIT 1;

  -- Marquer le gagnant
  UPDATE achats SET est_gagnant = TRUE, date_tirage = NOW()
  WHERE id = achat_gagnant.id;

  -- Marquer les perdants
  UPDATE achats SET est_gagnant = FALSE, date_tirage = NOW()
  WHERE objet_id = p_objet_id AND site_id = p_site_id AND id != achat_gagnant.id;

  -- Fermer la tombola
  UPDATE objets_boutique SET tombola_terminee = TRUE
  WHERE id = p_objet_id;

  RETURN QUERY SELECT achat_gagnant.acheteur_email, nb_participants;
END;
$$;

GRANT EXECUTE ON FUNCTION tirer_gagnant_tombola(BIGINT, TEXT) TO authenticated;


-- ============================================================
-- FIN — Résumé des tables créées
-- ============================================================
-- ✅ etudiants           (id, site_id, email, code_perso, pseudo, photo_profil, solde, is_admin, is_boutique_manager)
-- ✅ transactions         (id, site_id, destinataire_email, montant, raison, admin_email)
-- ✅ objets_boutique      (id, site_id, nom, prix, image_url, taille, quantite, is_tombola, tombola_terminee, is_published, admin_deleted)
-- ✅ achats               (id, site_id, acheteur_email, objet_id, nom, prix_paye, est_gagnant, date_tirage)
-- ✅ challenges           (id, site_id, titre, description, points, difficulte)
-- ✅ challenge_validations(id, site_id, challenge_id, user_email, validated_by_admin)
-- ✅ nfc_tags             (id, site_id, tag_id, label, points, one_shot, used, used_by)
-- ✅ Fonction tirer_gagnant_tombola(objet_id, site_id)
