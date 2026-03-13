-- Tables pour SiteForge (stockage Supabase au lieu du filesystem)

-- Projets (remplace config/projects/*.json)
CREATE TABLE IF NOT EXISTS sf_projects (
  id TEXT PRIMARY KEY,
  config JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Config globale (remplace config/global.json)
CREATE TABLE IF NOT EXISTS sf_global_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT ''
);

-- Désactiver RLS (accès uniquement via service key depuis le serveur)
ALTER TABLE sf_projects DISABLE ROW LEVEL SECURITY;
ALTER TABLE sf_global_config DISABLE ROW LEVEL SECURITY;

-- Valeurs par défaut global config
INSERT INTO sf_global_config (key, value) VALUES ('supabaseUrl', '') ON CONFLICT (key) DO NOTHING;
INSERT INTO sf_global_config (key, value) VALUES ('supabaseAnonKey', '') ON CONFLICT (key) DO NOTHING;
