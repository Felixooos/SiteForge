-- =============================================
-- SiteForge: Role system + Défis upgrade
-- Run this in the Supabase SQL Editor
-- =============================================

-- 1) Add role columns to etudiants (4-role system)
--    Créateur    = is_creator=true     → accès au panel SiteForge (construire des sites)
--    Super Admin = is_super_admin=true → poster/supprimer des défis, gérer la boutique
--    Admin       = is_admin=true       → valider des défis, donner/retirer des points
--    Utilisateur = (défaut)            → naviguer, acheter, participer
ALTER TABLE etudiants ADD COLUMN IF NOT EXISTS is_creator BOOLEAN DEFAULT false;
ALTER TABLE etudiants ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN DEFAULT false;

-- 2) Add missing columns to challenges (published/admin_deleted/terminated/created_by)
ALTER TABLE challenges ADD COLUMN IF NOT EXISTS published BOOLEAN DEFAULT false;
ALTER TABLE challenges ADD COLUMN IF NOT EXISTS admin_deleted BOOLEAN DEFAULT false;
ALTER TABLE challenges ADD COLUMN IF NOT EXISTS terminated BOOLEAN DEFAULT false;
ALTER TABLE challenges ADD COLUMN IF NOT EXISTS created_by TEXT;
-- Make description optional (some challenges may be simple)
ALTER TABLE challenges ALTER COLUMN description SET DEFAULT '';

-- 3) Update RLS: allow is_super_admin to manage challenges
DROP POLICY IF EXISTS "challenges_insert" ON challenges;
CREATE POLICY "challenges_insert" ON challenges FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM etudiants
    WHERE email = auth.jwt() ->> 'email'
    AND site_id = challenges.site_id
    AND (is_admin = TRUE OR is_super_admin = TRUE)
  )
);

DROP POLICY IF EXISTS "challenges_update" ON challenges;
CREATE POLICY "challenges_update" ON challenges FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM etudiants
    WHERE email = auth.jwt() ->> 'email'
    AND site_id = challenges.site_id
    AND (is_admin = TRUE OR is_super_admin = TRUE)
  )
);

DROP POLICY IF EXISTS "challenges_delete" ON challenges;
CREATE POLICY "challenges_delete" ON challenges FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM etudiants
    WHERE email = auth.jwt() ->> 'email'
    AND site_id = challenges.site_id
    AND (is_admin = TRUE OR is_super_admin = TRUE)
  )
);

-- 4) Update RLS: allow is_super_admin to manage challenge_validations
DROP POLICY IF EXISTS "cv_insert" ON challenge_validations;
CREATE POLICY "cv_insert" ON challenge_validations FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM etudiants
    WHERE email = auth.jwt() ->> 'email'
    AND site_id = challenge_validations.site_id
    AND (is_admin = TRUE OR is_super_admin = TRUE)
  )
);

DROP POLICY IF EXISTS "cv_delete" ON challenge_validations;
CREATE POLICY "cv_delete" ON challenge_validations FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM etudiants
    WHERE email = auth.jwt() ->> 'email'
    AND site_id = challenge_validations.site_id
    AND (is_admin = TRUE OR is_super_admin = TRUE)
  )
);

-- 5) Allow is_super_admin to insert transactions (for point awards)
DROP POLICY IF EXISTS "transactions_insert" ON transactions;
CREATE POLICY "transactions_insert" ON transactions FOR INSERT WITH CHECK (
  admin_email IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM etudiants
    WHERE email = auth.jwt() ->> 'email'
    AND site_id = transactions.site_id
    AND (is_admin = TRUE OR is_super_admin = TRUE)
  )
);

-- 6) Update etudiants update policy to protect new columns
DROP POLICY IF EXISTS "etudiants_update" ON etudiants;
CREATE POLICY "etudiants_update" ON etudiants FOR UPDATE
  USING (auth.jwt() ->> 'email' = email)
  WITH CHECK (
    auth.jwt() ->> 'email' = email
    AND is_admin            = (SELECT is_admin            FROM etudiants e2 WHERE e2.email = auth.jwt() ->> 'email' AND e2.site_id = etudiants.site_id)
    AND is_super_admin      = (SELECT is_super_admin      FROM etudiants e2 WHERE e2.email = auth.jwt() ->> 'email' AND e2.site_id = etudiants.site_id)
    AND is_creator          = (SELECT is_creator          FROM etudiants e2 WHERE e2.email = auth.jwt() ->> 'email' AND e2.site_id = etudiants.site_id)
    AND is_boutique_manager = (SELECT is_boutique_manager FROM etudiants e2 WHERE e2.email = auth.jwt() ->> 'email' AND e2.site_id = etudiants.site_id)
  );
