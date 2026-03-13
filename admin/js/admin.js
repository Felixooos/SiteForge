/* ==================== SiteForge Admin JS ==================== */

// Auth helper - inject token in all requests
const authFetch = (url, options = {}) => {
  const token = sessionStorage.getItem('siteforge_admin_token');
  if (!token && !url.includes('/api/global')) {
    window.location.href = '/admin/login.html';
    return Promise.reject('No token');
  }
  
  options.headers = {
    ...options.headers,
    'Authorization': `Bearer ${token}`
  };
  
  return fetch(url, options).then(res => {
    if (res.status === 401) {
      sessionStorage.removeItem('siteforge_admin_token');
      window.location.href = '/admin/login.html';
      throw new Error('Unauthorized');
    }
    return res;
  });
};

// State
let currentProjectId = null;
let config = null;
let saveTimeout = null;

// Icons for sections
const SECTION_ICONS = {
  hero: '🏠', about: 'ℹ️', team: '👥', gallery: '🖼️', goodies: '🛍️',
  programme: '📋', videos: '🎬', timeline: '📅', faq: '❓', contact: '✉️',
  classement: '🏆', boutique: '🛒', defis: '🎯', profil: '👤', footer: '🦶'
};

const SVG_ICONS = {
  home: '<path d="M10,20V14H14V20H19V12H22L12,3L2,12H5V20H10Z"/>',
  info: '<path d="M13,9H11V7H13M13,17H11V11H13M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2Z"/>',
  people: '<path d="M16,13C15.71,13 15.38,13 15.03,13.05C16.19,13.89 17,15 17,16.5V19H23V16.5C23,14.17 18.33,13 16,13M8,13C5.67,13 1,14.17 1,16.5V19H15V16.5C15,14.17 10.33,13 8,13M8,11A3,3 0 0,0 11,8A3,3 0 0,0 8,5A3,3 0 0,0 5,8A3,3 0 0,0 8,11M16,11A3,3 0 0,0 19,8A3,3 0 0,0 16,5A3,3 0 0,0 13,8A3,3 0 0,0 16,11Z"/>',
  photo: '<path d="M21,3H3C2,3 1,4 1,5V19A2,2 0 0,0 3,21H21C22,21 23,20 23,19V5C23,4 22,3 21,3M5,17L8.5,12.5L11,15.5L14.5,11L19,17H5Z"/>',
  shop: '<path d="M17,18C15.89,18 15,18.89 15,20A2,2 0 0,0 17,22A2,2 0 0,0 19,20C19,18.89 18.1,18 17,18M1,2V4H3L6.6,11.59L5.24,14.04C5.09,14.32 5,14.65 5,15A2,2 0 0,0 7,17H19V15H7.42A0.25,0.25 0 0,1 7.17,14.75C7.17,14.7 7.18,14.66 7.2,14.63L8.1,13H15.55C16.3,13 16.96,12.58 17.3,11.97L20.88,5.5C20.95,5.34 21,5.17 21,5A1,1 0 0,0 20,4H5.21L4.27,2M7,18C5.89,18 5,18.89 5,20A2,2 0 0,0 7,22A2,2 0 0,0 9,20C9,18.89 8.1,18 7,18Z"/>',
  list: '<path d="M3,4H21V8H3V4M3,10H21V14H3V10M3,16H21V20H3V16Z"/>',
  video: '<path d="M17,10.5V7A1,1 0 0,0 16,6H4A1,1 0 0,0 3,7V17A1,1 0 0,0 4,18H16A1,1 0 0,0 17,17V13.5L21,17.5V6.5L17,10.5Z"/>',
  timeline: '<path d="M9,10V12H7V10H9M13,10V12H11V10H13M17,10V12H15V10H17M19,3A2,2 0 0,1 21,5V19A2,2 0 0,1 19,21H5C3.89,21 3,20.1 3,19V5A2,2 0 0,1 5,3H6V1H8V3H16V1H18V3H19M19,19V8H5V19H19Z"/>',
  help: '<path d="M15.07,11.25L14.17,12.17C13.45,12.89 13,13.5 13,15H11V14.5C11,13.39 11.45,12.39 12.17,11.67L13.41,10.41C13.78,10.05 14,9.55 14,9C14,7.89 13.1,7 12,7A2,2 0 0,0 10,9H8A4,4 0 0,1 12,5A4,4 0 0,1 16,9C16,9.88 15.64,10.67 15.07,11.25M13,19H11V17H13M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2Z"/>',
  mail: '<path d="M20,8L12,13L4,8V6L12,11L20,6M20,4H4C2.89,4 2,4.89 2,6V18A2,2 0 0,0 4,20H20A2,2 0 0,0 22,18V6C22,4.89 21.1,4 20,4Z"/>',
  trophy: '<path d="M2,21H6V17H2V21M18,21H22V17H18V21M10,21H14V17H10V21M5.5,13.5L7,14.5L6.5,16H17.5L17,14.5L18.5,13.5C18.5,13.5 22,10.5 22,8.5C22,6.5 20,5 18.5,5H5.5C4,5 2,6.5 2,8.5C2,10.5 5.5,13.5 5.5,13.5Z"/>',
  cart: '<path d="M17,18C15.89,18 15,18.89 15,20A2,2 0 0,0 17,22A2,2 0 0,0 19,20C19,18.89 18.1,18 17,18M1,2V4H3L6.6,11.59L5.24,14.04C5.09,14.32 5,14.65 5,15A2,2 0 0,0 7,17H19V15H7.42A0.25,0.25 0 0,1 7.17,14.75C7.17,14.7 7.18,14.66 7.2,14.63L8.1,13H15.55C16.3,13 16.96,12.58 17.3,11.97L20.88,5.5C20.95,5.34 21,5.17 21,5A1,1 0 0,0 20,4H5.21L4.27,2M7,18C5.89,18 5,18.89 5,20A2,2 0 0,0 7,22A2,2 0 0,0 9,20C9,18.89 8.1,18 7,18Z"/>',
  defis: '<path d="M12,2L4,5V11.09C4,16.14 7.41,20.85 12,22C16.59,20.85 20,16.14 20,11.09V5L12,2M12,4.14L18,6.6V11.09C18,15.13 15.38,18.84 12,19.92C8.62,18.84 6,15.13 6,11.09V6.6L12,4.14M10,12.73L7.5,10.23L6.27,11.46L10,15.19L17.73,7.46L16.5,6.23L10,12.73Z"/>',
  person: '<path d="M12,4A4,4 0 0,1 16,8A4,4 0 0,1 12,12A4,4 0 0,1 8,8A4,4 0 0,1 12,4M12,14C16.42,14 20,15.79 20,18V20H4V18C4,15.79 7.58,14 12,14Z"/>'
};

// ==================== INIT ====================
document.addEventListener('DOMContentLoaded', () => {
  loadProjects();
  setupEventListeners();

  // Check hash for direct project edit (from portal link)
  const hash = window.location.hash;
  if (hash.startsWith('#edit=')) {
    const projectId = hash.substring(6);
    if (projectId) openProject(projectId);
  }
});

function setupEventListeners() {
  // Logout button
  document.getElementById('btn-logout')?.addEventListener('click', () => {
    if (confirm('Se déconnecter ?')) {
      sessionStorage.removeItem('siteforge_admin_token');
      window.location.href = '/admin/login.html';
    }
  });

  // New project button
  document.getElementById('btn-new-project').addEventListener('click', () => {
    document.getElementById('modal-new-project').classList.remove('hidden');
    document.getElementById('input-project-name').focus();
  });

  // Create project
  document.getElementById('btn-create-project').addEventListener('click', createProject);
  document.getElementById('input-project-name').addEventListener('keydown', e => {
    if (e.key === 'Enter') createProject();
  });

  // Modal backdrop close
  document.querySelectorAll('.modal-backdrop').forEach(b => b.addEventListener('click', closeModal));

  // Back to home
  document.getElementById('btn-back-home').addEventListener('click', goHome);

  // Global settings modal
  const modalGlobal = document.getElementById('modal-global-settings');
  document.getElementById('btn-global-settings').addEventListener('click', async () => {
    try {
      const res = await authFetch('/admin/api/global');
      const g = await res.json();
      document.getElementById('global-supabase-url').value = g.supabaseUrl || '';
      document.getElementById('global-supabase-anon').value = g.supabaseAnonKey || '';
    } catch {}
    modalGlobal.style.display = 'flex';
  });
  const closeGlobal = () => { modalGlobal.style.display = 'none'; };
  document.getElementById('btn-global-settings-close').addEventListener('click', closeGlobal);
  document.getElementById('btn-global-settings-cancel').addEventListener('click', closeGlobal);
  modalGlobal.addEventListener('click', (e) => { if (e.target === modalGlobal) closeGlobal(); });
  document.getElementById('btn-global-settings-save').addEventListener('click', async () => {
    const payload = {
      supabaseUrl: document.getElementById('global-supabase-url').value.trim(),
      supabaseAnonKey: document.getElementById('global-supabase-anon').value.trim()
    };
    const res = await authFetch('/admin/api/global', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (res.ok) { closeGlobal(); toast('Paramètres globaux sauvegardés !', 'success'); refreshPreview(); }
    else { toast('Erreur lors de la sauvegarde', 'error'); }
  });

  // Config tabs
  document.querySelectorAll('.config-tab').forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });

  // Save
  document.getElementById('btn-save').addEventListener('click', saveProject);

  // Preview controls
  document.querySelectorAll('.device-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.device-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('preview-wrapper').dataset.device = btn.dataset.device;
    });
  });

  document.getElementById('btn-refresh-preview').addEventListener('click', refreshPreview);
  document.getElementById('btn-publish').addEventListener('click', publishSite);
  document.getElementById('btn-deploy').addEventListener('click', deploySite);
  document.getElementById('btn-view-live').addEventListener('click', viewLive);
  document.getElementById('btn-back-sections').addEventListener('click', () => {
    document.getElementById('panel-section-editor').style.display = 'none';
    document.getElementById('panel-sections').classList.add('active');
  });

  // Color pickers - update hex display
  document.querySelectorAll('.cfg-color').forEach(input => {
    input.addEventListener('input', (e) => {
      e.target.closest('.color-pick').querySelector('.color-hex').textContent = e.target.value;
      scheduleAutoSave();
    });
  });

  // Navigation type
  document.querySelectorAll('input[name="nav-type"]').forEach(radio => {
    radio.addEventListener('change', () => {
      if (config) {
        config.navigation.type = radio.value;
        scheduleAutoSave();
      }
    });
  });

  // Navigation checkboxes
  document.getElementById('cfg-nav-logo').addEventListener('change', (e) => {
    if (config) { config.navigation.logoInNav = e.target.checked; scheduleAutoSave(); }
  });
  document.getElementById('cfg-nav-footer').addEventListener('change', (e) => {
    if (config) { config.navigation.showFooter = e.target.checked; scheduleAutoSave(); }
  });

  // Site Config fields
  // Save enableAuthGate checkbox
  const gateEl = document.getElementById('cfg-enable-auth-gate');
  if (gateEl) { if (!config.siteConfig) config.siteConfig = {}; config.siteConfig.enableAuthGate = gateEl.checked; }

  ['cfg-currency', 'cfg-allowed-domains', 'cfg-admin-emails'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', () => {
      if (!config) return;
      if (!config.siteConfig) config.siteConfig = {};
      const sc = config.siteConfig;
      if (id === 'cfg-supabase-url') sc.supabaseUrl = el.value;
      else if (id === 'cfg-supabase-key') sc.supabaseAnonKey = el.value;
      else if (id === 'cfg-currency') sc.currencyName = el.value;
      else if (id === 'cfg-allowed-domains') sc.allowedDomains = el.value.split(',').map(s => s.trim()).filter(Boolean);
      else if (id === 'cfg-admin-emails') sc.adminEmails = el.value.split(',').map(s => s.trim()).filter(Boolean);
      scheduleAutoSave();
    });
  });

  // Text inputs auto-save
  document.querySelectorAll('.cfg-input').forEach(input => {
    input.addEventListener('input', () => {
      const path = input.dataset.path;
      if (path && config) {
        setNestedValue(config, path, input.value);
        if (path === 'projectName') {
          document.getElementById('editor-project-name').textContent = input.value;
        }
        scheduleAutoSave();
      }
    });
  });

  // Upload zones
  document.querySelectorAll('.upload-zone').forEach(zone => {
    const input = zone.querySelector('.upload-input');
    input.addEventListener('change', (e) => handleUpload(e, zone));
  });
}

