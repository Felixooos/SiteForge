-- =============================================
-- SiteForge: Role system + Défis upgrade
-- =============================================

-- 1) Add role columns to etudiants (4-role system)
--    Créateur    = is_creator=true     → accès au panel SiteForge (construire des sites)
--    Super Admin = is_super_admin=true → poster/supprimer des défis, gérer la boutique
--    Admin       = is_admin=true       → valider des défis, donner/retirer des points
--    Utilisateur = (défaut)            → naviguer, acheter, participer
ALTER TABLE etudiants ADD COLUMN IF NOT EXISTS is_creator BOOLEAN DEFAULT false;
ALTER TABLE etudiants ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN DEFAULT false;

-- 2) Add created_by to challenges (who created the challenge)
ALTER TABLE challenges ADD COLUMN IF NOT EXISTS created_by TEXT;

-- 3) Add terminated column to challenges (if not exists)
ALTER TABLE challenges ADD COLUMN IF NOT EXISTS terminated BOOLEAN DEFAULT false;

-- 4) Ensure challenge_validations has proper unique constraint
-- (prevents double-validation of same challenge by same user on same site)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'unique_challenge_validation'
  ) THEN
    ALTER TABLE challenge_validations
      ADD CONSTRAINT unique_challenge_validation
      UNIQUE (challenge_id, user_email, site_id);
  END IF;
END$$;
