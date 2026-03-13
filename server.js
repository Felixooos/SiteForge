require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const express = require('express');
const path = require('path');
const fs = require('fs-extra');
const multer = require('multer');
const ejs = require('ejs');
const mime = require('mime-types');
const { createClient } = require('@supabase/supabase-js');
const sharp = require('sharp');

const app = express();
const PORT = 3000;

// ==================== SUPABASE ====================
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const BUCKET = process.env.SUPABASE_BUCKET || 'sites';

let supabase = null;
if (SUPABASE_URL && SUPABASE_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  console.log('  ✓ Supabase connecté');
} else {
  console.log('  ⚠ Supabase non configuré (.env manquant)');
}

// Init bucket on startup
async function initBucket() {
  if (!supabase) return;
  try {
    const { data: buckets } = await supabase.storage.listBuckets();
    const exists = buckets?.some(b => b.name === BUCKET);
    if (!exists) {
      await supabase.storage.createBucket(BUCKET, { public: true });
      console.log(`  ✓ Bucket "${BUCKET}" créé`);
    } else {
      console.log(`  ✓ Bucket "${BUCKET}" prêt`);
    }
  } catch (err) {
    console.log('  ⚠ Bucket init:', err.message);
  }
}
initBucket();

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Auth middleware for admin routes
async function requireAdmin(req, res, next) {
  // Les fichiers HTML/CSS/JS sont servis librement — le client JS gère la redirection vers login
  // Seules les routes /api/ sont protégées côté serveur
  if (!req.path.startsWith('/api/') || req.path === '/api/global' || req.path === '/api/check-admin') {
    return next();
  }

  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ error: 'Non authentifié' });
  }

  try {
    if (!supabase) return res.status(500).json({ error: 'Supabase non configuré' });

    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return res.status(401).json({ error: 'Session invalide' });

    const { data: etudiant } = await supabase
      .from('etudiants')
      .select('is_admin')
      .eq('email', user.email)
      .single();

    if (!etudiant || !etudiant.is_admin) {
      return res.status(403).json({ error: 'Accès refusé : droits administrateur requis' });
    }

    req.user = user;
    next();
  } catch (err) {
    console.error('Auth error:', err);
    res.status(401).send('Erreur d\'authentification');
  }
}

app.use('/admin', requireAdmin);
app.use('/admin', express.static(path.join(__dirname, 'admin')));
// Note: /uploads supprimé — les images sont dans Supabase Storage

// EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'templates'));