// ==================== PROJECT MANAGEMENT ====================
async function loadProjects() {
  const res = await authFetch('/admin/api/projects');
  const projects = await res.json();
  const grid = document.getElementById('projects-grid');
  const empty = document.getElementById('no-projects');

  if (projects.length === 0) {
    grid.innerHTML = '';
    empty.style.display = 'block';
    return;
  }

  empty.style.display = 'none';
  grid.innerHTML = projects.map(p => `
    <div class="project-card" onclick="openProject('${p.id}')">
      <h3>${escapeHtml(p.name)}</h3>
      <div class="project-meta">
        <span class="project-status ${p.published ? 'published' : 'draft'}">${p.published ? '🟢 En ligne' : '🟡 Brouillon'}</span>
        <span class="project-date">Modifié le ${new Date(p.lastModified).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
      </div>
      ${p.published ? `<a class="project-url" href="/${p.id}/" target="_blank" onclick="event.stopPropagation();">🌐 /${p.id}/</a>` : ''}
      <div class="project-actions">
        <button class="btn btn-sm btn-ghost" onclick="event.stopPropagation(); openProject('${p.id}')">Éditer</button>
        <button class="btn btn-sm btn-danger" onclick="event.stopPropagation(); deleteProject('${p.id}', '${escapeHtml(p.name)}')">Supprimer</button>
      </div>
    </div>
  `).join('');
}

async function createProject() {
  const name = document.getElementById('input-project-name').value.trim();
  if (!name) return;

  const res = await authFetch('/admin/api/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name })
  });

  if (!res.ok) {
    const err = await res.json();
    toast(err.error || 'Erreur', 'error');
    return;
  }

  const { id } = await res.json();
  closeModal();
  document.getElementById('input-project-name').value = '';
  toast(`Projet "${name}" créé !`, 'success');
  openProject(id);
}

async function deleteProject(id, name) {
  if (!confirm(`Supprimer le projet "${name}" ? Cette action est irréversible.`)) return;
  await authFetch(`/admin/api/projects/${id}`, { method: 'DELETE' });
  toast('Projet supprimé', 'success');
  loadProjects();
}

async function openProject(id) {
  const res = await authFetch(`/admin/api/projects/${id}`);
  if (!res.ok) { toast('Erreur de chargement', 'error'); return; }

  const data = await res.json();
  currentProjectId = id;
  config = data.config;

  // Switch to editor
  document.getElementById('page-home').classList.remove('active');
  document.getElementById('page-editor').classList.add('active');
  document.getElementById('editor-project-name').textContent = config.projectName;

  // Fill form with config values
  populateForm();
  populateSections();
  refreshPreview();

  // Check if deployed online
  document.getElementById('deploy-bar').classList.add('hidden');
  authFetch(`/admin/api/deploy-url/${id}`).then(r => r.json()).then(data => {
    if (data.url) showDeployUrl(data.url);
  }).catch(() => {});
}

function goHome() {
  document.getElementById('page-editor').classList.remove('active');
  document.getElementById('page-home').classList.add('active');
  currentProjectId = null;
  config = null;
  loadProjects();
}

// ==================== FORM POPULATION ====================
function populateForm() {
  // Text inputs
  document.querySelectorAll('.cfg-input').forEach(input => {
    const path = input.dataset.path;
    if (path) {
      const val = getNestedValue(config, path);
      if (val !== undefined) input.value = val;
    }
  });

  // Select elements
  const fontHeading = document.getElementById('cfg-font-heading');
  const fontBody = document.getElementById('cfg-font-body');
  if (fontHeading) fontHeading.value = config.fonts?.heading || 'Poppins';
  if (fontBody) fontBody.value = config.fonts?.body || 'Poppins';

  // Font selects need data-path handling
  fontHeading.addEventListener('change', () => {
    config.fonts.heading = fontHeading.value;
    scheduleAutoSave();
  });
  fontBody.addEventListener('change', () => {
    config.fonts.body = fontBody.value;
    scheduleAutoSave();
  });

  // Colors
  document.querySelectorAll('.cfg-color').forEach(input => {
    const path = input.dataset.path;
    if (path) {
      const val = getNestedValue(config, path);
      if (val) {
        input.value = val;
        input.closest('.color-pick').querySelector('.color-hex').textContent = val;
      }
    }
  });

  // Navigation
  const navType = config.navigation?.type || 'burger';
  document.querySelector(`input[name="nav-type"][value="${navType}"]`).checked = true;
  document.getElementById('cfg-nav-logo').checked = config.navigation?.logoInNav !== false;
  document.getElementById('cfg-nav-footer').checked = config.navigation?.showFooter !== false;

  // Logo preview
  if (config.logo) {
    document.getElementById('preview-logo').innerHTML = `<img src="${config.logo}" alt="Logo">`;
  }

  // Site Config (currency, domains, admins)
  if (!config.siteConfig) config.siteConfig = {};
  const sc = config.siteConfig;
  const elCurrency = document.getElementById('cfg-currency');
  const elDomains = document.getElementById('cfg-allowed-domains');
  const elAdmins = document.getElementById('cfg-admin-emails');
  const gateChk = document.getElementById('cfg-enable-auth-gate');
  if (gateChk) gateChk.checked = sc.enableAuthGate || false;
  if (elCurrency) elCurrency.value = sc.currencyName || 'points';
  if (elDomains) elDomains.value = (sc.allowedDomains || []).join(', ');
  if (elAdmins) elAdmins.value = (sc.adminEmails || []).join(', ');
}

function populateSections() {
  const list = document.getElementById('sections-list');
  const sections = config.sections.sort((a, b) => a.order - b.order);

  list.innerHTML = sections.map((s, i) => `
    <div class="section-item" draggable="true" data-id="${s.id}" data-index="${i}">
      <span class="drag-handle">⠿</span>
      <span class="section-icon">${SECTION_ICONS[s.type] || '📄'}</span>
      <span class="section-name">${escapeHtml(s.label)}</span>
      <button class="section-toggle ${s.enabled ? 'active' : ''}" data-id="${s.id}" title="${s.enabled ? 'Désactiver' : 'Activer'}"></button>
      <button class="section-edit" data-id="${s.id}" title="Éditer">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M20.71,7.04C21.1,6.65 21.1,6 20.71,5.63L18.37,3.29C18,2.9 17.35,2.9 16.96,3.29L15.12,5.12L18.87,8.87M3,17.25V21H6.75L17.81,9.93L14.06,6.18L3,17.25Z"/></svg>
      </button>
    </div>
  `).join('');

  // Toggle handlers
  list.querySelectorAll('.section-toggle').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      const section = config.sections.find(s => s.id === id);
      if (section) {
        section.enabled = !section.enabled;
        btn.classList.toggle('active');
        scheduleAutoSave();
      }
    });
  });

  // Edit handlers
  list.querySelectorAll('.section-edit').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openSectionEditor(btn.dataset.id);
    });
  });

  // Drag and drop
  setupDragDrop(list);
}

