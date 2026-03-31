-- ============================================================
--  SUPABASE STORAGE — Policies pour le bucket "sites"
--  Permet au client JS (utilisateur authentifie) d'uploader
--  des images (avatars, custom-cards, hotlines...)
--
--  PREREQUIS : le bucket "sites" doit exister ET etre PUBLIC.
--    (Dashboard > Storage > sites > Settings > Public bucket)
-- ============================================================

-- 1. Tout le monde peut LIRE les fichiers du bucket public "sites"
DROP POLICY IF EXISTS "sites_public_read" ON storage.objects;
CREATE POLICY "sites_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'sites');

-- 2. Les utilisateurs authentifies peuvent UPLOAD (INSERT)
DROP POLICY IF EXISTS "sites_auth_insert" ON storage.objects;
CREATE POLICY "sites_auth_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'sites');

-- 3. Les utilisateurs authentifies peuvent METTRE A JOUR (upsert)
DROP POLICY IF EXISTS "sites_auth_update" ON storage.objects;
CREATE POLICY "sites_auth_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'sites');

-- 4. Les utilisateurs authentifies peuvent SUPPRIMER
DROP POLICY IF EXISTS "sites_auth_delete" ON storage.objects;
CREATE POLICY "sites_auth_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'sites');
