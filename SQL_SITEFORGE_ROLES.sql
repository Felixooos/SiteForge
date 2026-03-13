-- =============================================
-- SiteForge: Role system + Défis upgrade
-- =============================================

-- 1) Add is_super_admin to etudiants (4-role system)
--    Créateur  = manages sites via SiteForge admin panel (sf_projects owner)
--    Super Admin = is_super_admin=true → can create/delete challenges, manage boutique
--    Admin     = is_admin=true → can validate challenges, give/remove points
--    Utilisateur = default → browse, buy
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