// ==================== SECTION EDITOR ====================
function openSectionEditor(sectionId) {
  const section = config.sections.find(s => s.id === sectionId);
  if (!section) return;

  document.getElementById('panel-sections').classList.remove('active');
  document.getElementById('panel-section-editor').style.display = 'block';
  document.getElementById('panel-section-editor').classList.add('active');
  document.getElementById('section-editor-title').textContent = `${SECTION_ICONS[section.type]} ${section.label}`;

  const fields = document.getElementById('section-editor-fields');
  fields.innerHTML = '';

  // Build fields based on section type
  const cfg = section.config;

  // Common: label
  fields.appendChild(createField('Nom dans le menu', 'text', section.label, (val) => { section.label = val; }));

  // ===== EFFECTS CHOOSER (for every section except footer) =====
  if (section.type !== 'footer') {
    if (!cfg.effects) cfg.effects = {};
    fields.appendChild(createEffectsChooser(cfg.effects, section.type));
  }

  switch (section.type) {
    case 'hero':
      fields.appendChild(createField('Titre principal', 'text', cfg.title, (val) => { cfg.title = val; }));
      fields.appendChild(createField('Sous-titre', 'text', cfg.subtitle, (val) => { cfg.subtitle = val; }));
      fields.appendChild(createUploadField('Image de fond', cfg.backgroundImage, (url) => { cfg.backgroundImage = url; }));
      fields.appendChild(createCheckboxField('Afficher le logo', cfg.showLogo, (val) => { cfg.showLogo = val; }));
      break;

    case 'about':
      fields.appendChild(createField('Titre', 'text', cfg.title, (val) => { cfg.title = val; }));
      fields.appendChild(createField('Description', 'textarea', cfg.description, (val) => { cfg.description = val; }));
      fields.appendChild(createUploadField('Image', cfg.image, (url) => { cfg.image = url; }));
      fields.appendChild(createSelectField('Disposition', cfg.layout, [
        { value: 'text-left', label: 'Texte à gauche' },
        { value: 'text-right', label: 'Texte à droite' },
        { value: 'centered', label: 'Centré' }
      ], (val) => { cfg.layout = val; }));
      break;

    case 'team':
      fields.appendChild(createField('Titre', 'text', cfg.title, (val) => { cfg.title = val; }));
      fields.appendChild(createField('Sous-titre', 'text', cfg.subtitle, (val) => { cfg.subtitle = val; }));
      fields.appendChild(createUploadField('Photo de groupe', cfg.groupPhoto, (url) => { cfg.groupPhoto = url; }));
      fields.appendChild(createField('Légende photo', 'text', cfg.groupPhotoCaption || '', (val) => { cfg.groupPhotoCaption = val; }));
      // Poles list
      fields.appendChild(createPolesEditor(cfg.poles || []));
      break;

    case 'gallery':
      fields.appendChild(createField('Titre', 'text', cfg.title, (val) => { cfg.title = val; }));
      fields.appendChild(createField('Sous-titre', 'text', cfg.subtitle, (val) => { cfg.subtitle = val; }));
      fields.appendChild(createSelectField('Disposition', cfg.layout, [
        { value: 'grid', label: 'Grille' },
        { value: 'masonry', label: 'Masonry' }
      ], (val) => { cfg.layout = val; }));
      fields.appendChild(createGalleryEditor(cfg.images || []));
      break;

    case 'goodies':
      fields.appendChild(createField('Titre', 'text', cfg.title, (val) => { cfg.title = val; }));
      fields.appendChild(createField('Sous-titre', 'text', cfg.subtitle, (val) => { cfg.subtitle = val; }));
      fields.appendChild(createGoodiesEditor(cfg.items || []));
      break;

    case 'programme':
      fields.appendChild(createField('Titre', 'text', cfg.title, (val) => { cfg.title = val; }));
      fields.appendChild(createProgrammeEditor(cfg.items || []));
      break;

    case 'videos':
      fields.appendChild(createField('Titre', 'text', cfg.title, (val) => { cfg.title = val; }));
      fields.appendChild(createField('Sous-titre', 'text', cfg.subtitle || '', (val) => { cfg.subtitle = val; }));
      fields.appendChild(createVideosEditor(cfg.videos || []));
      break;

    case 'timeline':
      fields.appendChild(createField('Titre', 'text', cfg.title, (val) => { cfg.title = val; }));
      fields.appendChild(createTimelineEditor(cfg.events || []));
      break;

    case 'faq':
      fields.appendChild(createField('Titre', 'text', cfg.title, (val) => { cfg.title = val; }));
      fields.appendChild(createFaqEditor(cfg.questions || []));
      break;

    case 'contact':
      fields.appendChild(createField('Titre', 'text', cfg.title, (val) => { cfg.title = val; }));
      fields.appendChild(createField('Email', 'text', cfg.email || '', (val) => { cfg.email = val; }));
      fields.appendChild(createField('Téléphone', 'text', cfg.phone || '', (val) => { cfg.phone = val; }));
      fields.appendChild(createField('Adresse', 'text', cfg.address || '', (val) => { cfg.address = val; }));
      fields.appendChild(createCheckboxField('Afficher formulaire', cfg.showForm !== false, (val) => { cfg.showForm = val; }));
      fields.appendChild(createField('Instagram', 'text', cfg.socialLinks?.instagram || '', (val) => { if (!cfg.socialLinks) cfg.socialLinks = {}; cfg.socialLinks.instagram = val; }));
      fields.appendChild(createField('Twitter / X', 'text', cfg.socialLinks?.twitter || '', (val) => { if (!cfg.socialLinks) cfg.socialLinks = {}; cfg.socialLinks.twitter = val; }));
      fields.appendChild(createField('Facebook', 'text', cfg.socialLinks?.facebook || '', (val) => { if (!cfg.socialLinks) cfg.socialLinks = {}; cfg.socialLinks.facebook = val; }));
      break;

    case 'classement':
      fields.appendChild(createField('Titre', 'text', cfg.title, (val) => { cfg.title = val; }));
      fields.appendChild(createField('Sous-titre', 'text', cfg.subtitle || '', (val) => { cfg.subtitle = val; }));
      break;

    case 'boutique':
      fields.appendChild(createField('Titre', 'text', cfg.title, (val) => { cfg.title = val; }));
      fields.appendChild(createField('Sous-titre', 'text', cfg.subtitle || '', (val) => { cfg.subtitle = val; }));
      break;

    case 'defis':
      fields.appendChild(createField('Titre', 'text', cfg.title, (val) => { cfg.title = val; }));
      fields.appendChild(createField('Sous-titre', 'text', cfg.subtitle || '', (val) => { cfg.subtitle = val; }));
      fields.appendChild(createDefisCategoriesEditor(cfg));
      break;

    case 'profil':
      fields.appendChild(createField('Titre', 'text', cfg.title, (val) => { cfg.title = val; }));
      fields.appendChild(createField('Sous-titre', 'text', cfg.subtitle || '', (val) => { cfg.subtitle = val; }));
      break;

    case 'footer':
      fields.appendChild(createUploadField('Logo du footer', cfg.logo || '', (url) => { cfg.logo = url; }));
      fields.appendChild(createField('Copyright', 'text', cfg.copyright || '', (val) => { cfg.copyright = val; }));
      fields.appendChild(createFooterColumnsEditor(cfg));
      break;
  }
}

// ==================== FIELD BUILDERS ====================
function createField(label, type, value, onChange) {
  const group = document.createElement('div');
  group.className = 'config-group';
  group.innerHTML = `<label>${label}</label>`;

  if (type === 'textarea') {
    const ta = document.createElement('textarea');
    ta.className = 'cfg-input';
    ta.value = value || '';
    ta.addEventListener('input', () => { onChange(ta.value); scheduleAutoSave(); });
    group.appendChild(ta);
  } else {
    const input = document.createElement('input');
    input.type = type;
    input.className = 'cfg-input';
    input.value = value || '';
    input.addEventListener('input', () => { onChange(input.value); scheduleAutoSave(); });
    group.appendChild(input);
  }
  return group;
}

function createSelectField(label, value, options, onChange) {
  const group = document.createElement('div');
  group.className = 'config-group';
  group.innerHTML = `<label>${label}</label>`;
  const select = document.createElement('select');
  select.className = 'cfg-input';
  select.innerHTML = options.map(o => `<option value="${o.value}" ${o.value === value ? 'selected' : ''}>${o.label}</option>`).join('');
  select.addEventListener('change', () => { onChange(select.value); scheduleAutoSave(); });
  group.appendChild(select);
  return group;
}

function createCheckboxField(label, checked, onChange) {
  const group = document.createElement('div');
  group.className = 'config-group';
  group.innerHTML = `<label class="checkbox-label"><input type="checkbox" ${checked ? 'checked' : ''}> ${label}</label>`;
  group.querySelector('input').addEventListener('change', (e) => { onChange(e.target.checked); scheduleAutoSave(); });
  return group;
}

function createUploadField(label, currentUrl, onChange) {
  const group = document.createElement('div');
  group.className = 'config-group';
  group.innerHTML = `
    <label>${label}</label>
    <div class="upload-zone">
      <div class="upload-preview">${currentUrl ? `<img src="${currentUrl}" alt=""><button type="button" class="upload-delete-btn" title="Supprimer l'image">✕</button>` : ''}</div>
      <span>${currentUrl ? 'Cliquer pour changer' : 'Cliquer ou déposer une image'}</span>
      <input type="file" accept="image/*" class="upload-input">
    </div>
  `;
  // Delete button
  const delBtn = group.querySelector('.upload-delete-btn');
  if (delBtn) {
    delBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      onChange('');
      group.querySelector('.upload-preview').innerHTML = '';
      group.querySelector('.upload-zone span').textContent = 'Cliquer ou déposer une image';
      scheduleAutoSave();
    });
  }
  group.querySelector('.upload-input').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('image', file);
    const res = await authFetch(`/admin/api/projects/${currentProjectId}/upload`, { method: 'POST', body: formData });
    if (res.ok) {
      const { url } = await res.json();
      onChange(url);
      group.querySelector('.upload-preview').innerHTML = `<img src="${url}" alt=""><button type="button" class="upload-delete-btn" title="Supprimer l'image">✕</button>`;
      group.querySelector('.upload-delete-btn').addEventListener('click', (ev) => {
        ev.stopPropagation();
        ev.preventDefault();
        onChange('');
        group.querySelector('.upload-preview').innerHTML = '';
        group.querySelector('.upload-zone span').textContent = 'Cliquer ou déposer une image';
        scheduleAutoSave();
      });
      group.querySelector('.upload-zone span').textContent = 'Cliquer pour changer';
      scheduleAutoSave();
    }
  });
  return group;
}

// ==================== EFFECT ROW (select + intensity slider) ====================
function createEffectRow(label, curVal, options, noneVals, intensity, onVal, onIntensity) {
  const group = createSelectField(label, curVal, options, (val) => {
    onVal(val);
    sliderRow.style.display = noneVals.includes(val) ? 'none' : 'flex';
  });
  const sliderRow = document.createElement('div');
  sliderRow.style.cssText = `display:${noneVals.includes(curVal) ? 'none' : 'flex'};align-items:center;gap:8px;margin-top:3px;padding:4px 8px;background:rgba(124,92,191,0.06);border-radius:6px;`;
  const lbl = document.createElement('span');
  lbl.textContent = '⚡ Intensité';
  lbl.style.cssText = 'font-size:11px;color:#888;white-space:nowrap;min-width:68px;';
  const slider = document.createElement('input');
  slider.type = 'range'; slider.min = 0; slider.max = 100;
  slider.value = intensity !== undefined ? intensity : 50;
  slider.style.cssText = 'flex:1;cursor:pointer;accent-color:#7c5cbf;';
  const valLbl = document.createElement('b');
  valLbl.textContent = slider.value;
  valLbl.style.cssText = 'font-size:11px;color:#7c5cbf;min-width:24px;text-align:right;';
  slider.addEventListener('input', () => { valLbl.textContent = slider.value; onIntensity(Number(slider.value)); scheduleAutoSave(); });
  sliderRow.append(lbl, slider, valLbl);
  group.appendChild(sliderRow);
  return group;
}

// ==================== EFFECTS CHOOSER ====================
function createEffectsChooser(effects, sectionType) {
  const wrapper = document.createElement('div');
  wrapper.className = 'config-group effects-chooser';
  wrapper.innerHTML = `<label>✨ Effets visuels <small>(optionnel)</small></label>`;

  const grid = document.createElement('div');
  grid.style.cssText = 'display:flex;flex-direction:column;gap:8px;';

  // Title style
  const titleOptions = [
    { value: 'normal', label: 'Normal' },
    { value: 'banner', label: '🎗️ Banderole (ruban)' },
    { value: 'glow', label: '✨ Néon / Glow' },
    { value: 'gradient', label: '🌈 Dégradé animé' },
    { value: 'typewriter', label: '⌨️ Machine à écrire' },
    { value: 'shine', label: '💎 Reflet brillant' }
  ];
  grid.appendChild(createEffectRow('Style du titre', effects.titleStyle || 'normal', titleOptions, ['normal'], effects.titleStyleIntensity,
    (val) => { effects.titleStyle = val; scheduleAutoSave(); },
    (val) => { effects.titleStyleIntensity = val; }));

  // Entrance animation
  const entranceOptions = [
    { value: 'none', label: 'Aucune' },
    { value: 'fade-up', label: '⬆️ Fondu vers le haut' },
    { value: 'fade-left', label: '⬅️ Glisse de gauche' },
    { value: 'fade-right', label: '➡️ Glisse de droite' },
    { value: 'zoom', label: '🔍 Zoom' },
    { value: 'flip', label: '🔄 Retournement' },
    { value: 'bounce', label: '🏀 Rebond' }
  ];
  grid.appendChild(createEffectRow('Animation d\'entrée', effects.entrance || 'fade-up', entranceOptions, ['none'], effects.entranceIntensity,
    (val) => { effects.entrance = val; scheduleAutoSave(); },
    (val) => { effects.entranceIntensity = val; }));

  // Hover effect (for cards)
  if (['team', 'goodies', 'gallery', 'videos', 'boutique', 'programme', 'faq'].includes(sectionType)) {
    const hoverOptions = [
      { value: 'none', label: 'Aucun' },
      { value: 'lift', label: '⬆️ Élévation' },
      { value: 'tilt', label: '🔄 Tilt 3D' },
      { value: 'glow', label: '✨ Lueur' },
      { value: 'wobble', label: '🫨 Tremblement' },
      { value: 'shine', label: '💎 Reflet brillant' },
      { value: 'scale', label: '🔍 Agrandissement' }
    ];
    grid.appendChild(createEffectRow('Effet au survol (cartes)', effects.cardHover || 'lift', hoverOptions, ['none'], effects.cardHoverIntensity,
      (val) => { effects.cardHover = val; scheduleAutoSave(); },
      (val) => { effects.cardHoverIntensity = val; }));
  }

  // Continuous animation
  const continuousOptions = [
    { value: 'none', label: 'Aucune' },
    { value: 'float', label: '🎈 Flottement' },
    { value: 'pulse', label: '💗 Pulsation' },
    { value: 'rotate-slow', label: '🔄 Rotation lente' }
  ];
  if (['hero', 'goodies'].includes(sectionType)) {
    grid.appendChild(createEffectRow('Animation continue', effects.continuous || 'none', continuousOptions, ['none'], effects.continuousIntensity,
      (val) => { effects.continuous = val; scheduleAutoSave(); },
      (val) => { effects.continuousIntensity = val; }));
  }

  // Background effect
  const bgOptions = [
    { value: 'none', label: 'Aucun' },
    { value: 'particles', label: '✨ Particules' },
    { value: 'gradient-move', label: '🌈 Dégradé mouvant' },
    { value: 'parallax', label: '🏔️ Parallaxe (image)' }
  ];
  grid.appendChild(createEffectRow('Effet de fond', effects.background || 'none', bgOptions, ['none'], effects.backgroundIntensity,
    (val) => { effects.background = val; scheduleAutoSave(); },
    (val) => { effects.backgroundIntensity = val; }));

  // Stagger children
  if (['team', 'goodies', 'gallery', 'videos', 'boutique', 'faq', 'timeline', 'programme'].includes(sectionType)) {
    grid.appendChild(createCheckboxField('🎯 Apparition en cascade (éléments un par un)', effects.stagger !== false, (val) => { effects.stagger = val; scheduleAutoSave(); }));
  }

  wrapper.appendChild(grid);
  return wrapper;
}