// Multer : mémoire seulement (pas de disque sur Vercel)
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// ==================== HELPERS ====================
function escapeHtmlServer(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ==================== GENERATE / PUBLISH PROJECT ====================
async function generateProject(projectId) {
  if (!supabase) return false;

  // Charger config depuis Supabase
  const { data: row, error: fetchErr } = await supabase
    .from('sf_projects')
    .select('config')
    .eq('id', projectId)
    .single();

  if (fetchErr || !row) return false;
  const config = row.config;

  // Générer HTML/CSS/JS en mémoire
  const globalConfig = await getGlobalConfig();
  const html = await ejs.renderFile(
    path.join(__dirname, 'templates', 'base.ejs'),
    { config, sections: config.sections.filter(s => s.enabled).sort((a, b) => a.order - b.order), globalConfig, siteId: projectId },
    { views: [path.join(__dirname, 'templates')] }
  );
  const css = generateCSS(config);
  const js = generateJS(config);

  // Upload vers Supabase Storage
  const uploads = [
    { path: `${projectId}/index.html`, content: html, type: 'text/html' },
    { path: `${projectId}/assets/style.css`, content: css, type: 'text/css' },
    { path: `${projectId}/assets/main.js`, content: js, type: 'application/javascript' },
  ];

  for (const file of uploads) {
    await supabase.storage.from(BUCKET).remove([file.path]);
    const { error } = await supabase.storage.from(BUCKET).upload(
      file.path, Buffer.from(file.content, 'utf-8'),
      { contentType: file.type, upsert: true }
    );
    if (error) console.error(`  ✗ Upload ${file.path}:`, error.message);
  }

  console.log(`  ✓ Site "${projectId}" publié → /${projectId}/`);
  return true;
}

// ==================== PORTAL PAGE (/) ====================
app.get('/', async (req, res) => {
  try {
    const projects = [];
    if (supabase) {
      const { data: rows } = await supabase.from('sf_projects').select('id, config, updated_at').order('updated_at', { ascending: false });
      for (const row of (rows || [])) {
        const publicUrl = SUPABASE_URL ? `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${row.id}/index.html` : null;
        projects.push({ id: row.id, name: row.config.projectName, published: true, onlineUrl: publicUrl });
      }
    }

    let cardsHtml = '';
    if (projects.length > 0) {
      cardsHtml = '<div class="sites-grid">' + projects.map(p => {
        const name = escapeHtmlServer(p.name);
        const statusClass = p.published ? 'published' : 'draft';
        const statusText = p.published ? 'En ligne' : 'Brouillon';
        const visitBtn = p.published ? `<a href="/${p.id}/" class="btn-visit" target="_blank">🌐 Local</a>` : '';
        const onlineBtn = p.onlineUrl ? `<a href="${p.onlineUrl}" class="btn-online" target="_blank">🚀 En ligne</a>` : '';
        return `<div class="site-card"><div class="site-card-body"><h3>${name}</h3><div class="site-status ${statusClass}">${statusText}</div><div class="site-actions">${visitBtn}${onlineBtn}<a href="/admin/#edit=${p.id}" class="btn-edit">✏️ Modifier</a></div></div></div>`;
      }).join('') + '</div>';
    } else {
      cardsHtml = `<div class="empty-portal"><div class="empty-icon">🌐</div><h3>Aucun site hébergé</h3><p>Crée ton premier site depuis le panel d'administration</p><a href="/admin/" class="btn-admin">⚙️ Accéder à l'admin</a></div>`;
    }

    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SiteForge — Mes Sites</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Inter', sans-serif; background: #0f1117; color: #e4e7ef; min-height: 100vh; }
    .portal-header { background: #1a1d27; border-bottom: 1px solid #2e3346; padding: 30px 40px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 15px; }
    .logo-area { display: flex; align-items: center; gap: 16px; }
    .logo-icon { font-size: 40px; }
    .logo-area h1 { font-size: 28px; font-weight: 800; }
    .tagline { color: #8b90a5; font-size: 14px; margin-top: 2px; }
    .btn-admin { display: inline-flex; align-items: center; gap: 8px; padding: 10px 20px; background: #6366f1; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px; transition: all 0.2s; }
    .btn-admin:hover { background: #818cf8; transform: translateY(-1px); }
    .portal-main { max-width: 1200px; margin: 0 auto; padding: 40px; }
    .portal-main h2 { font-size: 22px; margin-bottom: 25px; }
    .sites-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 20px; }
    .site-card { background: #1a1d27; border: 1px solid #2e3346; border-radius: 12px; overflow: hidden; transition: all 0.25s; }
    .site-card:hover { border-color: #6366f1; transform: translateY(-3px); box-shadow: 0 8px 30px rgba(99, 102, 241, 0.15); }
    .site-card-body { padding: 25px; }
    .site-card h3 { font-size: 20px; margin-bottom: 8px; }
    .site-status { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; padding: 4px 12px; border-radius: 20px; margin-bottom: 15px; }
    .site-status.published { background: rgba(34,197,94,0.15); color: #22c55e; }
    .site-status.draft { background: rgba(245,158,11,0.15); color: #f59e0b; }
    .site-status::before { content: ''; width: 8px; height: 8px; border-radius: 50%; background: currentColor; }
    .site-actions { display: flex; gap: 10px; flex-wrap: wrap; }
    .site-actions a { display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 13px; transition: all 0.2s; }
    .btn-visit { background: #6366f1; color: white; }
    .btn-visit:hover { background: #818cf8; }
    .btn-online { background: #22c55e; color: white; }
    .btn-online:hover { background: #16a34a; }
    .btn-edit { background: transparent; color: #8b90a5; border: 1px solid #2e3346; }
    .btn-edit:hover { background: #242836; color: #e4e7ef; }
    .empty-portal { text-align: center; padding: 80px 20px; }
    .empty-portal .empty-icon { font-size: 60px; margin-bottom: 20px; }
    .empty-portal h3 { font-size: 20px; margin-bottom: 8px; }
    .empty-portal p { color: #8b90a5; margin-bottom: 20px; }
  </style>
</head>
<body>
  <header class="portal-header">
    <div class="logo-area">
      <div class="logo-icon">🔥</div>
      <div>
        <h1>SiteForge</h1>
        <p class="tagline">Plateforme d'hébergement de sites</p>
      </div>
    </div>
    <a href="/admin/" class="btn-admin">⚙️ Administration</a>
  </header>
  <main class="portal-main">
    <h2>Sites hébergés</h2>
    ${cardsHtml}
  </main>
</body>
</html>`;
    res.send(html);
  } catch (err) {
    res.status(500).send('Erreur: ' + err.message);
  }
});

// ==================== GLOBAL CONFIG ====================
async function getGlobalConfig() {
  // Fallback sur les variables d'environnement
  const fallback = { supabaseUrl: SUPABASE_URL || '', supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '' };
  if (!supabase) return fallback;
  try {
    const { data: rows } = await supabase.from('sf_global_config').select('key, value');
    if (!rows || rows.length === 0) return fallback;
    const config = {};
    for (const row of rows) config[row.key] = row.value;
    return { supabaseUrl: config.supabaseUrl || fallback.supabaseUrl, supabaseAnonKey: config.supabaseAnonKey || fallback.supabaseAnonKey };
  } catch {
    return fallback;
  }
}

// ==================== ADMIN API ROUTES ====================

// GET /admin/api/global - Get global config
app.get('/admin/api/global', async (req, res) => {
  try { res.json(await getGlobalConfig()); } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /admin/api/check-admin - Vérifie si le token JWT est admin (utilisé par login.html)
app.get('/admin/api/check-admin', async (req, res) => {
  try {
    if (!supabase) return res.json({ isAdmin: false });
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.json({ isAdmin: false });
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return res.json({ isAdmin: false });
    const { data: etudiant } = await supabase.from('etudiants').select('is_admin').eq('email', user.email).single();
    res.json({ isAdmin: !!(etudiant && etudiant.is_admin) });
  } catch (err) {
    res.json({ isAdmin: false });
  }
});

// POST /admin/api/global - Update global config
app.post('/admin/api/global', async (req, res) => {
  try {
    if (!supabase) return res.status(500).json({ error: 'Supabase non configuré' });
    const updates = Object.entries(req.body);
    for (const [key, value] of updates) {
      await supabase.from('sf_global_config').upsert({ key, value }, { onConflict: 'key' });
    }
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /admin/api/projects - List all projects
app.get('/admin/api/projects', async (req, res) => {
  try {
    if (!supabase) return res.json([]);
    const { data: rows, error } = await supabase.from('sf_projects').select('id, config, updated_at').order('updated_at', { ascending: false });
    if (error) return res.json([]);
    const projects = (rows || []).map(row => ({
      id: row.id,
      name: row.config.projectName,
      published: true,
      onlineUrl: SUPABASE_URL ? `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${row.id}/index.html` : null,
      lastModified: row.updated_at
    }));
    res.json(projects);
  } catch (err) {
    res.json([]);
  }
});

// POST /admin/api/projects - Create a new project
app.post('/admin/api/projects', async (req, res) => {
  try {
    if (!supabase) return res.status(500).json({ error: 'Supabase non configuré' });
    const { name } = req.body;
    const id = name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'projet-' + Date.now();

    // Vérifier si le projet existe déjà
    const { data: existing } = await supabase.from('sf_projects').select('id').eq('id', id).single();
    if (existing) return res.status(400).json({ error: 'Un projet avec ce nom existe déjà' });

    const defaultConfig = await fs.readJson(path.join(__dirname, 'config', 'default.json'));
    defaultConfig.projectName = name;

    const { error } = await supabase.from('sf_projects').insert({ id, config: defaultConfig });
    if (error) throw error;

    // Auto-publish initial version
    await generateProject(id);

    res.json({ id, name });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /admin/api/projects/:id - Get project config
app.get('/admin/api/projects/:id', async (req, res) => {
  try {
    if (!supabase) return res.status(500).json({ error: 'Supabase non configuré' });
    const { data: row, error } = await supabase.from('sf_projects').select('config').eq('id', req.params.id).single();
    if (error || !row) return res.status(404).json({ error: 'Projet non trouvé' });
    const config = row.config;

    // Merger les sections manquantes depuis le config par défaut
    const defaultConfig = await fs.readJson(path.join(__dirname, 'config', 'default.json'));
    const existingTypes = new Set(config.sections.map(s => s.type));
    for (const defSection of defaultConfig.sections) {
      if (!existingTypes.has(defSection.type)) config.sections.push({ ...defSection });
    }
    if (!config.siteConfig) config.siteConfig = {};
    const defSC = defaultConfig.siteConfig || {};
    for (const key of Object.keys(defSC)) {
      if (config.siteConfig[key] === undefined) config.siteConfig[key] = defSC[key];
    }

    res.json({ id: req.params.id, config });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /admin/api/projects/:id - Update config + auto-publish
app.put('/admin/api/projects/:id', async (req, res) => {
  try {
    if (!supabase) return res.status(500).json({ error: 'Supabase non configuré' });
    const { error } = await supabase.from('sf_projects')
      .update({ config: req.body, updated_at: new Date().toISOString() })
      .eq('id', req.params.id);
    if (error) throw error;

    await generateProject(req.params.id);
    res.json({ success: true, published: true, url: `/${req.params.id}/` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /admin/api/projects/:id - Delete a project
app.delete('/admin/api/projects/:id', async (req, res) => {
  try {
    if (!supabase) return res.status(500).json({ error: 'Supabase non configuré' });
    const id = req.params.id;
    // Supprimer de la DB
    await supabase.from('sf_projects').delete().eq('id', id);
    // Supprimer les fichiers du Storage
    const { data: storageFiles } = await supabase.storage.from(BUCKET).list(id, { limit: 200 });
    if (storageFiles && storageFiles.length > 0) {
      await supabase.storage.from(BUCKET).remove(storageFiles.map(f => `${id}/${f.name}`));
    }
    const { data: assetFiles } = await supabase.storage.from(BUCKET).list(`${id}/assets`, { limit: 200 });
    if (assetFiles && assetFiles.length > 0) {
      await supabase.storage.from(BUCKET).remove(assetFiles.map(f => `${id}/assets/${f.name}`));
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /admin/api/projects/:projectId/upload - Upload image (auto-compress) → Supabase Storage
app.post('/admin/api/projects/:projectId/upload', upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Aucun fichier' });
  if (!supabase) return res.status(500).json({ error: 'Supabase non configuré' });
  try {
    const ext = path.extname(req.file.originalname).toLowerCase();
    let buffer = req.file.buffer;
    let filename, contentType;

    if (['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
      const keepPng = ext === '.png';
      if (keepPng) {
        buffer = await sharp(buffer).resize(1200, null, { withoutEnlargement: true, fit: 'inside' }).png({ compressionLevel: 8 }).toBuffer();
        filename = `${Date.now()}.png`;
        contentType = 'image/png';
      } else {
        buffer = await sharp(buffer).resize(1200, null, { withoutEnlargement: true, fit: 'inside' }).jpeg({ quality: 82 }).toBuffer();
        filename = `${Date.now()}.jpg`;
        contentType = 'image/jpeg';
      }
    } else {
      filename = `${Date.now()}${ext}`;
      contentType = req.file.mimetype;
    }

    const storagePath = `uploads/${req.params.projectId}/${filename}`;
    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(storagePath, buffer, { contentType, upsert: true });
    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
    res.json({ url: publicUrl, filename });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /admin/api/projects/:projectId/uploads/:filename - Delete an uploaded file
app.delete('/admin/api/projects/:projectId/uploads/:filename', async (req, res) => {
  try {
    if (!supabase) return res.status(500).json({ error: 'Supabase non configuré' });
    const safeName = path.basename(req.params.filename);
    const storagePath = `uploads/${req.params.projectId}/${safeName}`;
    await supabase.storage.from(BUCKET).remove([storagePath]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /admin/api/projects/:id/publish - Manual publish (= deploy sur Supabase Storage)
app.post('/admin/api/projects/:id/publish', async (req, res) => {
  try {
    const result = await generateProject(req.params.id);
    if (!result) return res.status(404).json({ error: 'Projet non trouvé' });
    const publicUrl = SUPABASE_URL ? `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${req.params.id}/index.html` : `/${req.params.id}/`;
    res.json({ success: true, url: publicUrl });
  } catch (err) {
    console.error('Publish error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /admin/api/projects/:id/deploy - Alias de publish
app.post('/admin/api/projects/:id/deploy', async (req, res) => {
  try {
    if (!supabase) return res.status(500).json({ error: 'Supabase non configuré' });
    const result = await generateProject(req.params.id);
    if (!result) return res.status(404).json({ error: 'Projet non trouvé' });
    const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${req.params.id}/index.html`;
    res.json({ success: true, url: publicUrl, uploaded: 3, total: 3 });
  } catch (err) {
    console.error('Deploy error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /admin/api/deploy-url/:id - Get the public URL of a deployed site
app.get('/admin/api/deploy-url/:id', (req, res) => {
  if (!SUPABASE_URL) return res.json({ url: null });
  const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${req.params.id}/index.html`;
  res.json({ url: publicUrl });
});

// GET /admin/preview/:id - Live preview (EJS rendered from config)
app.get('/admin/preview/:id', async (req, res) => {
  try {
    if (!supabase) return res.status(500).send('Supabase non configuré');
    const { data: row, error } = await supabase.from('sf_projects').select('config').eq('id', req.params.id).single();
    if (error || !row) return res.status(404).send('Projet non trouvé');
    const config = row.config;
    const sections = config.sections.filter(s => s.enabled).sort((a, b) => a.order - b.order);

    const globalConfig = await getGlobalConfig();
    let html = await ejs.renderFile(
      path.join(__dirname, 'templates', 'base.ejs'),
      { config, sections, globalConfig, siteId: req.params.id },
      { views: [path.join(__dirname, 'templates')] }
    );

    // Inject inline editing script for preview mode
    const editingScript = `
<style>
  [data-sf-edit] { position: relative; cursor: text; transition: outline 0.15s, box-shadow 0.15s; border-radius: 3px; }
  [data-sf-edit]:hover { outline: 2px dashed rgba(99,102,241,0.6); outline-offset: 4px; }
  [data-sf-edit]:focus { outline: 2px solid #6366f1; outline-offset: 4px; box-shadow: 0 0 0 4px rgba(99,102,241,0.15); }
  [data-sf-edit].sf-empty { min-height: 1.2em; min-width: 60px; display: inline-block; }
  [data-sf-edit].sf-empty::before { content: 'Cliquer pour éditer...'; color: rgba(150,150,150,0.5); font-style: italic; font-size: 0.9em; }
  .sf-edit-tooltip { position: fixed; bottom: 15px; left: 50%; transform: translateX(-50%); background: #1a1d27; color: #e4e7ef; padding: 8px 18px; border-radius: 8px; font-size: 13px; font-family: Inter, sans-serif; z-index: 99999; pointer-events: none; opacity: 0; transition: opacity 0.2s; box-shadow: 0 4px 15px rgba(0,0,0,0.3); }
  .sf-edit-tooltip.visible { opacity: 1; }
  .sf-section-highlight { animation: sf-pulse 0.6s ease; }
  @keyframes sf-pulse { 0% { box-shadow: 0 0 0 0 rgba(99,102,241,0.4); } 100% { box-shadow: 0 0 0 0 transparent; } }
</style>
<script>
(function() {
  // Tooltip
  const tooltip = document.createElement('div');
  tooltip.className = 'sf-edit-tooltip';
  tooltip.textContent = '✏️ Cliquer sur un texte pour le modifier directement';
  document.body.appendChild(tooltip);
  setTimeout(() => tooltip.classList.add('visible'), 500);
  setTimeout(() => tooltip.classList.remove('visible'), 4000);

  // Mark empty editable elements
  function markEmpty() {
    document.querySelectorAll('[data-sf-edit]').forEach(el => {
      el.classList.toggle('sf-empty', !el.textContent.trim());
    });
  }
  markEmpty();

  // Setup editable elements
  document.querySelectorAll('[data-sf-edit]').forEach(el => {
    el.setAttribute('tabindex', '0');

    el.addEventListener('focus', () => {
      el.setAttribute('contenteditable', 'true');
      el.classList.remove('sf-empty');
      tooltip.classList.remove('visible');
    });

    el.addEventListener('blur', () => {
      el.removeAttribute('contenteditable');
      const path = el.dataset.sfEdit;
      const value = el.innerText.trim();
      markEmpty();
      // Send to parent admin
      window.parent.postMessage({
        type: 'sf-inline-edit',
        path: path,
        value: value
      }, '*');
    });

    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        el.blur();
      }
      if (e.key === 'Escape') {
        el.blur();
      }
    });

    el.addEventListener('mouseenter', () => {
      if (!document.activeElement || document.activeElement !== el) {
        tooltip.textContent = '✏️ ' + (el.tagName === 'H1' ? 'Titre' : el.tagName === 'H2' ? 'Sous-titre' : el.tagName === 'H3' ? 'Titre' : el.tagName === 'P' ? 'Texte' : 'Champ') + ' — cliquer pour modifier';
        tooltip.classList.add('visible');
      }
    });
    el.addEventListener('mouseleave', () => {
      if (document.activeElement !== el) tooltip.classList.remove('visible');
    });
  });

  // Handle click on section to highlight in admin
  document.querySelectorAll('[id^="section-"]').forEach(sectionDiv => {
    sectionDiv.addEventListener('click', (e) => {
      // Don't interfere with contenteditable
      if (e.target.hasAttribute('contenteditable')) return;
      const sectionId = sectionDiv.id.replace('section-', '');
      window.parent.postMessage({ type: 'sf-section-click', sectionId }, '*');
    });
  });
})();
</script>`;

    html = html.replace('</body>', editingScript + '\n</body>');
    res.send(html);
  } catch (err) {
    console.error('Preview error:', err);
    res.status(500).send('Erreur: ' + err.message);
  }
});

// ==================== CSS GENERATOR ====================
function generateCSS(config) {
  const c = config.colors;
  const f = config.fonts;
  return `/* SiteForge - Generated CSS */
@import url('https://fonts.googleapis.com/css2?family=${f.heading.replace(/ /g, '+')}:wght@300;400;600;700;900&family=${f.body.replace(/ /g, '+')}:wght@300;400;500;600;700&display=swap');

:root {
  --primary: ${c.primary};
  --secondary: ${c.secondary};
  --accent: ${c.accent};
  --bg-start: ${c.backgroundStart};
  --bg-end: ${c.backgroundEnd};
  --text: ${c.text};
  --text-light: ${c.textLight};
  --card-bg: ${c.cardBg};
  --card-bg-end: ${c.cardBgEnd};
  --font-heading: '${f.heading}', sans-serif;
  --font-body: '${f.body}', sans-serif;
}

* { margin: 0; padding: 0; box-sizing: border-box; }

html { scroll-behavior: smooth; }

body {
  font-family: var(--font-body);
  background: linear-gradient(135deg, var(--bg-start) 0%, var(--bg-end) 100%);
  color: var(--text);
  min-height: 100vh;
  overflow-x: hidden;
}

/* ===== NAVIGATION BURGER ===== */
.nav-burger-btn {
  position: fixed; top: 20px; left: 20px; z-index: 9999;
  cursor: pointer; background: linear-gradient(135deg, var(--card-bg), var(--card-bg-end));
  padding: 12px; border-radius: 10px; box-shadow: 0 4px 15px rgba(0,0,0,0.2);
  border: none; display: flex; flex-direction: column; gap: 6px;
}
.nav-burger-btn span {
  display: block; width: 28px; height: 3px;
  background: var(--primary); border-radius: 2px; transition: all 0.3s;
}
.nav-burger-btn.active span:nth-child(1) { transform: translateY(9px) rotate(45deg); }
.nav-burger-btn.active span:nth-child(2) { opacity: 0; }
.nav-burger-btn.active span:nth-child(3) { transform: translateY(-9px) rotate(-45deg); }

.sidebar {
  position: fixed; top: 0; left: -350px; width: 320px; height: 100vh;
  background: linear-gradient(180deg, var(--card-bg), var(--card-bg-end));
  box-shadow: 5px 0 25px rgba(0,0,0,0.3); z-index: 9998;
  transition: left 0.3s ease; overflow-y: auto; display: flex; flex-direction: column;
}
.sidebar.open { left: 0; }
.sidebar-logo { text-align: center; padding: 30px 20px; border-bottom: 2px solid rgba(0,0,0,0.1); }
.sidebar-logo img { max-width: 180px; height: auto; }
.sidebar-logo h3 { color: var(--primary); font-family: var(--font-heading); font-size: 24px; margin-top: 10px; }
.sidebar-nav { padding: 20px 0; flex: 1; }
.sidebar-nav a {
  display: flex; align-items: center; padding: 16px 25px; color: var(--text);
  text-decoration: none; font-weight: 600; font-size: 18px;
  transition: all 0.3s; border-left: 4px solid transparent;
}
.sidebar-nav a:hover { background: rgba(0,0,0,0.05); transform: translateX(5px); }
.sidebar-nav a.active { border-left-color: var(--primary); background: rgba(0,0,0,0.05); }
.sidebar-nav a svg { width: 22px; height: 22px; margin-right: 12px; fill: var(--primary); }
.sidebar-footer { padding: 20px; border-top: 2px solid rgba(0,0,0,0.1); text-align: center; font-size: 13px; color: var(--text); opacity: 0.6; }
.sidebar-overlay {
  position: fixed; top: 0; left: 0; width: 100%; height: 100%;
  background: rgba(0,0,0,0.5); z-index: 9997; opacity: 0; visibility: hidden; transition: all 0.3s;
}
.sidebar-overlay.active { opacity: 1; visibility: visible; }

/* ===== NAVIGATION NAVBAR ===== */
.navbar {
  position: fixed; top: 0; left: 0; width: 100%; z-index: 9999;
  background: linear-gradient(135deg, var(--card-bg), var(--card-bg-end));
  box-shadow: 0 2px 10px rgba(0,0,0,0.15); padding: 0 40px;
  display: flex; align-items: center; justify-content: space-between; height: 70px;
}
.navbar-logo { display: flex; align-items: center; gap: 12px; }
.navbar-logo img { height: 40px; width: auto; }
.navbar-logo h3 { font-family: var(--font-heading); color: var(--primary); font-size: 20px; margin: 0; }
.navbar-links { display: flex; gap: 8px; }
.navbar-links a {
  color: var(--text); text-decoration: none; padding: 8px 16px;
  border-radius: 8px; font-weight: 600; transition: all 0.3s;
}
.navbar-links a:hover, .navbar-links a.active { background: var(--primary); color: white; }

/* ===== SECTIONS COMMON ===== */
.section {
  padding: 60px 20px; max-width: 1200px; margin: 0 auto;
  animation: fadeInUp 0.6s ease;
}
.section-banner {
  background: linear-gradient(135deg, var(--card-bg), var(--card-bg-end));
  padding: 25px 40px; margin: 0 calc(-50vw + 50%) 30px; text-align: center;
  box-shadow: 0 4px 15px rgba(0,0,0,0.15); position: relative; overflow: hidden;
}
.section-banner::after {
  content: ''; position: absolute; top: -50%; left: -50%; width: 200%; height: 200%;
  background: linear-gradient(45deg, transparent 30%, rgba(255,255,255,0.2) 50%, transparent 70%);
  animation: shine 5s ease-in-out infinite;
}
@keyframes shine {
  0% { transform: translateX(-100%) translateY(-100%) rotate(45deg); }
  100% { transform: translateX(100%) translateY(100%) rotate(45deg); }
}
.section-title {
  font-family: var(--font-heading); font-size: 2.5rem; font-weight: 900;
  color: var(--primary); position: relative; z-index: 1;
}
.section-subtitle {
  font-size: 1.1rem; color: var(--text); opacity: 0.7;
  text-align: center; margin-bottom: 30px;
}
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(30px); }
  to { opacity: 1; transform: translateY(0); }
}

/* ===== HERO ===== */
.hero-section {
  min-height: 100vh; display: flex; flex-direction: column;
  justify-content: center; align-items: center; text-align: center; padding: 40px 20px;
  position: relative;
}
.hero-section .hero-card {
  background: linear-gradient(135deg, var(--card-bg), var(--card-bg-end));
  padding: 50px 40px; border-radius: 20px;
  box-shadow: 0 15px 50px rgba(0,0,0,0.25); max-width: 600px; width: 100%;
}
.hero-section .hero-logo { max-width: 250px; height: auto; margin-bottom: 20px; }
.hero-section h1 {
  font-family: var(--font-heading); font-size: 3rem; font-weight: 900;
  background: linear-gradient(135deg, var(--primary), var(--secondary));
  -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
}
.hero-section p { color: var(--primary); font-weight: 600; font-size: 1.2rem; margin-top: 15px; }

/* ===== ABOUT ===== */
.about-content {
  display: flex; gap: 40px; align-items: center; flex-wrap: wrap;
}
.about-content.text-right { flex-direction: row-reverse; }
.about-text { flex: 1; min-width: 300px; }
.about-text p { line-height: 1.8; font-size: 1.1rem; color: var(--text-light); }
.about-image { flex: 1; min-width: 300px; text-align: center; }
.about-image img { max-width: 100%; border-radius: 15px; box-shadow: 0 10px 30px rgba(0,0,0,0.2); }

/* ===== TEAM ===== */
.group-photo { width: 100%; border-radius: 15px; box-shadow: 0 10px 30px rgba(0,0,0,0.2); margin-bottom: 40px; position: relative; overflow: hidden; }
.group-photo img { width: 100%; display: block; border-radius: 15px; }
.group-photo-overlay {
  position: absolute; bottom: 0; left: 0; right: 0;
  background: linear-gradient(transparent, rgba(0,0,0,0.7)); padding: 30px; color: white;
}
.group-photo-overlay h2 { font-family: var(--font-heading); font-size: 2rem; }
.group-photo-overlay p { opacity: 0.9; }
.team-timeline { display: flex; flex-direction: column; gap: 40px; }
.team-pole {
  display: flex; gap: 25px; align-items: stretch;
  background: linear-gradient(135deg, var(--card-bg), var(--card-bg-end));
  border-radius: 15px; overflow: hidden; box-shadow: 0 5px 20px rgba(0,0,0,0.15);
}
.team-pole.pole-right { flex-direction: row-reverse; }
.pole-image { flex: 0 0 200px; }
.pole-image img { width: 100%; height: 100%; object-fit: cover; }
.pole-content { flex: 1; padding: 25px; }
.pole-label { font-size: 0.85rem; text-transform: uppercase; color: var(--primary); font-weight: 700; letter-spacing: 1px; }
.pole-title { font-family: var(--font-heading); font-size: 1.5rem; margin: 8px 0; color: var(--text); }
.pole-description { color: var(--text); opacity: 0.8; line-height: 1.6; margin-bottom: 15px; }
.pole-members { display: flex; flex-wrap: wrap; gap: 8px; }
.member-tag {
  background: var(--primary); color: white; padding: 5px 12px;
  border-radius: 20px; font-size: 0.85rem; font-weight: 600;
}

/* ===== GALLERY ===== */
.gallery-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 15px; }
.gallery-grid.layout-masonry { columns: 3; column-gap: 15px; }
.gallery-grid.layout-masonry .gallery-item { break-inside: avoid; margin-bottom: 15px; }
.gallery-item { border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.15); cursor: pointer; transition: transform 0.3s; }
.gallery-item:hover { transform: scale(1.03); }
.gallery-item img { width: 100%; display: block; }

/* ===== GOODIES ===== */
.goodies-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 25px; }
.goodie-card {
  background: linear-gradient(135deg, var(--card-bg), var(--card-bg-end));
  border-radius: 15px; overflow: hidden; box-shadow: 0 5px 20px rgba(0,0,0,0.15);
  text-align: center; transition: transform 0.3s;
}
.goodie-card:hover { transform: translateY(-5px); }
.goodie-card img { width: 100%; aspect-ratio: 1; object-fit: cover; }
.goodie-card h3 { padding: 15px; font-family: var(--font-heading); color: var(--text); }
.goodie-card p { padding: 0 15px 15px; color: var(--text); opacity: 0.7; font-size: 0.9rem; }

/* ===== PROGRAMME ===== */
.programme-list { display: flex; flex-direction: column; gap: 15px; }
.programme-item {
  background: linear-gradient(135deg, var(--card-bg), var(--card-bg-end));
  border-radius: 12px; overflow: hidden; box-shadow: 0 3px 12px rgba(0,0,0,0.1);
}
.programme-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 20px 25px; cursor: pointer; transition: background 0.3s;
}
.programme-header:hover { background: rgba(0,0,0,0.03); }
.programme-header h3 { font-family: var(--font-heading); color: var(--text); font-size: 1.2rem; }
.programme-arrow { transition: transform 0.3s; font-size: 0.8rem; color: var(--primary); }
.programme-arrow.open { transform: rotate(180deg); }
.programme-detail {
  max-height: 0; overflow: hidden; transition: max-height 0.4s ease;
  padding: 0 25px;
}
.programme-detail.open { max-height: 500px; padding: 0 25px 20px; }
.programme-detail ul { list-style: disc; padding-left: 20px; }
.programme-detail li { margin-bottom: 8px; line-height: 1.6; color: var(--text); }
.programme-summary { padding: 0 25px 15px; color: var(--text); opacity: 0.7; }

/* ===== VIDEOS ===== */
.videos-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 25px; }
.video-card {
  background: linear-gradient(135deg, var(--card-bg), var(--card-bg-end));
  border-radius: 15px; overflow: hidden; box-shadow: 0 5px 20px rgba(0,0,0,0.15);
}
.video-card .video-thumb { width: 100%; aspect-ratio: 16/9; object-fit: cover; background: #000; }
.video-card iframe { width: 100%; aspect-ratio: 16/9; border: none; }
.video-card h3 { padding: 15px; font-family: var(--font-heading); color: var(--text); }

/* ===== TIMELINE ===== */
.timeline-container { position: relative; padding-left: 40px; }
.timeline-container::before {
  content: ''; position: absolute; left: 15px; top: 0; bottom: 0;
  width: 3px; background: var(--primary); border-radius: 2px;
}
.timeline-event {
  position: relative; margin-bottom: 40px;
  background: linear-gradient(135deg, var(--card-bg), var(--card-bg-end));
  padding: 25px; border-radius: 12px; box-shadow: 0 3px 12px rgba(0,0,0,0.1);
}
.timeline-event::before {
  content: ''; position: absolute; left: -33px; top: 30px;
  width: 14px; height: 14px; background: var(--primary);
  border-radius: 50%; border: 3px solid var(--card-bg);
}
.timeline-date { color: var(--primary); font-weight: 700; font-size: 0.9rem; margin-bottom: 5px; }
.timeline-event h3 { font-family: var(--font-heading); color: var(--text); margin-bottom: 8px; }
.timeline-event p { color: var(--text); opacity: 0.8; line-height: 1.6; }

/* ===== FAQ ===== */
.faq-list { display: flex; flex-direction: column; gap: 12px; max-width: 800px; margin: 0 auto; }
.faq-item {
  background: linear-gradient(135deg, var(--card-bg), var(--card-bg-end));
  border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}
.faq-question {
  display: flex; justify-content: space-between; align-items: center;
  padding: 18px 22px; cursor: pointer; font-weight: 600; color: var(--text);
}
.faq-question:hover { background: rgba(0,0,0,0.03); }
.faq-answer { max-height: 0; overflow: hidden; transition: max-height 0.4s ease; padding: 0 22px; }
.faq-answer.open { max-height: 300px; padding: 0 22px 18px; }
.faq-answer p { color: var(--text); opacity: 0.8; line-height: 1.7; }

/* ===== CONTACT ===== */
.contact-content { display: flex; gap: 40px; flex-wrap: wrap; max-width: 900px; margin: 0 auto; }
.contact-info { flex: 1; min-width: 280px; }
.contact-info-item { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; color: var(--text-light); }
.contact-info-item svg { width: 24px; height: 24px; fill: var(--primary); flex-shrink: 0; }
.contact-form { flex: 1; min-width: 280px; }
.contact-form input, .contact-form textarea {
  width: 100%; padding: 14px; margin-bottom: 15px;
  border: 2px solid rgba(0,0,0,0.1); border-radius: 10px;
  font-family: var(--font-body); font-size: 1rem;
  background: linear-gradient(135deg, var(--card-bg), var(--card-bg-end));
  color: var(--text);
}
.contact-form input:focus, .contact-form textarea:focus { outline: none; border-color: var(--primary); }
.contact-form textarea { min-height: 120px; resize: vertical; }
.contact-form button {
  width: 100%; padding: 14px; background: linear-gradient(135deg, var(--primary), var(--secondary));
  color: white; border: none; border-radius: 10px; font-size: 1rem;
  font-weight: 700; cursor: pointer; transition: transform 0.2s, box-shadow 0.2s;
}
.contact-form button:hover { transform: translateY(-2px); box-shadow: 0 5px 20px rgba(0,0,0,0.2); }
.social-links { display: flex; gap: 15px; margin-top: 25px; }
.social-links a {
  width: 45px; height: 45px; border-radius: 50%;
  background: var(--primary); display: flex; align-items: center; justify-content: center;
  transition: transform 0.3s;
}
.social-links a:hover { transform: scale(1.1); }
.social-links a svg { width: 22px; height: 22px; fill: white; }

/* ===== RESPONSIVE ===== */
@media (max-width: 768px) {
  .section { padding: 40px 15px; }
  .section-title { font-size: 1.8rem; }
  .hero-section h1 { font-size: 2.2rem; }
  .hero-section .hero-card { padding: 30px 20px; }
  .about-content { flex-direction: column !important; }
  .team-pole { flex-direction: column !important; }
  .pole-image { flex: 0 0 auto; height: 200px; }
  .navbar { padding: 0 15px; }
  .navbar-links a { padding: 6px 10px; font-size: 0.85rem; }
  .sidebar { width: 85vw; max-width: 300px; left: -100vw; }
  .gallery-grid { grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); }
  .gallery-grid.layout-masonry { columns: 2; }
  .contact-content { flex-direction: column; }
  .timeline-container { padding-left: 30px; }
}

@media (min-width: 768px) {
  .section-title { font-size: 3rem; }
  .hero-section h1 { font-size: 4rem; }
  p { font-size: 18px; }
}
`;
}

// ==================== JS GENERATOR ====================
function generateJS(config) {
  const navType = config.navigation.type;
  let js = `/* SiteForge - Generated JS */\n`;

  if (navType === 'burger') {
    js += `
// Burger menu
const burgerBtn = document.querySelector('.nav-burger-btn');
const sidebar = document.querySelector('.sidebar');
const overlay = document.querySelector('.sidebar-overlay');
let sidebarOpen = false;

function toggleSidebar() {
  sidebarOpen = !sidebarOpen;
  sidebar.classList.toggle('open', sidebarOpen);
  overlay.classList.toggle('active', sidebarOpen);
  burgerBtn.classList.toggle('active', sidebarOpen);
}

if (burgerBtn) burgerBtn.addEventListener('click', toggleSidebar);
if (overlay) overlay.addEventListener('click', () => { if (sidebarOpen) toggleSidebar(); });

document.querySelectorAll('.sidebar-nav a').forEach(link => {
  link.addEventListener('click', () => { if (sidebarOpen) toggleSidebar(); });
});
`;
  }

  // Programme accordion
  js += `
// Programme accordion
document.querySelectorAll('.programme-header').forEach(header => {
  header.addEventListener('click', () => {
    const detail = header.nextElementSibling;
    if (!detail) return;
    const isOpen = detail.classList.contains('open');
    document.querySelectorAll('.programme-detail').forEach(d => d.classList.remove('open'));
    document.querySelectorAll('.programme-arrow').forEach(a => a.classList.remove('open'));
    if (!isOpen) {
      detail.classList.add('open');
      header.querySelector('.programme-arrow')?.classList.add('open');
    }
  });
});

// FAQ accordion
document.querySelectorAll('.faq-question').forEach(q => {
  q.addEventListener('click', () => {
    const answer = q.nextElementSibling;
    if (!answer) return;
    const isOpen = answer.classList.contains('open');
    document.querySelectorAll('.faq-answer').forEach(a => a.classList.remove('open'));
    if (!isOpen) answer.classList.add('open');
  });
});

// Smooth scroll for anchor links
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    e.preventDefault();
    const target = document.querySelector(a.getAttribute('href'));
    if (target) target.scrollIntoView({ behavior: 'smooth' });
  });
});
`;

  return js;
}

// ==================== SERVE SUB-SITES (proxy depuis Supabase Storage) ====================
app.use('/:projectId', async (req, res, next) => {
  const projectId = req.params.projectId;
  if (['admin', 'uploads', 'favicon.ico', 'api'].includes(projectId)) return next();
  if (!supabase) return next();

  // Vérifier que le projet existe
  const { data: row } = await supabase.from('sf_projects').select('id').eq('id', projectId).single();
  if (!row) return next();

  // Déterminer le fichier à servir
  let filePath = req.path;
  if (filePath === '/' || filePath === '') filePath = '/index.html';
  const storagePath = `${projectId}${filePath}`;

  // Télécharger depuis Supabase Storage
  const { data: fileData, error } = await supabase.storage.from(BUCKET).download(storagePath);
  if (error || !fileData) return next();

  const buffer = Buffer.from(await fileData.arrayBuffer());
  const ext = path.extname(filePath);
  const contentType = mime.lookup(ext) || 'application/octet-stream';

  res.setHeader('Content-Type', contentType);
  res.setHeader('Cache-Control', 'public, max-age=60');
  res.send(buffer);
});

// ==================== START ====================
if (!process.env.VERCEL) { app.listen(PORT, () => {
  console.log(`\n  ╔══════════════════════════════════════════╗`);
  console.log(`  ║     🔥 SiteForge — Hébergement Local     ║`);
  console.log(`  ║                                          ║`);
  console.log(`  ║  Portal:  http://localhost:${PORT}/            ║`);
  console.log(`  ║  Admin:   http://localhost:${PORT}/admin/      ║`);
  console.log(`  ╚══════════════════════════════════════════╝\n`);
});

}

// Export for Vercel
module.exports = app;