// ==================== FOOTER COLUMNS EDITOR ====================
function createFooterColumnsEditor(cfg) {
  if (!cfg.columns) cfg.columns = [];
  const wrapper = document.createElement('div');
  wrapper.className = 'config-group';
  wrapper.innerHTML = `<label>Colonnes du Footer</label>`;

  const list = document.createElement('div');
  list.className = 'dynamic-list';

  function renderColumns() {
    list.innerHTML = '';
    cfg.columns.forEach((col, i) => {
      const item = document.createElement('div');
      item.className = 'dynamic-item';
      item.style.cssText = 'padding:12px;border:1px solid rgba(255,255,255,0.1);border-radius:8px;background:rgba(0,0,0,0.15);margin-bottom:8px;';

      let typeLabel = { text: 'Texte', links: 'Liens', sponsors: 'Sponsors', social: 'Réseaux sociaux' }[col.type] || col.type;

      let fieldsHtml = `
        <div class="item-header" style="margin-bottom:8px;">
          <strong>Colonne ${i + 1} — ${typeLabel}</strong>
          <button class="remove-item" data-idx="${i}">✕</button>
        </div>
        <input type="text" class="cfg-input" placeholder="Titre de la colonne" value="${escapeHtml(col.title || '')}" data-field="title" data-idx="${i}" style="margin-bottom:6px;">
      `;

      if (col.type === 'text') {
        fieldsHtml += `<textarea class="cfg-input" placeholder="Contenu texte" data-field="content" data-idx="${i}" style="min-height:60px;">${escapeHtml(col.content || '')}</textarea>`;
      } else if (col.type === 'links') {
        fieldsHtml += `<div class="footer-links-list" data-idx="${i}">`;
        (col.links || []).forEach((link, li) => {
          fieldsHtml += `<div style="display:flex;gap:4px;margin-bottom:4px;"><input type="text" class="cfg-input" placeholder="Label" value="${escapeHtml(link.label || '')}" data-lfield="label" data-li="${li}" data-idx="${i}" style="flex:1;"><input type="text" class="cfg-input" placeholder="URL" value="${escapeHtml(link.url || '')}" data-lfield="url" data-li="${li}" data-idx="${i}" style="flex:1;"><button class="remove-item" data-rm-link="${li}" data-idx="${i}" style="width:30px;">✕</button></div>`;
        });
        fieldsHtml += `<button class="btn btn-sm btn-ghost" data-add-link="${i}" style="margin-top:4px;">+ Lien</button></div>`;
      } else if (col.type === 'sponsors') {
        fieldsHtml += `<div class="footer-sponsors-list" data-idx="${i}">`;
        (col.sponsors || []).forEach((sp, si) => {
          fieldsHtml += `<div style="display:flex;gap:4px;margin-bottom:4px;align-items:center;"><input type="text" class="cfg-input" placeholder="Nom" value="${escapeHtml(sp.name || '')}" data-sfield="name" data-si="${si}" data-idx="${i}" style="flex:1;"><input type="text" class="cfg-input" placeholder="URL" value="${escapeHtml(sp.url || '')}" data-sfield="url" data-si="${si}" data-idx="${i}" style="flex:1;"><button class="remove-item" data-rm-sponsor="${si}" data-idx="${i}" style="width:30px;">✕</button></div>`;
        });
        fieldsHtml += `<button class="btn btn-sm btn-ghost" data-add-sponsor="${i}" style="margin-top:4px;">+ Sponsor</button></div>`;
      } else if (col.type === 'social') {
        ['instagram', 'twitter', 'facebook', 'tiktok', 'discord', 'youtube'].forEach(net => {
          fieldsHtml += `<input type="text" class="cfg-input" placeholder="${net}" value="${escapeHtml(col[net] || '')}" data-social="${net}" data-idx="${i}" style="margin-bottom:4px;">`;
        });
      }

      item.innerHTML = fieldsHtml;
      list.appendChild(item);
    });

    // Event listeners
    list.querySelectorAll('[data-field]').forEach(el => {
      el.addEventListener('input', () => { cfg.columns[parseInt(el.dataset.idx)][el.dataset.field] = el.value; scheduleAutoSave(); });
    });
    list.querySelectorAll('[data-lfield]').forEach(el => {
      el.addEventListener('input', () => { 
        const col = cfg.columns[parseInt(el.dataset.idx)];
        if (!col.links) col.links = [];
        if (!col.links[parseInt(el.dataset.li)]) col.links[parseInt(el.dataset.li)] = {};
        col.links[parseInt(el.dataset.li)][el.dataset.lfield] = el.value; 
        scheduleAutoSave(); 
      });
    });
    list.querySelectorAll('[data-sfield]').forEach(el => {
      el.addEventListener('input', () => { 
        const col = cfg.columns[parseInt(el.dataset.idx)];
        if (!col.sponsors) col.sponsors = [];
        if (!col.sponsors[parseInt(el.dataset.si)]) col.sponsors[parseInt(el.dataset.si)] = {};
        col.sponsors[parseInt(el.dataset.si)][el.dataset.sfield] = el.value; 
        scheduleAutoSave(); 
      });
    });
    list.querySelectorAll('[data-social]').forEach(el => {
      el.addEventListener('input', () => { cfg.columns[parseInt(el.dataset.idx)][el.dataset.social] = el.value; scheduleAutoSave(); });
    });
    list.querySelectorAll('.remove-item[data-idx]').forEach(btn => {
      if (btn.dataset.rmLink !== undefined) {
        btn.addEventListener('click', () => { cfg.columns[parseInt(btn.dataset.idx)].links.splice(parseInt(btn.dataset.rmLink), 1); renderColumns(); scheduleAutoSave(); });
      } else if (btn.dataset.rmSponsor !== undefined) {
        btn.addEventListener('click', () => { cfg.columns[parseInt(btn.dataset.idx)].sponsors.splice(parseInt(btn.dataset.rmSponsor), 1); renderColumns(); scheduleAutoSave(); });
      } else {
        btn.addEventListener('click', () => { cfg.columns.splice(parseInt(btn.dataset.idx), 1); renderColumns(); scheduleAutoSave(); });
      }
    });
    list.querySelectorAll('[data-add-link]').forEach(btn => {
      btn.addEventListener('click', () => { cfg.columns[parseInt(btn.dataset.addLink)].links.push({ label: '', url: '' }); renderColumns(); scheduleAutoSave(); });
    });
    list.querySelectorAll('[data-add-sponsor]').forEach(btn => {
      btn.addEventListener('click', () => { cfg.columns[parseInt(btn.dataset.addSponsor)].sponsors.push({ name: '', url: '', image: '' }); renderColumns(); scheduleAutoSave(); });
    });
  }

  renderColumns();

  // Add column button
  const addBar = document.createElement('div');
  addBar.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;';
  addBar.innerHTML = `
    <button class="btn btn-sm btn-ghost" data-add-col="text">+ Texte</button>
    <button class="btn btn-sm btn-ghost" data-add-col="links">+ Liens</button>
    <button class="btn btn-sm btn-ghost" data-add-col="sponsors">+ Sponsors</button>
    <button class="btn btn-sm btn-ghost" data-add-col="social">+ Réseaux</button>
  `;
  addBar.querySelectorAll('[data-add-col]').forEach(btn => {
    btn.addEventListener('click', () => {
      const type = btn.dataset.addCol;
      const newCol = { title: '', type };
      if (type === 'links') newCol.links = [];
      if (type === 'sponsors') newCol.sponsors = [];
      cfg.columns.push(newCol);
      renderColumns();
      scheduleAutoSave();
    });
  });

  wrapper.appendChild(list);
  wrapper.appendChild(addBar);
  return wrapper;
}

// ==================== DYNAMIC LIST EDITORS ====================
function createPolesEditor(poles) {
  const wrapper = document.createElement('div');
  wrapper.className = 'config-group';
  wrapper.innerHTML = `<label>Pôles / Groupes</label>`;

  const list = document.createElement('div');
  list.className = 'dynamic-list';

  // Normalize members: string → object
  function normalizeMember(m) {
    if (typeof m === 'string') return { name: m, role: '', photo: '', description: '' };
    return m;
  }

  function renderMembersEditor(memberList, container) {
    container.innerHTML = '';
    memberList.forEach((rawM, mi) => {
      const m = normalizeMember(rawM);
      memberList[mi] = m;
      const el = document.createElement('div');
      el.className = 'dynamic-item member-sub-item';
      el.style.cssText = 'margin-left:10px;border-left:3px solid var(--admin-primary);padding-left:10px;background:var(--admin-bg);';
      el.innerHTML = `
        <div class="item-header" style="margin-bottom:6px;"><strong>👤 Membre ${mi + 1}</strong><button class="remove-item" data-mi="${mi}">✕</button></div>
        <input type="text" placeholder="Nom" value="${escapeHtml(m.name || '')}" data-mfield="name" data-mi="${mi}" style="margin-bottom:5px;">
        <input type="text" placeholder="Rôle / Poste" value="${escapeHtml(m.role || '')}" data-mfield="role" data-mi="${mi}" style="margin-bottom:5px;">
        <textarea placeholder="Description (optionnel)" data-mfield="description" data-mi="${mi}" style="min-height:60px;margin-bottom:5px;">${escapeHtml(m.description || '')}</textarea>
        ${m.photo ? `<img src="${m.photo}" style="width:60px;height:60px;object-fit:cover;border-radius:50%;margin:4px 0;border:2px solid var(--admin-primary);">` : ''}
        <div class="upload-zone" style="padding:8px;">
          <span>📷 Photo du membre</span>
          <input type="file" accept="image/*" class="upload-input member-photo-upload" data-mi="${mi}">
        </div>
      `;
      container.appendChild(el);
    });

    container.querySelectorAll('input[type="text"], textarea').forEach(el => {
      el.addEventListener('input', () => {
        const mi = parseInt(el.dataset.mi);
        memberList[mi][el.dataset.mfield] = el.value;
        scheduleAutoSave();
      });
    });
    container.querySelectorAll('.member-photo-upload').forEach(el => {
      el.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const formData = new FormData();
        formData.append('image', file);
        const res = await authFetch(`/admin/api/projects/${currentProjectId}/upload`, { method: 'POST', body: formData });
        if (res.ok) {
          const { url } = await res.json();
          memberList[parseInt(el.dataset.mi)].photo = url;
          renderMembersEditor(memberList, container);
          scheduleAutoSave();
        }
      });
    });
    container.querySelectorAll('.remove-item[data-mi]').forEach(btn => {
      btn.addEventListener('click', () => {
        memberList.splice(parseInt(btn.dataset.mi), 1);
        renderMembersEditor(memberList, container);
        scheduleAutoSave();
      });
    });
  }

  function render() {
    list.innerHTML = '';
    poles.forEach((pole, i) => {
      const item = document.createElement('div');
      item.className = 'dynamic-item';
      item.style.cssText = 'padding-bottom:14px;';
      item.innerHTML = `
        <div class="item-header"><strong>Pôle ${i + 1}</strong><button class="remove-item" data-i="${i}">✕</button></div>
        <input type="text" placeholder="Nom du pôle (ex: Communication)" value="${escapeHtml(pole.name || '')}" data-field="name" data-i="${i}">
        <input type="text" placeholder="Titre affiché (ex: Le Bureau)" value="${escapeHtml(pole.title || '')}" data-field="title" data-i="${i}">
        <textarea placeholder="Description du pôle" data-field="description" data-i="${i}">${escapeHtml(pole.description || '')}</textarea>
        ${pole.image ? `<img src="${pole.image}" style="max-width:80px;border-radius:8px;margin:4px 0;">` : ''}
        <div class="upload-zone" style="padding:10px;margin-top:4px;margin-bottom:10px;">
          <span>🖼️ Image du pôle</span>
          <input type="file" accept="image/*" class="upload-input pole-img-upload" data-i="${i}">
        </div>
        <div class="pole-members-label" style="font-size:12px;font-weight:700;color:var(--admin-primary);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Membres du pôle</div>
        <div class="members-sub-list" data-pi="${i}"></div>
        <button class="btn-add-item add-member-btn" data-i="${i}" style="margin-top:6px;padding:6px 10px;font-size:12px;">+ Ajouter un membre</button>
      `;
      list.appendChild(item);

      // Normalize and render members
      if (!pole.members) pole.members = [];
      pole.members = pole.members.map(normalizeMember);
      const membersContainer = item.querySelector('.members-sub-list');
      renderMembersEditor(pole.members, membersContainer);
    });

    // Pole image upload
    list.querySelectorAll('.pole-img-upload').forEach(el => {
      el.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const formData = new FormData();
        formData.append('image', file);
        const res = await authFetch(`/admin/api/projects/${currentProjectId}/upload`, { method: 'POST', body: formData });
        if (res.ok) {
          const { url } = await res.json();
          poles[parseInt(el.dataset.i)].image = url;
          render();
          scheduleAutoSave();
        }
      });
    });

    // Pole text inputs
    list.querySelectorAll('input[type="text"][data-field], textarea[data-field]').forEach(el => {
      el.addEventListener('input', () => {
        poles[parseInt(el.dataset.i)][el.dataset.field] = el.value;
        scheduleAutoSave();
      });
    });

    // Remove pole
    list.querySelectorAll('.remove-item[data-i]').forEach(btn => {
      btn.addEventListener('click', () => { poles.splice(parseInt(btn.dataset.i), 1); render(); scheduleAutoSave(); });
    });

    // Add member button
    list.querySelectorAll('.add-member-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const i = parseInt(btn.dataset.i);
        poles[i].members.push({ name: '', role: '', photo: '', description: '' });
        const membersContainer = list.querySelectorAll('.members-sub-list')[i];
        renderMembersEditor(poles[i].members, membersContainer);
      });
    });
  }

  render();
  wrapper.appendChild(list);

  const addBtn = document.createElement('button');
  addBtn.className = 'btn-add-item';
  addBtn.textContent = '+ Ajouter un pôle';
  addBtn.addEventListener('click', () => {
    poles.push({ name: '', title: '', description: '', image: '', members: [] });
    render();
  });
  wrapper.appendChild(addBtn);
  return wrapper;
}

// ==================== SHARED PHOTO CONTROLS (blur, overlay text, countdown) ====================

// Helper: delete an uploaded file when replacing it
async function deleteUpload(oldUrl) {
  if (!oldUrl || !currentProjectId) return;
  const filename = oldUrl.split('/').pop();
  if (!filename) return;
  try {
    await authFetch(`/admin/api/projects/${currentProjectId}/uploads/${encodeURIComponent(filename)}`, { method: 'DELETE' });
  } catch (e) { /* ignore */ }
}

function appendPhotoControls(container, item, rerenderFn) {
  // Blur row
  const rowBlur = document.createElement('div');
  rowBlur.style.cssText = 'display:flex;align-items:center;gap:8px;margin-top:4px;';
  rowBlur.innerHTML = `
    <span style="font-size:11px;color:#888;min-width:40px;">🌫️ Flou</span>
    <input type="range" min="0" max="100" value="${item.blur || 0}" class="pc-blur" style="flex:1;accent-color:#7c5cbf;">
    <b style="font-size:11px;color:#7c5cbf;min-width:28px;text-align:right;" class="pc-blur-val">${item.blur || 0}</b>
  `;
  rowBlur.querySelector('.pc-blur').addEventListener('input', (e) => {
    item.blur = Number(e.target.value);
    rowBlur.querySelector('.pc-blur-val').textContent = e.target.value;
    scheduleAutoSave();
  });
  container.appendChild(rowBlur);

  // Overlay text row
  const rowText = document.createElement('div');
  rowText.style.cssText = 'display:flex;align-items:center;gap:8px;margin-top:4px;';
  rowText.innerHTML = `
    <span style="font-size:11px;color:#888;min-width:40px;">📝 Texte</span>
    <input type="text" placeholder="Texte superposé" value="${escapeHtml(item.overlayText || '')}" class="pc-overlay" style="flex:1;">
    <select class="pc-overlay-pos" style="width:75px;font-size:11px;">
      <option value="center" ${(item.overlayPosition || 'center') === 'center' ? 'selected' : ''}>Centre</option>
      <option value="top" ${item.overlayPosition === 'top' ? 'selected' : ''}>Haut</option>
      <option value="bottom" ${item.overlayPosition === 'bottom' ? 'selected' : ''}>Bas</option>
    </select>
  `;
  rowText.querySelector('.pc-overlay').addEventListener('input', (e) => { item.overlayText = e.target.value; scheduleAutoSave(); });
  rowText.querySelector('.pc-overlay-pos').addEventListener('change', (e) => { item.overlayPosition = e.target.value; scheduleAutoSave(); });
  container.appendChild(rowText);

  // Countdown row
  const cdMode = item.countdown?.mode || 'none';
  const cdVal = item.countdown?.value || '';
  const rowCd = document.createElement('div');
  rowCd.style.cssText = 'display:flex;align-items:center;gap:8px;margin-top:4px;flex-wrap:wrap;';
  rowCd.innerHTML = `
    <span style="font-size:11px;color:#888;min-width:40px;">⏱️ Compte</span>
    <select class="pc-cd-mode" style="width:90px;font-size:11px;">
      <option value="none" ${cdMode === 'none' ? 'selected' : ''}>Aucun</option>
      <option value="date" ${cdMode === 'date' ? 'selected' : ''}>Jusqu'à date</option>
      <option value="duration" ${cdMode === 'duration' ? 'selected' : ''}>Durée (h)</option>
    </select>
    <input type="${cdMode === 'date' ? 'datetime-local' : 'text'}" placeholder="${cdMode === 'duration' ? 'Ex: 9' : 'Date cible'}" value="${escapeHtml(cdVal)}" class="pc-cd-val" style="flex:1;display:${cdMode === 'none' ? 'none' : 'block'};">
  `;
  rowCd.querySelector('.pc-cd-mode').addEventListener('change', (e) => {
    if (!item.countdown) item.countdown = {};
    item.countdown.mode = e.target.value;
    item.countdown.value = '';
    rerenderFn();
    scheduleAutoSave();
  });
  rowCd.querySelector('.pc-cd-val').addEventListener('input', (e) => {
    if (!item.countdown) item.countdown = {};
    item.countdown.value = e.target.value;
    scheduleAutoSave();
  });
  container.appendChild(rowCd);

  // Font size row
  const rowFs = document.createElement('div');
  rowFs.style.cssText = 'display:flex;align-items:center;gap:8px;margin-top:4px;';
  const fsVal = item.overlayFontSize || 18;
  rowFs.innerHTML = `
    <span style="font-size:11px;color:#888;min-width:40px;">📏 Taille</span>
    <input type="range" min="8" max="72" value="${fsVal}" class="pc-fs" style="flex:1;accent-color:#7c5cbf;">
    <b style="font-size:11px;color:#7c5cbf;min-width:28px;text-align:right;" class="pc-fs-val">${fsVal}px</b>
  `;
  rowFs.querySelector('.pc-fs').addEventListener('input', (e) => {
    item.overlayFontSize = Number(e.target.value);
    rowFs.querySelector('.pc-fs-val').textContent = e.target.value + 'px';
    scheduleAutoSave();
  });
  container.appendChild(rowFs);

  // Photo size row
  const rowSize = document.createElement('div');
  rowSize.style.cssText = 'display:flex;align-items:center;gap:8px;margin-top:4px;';
  const curSize = item.photoSize || 100;
  rowSize.innerHTML = `
    <span style="font-size:11px;color:#888;min-width:40px;">📐 Taille</span>
    <input type="range" min="50" max="150" value="${curSize}" class="pc-size" style="flex:1;accent-color:#7c5cbf;">
    <b style="font-size:11px;color:#7c5cbf;min-width:34px;text-align:right;" class="pc-size-val">${curSize}%</b>
  `;
  rowSize.querySelector('.pc-size').addEventListener('input', (e) => {
    item.photoSize = Number(e.target.value);
    rowSize.querySelector('.pc-size-val').textContent = e.target.value + '%';
    scheduleAutoSave();
  });
  container.appendChild(rowSize);

  // Hover animation row
  const rowAnim = document.createElement('div');
  rowAnim.style.cssText = 'display:flex;align-items:center;gap:8px;margin-top:4px;';
  const curAnim = item.hoverAnim || 'none';
  rowAnim.innerHTML = `
    <span style="font-size:11px;color:#888;min-width:40px;">👆 Survol</span>
    <select class="pc-anim" style="flex:1;font-size:11px;">
      <option value="none" ${curAnim === 'none' ? 'selected' : ''}>Aucune</option>
      <option value="wobble" ${curAnim === 'wobble' ? 'selected' : ''}>Wobble</option>
      <option value="zoom" ${curAnim === 'zoom' ? 'selected' : ''}>Zoom</option>
      <option value="lift" ${curAnim === 'lift' ? 'selected' : ''}>Soulèvement</option>
      <option value="bounce" ${curAnim === 'bounce' ? 'selected' : ''}>Rebond</option>
      <option value="shake" ${curAnim === 'shake' ? 'selected' : ''}>Shake</option>
      <option value="tilt" ${curAnim === 'tilt' ? 'selected' : ''}>Tilt 3D</option>
    </select>
  `;
  const curAnimInt = item.hoverIntensity ?? 5;
  const rowAnimInt = document.createElement('div');
  rowAnimInt.style.cssText = `display:${curAnim === 'none' ? 'none' : 'flex'};align-items:center;gap:8px;margin-top:2px;`;
  rowAnimInt.innerHTML = `
    <span style="font-size:11px;color:#888;min-width:40px;">↕ Force</span>
    <input type="range" class="pc-anim-int" min="1" max="10" step="1" value="${curAnimInt}" style="flex:1;">
    <span class="pc-anim-int-val" style="font-size:11px;min-width:18px;text-align:right;">${curAnimInt}</span>
  `;
  rowAnim.querySelector('.pc-anim').addEventListener('change', (e) => {
    item.hoverAnim = e.target.value;
    rowAnimInt.style.display = e.target.value === 'none' ? 'none' : 'flex';
    scheduleAutoSave();
  });
  rowAnimInt.querySelector('.pc-anim-int').addEventListener('input', (e) => {
    item.hoverIntensity = parseInt(e.target.value);
    rowAnimInt.querySelector('.pc-anim-int-val').textContent = e.target.value;
    scheduleAutoSave();
  });
  container.appendChild(rowAnim);
  container.appendChild(rowAnimInt);

  // Continuous animation row
  const rowCont = document.createElement('div');
  rowCont.style.cssText = 'display:flex;align-items:center;gap:8px;margin-top:4px;';
  const curCont = item.contAnim || 'none';
  rowCont.innerHTML = `
    <span style="font-size:11px;color:#888;min-width:40px;">🔄 Boucle</span>
    <select class="pc-cont" style="flex:1;font-size:11px;">
      <option value="none" ${curCont === 'none' ? 'selected' : ''}>Aucune</option>
      <option value="float" ${curCont === 'float' ? 'selected' : ''}>Flotteaison</option>
      <option value="wobble" ${curCont === 'wobble' ? 'selected' : ''}>Wobble doux</option>
      <option value="pulse" ${curCont === 'pulse' ? 'selected' : ''}>Pulsation</option>
      <option value="spin" ${curCont === 'spin' ? 'selected' : ''}>Rotation lente</option>
    </select>
  `;
  const curContInt = item.contIntensity ?? 5;
  const rowContInt = document.createElement('div');
  rowContInt.style.cssText = `display:${curCont === 'none' ? 'none' : 'flex'};align-items:center;gap:8px;margin-top:2px;`;
  rowContInt.innerHTML = `
    <span style="font-size:11px;color:#888;min-width:40px;">↕ Force</span>
    <input type="range" class="pc-cont-int" min="1" max="10" step="1" value="${curContInt}" style="flex:1;">
    <span class="pc-cont-int-val" style="font-size:11px;min-width:18px;text-align:right;">${curContInt}</span>
  `;
  rowCont.querySelector('.pc-cont').addEventListener('change', (e) => {
    item.contAnim = e.target.value;
    rowContInt.style.display = e.target.value === 'none' ? 'none' : 'flex';
    scheduleAutoSave();
  });
  rowContInt.querySelector('.pc-cont-int').addEventListener('input', (e) => {
    item.contIntensity = parseInt(e.target.value);
    rowContInt.querySelector('.pc-cont-int-val').textContent = e.target.value;
    scheduleAutoSave();
  });
  container.appendChild(rowCont);
  container.appendChild(rowContInt);
}

function createGoodiesEditor(items) {
  const section = config.sections.find(s => s.type === 'goodies');
  const wrapper = document.createElement('div');
  wrapper.className = 'config-group';
  wrapper.innerHTML = `<label>Articles</label>`;

  const list = document.createElement('div');
  list.className = 'dynamic-list';

  function render() {
    list.innerHTML = '';
    items.forEach((item, i) => {
      const el = document.createElement('div');
      el.className = 'dynamic-item';
      el.style.cssText = 'display:flex;flex-direction:column;gap:4px;padding:10px;background:rgba(124,92,191,0.04);border-radius:8px;margin-bottom:8px;';

      // Header row
      const header = document.createElement('div');
      header.style.cssText = 'display:flex;align-items:center;gap:8px;';
      header.innerHTML = `
        ${item.image ? `<img src="${item.image}" style="width:52px;height:52px;object-fit:cover;border-radius:6px;${item.blur ? 'filter:blur(' + (item.blur / 5) + 'px)' : ''}">` : ''}
        <div style="flex:1;display:flex;flex-direction:column;gap:4px;">
          <input type="text" placeholder="Nom" value="${escapeHtml(item.name || '')}" class="gi-name" data-i="${i}" style="">
          <input type="text" placeholder="Description" value="${escapeHtml(item.description || '')}" class="gi-desc" data-i="${i}" style="">
        </div>
        <button class="remove-item" data-i="${i}">✕</button>
      `;
      el.appendChild(header);

      // Upload zone
      const uploadDiv = document.createElement('div');
      uploadDiv.className = 'upload-zone';
      uploadDiv.style.cssText = 'padding:8px;margin-top:2px;';
      uploadDiv.innerHTML = `<span>📷 ${item.image ? 'Changer l\'image' : 'Upload image'}</span><input type="file" accept="image/*" class="upload-input gi-upload" data-i="${i}">`;
      el.appendChild(uploadDiv);

      // Photo controls (blur, overlay, countdown)
      appendPhotoControls(el, item, render);

      list.appendChild(el);
    });

    list.querySelectorAll('.gi-name, .gi-desc').forEach(el => {
      const field = el.classList.contains('gi-name') ? 'name' : 'description';
      el.addEventListener('input', () => { items[parseInt(el.dataset.i)][field] = el.value; scheduleAutoSave(); });
    });
    list.querySelectorAll('.gi-upload').forEach(el => {
      el.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const i = parseInt(el.dataset.i);
        const oldUrl = items[i].image;
        const formData = new FormData();
        formData.append('image', file);
        const res = await authFetch(`/admin/api/projects/${currentProjectId}/upload`, { method: 'POST', body: formData });
        if (res.ok) {
          const { url } = await res.json();
          if (oldUrl) deleteUpload(oldUrl);
          items[i].image = url;
          render();
          scheduleAutoSave();
        }
      });
    });
    list.querySelectorAll('.remove-item').forEach(btn => {
      btn.addEventListener('click', () => { items.splice(parseInt(btn.dataset.i), 1); render(); scheduleAutoSave(); });
    });
  }

  render();
  wrapper.appendChild(list);

  const addBtn = document.createElement('button');
  addBtn.className = 'btn-add-item';
  addBtn.textContent = '+ Ajouter un article';
  addBtn.addEventListener('click', () => {
    items.push({ name: '', image: '', description: '', blur: 0, overlayText: '', overlayPosition: 'center', overlayFontSize: 18, hoverAnim: 'wobble', hoverIntensity: 5, contAnim: 'none', contIntensity: 5, photoSize: 100, countdown: { mode: 'none', value: '' } });
    render();
  });
  wrapper.appendChild(addBtn);
  return wrapper;
}

function createGalleryEditor(images) {
  const section = config.sections.find(s => s.type === 'gallery');
  const wrapper = document.createElement('div');
  wrapper.className = 'config-group';
  wrapper.innerHTML = `<label>Images</label>`;

  const list = document.createElement('div');
  list.className = 'dynamic-list';

  function render() {
    list.innerHTML = '';
    images.forEach((img, i) => {
      const el = document.createElement('div');
      el.className = 'dynamic-item';
      el.style.cssText = 'display:flex;flex-direction:column;gap:6px;padding:10px;background:rgba(124,92,191,0.04);border-radius:8px;margin-bottom:8px;';

      // Row 1: thumbnail + caption + delete
      const row1 = document.createElement('div');
      row1.style.cssText = 'display:flex;align-items:center;gap:10px;';
      row1.innerHTML = `
        ${img.url ? `<img src="${img.url}" style="width:60px;height:60px;object-fit:cover;border-radius:6px;${img.blur ? 'filter:blur(' + (img.blur / 5) + 'px)' : ''}">` : ''}
        <input type="text" placeholder="Légende" value="${escapeHtml(img.caption || '')}" class="gallery-caption" data-i="${i}" style="flex:1;">
        <button class="remove-item" data-i="${i}">✕</button>
      `;
      el.appendChild(row1);

      // Row 2: blur slider
      const row2 = document.createElement('div');
      row2.style.cssText = 'display:flex;align-items:center;gap:8px;';
      row2.innerHTML = `
        <span style="font-size:11px;color:#888;min-width:40px;">🌫️ Flou</span>
        <input type="range" min="0" max="100" value="${img.blur || 0}" class="gallery-blur" data-i="${i}" style="flex:1;accent-color:#7c5cbf;">
        <b style="font-size:11px;color:#7c5cbf;min-width:28px;text-align:right;" class="blur-val">${img.blur || 0}</b>
      `;
      el.appendChild(row2);

      // Row 3: overlay text
      const row3 = document.createElement('div');
      row3.style.cssText = 'display:flex;align-items:center;gap:8px;';
      row3.innerHTML = `
        <span style="font-size:11px;color:#888;min-width:40px;">📝 Texte</span>
        <input type="text" placeholder="Texte superposé" value="${escapeHtml(img.overlayText || '')}" class="gallery-overlay" data-i="${i}" style="flex:1;">
        <select class="gallery-overlay-pos" data-i="${i}" style="width:80px;font-size:11px;">
          <option value="center" ${(img.overlayPosition || 'center') === 'center' ? 'selected' : ''}>Centre</option>
          <option value="top" ${img.overlayPosition === 'top' ? 'selected' : ''}>Haut</option>
          <option value="bottom" ${img.overlayPosition === 'bottom' ? 'selected' : ''}>Bas</option>
        </select>
      `;
      el.appendChild(row3);

      // Row 4: countdown
      const cdMode = img.countdown?.mode || 'none';
      const cdVal = img.countdown?.value || '';
      const row4 = document.createElement('div');
      row4.style.cssText = 'display:flex;align-items:center;gap:8px;flex-wrap:wrap;';
      row4.innerHTML = `
        <span style="font-size:11px;color:#888;min-width:40px;">⏱️ Compte</span>
        <select class="gallery-cd-mode" data-i="${i}" style="width:90px;font-size:11px;">
          <option value="none" ${cdMode === 'none' ? 'selected' : ''}>Aucun</option>
          <option value="date" ${cdMode === 'date' ? 'selected' : ''}>Jusqu'à date</option>
          <option value="duration" ${cdMode === 'duration' ? 'selected' : ''}>Durée (h)</option>
        </select>
        <input type="${cdMode === 'date' ? 'datetime-local' : 'text'}" placeholder="${cdMode === 'duration' ? 'Ex: 9' : 'Date cible'}" value="${escapeHtml(cdVal)}" class="gallery-cd-val" data-i="${i}" style="flex:1;display:${cdMode === 'none' ? 'none' : 'block'};">
      `;
      el.appendChild(row4);

      list.appendChild(el);
    });

    // Bind events
    list.querySelectorAll('.gallery-caption').forEach(el => {
      el.addEventListener('input', () => { images[parseInt(el.dataset.i)].caption = el.value; scheduleAutoSave(); });
    });
    list.querySelectorAll('.remove-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const i = parseInt(btn.dataset.i);
        if (images[i] && images[i].url) deleteUpload(images[i].url);
        images.splice(i, 1);
        render();
        scheduleAutoSave();
      });
    });
    list.querySelectorAll('.gallery-blur').forEach(el => {
      el.addEventListener('input', () => {
        const i = parseInt(el.dataset.i);
        images[i].blur = Number(el.value);
        el.closest('.dynamic-item').querySelector('.blur-val').textContent = el.value;
        const thumb = el.closest('.dynamic-item').querySelector('img');
        if (thumb) thumb.style.filter = `blur(${el.value / 5}px)`;
        scheduleAutoSave();
      });
    });
    list.querySelectorAll('.gallery-overlay').forEach(el => {
      el.addEventListener('input', () => { images[parseInt(el.dataset.i)].overlayText = el.value; scheduleAutoSave(); });
    });
    list.querySelectorAll('.gallery-overlay-pos').forEach(el => {
      el.addEventListener('change', () => { images[parseInt(el.dataset.i)].overlayPosition = el.value; scheduleAutoSave(); });
    });
    list.querySelectorAll('.gallery-cd-mode').forEach(el => {
      el.addEventListener('change', () => {
        const i = parseInt(el.dataset.i);
        const mode = el.value;
        if (!images[i].countdown) images[i].countdown = {};
        images[i].countdown.mode = mode;
        images[i].countdown.value = '';
        render();
        scheduleAutoSave();
      });
    });
    list.querySelectorAll('.gallery-cd-val').forEach(el => {
      el.addEventListener('input', () => {
        const i = parseInt(el.dataset.i);
        if (!images[i].countdown) images[i].countdown = {};
        images[i].countdown.value = el.value;
        scheduleAutoSave();
      });
    });
  }

  render();
  wrapper.appendChild(list);

  const uploadZone = document.createElement('div');
  uploadZone.className = 'upload-zone';
  uploadZone.style.marginTop = '8px';
  uploadZone.innerHTML = `<span>📷 Ajouter des images</span><input type="file" accept="image/*" class="upload-input" multiple>`;
  uploadZone.querySelector('.upload-input').addEventListener('change', async (e) => {
    for (const file of e.target.files) {
      const formData = new FormData();
      formData.append('image', file);
      const res = await authFetch(`/admin/api/projects/${currentProjectId}/upload`, { method: 'POST', body: formData });
      if (res.ok) {
        const { url } = await res.json();
        images.push({ url, caption: '', blur: 0, overlayText: '', overlayPosition: 'center', overlayFontSize: 18, hoverAnim: 'zoom', hoverIntensity: 5, contAnim: 'none', contIntensity: 5, photoSize: 100, countdown: { mode: 'none', value: '' } });
      }
    }
    section.config.images = images;
    render();
    scheduleAutoSave();
  });
  wrapper.appendChild(uploadZone);
  return wrapper;
}

function createProgrammeEditor(items) {
  const section = config.sections.find(s => s.type === 'programme');
  const wrapper = document.createElement('div');
  wrapper.className = 'config-group';
  wrapper.innerHTML = `<label>Points du programme</label>`;

  const list = document.createElement('div');
  list.className = 'dynamic-list';

  function render() {
    list.innerHTML = '';
    items.forEach((item, i) => {
      const el = document.createElement('div');
      el.className = 'dynamic-item';
      el.innerHTML = `
        <div class="item-header"><strong>Point ${i + 1}</strong><button class="remove-item" data-i="${i}">✕</button></div>
        <input type="text" placeholder="Titre" value="${escapeHtml(item.title || '')}" data-field="title" data-i="${i}">
        <input type="text" placeholder="Résumé" value="${escapeHtml(item.summary || '')}" data-field="summary" data-i="${i}">
        <textarea placeholder="Détails (un par ligne)" data-field="details" data-i="${i}">${(item.details || []).join('\n')}</textarea>
      `;
      list.appendChild(el);
    });

    list.querySelectorAll('input, textarea').forEach(el => {
      el.addEventListener('input', () => {
        const i = parseInt(el.dataset.i);
        if (el.dataset.field === 'details') {
          items[i].details = el.value.split('\n').filter(Boolean);
        } else {
          items[i][el.dataset.field] = el.value;
        }
        scheduleAutoSave();
      });
    });
    list.querySelectorAll('.remove-item').forEach(btn => {
      btn.addEventListener('click', () => { items.splice(parseInt(btn.dataset.i), 1); render(); scheduleAutoSave(); });
    });
  }

  render();
  wrapper.appendChild(list);

  const addBtn = document.createElement('button');
  addBtn.className = 'btn-add-item';
  addBtn.textContent = '+ Ajouter un point';
  addBtn.addEventListener('click', () => { items.push({ title: '', summary: '', details: [] }); render(); });
  wrapper.appendChild(addBtn);
  return wrapper;
}

function createVideosEditor(videos) {
  const section = config.sections.find(s => s.type === 'videos');
  const wrapper = document.createElement('div');
  wrapper.className = 'config-group';
  wrapper.innerHTML = `<label>Vidéos</label>`;

  const list = document.createElement('div');
  list.className = 'dynamic-list';

  function render() {
    list.innerHTML = '';
    videos.forEach((vid, i) => {
      const el = document.createElement('div');
      el.className = 'dynamic-item';
      el.style.cssText = 'display:flex;flex-direction:column;gap:6px;padding:10px;background:rgba(124,92,191,0.04);border-radius:8px;margin-bottom:8px;';

      // Header row: thumbnail preview + title + delete
      const row1 = document.createElement('div');
      row1.style.cssText = 'display:flex;align-items:center;gap:10px;';
      // Compute auto YT thumb
      const ytM = (vid.url || '').match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/);
      const autoThumb = ytM ? `https://img.youtube.com/vi/${ytM[1]}/hqdefault.jpg` : '';
      const thumbSrc = vid.thumbnail || autoThumb;
      row1.innerHTML = `
        ${thumbSrc ? `<img src="${thumbSrc}" style="width:80px;height:45px;object-fit:cover;border-radius:6px;${vid.blur ? 'filter:blur(' + (vid.blur / 5) + 'px)' : ''}">` : '<div style="width:80px;height:45px;background:rgba(0,0,0,0.1);border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:18px;">🎬</div>'}
        <div style="flex:1;display:flex;flex-direction:column;gap:4px;">
          <input type="text" placeholder="Titre" value="${escapeHtml(vid.title || '')}" class="vid-title" data-i="${i}">
          <input type="text" placeholder="URL YouTube/Vimeo" value="${escapeHtml(vid.url || '')}" class="vid-url" data-i="${i}">
        </div>
        <button class="remove-item" data-i="${i}">✕</button>
      `;
      el.appendChild(row1);

      // Thumbnail upload zone
      const uploadDiv = document.createElement('div');
      uploadDiv.className = 'upload-zone';
      uploadDiv.style.cssText = 'padding:8px;margin-top:2px;';
      uploadDiv.innerHTML = `<span>🖼️ ${vid.thumbnail ? 'Changer la miniature' : 'Miniature personnalisée'}</span><input type="file" accept="image/*" class="upload-input vid-thumb-upload" data-i="${i}">`;
      el.appendChild(uploadDiv);

      // Photo controls (blur, overlay text + position + font size, countdown)
      appendPhotoControls(el, vid, render);

      list.appendChild(el);
    });

    list.querySelectorAll('.vid-title').forEach(el => {
      el.addEventListener('input', () => { videos[parseInt(el.dataset.i)].title = el.value; scheduleAutoSave(); });
    });
    list.querySelectorAll('.vid-url').forEach(el => {
      el.addEventListener('input', () => { videos[parseInt(el.dataset.i)].url = el.value; scheduleAutoSave(); });
    });
    list.querySelectorAll('.vid-thumb-upload').forEach(el => {
      el.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const i = parseInt(el.dataset.i);
        const oldThumb = videos[i].thumbnail;
        const formData = new FormData();
        formData.append('image', file);
        const res = await authFetch(`/admin/api/projects/${currentProjectId}/upload`, { method: 'POST', body: formData });
        if (res.ok) {
          const { url } = await res.json();
          if (oldThumb) deleteUpload(oldThumb);
          videos[i].thumbnail = url;
          render();
          scheduleAutoSave();
        }
      });
    });
    list.querySelectorAll('.remove-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const i = parseInt(btn.dataset.i);
        if (videos[i] && videos[i].thumbnail) deleteUpload(videos[i].thumbnail);
        videos.splice(i, 1);
        render();
        scheduleAutoSave();
      });
    });
  }

  render();
  wrapper.appendChild(list);

  const addBtn = document.createElement('button');
  addBtn.className = 'btn-add-item';
  addBtn.textContent = '+ Ajouter une vidéo';
  addBtn.addEventListener('click', () => {
    videos.push({ title: '', url: '', thumbnail: '', blur: 0, overlayText: '', overlayPosition: 'center', overlayFontSize: 18, hoverAnim: 'zoom', hoverIntensity: 5, contAnim: 'none', contIntensity: 5, photoSize: 100, countdown: { mode: 'none', value: '' } });
    render();
  });
  wrapper.appendChild(addBtn);
  return wrapper;
}

function createTimelineEditor(events) {
  const wrapper = document.createElement('div');
  wrapper.className = 'config-group';
  wrapper.innerHTML = `<label>Événements</label>`;

  const list = document.createElement('div');
  list.className = 'dynamic-list';

  function render() {
    list.innerHTML = '';
    events.forEach((evt, i) => {
      const el = document.createElement('div');
      el.className = 'dynamic-item';
      el.innerHTML = `
        <div class="item-header"><strong>Événement ${i + 1}</strong><button class="remove-item" data-i="${i}">✕</button></div>
        <input type="text" placeholder="Date" value="${escapeHtml(evt.date || '')}" data-field="date" data-i="${i}">
        <input type="text" placeholder="Titre" value="${escapeHtml(evt.title || '')}" data-field="title" data-i="${i}">
        <textarea placeholder="Description" data-field="description" data-i="${i}">${escapeHtml(evt.description || '')}</textarea>
      `;
      list.appendChild(el);
    });

    list.querySelectorAll('input, textarea').forEach(el => {
      el.addEventListener('input', () => { events[parseInt(el.dataset.i)][el.dataset.field] = el.value; scheduleAutoSave(); });
    });
    list.querySelectorAll('.remove-item').forEach(btn => {
      btn.addEventListener('click', () => { events.splice(parseInt(btn.dataset.i), 1); render(); scheduleAutoSave(); });
    });
  }

  render();
  wrapper.appendChild(list);

  const addBtn = document.createElement('button');
  addBtn.className = 'btn-add-item';
  addBtn.textContent = '+ Ajouter un événement';
  addBtn.addEventListener('click', () => { events.push({ date: '', title: '', description: '' }); render(); });
  wrapper.appendChild(addBtn);
  return wrapper;
}

function createFaqEditor(questions) {
  const wrapper = document.createElement('div');
  wrapper.className = 'config-group';
  wrapper.innerHTML = `<label>Questions / Réponses</label>`;

  const list = document.createElement('div');
  list.className = 'dynamic-list';

  function render() {
    list.innerHTML = '';
    questions.forEach((q, i) => {
      const el = document.createElement('div');
      el.className = 'dynamic-item';
      el.innerHTML = `
        <div class="item-header"><strong>Q&R ${i + 1}</strong><button class="remove-item" data-i="${i}">✕</button></div>
        <input type="text" placeholder="Question" value="${escapeHtml(q.question || '')}" data-field="question" data-i="${i}">
        <textarea placeholder="Réponse" data-field="answer" data-i="${i}">${escapeHtml(q.answer || '')}</textarea>
      `;
      list.appendChild(el);
    });

    list.querySelectorAll('input, textarea').forEach(el => {
      el.addEventListener('input', () => { questions[parseInt(el.dataset.i)][el.dataset.field] = el.value; scheduleAutoSave(); });
    });
    list.querySelectorAll('.remove-item').forEach(btn => {
      btn.addEventListener('click', () => { questions.splice(parseInt(btn.dataset.i), 1); render(); scheduleAutoSave(); });
    });
  }

  render();
  wrapper.appendChild(list);

  const addBtn = document.createElement('button');
  addBtn.className = 'btn-add-item';
  addBtn.textContent = '+ Ajouter une question';
  addBtn.addEventListener('click', () => { questions.push({ question: '', answer: '' }); render(); });
  wrapper.appendChild(addBtn);
  return wrapper;
}

// ==================== DEFIS CATEGORIES EDITOR ====================
function createDefisCategoriesEditor(cfg) {
  if (!cfg.categories) cfg.categories = [
    { name: 'Facile', points: 50, color: '#22c55e' },
    { name: 'Moyen', points: 150, color: '#f59e0b' },
    { name: 'Difficile', points: 300, color: '#ef4444' }
  ];

  const wrapper = document.createElement('div');
  wrapper.className = 'config-group';
  wrapper.innerHTML = `<label>Catégories de difficulté</label>`;

  const list = document.createElement('div');
  list.className = 'dynamic-list';

  function render() {
    list.innerHTML = '';
    cfg.categories.forEach((cat, i) => {
      const el = document.createElement('div');
      el.className = 'dynamic-item';
      el.style.cssText = 'display:flex;gap:8px;align-items:center;padding:10px;background:rgba(124,92,191,0.04);border-radius:8px;margin-bottom:8px;';
      el.innerHTML = `
        <div style="width:20px;height:20px;border-radius:50%;background:${cat.color};flex-shrink:0;"></div>
        <input type="text" placeholder="Nom" value="${escapeHtml(cat.name || '')}" class="cat-name" data-i="${i}" style="flex:1;">
        <input type="number" placeholder="Points" value="${cat.points || 50}" class="cat-points" data-i="${i}" style="width:80px;">
        <input type="color" value="${cat.color || '#6366f1'}" class="cat-color" data-i="${i}" style="width:40px;height:32px;border:none;cursor:pointer;">
        <button class="remove-item" data-i="${i}">✕</button>
      `;
      list.appendChild(el);
    });

    list.querySelectorAll('.cat-name').forEach(el => {
      el.addEventListener('input', () => { cfg.categories[parseInt(el.dataset.i)].name = el.value; scheduleAutoSave(); });
    });
    list.querySelectorAll('.cat-points').forEach(el => {
      el.addEventListener('input', () => { cfg.categories[parseInt(el.dataset.i)].points = parseInt(el.value) || 0; scheduleAutoSave(); });
    });
    list.querySelectorAll('.cat-color').forEach(el => {
      el.addEventListener('input', () => { cfg.categories[parseInt(el.dataset.i)].color = el.value; scheduleAutoSave(); });
    });
    list.querySelectorAll('.remove-item').forEach(btn => {
      btn.addEventListener('click', () => { cfg.categories.splice(parseInt(btn.dataset.i), 1); render(); scheduleAutoSave(); });
    });
  }

  render();
  wrapper.appendChild(list);

  const addBtn = document.createElement('button');
  addBtn.className = 'btn-add-item';
  addBtn.textContent = '+ Ajouter une catégorie';
  addBtn.addEventListener('click', () => {
    cfg.categories.push({ name: 'Nouvelle', points: 100, color: '#6366f1' });
    render();
  });
  wrapper.appendChild(addBtn);
  return wrapper;
}

// ==================== DRAG & DROP ====================
function setupDragDrop(list) {
  let dragItem = null;

  list.querySelectorAll('.section-item').forEach(item => {
    item.addEventListener('dragstart', (e) => {
      dragItem = item;
      item.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });

    item.addEventListener('dragend', () => {
      item.classList.remove('dragging');
      dragItem = null;
      // Update order from DOM
      list.querySelectorAll('.section-item').forEach((el, i) => {
        const id = el.dataset.id;
        const section = config.sections.find(s => s.id === id);
        if (section) section.order = i;
      });
      scheduleAutoSave();
    });

    item.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (dragItem === item) return;
      const rect = item.getBoundingClientRect();
      const mid = rect.top + rect.height / 2;
      if (e.clientY < mid) {
        list.insertBefore(dragItem, item);
      } else {
        list.insertBefore(dragItem, item.nextSibling);
      }
    });
  });
}

// ==================== SAVE & PREVIEW ====================
function scheduleAutoSave(skipRefresh = false) {
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(async () => {
    await saveProject();
    if (!skipRefresh) refreshPreview();
  }, 800);
}

async function saveProject() {
  if (!currentProjectId || !config) return;

  // Collect color values from color pickers
  document.querySelectorAll('.cfg-color').forEach(input => {
    const path = input.dataset.path;
    if (path) setNestedValue(config, path, input.value);
  });

  // Collect siteConfig fields explicitly before saving
  if (!config.siteConfig) config.siteConfig = {};
  const elCurrency = document.getElementById('cfg-currency');
  const elDomains = document.getElementById('cfg-allowed-domains');
  const elAdmins = document.getElementById('cfg-admin-emails');
  const elGate = document.getElementById('cfg-enable-auth-gate');
  if (elCurrency) config.siteConfig.currencyName = elCurrency.value;
  if (elDomains) config.siteConfig.allowedDomains = elDomains.value.split(',').map(s => s.trim()).filter(Boolean);
  if (elAdmins) config.siteConfig.adminEmails = elAdmins.value.split(',').map(s => s.trim()).filter(Boolean);
  if (elGate) config.siteConfig.enableAuthGate = elGate.checked;

  const res = await authFetch(`/admin/api/projects/${currentProjectId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config)
  });

  if (res.ok) {
    toast('Sauvegardé ✓', 'success');
  } else {
    toast('Erreur de sauvegarde', 'error');
  }
}

function refreshPreview() {
  if (!currentProjectId) return;
  const iframe = document.getElementById('preview-iframe');
  // Remember current active section before reload
  let activeSection = null;
  try {
    const active = iframe.contentDocument?.querySelector('.sf-section-wrapper.sf-active');
    if (active) activeSection = active.id;
  } catch(e) {}
  // After reload, restore the section
  iframe.addEventListener('load', () => {
    if (activeSection) {
      try { iframe.contentWindow.showSection?.(activeSection); } catch(e) {}
    }
  }, { once: true });
  iframe.src = `/admin/preview/${currentProjectId}?t=${Date.now()}`;
}

async function publishSite() {
  if (!currentProjectId) return;
  await saveProject();

  toast('Publication en cours...', 'success');
  const res = await authFetch(`/admin/api/projects/${currentProjectId}/publish`, { method: 'POST' });
  if (res.ok) {
    const data = await res.json();
    toast('Site publié ! En ligne → ' + data.url, 'success');
  } else {
    const err = await res.json();
    toast('Erreur: ' + (err.error || 'Inconnue'), 'error');
  }
}

function viewLive() {
  if (!currentProjectId) return;
  window.open(`/${currentProjectId}/`, '_blank');
}

async function deploySite() {
  if (!currentProjectId) return;
  await saveProject();

  const deployBtn = document.getElementById('btn-deploy');
  deployBtn.textContent = '⏳ Déploiement...';
  deployBtn.disabled = true;

  toast('Déploiement en ligne (Supabase)...', 'success');
  try {
    const res = await authFetch(`/admin/api/projects/${currentProjectId}/deploy`, { method: 'POST' });
    const data = await res.json();
    if (res.ok) {
      toast(`Déployé ! ${data.uploaded} fichiers en ligne`, 'success');
      showDeployUrl(data.url);
    } else {
      toast('Erreur: ' + (data.error || 'Inconnue'), 'error');
    }
  } catch (err) {
    toast('Erreur réseau: ' + err.message, 'error');
  }
  deployBtn.textContent = '🚀 Mettre en ligne';
  deployBtn.disabled = false;
}

function showDeployUrl(url) {
  const bar = document.getElementById('deploy-bar');
  const text = document.getElementById('deploy-url-text');
  const link = document.getElementById('deploy-url-link');
  bar.classList.remove('hidden');
  text.textContent = '🚀 ' + url;
  link.href = url;
}

// ==================== UPLOAD HANDLER ====================
async function handleUpload(e, zone) {
  const file = e.target.files[0];
  if (!file || !currentProjectId) return;

  const formData = new FormData();
  formData.append('image', file);

  const res = await authFetch(`/admin/api/projects/${currentProjectId}/upload`, { method: 'POST', body: formData });
  if (res.ok) {
    const { url } = await res.json();
    const path = zone.dataset.path;
    if (path) setNestedValue(config, path, url);


    const preview = zone.querySelector('.upload-preview');
    if (preview) preview.innerHTML = `<img src="${url}" alt="">`;

    scheduleAutoSave();
    toast('Image uploadée ✓', 'success');
  }
}

// ==================== UTILITIES ====================
function switchTab(tab) {
  document.querySelectorAll('.config-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.config-panel').forEach(p => p.classList.remove('active'));
  document.querySelector(`.config-tab[data-tab="${tab}"]`).classList.add('active');
  document.getElementById(`panel-${tab}`).classList.add('active');

  // Hide section editor if showing
  document.getElementById('panel-section-editor').style.display = 'none';
}

function closeModal() {
  document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
}

function toast(message, type = 'success') {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.className = `toast ${type}`;
  setTimeout(() => el.classList.add('hidden'), 2500);
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function getNestedValue(obj, path) {
  return path.split('.').reduce((o, k) => o?.[k], obj);
}

function setNestedValue(obj, path, value) {
  const keys = path.split('.');
  const last = keys.pop();
  const target = keys.reduce((o, k) => { if (!o[k]) o[k] = {}; return o[k]; }, obj);
  target[last] = value;
}

// ==================== INLINE EDITING (postMessage from preview iframe) ====================
window.addEventListener('message', (event) => {
  if (!config || !event.data) return;

  // Handle inline text edits from preview
  if (event.data.type === 'sf-inline-edit') {
    const editPath = event.data.path; // e.g. "hero.title" or "team.poles.0.name"
    const value = event.data.value;

    const parts = editPath.split('.');
    const sectionId = parts[0];
    const fieldPath = parts.slice(1);

    const section = config.sections.find(s => s.id === sectionId);
    if (!section) return;

    // Navigate into section.config using the field path
    let target = section.config;
    for (let i = 0; i < fieldPath.length - 1; i++) {
      const key = fieldPath[i];
      // Could be an array index
      if (target[key] !== undefined) {
        target = target[key];
      } else if (Array.isArray(target) && !isNaN(key)) {
        target = target[parseInt(key)];
      } else {
        return; // Invalid path
      }
    }
    const lastKey = fieldPath[fieldPath.length - 1];
    if (target && lastKey) {
      target[lastKey] = value;
      // Save without refreshing preview (user is editing in the iframe)
      scheduleAutoSave(true);
      toast('✏️ Modifié: ' + sectionId, 'success');

      // If section editor is open for this section, refresh its fields
      const editorTitle = document.getElementById('section-editor-title');
      if (editorTitle && document.getElementById('panel-section-editor').style.display !== 'none') {
        // Re-open section editor to reflect changes
        openSectionEditor(sectionId);
      }
    }
  }

  // Handle section click - navigate to section editor
  if (event.data.type === 'sf-section-click') {
    const sectionId = event.data.sectionId;
    if (!sectionId) return;
    const section = config.sections.find(s => s.id === sectionId);
    if (!section) return;

    // Switch to sections tab and open the editor for this section
    switchTab('sections');
    openSectionEditor(sectionId);

    // Brief toast
    toast(`📝 Édition: ${section.label}`, 'success');
  }
});

