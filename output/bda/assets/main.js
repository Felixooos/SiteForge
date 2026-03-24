/* ============================================================
   BDA — Main Application JS
   Mobile-first swipe app (Clash Royale style)
   ============================================================ */

(function () {
  'use strict';

  // ==================== CONFIG ====================
  const SITE_ID = 'bda';
  const DIFF_POINTS = { facile: 50, moyen: 150, difficile: 300 };
  const DEFAULT_AVATAR = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="%23334155" width="100" height="100" rx="50"/><text x="50" y="62" text-anchor="middle" fill="%2394a3b8" font-size="40">?</text></svg>';

  // ==================== SUPABASE INIT ====================
  // Supabase URL & Key are injected from the project's siteConfig or global config
  let SUPABASE_URL = '';
  let SUPABASE_ANON_KEY = '';
  let supabase = null;

  // Try to read from a meta tag or global var (set by server)
  const metaUrl = document.querySelector('meta[name="supabase-url"]');
  const metaKey = document.querySelector('meta[name="supabase-anon-key"]');
  if (metaUrl) SUPABASE_URL = metaUrl.content;
  if (metaKey) SUPABASE_ANON_KEY = metaKey.content;

  // Fallback: try window.__SUPABASE__
  if (!SUPABASE_URL && window.__SUPABASE__) {
    SUPABASE_URL = window.__SUPABASE__.url;
    SUPABASE_ANON_KEY = window.__SUPABASE__.key;
  }

  // Fallback: try fetching from the siteforge API
  async function initSupabase() {
    if (!SUPABASE_URL) {
      try {
        const res = await fetch('/admin/api/global');
        const data = await res.json();
        SUPABASE_URL = data.supabaseUrl;
        SUPABASE_ANON_KEY = data.supabaseAnonKey;
      } catch (e) {
        console.warn('Could not fetch global config:', e);
      }
    }
    if (SUPABASE_URL && SUPABASE_ANON_KEY && window.supabase) {
      supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
  }

  // ==================== STATE ====================
  const state = {
    user: null,        // supabase user
    profile: null,     // etudiants row
    isGuest: false,
    isAdmin: false,
    currentPage: 2,    // start on Classement (center)
    packs: [],
    cards: [],
    userCards: [],
    badges: [],
    userBadges: [],
    allUserBadges: [],  // all users' badges for leaderboard display
    challenges: [],
    validations: [],
    leaderboard: [],
    allUsers: [],
    customCards: [],    // bda_custom_cards from all users
    pokedexTab: 'normal',
    defiFilter: 'all',
    lbSearch: '',       // leaderboard search query
    mode: 'game',       // 'game' or 'info'
    infoPage: 2,        // current info mode page (Planning)
    packRevealCards: [],
    packRevealIndex: 0,
    sutomSession: null,
    sutomWords: [],
  };

  // ==================== DOM REFS ====================
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const els = {
    authGate: $('#auth-gate'),
    app: $('#app'),
    swipeTrack: $('#swipe-track'),
    swipeContainer: $('#swipe-container'),
    bottomNav: $('#bottom-nav'),
    userCoins: $('#user-coins'),
    toast: $('#toast'),
  };

  // ==================== TOAST ====================
  let toastTimer;
  function toast(msg, type = '') {
    clearTimeout(toastTimer);
    els.toast.textContent = msg;
    els.toast.className = 'toast show ' + type;
    toastTimer = setTimeout(() => els.toast.className = 'toast', 2500);
  }

  // ==================== SWIPE NAVIGATION ====================
  function goToPage(index, animate = true) {
    if (index < 0 || index > 4) return;
    state.currentPage = index;
    if (!animate) els.swipeTrack.classList.add('dragging');
    els.swipeTrack.style.transform = `translateX(-${index * 100}%)`;
    if (!animate) requestAnimationFrame(() => els.swipeTrack.classList.remove('dragging'));

    // Update nav active states
    $$('#bottom-nav .nav-item').forEach((btn, i) => {
      btn.classList.toggle('active', i === index);
    });

    // Hide admin FAB when not on défis page
    const fab = document.querySelector('.admin-fab');
    if (fab && index !== 3) fab.style.display = 'none';

    // Refresh page data on navigate
    refreshPage(index);
  }

  function initSwipe() {
    let startX = 0, startY = 0, deltaX = 0, isDragging = false, isScrolling = null;
    const threshold = 50;
    const container = els.swipeContainer;

    container.addEventListener('touchstart', (e) => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      deltaX = 0;
      isDragging = true;
      isScrolling = null;
    }, { passive: true });

    container.addEventListener('touchmove', (e) => {
      if (!isDragging) return;
      const dx = e.touches[0].clientX - startX;
      const dy = e.touches[0].clientY - startY;

      // Determine if scrolling vertically or swiping horizontally
      if (isScrolling === null) {
        isScrolling = Math.abs(dy) > Math.abs(dx);
      }
      if (isScrolling) return;

      deltaX = dx;
      const offset = -(state.currentPage * 100) + (deltaX / window.innerWidth * 100);
      els.swipeTrack.classList.add('dragging');
      els.swipeTrack.style.transform = `translateX(${offset}%)`;
    }, { passive: true });

    container.addEventListener('touchend', () => {
      if (!isDragging) return;
      isDragging = false;
      els.swipeTrack.classList.remove('dragging');

      // Pure tap or vertical scroll — don't interfere with click events
      if (isScrolling === null || isScrolling === true) return;

      if (deltaX > threshold && state.currentPage > 0) {
        goToPage(state.currentPage - 1);
      } else if (deltaX < -threshold && state.currentPage < 4) {
        goToPage(state.currentPage + 1);
      } else {
        // Snap back without re-rendering
        els.swipeTrack.style.transform = `translateX(-${state.currentPage * 100}%)`;
      }
    });

    // Bottom nav clicks (game mode)
    $$('#bottom-nav .nav-item').forEach(btn => {
      btn.addEventListener('click', () => {
        goToPage(parseInt(btn.dataset.page));
      });
    });

    // Info mode nav clicks
    $$('#bottom-nav-info .nav-item').forEach(btn => {
      btn.addEventListener('click', () => {
        goToInfoPage(parseInt(btn.dataset.page));
      });
    });

    // Mode segmented control
    const btnGame = $('#mode-btn-game');
    const btnInfo = $('#mode-btn-info');
    if (btnGame) btnGame.addEventListener('click', () => switchMode('game'));
    if (btnInfo) btnInfo.addEventListener('click', () => switchMode('info'));

    // Info mode swipe
    initInfoSwipe();
  }

  // ==================== INFO MODE ====================
  function goToInfoPage(index, animate = true) {
    if (index < 0 || index > 4) return;
    state.infoPage = index;
    const track = $('#swipe-track-info');
    if (!track) return;
    if (!animate) track.classList.add('dragging');
    track.style.transform = `translateX(-${index * 100}%)`;
    if (!animate) requestAnimationFrame(() => track.classList.remove('dragging'));
    $$('#bottom-nav-info .nav-item').forEach((btn, i) => {
      btn.classList.toggle('active', i === index);
    });
  }

  function initInfoSwipe() {
    const container = $('#swipe-container-info');
    const track = $('#swipe-track-info');
    if (!container || !track) return;

    let startX = 0, startY = 0, deltaX = 0, isDragging = false, isScrolling = null;
    const threshold = 50;

    container.addEventListener('touchstart', (e) => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      deltaX = 0; isDragging = true; isScrolling = null;
    }, { passive: true });

    container.addEventListener('touchmove', (e) => {
      if (!isDragging) return;
      const dx = e.touches[0].clientX - startX;
      const dy = e.touches[0].clientY - startY;
      if (isScrolling === null) isScrolling = Math.abs(dy) > Math.abs(dx);
      if (isScrolling) return;
      deltaX = dx;
      const offset = -(state.infoPage * 100) + (deltaX / window.innerWidth * 100);
      track.classList.add('dragging');
      track.style.transform = `translateX(${offset}%)`;
    }, { passive: true });

    container.addEventListener('touchend', () => {
      if (!isDragging) return;
      isDragging = false;
      track.classList.remove('dragging');
      if (isScrolling === null || isScrolling === true) return;
      if (deltaX > threshold && state.infoPage > 0) {
        goToInfoPage(state.infoPage - 1);
      } else if (deltaX < -threshold && state.infoPage < 4) {
        goToInfoPage(state.infoPage + 1);
      } else {
        track.style.transform = `translateX(-${state.infoPage * 100}%)`;
      }
    });
  }

  function switchMode(newMode) {
    if (state.mode === newMode) return;
    const gameContainer = els.swipeContainer;
    const infoContainer = $('#swipe-container-info');
    const gameNav = $('#bottom-nav');
    const infoNav = $('#bottom-nav-info');
    const btnGame = $('#mode-btn-game');
    const btnInfo = $('#mode-btn-info');

    state.mode = newMode;

    if (newMode === 'info') {
      gameContainer.style.display = 'none';
      gameNav.style.display = 'none';
      infoContainer.style.display = 'block';
      infoContainer.classList.add('mode-transition-enter');
      infoNav.style.display = 'flex';
      btnGame.classList.remove('active');
      btnInfo.classList.add('active');
      state.infoPage = 2;
      goToInfoPage(state.infoPage, false);
      initEcocups();
      setTimeout(() => infoContainer.classList.remove('mode-transition-enter'), 400);
    } else {
      infoContainer.style.display = 'none';
      infoNav.style.display = 'none';
      gameContainer.style.display = 'block';
      gameContainer.classList.add('mode-transition-enter');
      gameNav.style.display = 'flex';
      btnGame.classList.add('active');
      btnInfo.classList.remove('active');
      goToPage(state.currentPage, false);
      setTimeout(() => gameContainer.classList.remove('mode-transition-enter'), 400);
    }
  }

  // ==================== TEAM MEMBERS DATA ====================
  const membersData = {
    victor: { name: 'Victor', role: 'Président', pole: 'Le Bureau', photo: 'images/team/Victor.jpg', desc: 'Le chef d\'orchestre du BDA ! Victor coordonne toutes les opérations et veille à ce que chaque projet avance dans les temps.' },
    lila: { name: 'Lila', role: 'Vice-Présidente', pole: 'Le Bureau', photo: 'images/team/Lila.jpg', desc: 'Le bras droit du président, Lila gère les relations internes et remplace Victor quand il est débordé (souvent).' },
    enekio: { name: 'Enékio', role: 'Trésorier', pole: 'Le Bureau', photo: 'images/team/Enekio.jpg', desc: 'Le gardien des finances ! Enékio s\'assure que chaque centime est bien dépensé et que le budget tient la route.' },
    camille: { name: 'Camille', role: 'Secrétaire', pole: 'Le Bureau', photo: 'images/team/Camille.jpg', desc: 'La mémoire du BDA. Camille rédige les comptes-rendus, organise les réunions et garde une trace de tout.' },
    felix: { name: 'Félix', role: 'Respo Comm & Site & Film', pole: 'Communication / Prod', photo: 'images/team/Felix.jpg', desc: 'Le touche-à-tout créatif : réseaux sociaux, site web, et réalisation des films du BDA. Dort pas beaucoup.' },
    margaux: { name: 'Margaux', role: 'Co-Respo Comm', pole: 'Communication', photo: 'images/team/Margaux.jpg', desc: 'Margaux co-pilote la communication avec un œil artistique et une énergie débordante pour les visuels.' },
    nathanael: { name: 'Nathanaël', role: 'Comm', pole: 'Communication', photo: 'images/team/Nathanael.jpg', desc: 'Toujours là pour un coup de main sur les affiches et les stories Instagram du BDA.' },
    lea: { name: 'Léa', role: 'Comm', pole: 'Communication', photo: 'images/team/Lea.jpg', desc: 'Créative et dynamique, Léa apporte sa touche perso à chaque visuel du BDA.' },
    ethan: { name: 'Ethan', role: 'Comm & Respo Musique', pole: 'Communication / Prod', photo: 'images/team/Ethan.jpg', desc: 'Passionné de musique, Ethan compose les ambiances sonores et aide sur la communication.' },
    louis: { name: 'Louis', role: 'Respo Event', pole: 'Événementiel', photo: 'images/team/Louis.jpg', desc: 'L\'architecte des événements ! Louis planifie et orchestre chaque soirée et activité du BDA.' },
    jeanne: { name: 'Jeanne', role: 'Event', pole: 'Événementiel', photo: 'images/team/Jeanne.jpg', desc: 'Jeanne met l\'ambiance et s\'assure que chaque événement est mémorable !' },
    sacha: { name: 'Sacha', role: 'Event', pole: 'Événementiel', photo: 'images/team/Sacha.jpg', desc: 'Toujours motivé, Sacha est le premier à monter les tables et le dernier à les ranger.' },
    soline: { name: 'Soline', role: 'Event', pole: 'Événementiel', photo: 'images/team/Soline.jpg', desc: 'Soline apporte une touche de créativité et d\'organisation à chaque événement.' },
    antoine: { name: 'Antoine', role: 'Event', pole: 'Événementiel', photo: 'images/team/Antoine.jpg', desc: 'Antoine, c\'est le gars sur qui on peut toujours compter pour la logistique des events.' },
    andreas: { name: 'Andréas', role: 'Respo Log', pole: 'L3D', photo: 'images/team/Andreas.jpg', desc: 'Le roi de la logistique : Andréas sait exactement combien de chaises il faut et où les trouver.' },
    lucas: { name: 'Lucas', role: 'Respo Dém', pole: 'L3D', photo: 'images/team/Lucas.jpg', desc: 'Lucas parcourt la ville pour décrocher les meilleurs partenariats et sponsoring.' },
    joseph: { name: 'Joseph', role: 'Dém', pole: 'L3D', photo: 'images/team/Joseph.jpg', desc: 'Joseph donne un coup de main sur les démarches et ne recule devant aucun challenge.' },
    max: { name: 'Max', role: 'Respo DD', pole: 'L3D', photo: 'images/team/Max.jpg', desc: 'Max veille au développement durable : écocups, tri, bilan carbone... La planète, c\'est important !' },
  };

  function initTeamClicks() {
    document.querySelectorAll('.member-card[data-member-modal]').forEach(card => {
      card.addEventListener('click', () => {
        const key = card.dataset.memberModal;
        const member = membersData[key];
        if (!member) return;
        $('#member-detail-photo').src = member.photo;
        $('#member-detail-name').textContent = member.name;
        $('#member-detail-role').textContent = member.role + ' — ' + member.pole;
        $('#member-detail-desc').textContent = member.desc;
        openModal('modal-member');
      });
    });

    // Photo lightbox on member detail photo click
    const detailPhoto = $('#member-detail-photo');
    if (detailPhoto) {
      detailPhoto.style.cursor = 'zoom-in';
      detailPhoto.addEventListener('click', (e) => {
        e.stopPropagation();
        openLightbox(detailPhoto.src);
      });
    }

    // Lightbox close
    const lb = $('#photo-lightbox');
    const lbClose = $('#lightbox-close');
    if (lb) {
      lbClose.addEventListener('click', closeLightbox);
      lb.addEventListener('click', (e) => {
        if (e.target === lb) closeLightbox();
      });
    }
  }

  function openLightbox(src) {
    const lb = $('#photo-lightbox');
    const img = $('#lightbox-img');
    if (!lb || !img) return;
    img.src = src;
    lb.style.display = 'flex';
  }

  function closeLightbox() {
    const lb = $('#photo-lightbox');
    if (lb) lb.style.display = 'none';
  }

  function initGoodiesClicks() {
    document.querySelectorAll('[data-lightbox]').forEach(el => {
      el.style.cursor = 'pointer';
      el.addEventListener('click', () => {
        openLightbox(el.dataset.lightbox);
      });
    });
  }

  // ==================== THREE.JS ECOCUP 3D ====================
  let ecocupsInitialized = false;
  const ecocupAnimations = [];

  function initEcocups() {
    if (ecocupsInitialized || typeof THREE === 'undefined') return;
    ecocupsInitialized = true;

    const cups = [
      { canvasId: 'ecocup-canvas-normal', texture: 'images/goodies/Ecocup.png' },
      { canvasId: 'ecocup-canvas-collector', texture: 'images/goodies/Ecocup_Collector.png' },
    ];

    cups.forEach(({ canvasId, texture }) => {
      const canvas = document.getElementById(canvasId);
      if (!canvas) return;
      const parent = canvas.parentElement;
      const size = Math.min(parent.clientWidth, parent.clientHeight) || 140;

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
      camera.position.set(0, 2, 14);
      camera.lookAt(0, 0, 0);

      const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
      renderer.setSize(size, size);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setClearColor(0x000000, 0);

      const loader = new THREE.TextureLoader();
      loader.load(texture, (tex) => {
        const geo = new THREE.CylinderGeometry(3, 2, 10, 64);
        const mat = new THREE.MeshBasicMaterial({ map: tex });
        const cup = new THREE.Mesh(geo, mat);
        scene.add(cup);

        function animate() {
          const id = requestAnimationFrame(animate);
          cup.rotation.y += 0.01;
          renderer.render(scene, camera);
          ecocupAnimations.push(id);
        }
        animate();
      });
    });
  }

  // ==================== AUTH ====================
  function showAuth() {
    els.authGate.style.display = 'flex';
    els.app.style.display = 'none';
  }

  function showApp() {
    els.authGate.style.display = 'none';
    els.app.style.display = 'block';
    goToPage(2, false); // Start on Classement
    loadAllData();
  }

  function initAuth() {
    $('#btn-login').addEventListener('click', handleLogin);
    $('#btn-register').addEventListener('click', handleRegister);
    $('#btn-guest').addEventListener('click', handleGuest);
    $('#show-register').addEventListener('click', (e) => {
      e.preventDefault();
      $('#auth-login').style.display = 'none';
      $('#auth-register').style.display = 'block';
    });
    $('#show-login').addEventListener('click', (e) => {
      e.preventDefault();
      $('#auth-register').style.display = 'none';
      $('#auth-login').style.display = 'block';
    });
    $('#btn-logout').addEventListener('click', handleLogout);
    $('#btn-guest-login').addEventListener('click', () => {
      handleLogout();
    });

    // Enter key on inputs
    $('#login-password').addEventListener('keydown', (e) => { if (e.key === 'Enter') handleLogin(); });
    $('#register-password').addEventListener('keydown', (e) => { if (e.key === 'Enter') handleRegister(); });
  }

  async function handleLogin() {
    const email = $('#login-email').value.trim();
    const password = $('#login-password').value;
    const errEl = $('#auth-error');
    errEl.textContent = '';

    if (!email || !password) { errEl.textContent = 'Remplis tous les champs.'; return; }
    if (!supabase) { errEl.textContent = 'Connexion au serveur impossible.'; return; }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) { errEl.textContent = error.message; return; }

      state.user = data.user;
      state.isGuest = false;
      await loadProfile();
      showApp();
    } catch (e) {
      errEl.textContent = 'Erreur de connexion.';
    }
  }

  async function handleRegister() {
    const pseudo = $('#register-pseudo').value.trim();
    const email = $('#register-email').value.trim();
    const password = $('#register-password').value;
    const errEl = $('#auth-error');
    errEl.textContent = '';

    if (!pseudo || !email || !password) { errEl.textContent = 'Remplis tous les champs.'; return; }
    if (password.length < 6) { errEl.textContent = 'Mot de passe : 6 caractères minimum.'; return; }
    if (!supabase) { errEl.textContent = 'Connexion au serveur impossible.'; return; }

    // Check blocked domains
    // (will be configurable later via siteConfig)

    try {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) { errEl.textContent = error.message; return; }

      // Create etudiants row
      const { error: insertErr } = await supabase.from('etudiants').insert({
        site_id: SITE_ID,
        email: email,
        pseudo: pseudo,
        solde: 0,
        is_admin: false,
        is_super_admin: false,
        is_creator: false,
      });
      if (insertErr) console.warn('Profile insert:', insertErr);

      state.user = data.user;
      state.isGuest = false;
      await loadProfile();
      showApp();
      toast('Bienvenue ' + pseudo + ' !', 'success');
    } catch (e) {
      errEl.textContent = 'Erreur lors de l\'inscription.';
    }
  }

  function handleGuest() {
    state.user = null;
    state.profile = null;
    state.isGuest = true;
    state.isAdmin = false;
    showApp();
    toast('Mode Invité — Lecture seule', '');
  }

  async function handleLogout() {
    if (supabase && !state.isGuest) {
      await supabase.auth.signOut();
    }
    state.user = null;
    state.profile = null;
    state.isGuest = false;
    state.isAdmin = false;
    showAuth();
  }

  async function loadProfile() {
    if (!supabase || !state.user) return;
    const { data } = await supabase
      .from('etudiants')
      .select('*')
      .eq('site_id', SITE_ID)
      .eq('email', state.user.email)
      .single();

    if (data) {
      state.profile = data;
      state.isAdmin = data.is_admin || data.is_super_admin;
    }
  }

  async function checkSession() {
    if (!supabase) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (session && session.user) {
      state.user = session.user;
      state.isGuest = false;
      await loadProfile();
      showApp();
    }
  }

  // ==================== DATA LOADING ====================
  async function loadAllData() {
    if (!supabase) return;
    await Promise.all([
      loadPacks(),
      loadCards(),
      loadUserCards(),
      loadBadges(),
      loadUserBadges(),
      loadAllUserBadges(),
      loadChallenges(),
      loadValidations(),
      loadLeaderboard(),
      loadCustomCards(),
      loadSutomWords(),
    ]);
    updateUI();
  }

  async function loadSutomWords() {
    if (!supabase) return;
    const { data } = await supabase.from('bda_sutom_words').select('*').eq('site_id', SITE_ID).order('play_date', { ascending: false }).limit(30);
    state.sutomWords = data || [];
  }

  async function loadPacks() {
    if (!supabase) return;
    const { data } = await supabase.from('bda_packs').select('*').eq('site_id', SITE_ID).eq('enabled', true).order('display_order');
    state.packs = data || [];
  }

  async function loadCards() {
    if (!supabase) return;
    const { data } = await supabase.from('bda_cards').select('*').eq('site_id', SITE_ID).order('card_number');
    state.cards = data || [];
  }

  async function loadUserCards() {
    if (!supabase || state.isGuest) { state.userCards = []; return; }
    const { data } = await supabase.from('bda_user_cards').select('*').eq('site_id', SITE_ID).eq('user_email', state.user.email);
    state.userCards = data || [];
  }

  async function loadBadges() {
    if (!supabase) return;
    const { data } = await supabase.from('bda_badges').select('*').eq('site_id', SITE_ID);
    state.badges = data || [];
  }

  async function loadUserBadges() {
    if (!supabase || state.isGuest) { state.userBadges = []; return; }
    const { data } = await supabase.from('bda_user_badges').select('*').eq('site_id', SITE_ID).eq('user_email', state.user.email);
    state.userBadges = data || [];
  }

  async function loadChallenges() {
    if (!supabase) return;
    const { data } = await supabase.from('challenges').select('*').eq('site_id', SITE_ID).eq('published', true).eq('admin_deleted', false).order('created_at', { ascending: false });
    state.challenges = data || [];
  }

  async function loadValidations() {
    if (!supabase || state.isGuest) { state.validations = []; return; }
    const { data } = await supabase.from('challenge_validations').select('*').eq('site_id', SITE_ID).eq('user_email', state.user.email);
    state.validations = data || [];
  }

  async function loadLeaderboard() {
    if (!supabase) return;
    const { data } = await supabase.from('etudiants').select('email, pseudo, photo_profil, solde').eq('site_id', SITE_ID).order('solde', { ascending: false });
    state.leaderboard = data || [];
    state.allUsers = data || [];
  }

  async function loadAllUserBadges() {
    if (!supabase) return;
    const { data } = await supabase.from('bda_user_badges').select('*').eq('site_id', SITE_ID);
    state.allUserBadges = data || [];
  }

  async function loadCustomCards() {
    if (!supabase) return;
    const { data } = await supabase.from('bda_custom_cards').select('*').eq('site_id', SITE_ID).order('created_at', { ascending: false });
    state.customCards = data || [];
  }

  // ==================== REFRESH PAGE ====================
  function refreshPage(index) {
    switch (index) {
      case 0: renderBoutique(); break;
      case 1: renderPokedex(); break;
      case 2: renderClassement(); break;
      case 3: renderDefis(); break;
      case 4: renderProfil(); break;
    }
  }

  function updateUI() {
    updateCoins();
    renderBoutique();
    renderPokedex();
    renderClassement();
    renderDefis();
    renderProfil();
  }

  function updateCoins() {
    const coins = state.profile ? state.profile.solde : 0;
    els.userCoins.textContent = coins.toLocaleString();
    const pc = $('#profil-coins');
    if (pc) pc.textContent = coins.toLocaleString();
  }

  // ==================== PAGE 0: BOUTIQUE ====================
  function renderBoutique() {
    const container = $('#packs-list');
    if (!container) return;

    if (state.packs.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">?</div><p>Aucun pack disponible</p></div>';
      return;
    }

    container.innerHTML = state.packs.map((pack, i) => `
      <div class="pack-card tier-${i}">
        <div class="pack-egg-icon">${i === 0 ? '?' : i === 1 ? '?' : '?'}</div>
        <div class="pack-info">
          <div class="pack-name">${escHtml(pack.name)}</div>
          <div class="pack-desc">${escHtml(pack.description)}</div>
          <div class="pack-actions">
            <button class="pack-price" data-pack-id="${pack.id}" ${state.isGuest || (state.profile && state.profile.solde < pack.price) ? 'disabled' : ''}>
              ${pack.price}
            </button>
            <button class="pack-info-btn" data-pack-info="${pack.id}">i</button>
          </div>
        </div>
      </div>
    `).join('');

    // Buy pack handlers
    container.querySelectorAll('.pack-price').forEach(btn => {
      btn.addEventListener('click', () => buyPack(parseInt(btn.dataset.packId)));
    });
    container.querySelectorAll('.pack-info-btn').forEach(btn => {
      btn.addEventListener('click', () => showPackInfo(parseInt(btn.dataset.packInfo)));
    });

    renderSutom();
  }

  function normalizeWord(raw) {
    return (raw || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Za-z]/g, '')
      .toUpperCase();
  }

  function getTodaySutomWord() {
    const today = new Date().toISOString().slice(0, 10);
    const entry = state.sutomWords.find(w => w.play_date === today);
    if (entry) return { word: normalizeWord(entry.word), points: Number(entry.points || 120) };
    return { word: 'DINOS', points: 100 };
  }

  function renderSutom() {
    const wrap = $('#sutom-widget');
    if (!wrap) return;
    const isCreator = !!(state.profile && (state.profile.is_creator || state.profile.is_admin || state.profile.is_super_admin));
    const today = new Date().toISOString().slice(0, 10);
    const { word, points } = getTodaySutomWord();
    const solvedKey = `bda_sutom_solved_${today}_${state.user?.email || 'guest'}`;
    const alreadySolved = localStorage.getItem(solvedKey) === '1';

    if (!state.sutomSession || state.sutomSession.date !== today || state.sutomSession.word !== word) {
      state.sutomSession = { date: today, word, points, tries: [], solved: alreadySolved };
    } else {
      state.sutomSession.points = points;
      state.sutomSession.solved = alreadySolved;
    }

    const tries = state.sutomSession.tries || [];
    const maxTries = 6;
    const rows = tries.map(guess => renderSutomRow(guess, word)).join('');
    const emptyRows = Math.max(0, (state.sutomSession.solved ? 0 : 1));

    // Planned words list for creators
    const plannedHtml = isCreator ? state.sutomWords.slice(0, 7).map(w => {
      const d = w.play_date;
      const isToday = d === today;
      return `<div class="sutom-planned-item${isToday ? ' planned-today' : ''}"><span class="planned-date">${d}</span><span class="planned-word">${escHtml(normalizeWord(w.word))}</span><span class="planned-pts">${w.points} pts</span></div>`;
    }).join('') : '';

    wrap.innerHTML = `
      <div class="sutom-card">
        <div class="sutom-head">
          <h3>Sutom du jour</h3>
          <p>${points} pts &middot; ${word.length} lettres &middot; ${maxTries - tries.length} essai(s) restant(s)</p>
        </div>
        <div class="sutom-grid">${rows}</div>
        ${state.sutomSession.solved
          ? '<div class="sutom-result sutom-win">Bravo ! Mot trouve &mdash; +' + points + ' pts</div>'
          : tries.length >= maxTries
            ? '<div class="sutom-result sutom-lose">Perdu ! Le mot etait : ' + escHtml(word) + '</div>'
            : `<div class="sutom-input-row">
                <input id="sutom-guess" type="text" maxlength="${word.length}" placeholder="${word[0]}${'_'.repeat(word.length - 1)} (${word.length} lettres)">
                <button id="sutom-submit" class="btn-primary">OK</button>
              </div>`
        }
        <div class="sutom-foot">
          <span>1re lettre : ${escHtml(word[0] || '?')}</span>
          <span>${tries.length}/${maxTries}</span>
        </div>
      </div>
      ${isCreator ? `
      <div class="sutom-card sutom-admin">
        <div class="sutom-head">
          <h3>Planification Sutom</h3>
          <p>Planifie les mots pour les prochains jours.</p>
        </div>
        ${plannedHtml ? '<div class="sutom-planned-list">' + plannedHtml + '</div>' : ''}
        <div class="sutom-plan-form">
          <div class="sutom-plan-row">
            <label>Date<input id="sutom-plan-date" type="date" value="${today}"></label>
            <label>Mot<input id="sutom-plan-word" type="text" placeholder="Ex: MUSIQUE" maxlength="15"></label>
            <label>Points<input id="sutom-plan-points" type="number" min="10" step="10" value="120"></label>
          </div>
          <button id="sutom-plan-save" class="btn-primary" style="width:100%;margin-top:8px">Planifier ce mot</button>
        </div>
      </div>` : ''}
    `;

    const submitBtn = $('#sutom-submit');
    const guessInput = $('#sutom-guess');
    if (submitBtn && guessInput) {
      const submit = () => submitSutomGuess();
      submitBtn.addEventListener('click', submit);
      guessInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
      guessInput.focus();
    }

    const saveBtn = $('#sutom-plan-save');
    if (saveBtn) saveBtn.addEventListener('click', saveSutomSchedule);
  }

  function renderSutomRow(guess, word) {
    const letters = guess.split('');
    return `<div class="sutom-row">` + letters.map((ch, idx) => {
      let cls = 'absent';
      if (word[idx] === ch) cls = 'well';
      else if (word.includes(ch)) cls = 'present';
      return `<span class="sutom-cell ${cls}">${escHtml(ch)}</span>`;
    }).join('') + `</div>`;
  }

  async function submitSutomGuess() {
    if (!state.sutomSession || state.sutomSession.solved) return;
    const input = $('#sutom-guess');
    if (!input) return;
    const guess = normalizeWord(input.value);
    const target = state.sutomSession.word;
    if (guess.length !== target.length) { toast(`Mot invalide (${target.length} lettres)`, 'error'); return; }
    if (state.sutomSession.tries.length >= 6) { toast('Plus d\'essais aujourd\'hui.', 'error'); return; }

    state.sutomSession.tries.push(guess);
    input.value = '';
    const isWin = guess === target;
    if (isWin) {
      state.sutomSession.solved = true;
      await rewardSutomPoints();
      toast('Bravo, mot trouvé !', 'success');
    } else if (state.sutomSession.tries.length >= 6) {
      toast(`Perdu. Mot du jour: ${target}`, 'error');
    }
    renderSutom();
  }

  async function rewardSutomPoints() {
    if (state.isGuest || !supabase || !state.user || !state.sutomSession) return;
    const day = state.sutomSession.date;
    const solvedKey = `bda_sutom_solved_${day}_${state.user.email}`;
    if (localStorage.getItem(solvedKey) === '1') return;
    const points = Number(state.sutomSession.points || 0);
    if (!points) return;

    const { error } = await supabase.from('transactions').insert({
      site_id: SITE_ID,
      destinataire_email: state.user.email,
      montant: points,
      raison: `Sutom du ${day}`,
      admin_email: null,
    });
    if (!error) {
      localStorage.setItem(solvedKey, '1');
      if (state.profile) {
        state.profile.solde += points;
        updateCoins();
      }
      await loadLeaderboard();
      renderClassement();
    }
  }

  async function saveSutomSchedule() {
    const date = $('#sutom-plan-date')?.value;
    const word = normalizeWord($('#sutom-plan-word')?.value || '');
    const points = parseInt($('#sutom-plan-points')?.value || '0', 10);
    if (!date) { toast('Choisis une date.', 'error'); return; }
    if (!word || word.length < 4) { toast('Mot trop court (min. 4 lettres).', 'error'); return; }
    if (!points || points < 10) { toast('Points invalides.', 'error'); return; }
    if (!supabase) { toast('Connexion serveur indisponible.', 'error'); return; }

    // Upsert into bda_sutom_words
    const { error } = await supabase.from('bda_sutom_words').upsert({
      site_id: SITE_ID,
      play_date: date,
      word: word,
      points: points,
      created_by: state.user?.email || 'creator',
    }, { onConflict: 'site_id,play_date' });

    if (error) {
      toast('Erreur: ' + error.message, 'error');
      return;
    }
    await loadSutomWords();
    toast('Mot planifie pour le ' + date, 'success');
    renderSutom();
  }

  async function buyPack(packId) {
    if (state.isGuest) { toast('Connecte-toi pour acheter !', 'error'); return; }
    const pack = state.packs.find(p => p.id === packId);
    if (!pack || !state.profile) return;
    if (state.profile.solde < pack.price) { toast('Pas assez de pièces !', 'error'); return; }

    // Show pack opening modal
    const modal = $('#modal-pack');
    const egg = $('#pack-egg');
    const stage = $('#pack-card-stage');
    const closeBtn = $('#pack-close');

    modal.style.display = 'flex';
    egg.style.display = 'block';
    egg.className = 'pack-egg';
    stage.style.display = 'none';
    closeBtn.style.display = 'none';

    // Deduct coins via transaction (le trigger DB met à jour etudiants.solde automatiquement)
    await supabase.from('transactions').insert({
      site_id: SITE_ID,
      destinataire_email: state.user.email,
      montant: -pack.price,
      raison: 'Achat pack: ' + pack.name,
      admin_email: null,
    });
    state.profile.solde -= pack.price;
    updateCoins();

    // Draw cards
    const drawnCards = drawCardsFromPack(pack);

    // Save to inventory
    const insertRows = [];
    for (const card of drawnCards) {
      // Check if already owned
      const existing = state.userCards.find(uc => uc.card_id === card.id);
      if (!existing) {
        insertRows.push({
          site_id: SITE_ID,
          user_email: state.user.email,
          card_id: card.id,
          obtained_via: 'pack',
        });
      }
    }

    if (insertRows.length > 0) {
      await supabase.from('bda_user_cards').insert(insertRows);
      // Update local state immediately so pokédex reflects new cards
      insertRows.forEach(row => state.userCards.push({ ...row }));
    }

    // Save opening history
    await supabase.from('bda_pack_openings').insert({
      site_id: SITE_ID,
      user_email: state.user.email,
      pack_id: packId,
      cards_drawn: drawnCards.map(c => ({ card_id: c.id, name: c.name, is_shiny: c.is_shiny })),
      price_paid: pack.price,
    });

    // Store for sequential reveal
    state.packRevealCards = drawnCards;
    state.packRevealIndex = 0;

    // Animate egg crack
    setTimeout(() => { egg.classList.add('cracking'); }, 800);

    // After egg cracks, show sequential card stage
    setTimeout(() => {
      egg.style.display = 'none';
      stage.style.display = 'flex';
      $('#pack-reveal-total').textContent = drawnCards.length;
      $('#pack-reveal-count').textContent = '0';
      const container = $('#pack-card-container');
      container.innerHTML = '<div class="pack-tap-prompt">Touche pour r\u00e9v\u00e9ler</div>';
      container.onclick = revealNextCard;
    }, 1800);

    closeBtn.onclick = () => {
      modal.style.display = 'none';
      loadUserCards().then(() => {
        renderPokedex();
        renderBoutique();
        checkBadges();
      });
    };
  }

  function revealNextCard() {
    const cards = state.packRevealCards;
    const idx = state.packRevealIndex;
    if (!cards || idx >= cards.length) return;

    const card = cards[idx];
    state.packRevealIndex++;
    $('#pack-reveal-count').textContent = state.packRevealIndex;

    const container = $('#pack-card-container');

    if (card.is_shiny) {
      // ===== SHINY SUSPENSE (Clash Royale legendary style) =====
      container.classList.add('shiny-reveal-active');
      container.innerHTML = `
        <div class="shiny-suspense-card">
          <div class="shiny-card-inner">
            <div class="shiny-card-back"><span>?</span></div>
            <div class="shiny-card-front">
              ${card.image_url ? `<img src="${escAttr(card.image_url)}" alt="">` : '<div style="font-size:60px">?</div>'}
              <div class="reveal-name">${escHtml(card.name)}</div>
              <div class="reveal-shiny-badge">SHINY</div>
            </div>
          </div>
        </div>
        <div class="shiny-lightning"></div>
      `;
      const flipEl = container.querySelector('.shiny-suspense-card');
      flipEl.classList.add('phase-spin');
      setTimeout(() => {
        flipEl.classList.remove('phase-spin');
        flipEl.classList.add('phase-reveal');
        container.classList.remove('shiny-reveal-active');
      }, 2900);
      container.onclick = null;
      setTimeout(() => {
        if (state.packRevealIndex >= cards.length) {
          $('#pack-close').style.display = 'block';
        } else {
          container.onclick = revealNextCard;
        }
      }, 4200);
    } else {
      // ===== NORMAL CARD (quick flip) =====
      container.classList.remove('shiny-reveal-active');
      container.innerHTML = `
        <div class="normal-flip-card">
          <div class="normal-card-inner">
            <div class="normal-card-back"><span>?</span></div>
            <div class="normal-card-front">
              ${card.image_url ? `<img src="${escAttr(card.image_url)}" alt="">` : '<div style="font-size:60px">?</div>'}
              <div class="reveal-name">${escHtml(card.name)}</div>
            </div>
          </div>
        </div>
      `;
      requestAnimationFrame(() => {
        container.querySelector('.normal-flip-card').classList.add('flipped');
      });
      if (state.packRevealIndex >= cards.length) {
        setTimeout(() => { $('#pack-close').style.display = 'block'; }, 700);
      }
    }
  }

  function drawCardsFromPack(pack) {
    const available = state.cards;
    if (available.length === 0) return [];

    const drawn = [];
    for (let i = 0; i < pack.cards_count; i++) {
      const isShiny = Math.random() < (pack.shiny_chance || 0.05);
      let pool = available.filter(c => c.is_shiny === isShiny);
      if (pool.length === 0) pool = available.filter(c => !c.is_shiny);
      if (pool.length === 0) pool = available;
      const card = pool[Math.floor(Math.random() * pool.length)];
      drawn.push(card);
    }

    return drawn;
  }

  function showPackInfo(packId) {
    const pack = state.packs.find(p => p.id === packId);
    if (!pack) return;

    $('#info-pack-name').textContent = pack.name;
    $('#info-pack-stats').innerHTML = `
      <div class="info-stat-row"><span class="info-stat-label">Cartes par pack</span><span class="info-stat-value">${pack.cards_count}</span></div>
      <div class="info-stat-row"><span class="info-stat-label">Chance Shiny</span><span class="info-stat-value">${((pack.shiny_chance || 0.05) * 100).toFixed(0)}%</span></div>
    `;
    openModal('modal-pack-info');
  }

  // ==================== PAGE 1: POKEDEX ====================
  function renderPokedex() {
    const grid = $('#pokedex-grid');
    if (!grid) return;

    // Handle creations tab separately
    if (state.pokedexTab === 'creations') {
      renderCreationsTab(grid);
      return;
    }

    const isShinyTab = state.pokedexTab === 'shiny';
    const filteredCards = state.cards.filter(c => c.is_shiny === isShinyTab);
    const ownedIds = new Set(state.userCards.map(uc => uc.card_id));

    // Reset grid class (may have been changed by creations tab)
    grid.className = 'pokedex-grid';

    // Update counts
    const normalOwned = state.userCards.filter(uc => {
      const card = state.cards.find(c => c.id === uc.card_id);
      return card && !card.is_shiny;
    }).length;
    const shinyOwned = state.userCards.filter(uc => {
      const card = state.cards.find(c => c.id === uc.card_id);
      return card && card.is_shiny;
    }).length;

    const cn = $('#count-normal');
    const cs = $('#count-shiny');
    if (cn) cn.textContent = normalOwned;
    if (cs) cs.textContent = shinyOwned;

    if (filteredCards.length === 0) {
      // Show placeholder if no cards defined
      const total = isShinyTab ? 24 : 24;
      let html = '';
      for (let i = 1; i <= total; i++) {
        const isOwned = false;
        html += `
          <div class="card-slot locked">
            <div class="card-placeholder">?</div>
          </div>
        `;
      }
      grid.innerHTML = html;
      return;
    }

    grid.innerHTML = filteredCards.map(card => {
      const owned = ownedIds.has(card.id);
      const classes = ['card-slot'];
      if (owned) classes.push('obtained');
      if (card.is_shiny) classes.push('shiny');
      if (!owned) classes.push('locked');

      return `
        <div class="${classes.join(' ')}" data-card-id="${card.id}">
          ${card.image_url ? `<img class="card-img" src="${escAttr(card.image_url)}" alt="">` : `<div class="card-placeholder">${owned ? '?' : '?'}</div>`}
          <div class="card-name">${owned ? escHtml(card.name) : '???'}</div>
          ${!card.is_shiny && !owned && !state.isGuest ? `<button class="card-mark-btn" data-mark-card="${card.id}">V</button>` : ''}
        </div>
      `;
    }).join('');

    // Click to view card details
    grid.querySelectorAll('.card-slot.obtained').forEach(slot => {
      slot.addEventListener('click', (e) => {
        if (e.target.classList.contains('card-mark-btn')) return;
        showCardDetail(parseInt(slot.dataset.cardId));
      });
    });

    // Mark normal card as obtained
    grid.querySelectorAll('.card-mark-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        markCardObtained(parseInt(btn.dataset.markCard));
      });
    });
  }

  async function markCardObtained(cardId) {
    if (state.isGuest || !supabase || !state.user) return;
    const card = state.cards.find(c => c.id === cardId);
    if (!card || card.is_shiny) {
      toast('Seul un admin peut débloquer les cartes Shiny !', 'error');
      return;
    }

    const existing = state.userCards.find(uc => uc.card_id === cardId);
    if (existing) return;

    const { error } = await supabase.from('bda_user_cards').insert({
      site_id: SITE_ID,
      user_email: state.user.email,
      card_id: cardId,
      obtained_via: 'manual',
    });

    if (!error) {
      toast('Carte obtenue !', 'success');
      await loadUserCards();
      renderPokedex();
      checkBadges();
    }
  }

  function showCardDetail(cardId) {
    const card = state.cards.find(c => c.id === cardId);
    if (!card) return;

    const content = $('#card-detail-content');
    content.innerHTML = `
      ${card.image_url ? `<img class="card-detail-img" src="${escAttr(card.image_url)}" alt="">` : '<div style="font-size:80px;margin-bottom:12px">?</div>'}
      <div class="card-detail-name">${escHtml(card.name)}</div>
      ${card.is_shiny ? '<div class="card-detail-shiny-badge">SHINY</div>' : ''}
    `;
    openModal('modal-card');
  }

  // Pokedex tab switching
  function initPokedexTabs() {
    $$('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        $$('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.pokedexTab = btn.dataset.tab;
        renderPokedex();
      });
    });
  }

  function renderCreationsTab(grid) {
    const cards = state.customCards;
    // Show all approved cards + pending if admin or creator
    const visibleCards = cards.filter(c => {
      if (c.approved) return true;
      if (state.isAdmin) return true;
      if (state.user && c.creator_email === state.user.email) return true;
      return false;
    });

    if (visibleCards.length === 0) {
      grid.innerHTML = '<div class="empty-state"><div class="empty-state-icon">--</div><p>Aucune cr\u00e9ation pour le moment.<br>Cr\u00e9e ta carte dans l\'onglet Profil !</p></div>';
      grid.className = 'pokedex-grid';
      return;
    }

    grid.className = 'creations-grid';
    grid.innerHTML = visibleCards.map(card => {
      const author = state.allUsers.find(u => u.email === card.creator_email);
      const authorName = author ? (author.pseudo || card.creator_email) : card.creator_email;
      return `
        <div class="creation-card ${card.approved ? '' : 'pending'}" data-custom-id="${card.id}">
          ${card.image_url ? `<img class="creation-card-img" src="${escAttr(card.image_url)}" alt="">` : '<div class="creation-card-img-placeholder">?</div>'}
          <div class="creation-card-body">
            <div class="creation-card-name">${escHtml(card.name)}</div>
            <div class="creation-card-author">par ${escHtml(authorName)}</div>
            ${card.approved
              ? '<div class="creation-card-status approved">Approuv\u00e9</div>'
              : '<div class="creation-card-status pending-review">En attente</div>'}
            ${state.isAdmin && !card.approved ? `<button class="btn-sm btn-approve-card" data-approve-id="${card.id}" style="margin-top:6px;background:var(--success);color:white;border:none;border-radius:8px;padding:4px 10px;font-size:0.7rem;cursor:pointer">Approuver</button>` : ''}
          </div>
        </div>
      `;
    }).join('');

    // Click to view full card + download PNG
    grid.querySelectorAll('.creation-card').forEach(el => {
      el.addEventListener('click', (e) => {
        if (e.target.classList.contains('btn-approve-card')) return;
        showCustomCardModal(parseInt(el.dataset.customId));
      });
    });

    // Admin approve button
    grid.querySelectorAll('.btn-approve-card').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = parseInt(btn.dataset.approveId);
        await supabase.from('bda_custom_cards').update({ approved: true }).eq('id', id);
        toast('Carte approuvée !', 'success');
        await loadCustomCards();
        renderPokedex();
      });
    });
  }

  function showCustomCardModal(customCardId) {
    const card = state.customCards.find(c => c.id === customCardId);
    if (!card) return;

    const author = state.allUsers.find(u => u.email === card.creator_email);
    const authorName = author ? (author.pseudo || card.creator_email) : card.creator_email;

    const render = $('#custom-card-render');
    render.innerHTML = `
      ${card.image_url ? `<img src="${escAttr(card.image_url)}" alt="" style="width:100%;max-height:50vh;object-fit:contain;border-radius:16px;margin-bottom:16px">` : '<div style="font-size:80px;margin:20px 0;opacity:0.3">?</div>'}
      <div class="ccr-name" style="font-size:1.4rem;margin-bottom:6px">${escHtml(card.name)}</div>
      <div class="ccr-desc">${escHtml(card.description)}</div>
      <div class="ccr-author" style="margin:8px 0">Créé par ${escHtml(authorName)}</div>
      ${card.attack_name ? `
        <div class="ccr-attack" style="margin-top:12px">
          <span class="ccr-atk-name">${escHtml(card.attack_name)}</span>
          <span class="ccr-atk-dmg">${card.attack_damage} DMG</span>
        </div>
      ` : ''}
      ${state.isAdmin && !card.approved ? `
        <button class="btn-primary" style="margin-top:16px;background:var(--success)" id="btn-modal-approve">Approuver cette carte</button>
      ` : ''}
      ${card.approved ? '<div style="margin-top:12px;color:var(--success);font-weight:700">Carte approuv\u00e9e</div>' : ''}
    `;

    // Approve handler in modal
    const approveBtn = render.querySelector('#btn-modal-approve');
    if (approveBtn) {
      approveBtn.addEventListener('click', async () => {
        await supabase.from('bda_custom_cards').update({ approved: true }).eq('id', card.id);
        toast('Carte approuvée !', 'success');
        closeAllModals();
        await loadCustomCards();
        renderPokedex();
      });
    }

    // PNG save button
    const saveBtn = $('#btn-save-card-png');
    saveBtn.onclick = () => generateCardPNG(card, authorName);

    openModal('modal-custom-card');
  }

  function generateCardPNG(card, authorName) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const W = 400, H = 600;
    canvas.width = W;
    canvas.height = H;

    // Background gradient
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, '#0a1a0d');
    grad.addColorStop(1, '#162b19');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(0, 0, W, H, 20);
    ctx.fill();

    // Border
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(2, 2, W - 4, H - 4, 18);
    ctx.stroke();

    // Top label
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(0, 0, W, 36);
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 12px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('CARTE PERSONNALISÉE', W / 2, 24);

    // Card name
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px Poppins, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(card.name || 'Sans nom', W / 2, H - 140);

    // Description
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px Inter, sans-serif';
    wrapText(ctx, card.description || '', W / 2, H - 110, W - 60, 18);

    // Author
    ctx.fillStyle = '#64748b';
    ctx.font = '11px Inter, sans-serif';
    ctx.fillText('Créé par ' + (authorName || ''), W / 2, H - 60);

    // Attack bar
    if (card.attack_name) {
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.beginPath();
      ctx.roundRect(30, H - 50, W - 60, 36, 10);
      ctx.fill();
      ctx.fillStyle = '#f59e0b';
      ctx.font = 'bold 13px Inter, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(card.attack_name, 44, H - 27);
      ctx.fillStyle = '#ef4444';
      ctx.font = 'bold 15px Inter, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(card.attack_damage + ' DMG', W - 44, H - 27);
    }

    // If there's an image, draw it, otherwise just download
    if (card.image_url) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const imgH = 300;
        ctx.save();
        ctx.beginPath();
        ctx.rect(20, 44, W - 40, imgH);
        ctx.clip();
        const scale = Math.max((W - 40) / img.width, imgH / img.height);
        const dw = img.width * scale, dh = img.height * scale;
        ctx.drawImage(img, 20 + (W - 40 - dw) / 2, 44 + (imgH - dh) / 2, dw, dh);
        ctx.restore();
        downloadCanvas(canvas, card.name);
      };
      img.onerror = () => downloadCanvas(canvas, card.name);
      img.src = card.image_url;
    } else {
      // Placeholder icon
      ctx.fillStyle = '#334155';
      ctx.fillRect(20, 44, W - 40, 300);
      ctx.fillStyle = '#64748b';
      ctx.font = '60px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('🃏', W / 2, 210);
      downloadCanvas(canvas, card.name);
    }
  }

  function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
    if (!text) return;
    const words = text.split(' ');
    let line = '';
    for (const word of words) {
      const testLine = line + word + ' ';
      if (ctx.measureText(testLine).width > maxWidth && line) {
        ctx.fillText(line.trim(), x, y);
        line = word + ' ';
        y += lineHeight;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line.trim(), x, y);
  }

  function downloadCanvas(canvas, name) {
    const link = document.createElement('a');
    link.download = (name || 'carte').replace(/[^a-zA-Z0-9àâéèêëîïôùûç_-]/gi, '_') + '.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
    toast('Image t\u00e9l\u00e9charg\u00e9e !', 'success');
  }

  // ==================== PAGE 2: CLASSEMENT ====================
  function renderClassement() {
    const container = $('#leaderboard');
    if (!container) return;
    const lb = state.leaderboard;

    // My position banner
    const myPosEl = $('#my-position');
    if (!state.isGuest && state.user && myPosEl) {
      const myIdx = lb.findIndex(p => p.email === state.user.email);
      if (myIdx >= 0) {
        myPosEl.style.display = 'flex';
        $('#my-pos-rank').textContent = '#' + (myIdx + 1);
        $('#my-pos-coins').textContent = lb[myIdx].solde.toLocaleString() + ' pts';
      } else {
        myPosEl.style.display = 'none';
      }
    } else if (myPosEl) {
      myPosEl.style.display = 'none';
    }

    if (lb.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">--</div><p>Aucun joueur pour le moment</p></div>';
      return;
    }

    // Filter by search
    const query = state.lbSearch.toLowerCase().trim();
    const filtered = query ? lb.filter(p => (p.pseudo || p.email).toLowerCase().includes(query)) : lb;

    let html = '';

    // Podium (top 3) — only when not searching
    if (!query && filtered.length >= 3) {
      const podiumOrder = [filtered[1], filtered[0], filtered[2]]; // silver, gold, bronze
      const ranks = ['2e', '1er', '3e'];
      html += '<div class="lb-podium">';
      podiumOrder.forEach((player, i) => {
        const avatarContent = player.photo_profil
          ? `<img src="${escAttr(player.photo_profil)}" alt="">`
          : (player.pseudo ? player.pseudo[0].toUpperCase() : '?');
        const badgeIcons = getPlayerBadgeIcons(player.email);
        html += `
          <div class="lb-podium-item" data-email="${escAttr(player.email)}">
            <div class="lb-podium-avatar">${avatarContent}</div>
            <div class="lb-podium-rank">${ranks[i]}</div>
            <div class="lb-podium-name">${escHtml(player.pseudo || player.email)}</div>
            <div class="lb-podium-score">${player.solde.toLocaleString()} pts</div>
            ${badgeIcons ? `<div class="lb-badges">${badgeIcons}</div>` : ''}
          </div>
        `;
      });
      html += '</div>';
    }

    // Rest of leaderboard
    const start = (!query && filtered.length >= 3) ? 3 : 0;
    for (let i = start; i < filtered.length; i++) {
      const player = filtered[i];
      const avatarContent = player.photo_profil
        ? `<img src="${escAttr(player.photo_profil)}" alt="">`
        : (player.pseudo ? player.pseudo[0].toUpperCase() : '?');

      // Get global rank (from full lb, not filtered)
      const globalRank = lb.findIndex(p => p.email === player.email) + 1;
      const playerBadgeIcons = getPlayerBadgeIcons(player.email);

      const isMe = state.user && player.email === state.user.email;

      html += `
        <div class="lb-row ${isMe ? 'lb-row-me' : ''}" data-email="${escAttr(player.email)}">
          <div class="lb-rank">${globalRank}</div>
          <div class="lb-avatar">${avatarContent}</div>
          <div class="lb-info">
            <div class="lb-name">${escHtml(player.pseudo || player.email)}</div>
            ${playerBadgeIcons ? `<div class="lb-badges">${playerBadgeIcons}</div>` : ''}
          </div>
          <div class="lb-score">${player.solde.toLocaleString()} pts</div>
          ${state.isAdmin ? `<button class="lb-admin-btn" data-admin-email="${escAttr(player.email)}">+</button>` : ''}
        </div>
      `;
    }

    if (filtered.length === 0) {
      html = '<div class="empty-state"><p>Aucun résultat pour "' + escHtml(query) + '"</p></div>';
    }

    container.innerHTML = html;

    // Click handlers for player profiles
    container.querySelectorAll('.lb-podium-item, .lb-row').forEach(row => {
      row.addEventListener('click', (e) => {
        if (e.target.classList.contains('lb-admin-btn')) return;
        showPlayerProfile(row.dataset.email);
      });
    });

    // Admin + button
    container.querySelectorAll('.lb-admin-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        showPlayerProfile(btn.dataset.adminEmail, true);
      });
    });
  }

  function getPlayerBadgeIcons(email) {
    // Use allUserBadges to show badges for any player
    const userBadges = state.allUserBadges.filter(ub => ub.user_email === email);
    if (userBadges.length === 0) return '';
    return userBadges.map(ub => {
      const badge = state.badges.find(b => b.id === ub.badge_id);
      return badge ? `<span class="lb-badge" title="${escAttr(badge.name)}">${badge.icon}</span>` : '';
    }).join('');
  }

  function initLeaderboardSearch() {
    const input = $('#lb-search-input');
    if (!input) return;
    input.addEventListener('input', () => {
      state.lbSearch = input.value;
      renderClassement();
    });
  }

  async function showPlayerProfile(email, showAdminActions = false) {
    const player = state.leaderboard.find(p => p.email === email);
    if (!player) return;

    const avatar = $('#player-avatar');
    avatar.src = player.photo_profil || DEFAULT_AVATAR;
    avatar.onerror = () => { avatar.src = DEFAULT_AVATAR; };
    $('#player-pseudo').textContent = player.pseudo || player.email;
    $('#player-score').textContent = player.solde + ' pi\u00e8ces';

    // Show badges for this player
    const playerUB = state.allUserBadges.filter(ub => ub.user_email === email);
    $('#player-badges').innerHTML = state.badges.map(badge => {
      const earned = playerUB.some(ub => ub.badge_id === badge.id);
      return `
        <div class="badge-item ${earned ? 'earned' : 'locked'}">
          <div class="badge-icon">${badge.icon}</div>
          <div class="badge-name">${escHtml(badge.name)}</div>
        </div>
      `;
    }).join('');

    // Admin actions
    const adminDiv = $('#player-admin-actions');
    if (state.isAdmin && (showAdminActions || true)) {
      adminDiv.style.display = 'block';
      $('#btn-admin-points').onclick = async () => {
        const points = parseInt($('#admin-points-input').value);
        if (!points || points <= 0) { toast('Entre un nombre de points valide', 'error'); return; }

        const { data, error } = await supabase.rpc('bda_add_points', {
          p_site_id: SITE_ID,
          p_target_email: email,
          p_points: points,
        });

        if (error) { toast('Erreur: ' + error.message, 'error'); return; }
        if (data?.error) { toast('Erreur: ' + data.error, 'error'); return; }

        toast(`+${points} pi\u00e8ces pour ${player.pseudo || email} !`, 'success');
        $('#admin-points-input').value = '';
        closeAllModals();
        await loadLeaderboard();
        if (email === state.user?.email) { await loadProfile(); }
        updateCoins();
        renderClassement();
      };
    } else {
      adminDiv.style.display = 'none';
    }

    openModal('modal-player');
  }

  // ==================== PAGE 3: DEFIS ====================
  function renderDefis() {
    const container = $('#defis-list');
    if (!container) return;

    let challenges = state.challenges;
    if (state.defiFilter !== 'all') {
      challenges = challenges.filter(c => c.difficulte === state.defiFilter);
    }

    // Show/hide admin FAB
    const fab = document.querySelector('.admin-fab');
    if (state.isAdmin && state.currentPage === 3) {
      if (!fab) {
        const btn = document.createElement('button');
        btn.className = 'admin-fab';
        btn.textContent = '+';
        btn.style.display = 'block';
        btn.addEventListener('click', () => openChallengeEditor());
        els.app.appendChild(btn);
      } else {
        fab.style.display = 'block';
      }
    } else if (fab) {
      fab.style.display = 'none';
    }

    if (challenges.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">--</div><p>Aucun d\u00e9fi disponible</p></div>';
      return;
    }

    const completedIds = new Set(state.validations.map(v => v.challenge_id));

    container.innerHTML = challenges.map(ch => {
      const done = completedIds.has(ch.id);
      return `
        <div class="defi-card">
          <div class="defi-top">
            <div class="defi-title">${escHtml(ch.titre)}</div>
            <div class="defi-points ${ch.difficulte}">${DIFF_POINTS[ch.difficulte] || ch.points} pts</div>
          </div>
          <div class="defi-desc">${escHtml(ch.description)}</div>
          ${done ? '<div class="defi-status">D\u00e9fi compl\u00e9t\u00e9</div>' : ''}
          ${state.isAdmin ? `
            <div class="defi-admin-actions">
              <button class="defi-btn-validate" data-validate-ch="${ch.id}">Valider</button>
              <button class="defi-btn-edit" data-edit-ch="${ch.id}">Editer</button>
              <button class="defi-btn-delete" data-delete-ch="${ch.id}">Suppr.</button>
            </div>
          ` : ''}
        </div>
      `;
    }).join('');

    // Admin handlers
    container.querySelectorAll('.defi-btn-validate').forEach(btn => {
      btn.addEventListener('click', () => openValidateModal(parseInt(btn.dataset.validateCh)));
    });
    container.querySelectorAll('.defi-btn-edit').forEach(btn => {
      btn.addEventListener('click', () => openChallengeEditor(parseInt(btn.dataset.editCh)));
    });
    container.querySelectorAll('.defi-btn-delete').forEach(btn => {
      btn.addEventListener('click', () => deleteChallenge(parseInt(btn.dataset.deleteCh)));
    });
  }

  function initDefiFilters() {
    $$('.cat-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        $$('.cat-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.defiFilter = btn.dataset.cat;
        renderDefis();
      });
    });
  }

  function openChallengeEditor(challengeId = null) {
    const ch = challengeId ? state.challenges.find(c => c.id === challengeId) : null;
    $('#challenge-modal-title').textContent = ch ? 'Modifier le Défi' : 'Nouveau Défi';
    $('#ch-titre').value = ch ? ch.titre : '';
    $('#ch-desc').value = ch ? ch.description : '';
    $('#ch-diff').value = ch ? ch.difficulte : 'facile';

    $('#btn-save-challenge').onclick = async () => {
      const titre = $('#ch-titre').value.trim();
      const desc = $('#ch-desc').value.trim();
      const diff = $('#ch-diff').value;
      if (!titre) { toast('Titre requis', 'error'); return; }

      const points = DIFF_POINTS[diff] || 50;

      if (ch) {
        const { error: updErr } = await supabase.from('challenges').update({ titre, description: desc, difficulte: diff, points }).eq('id', ch.id);
        if (updErr) { toast('Erreur: ' + updErr.message, 'error'); return; }
        toast('Défi modifié', 'success');
      } else {
        const { error: insErr } = await supabase.from('challenges').insert({
          site_id: SITE_ID,
          titre, description: desc, difficulte: diff, points,
          published: true, created_by: state.user.email,
        });
        if (insErr) { toast('Erreur: ' + insErr.message, 'error'); return; }
        toast('Défi créé !', 'success');
      }

      closeAllModals();
      await loadChallenges();
      renderDefis();
    };

    openModal('modal-challenge');
  }

  async function openValidateModal(challengeId) {
    const ch = state.challenges.find(c => c.id === challengeId);
    if (!ch) return;
    $('#validate-challenge-name').textContent = ch.titre + ' (' + ch.points + ' pts)';

    const select = $('#validate-user-select');
    select.innerHTML = '<option value="">Choisir un joueur…</option>';
    state.allUsers.forEach(u => {
      const opt = document.createElement('option');
      opt.value = u.email;
      opt.textContent = u.pseudo || u.email;
      select.appendChild(opt);
    });

    $('#btn-confirm-validate').onclick = async () => {
      const email = select.value;
      if (!email) { toast('Sélectionne un joueur', 'error'); return; }

      const { data, error } = await supabase.rpc('bda_validate_challenge', {
        p_site_id: SITE_ID,
        p_challenge_id: challengeId,
        p_target_email: email,
      });

      if (error) { toast('Erreur: ' + error.message, 'error'); return; }
      if (data?.error === 'already_validated') { toast('Déjà validé pour ce joueur', 'error'); return; }
      if (data?.error) { toast('Erreur: ' + data.error, 'error'); return; }

      toast('D\u00e9fi valid\u00e9 ! +' + ch.points + ' pts', 'success');
      closeAllModals();
      await Promise.all([loadLeaderboard(), loadValidations()]);
      if (email === state.user?.email) { await loadProfile(); updateCoins(); }
      renderClassement();
      renderDefis();
    };

    openModal('modal-validate');
  }

  async function deleteChallenge(challengeId) {
    if (!confirm('Supprimer ce défi ?')) return;
    await supabase.from('challenges').update({ admin_deleted: true }).eq('id', challengeId);
    toast('Défi supprimé', 'success');
    await loadChallenges();
    renderDefis();
  }

  // ==================== PAGE 4: PROFIL ====================
  function renderProfil() {
    if (state.isGuest) {
      $('#profil-guest').style.display = 'block';
      $('#profil-content').style.display = 'none';
      return;
    }
    $('#profil-guest').style.display = 'none';
    $('#profil-content').style.display = 'block';

    if (!state.profile) return;

    const p = state.profile;
    $('#profil-pseudo').textContent = p.pseudo || 'Sans pseudo';
    $('#profil-email').textContent = state.user?.email || '';
    $('#profil-coins').textContent = p.solde.toLocaleString();

    // Avatar
    const avatarImg = $('#profil-avatar-img');
    if (p.photo_profil) {
      avatarImg.src = p.photo_profil;
      avatarImg.style.display = 'block';
    } else {
      avatarImg.style.display = 'none';
    }

    // Cards count
    const totalCards = state.userCards.length;
    $('#profil-cards').textContent = totalCards;

    // Rank
    const rank = state.leaderboard.findIndex(l => l.email === state.user?.email);
    $('#profil-rank').textContent = rank >= 0 ? `#${rank + 1}` : '#—';

    // Badges
    const badgesContainer = $('#profil-badges');
    badgesContainer.innerHTML = state.badges.map(badge => {
      const earned = state.userBadges.some(ub => ub.badge_id === badge.id);
      return `
        <div class="badge-item ${earned ? 'earned' : 'locked'}">
          <div class="badge-icon">${badge.icon}</div>
          <div class="badge-name">${escHtml(badge.name)}</div>
        </div>
      `;
    }).join('');

    // Edit pseudo
    $('#edit-pseudo').value = p.pseudo || '';
  }

  function initProfil() {
    // Save pseudo
    $('#btn-save-pseudo').addEventListener('click', async () => {
      const pseudo = $('#edit-pseudo').value.trim();
      if (!pseudo) return;
      await supabase.from('etudiants').update({ pseudo }).eq('id', state.profile.id);
      state.profile.pseudo = pseudo;
      toast('Pseudo mis à jour !', 'success');
      renderProfil();
      await loadLeaderboard();
      renderClassement();
    });

    // Avatar upload
    $('#btn-edit-avatar').addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('image', file);

        try {
          const token = (await supabase.auth.getSession()).data.session?.access_token;
          const res = await fetch(`/admin/api/projects/${SITE_ID}/upload`, {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + token },
            body: formData,
          });
          const data = await res.json();
          if (data.url) {
            await supabase.from('etudiants').update({ photo_profil: data.url }).eq('id', state.profile.id);
            state.profile.photo_profil = data.url;
            toast('Avatar mis à jour !', 'success');
            renderProfil();
          }
        } catch (err) {
          // Fallback: upload directly to supabase storage
          const ext = file.name.split('.').pop();
          const fileName = `avatars/${SITE_ID}/${state.user.email.replace(/[^a-z0-9]/gi, '_')}.${ext}`;
          const { error } = await supabase.storage.from('sites').upload(fileName, file, { upsert: true, contentType: file.type });
          if (!error) {
            const { data: { publicUrl } } = supabase.storage.from('sites').getPublicUrl(fileName);
            await supabase.from('etudiants').update({ photo_profil: publicUrl }).eq('id', state.profile.id);
            state.profile.photo_profil = publicUrl;
            toast('Avatar mis à jour !', 'success');
            renderProfil();
          }
        }
      };
      input.click();
    });

    // Card creator
    initCardCreator();
  }

  function initCardCreator() {
    const imgInput = $('#cc-image');
    let selectedFile = null;
    let editingCardId = null;

    // Live preview updates
    const liveName = $('#cc-live-name');
    const liveDesc = $('#cc-live-desc');
    const liveAtkName = $('#cc-live-atk-name');
    const liveAtkDmg = $('#cc-live-atk-dmg');
    const liveImgArea = $('#cc-live-img-area');
    const submitBtn = $('#btn-create-card');

    // Auto-fill if user already created a card
    function prefillExistingCard() {
      if (state.isGuest || !state.user) return;
      const existing = state.customCards.find(c => c.creator_email === state.user.email);
      if (existing) {
        editingCardId = existing.id;
        $('#cc-name').value = existing.name || '';
        $('#cc-desc').value = existing.description || '';
        $('#cc-attack').value = existing.attack_name || '';
        $('#cc-damage').value = existing.attack_damage || '';
        liveName.textContent = existing.name || 'Nom de la carte';
        liveDesc.textContent = existing.description || 'Description...';
        liveAtkName.textContent = existing.attack_name || 'Attaque';
        liveAtkDmg.textContent = (existing.attack_damage || '0') + ' DMG';
        if (existing.image_url) {
          liveImgArea.innerHTML = `<img src="${existing.image_url}" alt="Preview">`;
        }
        submitBtn.textContent = 'Modifier ma carte';
      } else {
        editingCardId = null;
        submitBtn.textContent = 'Soumettre la carte';
      }
    }

    prefillExistingCard();

    $('#cc-name').addEventListener('input', (e) => {
      liveName.textContent = e.target.value || 'Nom de la carte';
    });
    $('#cc-desc').addEventListener('input', (e) => {
      liveDesc.textContent = e.target.value || 'Description...';
    });
    $('#cc-attack').addEventListener('input', (e) => {
      liveAtkName.textContent = (e.target.value || 'Attaque');
    });
    $('#cc-damage').addEventListener('input', (e) => {
      liveAtkDmg.textContent = (e.target.value || '0') + ' DMG';
    });

    imgInput.addEventListener('change', (e) => {
      selectedFile = e.target.files[0];
      if (selectedFile) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          liveImgArea.innerHTML = `<img src="${ev.target.result}" alt="Preview">`;
        };
        reader.readAsDataURL(selectedFile);
      }
    });

    $('#btn-create-card').addEventListener('click', async () => {
      if (state.isGuest) { toast('Connecte-toi pour creer une carte', 'error'); return; }

      // Block creation if already has a card (and not in edit mode)
      if (!editingCardId) {
        const existing = state.customCards.find(c => c.creator_email === state.user.email);
        if (existing) { toast('Tu as deja une carte. Modifie-la !', 'error'); return; }
      }

      const name = $('#cc-name').value.trim();
      const desc = $('#cc-desc').value.trim();
      const attack = $('#cc-attack').value.trim();
      const damage = parseInt($('#cc-damage').value) || 0;

      if (!name) { toast('Nom de la carte requis', 'error'); return; }

      let imageUrl = editingCardId ? (state.customCards.find(c => c.id === editingCardId)?.image_url || '') : '';
      if (selectedFile) {
        const formData = new FormData();
        formData.append('image', selectedFile);
        try {
          const token = (await supabase.auth.getSession()).data.session?.access_token;
          const res = await fetch(`/admin/api/projects/${SITE_ID}/upload`, {
            method: 'POST',
            headers: token ? { 'Authorization': 'Bearer ' + token } : {},
            body: formData,
          });
          const result = await res.json();
          if (result.url) imageUrl = result.url;
        } catch (e) {
          console.warn('Server upload failed, trying Supabase storage:', e);
          try {
            const ext = selectedFile.name.split('.').pop();
            const safeName = `custom_${Date.now()}.${ext}`;
            const fileName = `custom-cards/${SITE_ID}/${safeName}`;
            const { error } = await supabase.storage.from('sites').upload(fileName, selectedFile, { upsert: true, contentType: selectedFile.type });
            if (!error) {
              const { data: { publicUrl } } = supabase.storage.from('sites').getPublicUrl(fileName);
              imageUrl = publicUrl;
            }
          } catch (e2) { console.warn('Supabase upload also failed:', e2); }
        }
      }

      let error;
      if (editingCardId) {
        ({ error } = await supabase.from('bda_custom_cards').update({
          name, description: desc, attack_name: attack, attack_damage: damage,
          image_url: imageUrl, approved: false,
        }).eq('id', editingCardId));
      } else {
        ({ error } = await supabase.from('bda_custom_cards').insert({
          site_id: SITE_ID,
          creator_email: state.user.email,
          name, description: desc, attack_name: attack, attack_damage: damage,
          image_url: imageUrl,
        }));
      }

      if (!error) {
        toast(editingCardId ? 'Carte modifi\u00e9e !' : 'Carte soumise ! En attente d\'approbation.', 'success');
        selectedFile = null;
        await loadCustomCards();
        prefillExistingCard();
      } else {
        toast('Erreur: ' + error.message, 'error');
      }
    });
  }

  // ==================== BADGES AUTO-CHECK ====================
  async function checkBadges() {
    if (state.isGuest || !state.user || !supabase) return;

    const normalOwned = state.userCards.filter(uc => {
      const card = state.cards.find(c => c.id === uc.card_id);
      return card && !card.is_shiny;
    }).length;

    const shinyOwned = state.userCards.filter(uc => {
      const card = state.cards.find(c => c.id === uc.card_id);
      return card && card.is_shiny;
    }).length;

    const totalOwned = state.userCards.length;
    const earnedIds = new Set(state.userBadges.map(ub => ub.badge_id));

    for (const badge of state.badges) {
      if (earnedIds.has(badge.id)) continue;

      let earned = false;
      switch (badge.condition_type) {
        case 'cards_collected':
          earned = normalOwned >= badge.condition_value;
          break;
        case 'shiny_collected':
          earned = shinyOwned >= badge.condition_value;
          break;
        case 'all_normal':
          earned = normalOwned >= badge.condition_value;
          break;
        case 'all_shiny':
          earned = shinyOwned >= badge.condition_value;
          break;
        case 'all_cards':
          earned = totalOwned >= badge.condition_value;
          break;
      }

      if (earned) {
        const { error } = await supabase.from('bda_user_badges').insert({
          site_id: SITE_ID, user_email: state.user.email, badge_id: badge.id,
        });
        if (!error) {
          toast(`Badge débloqué : ${badge.icon} ${badge.name} !`, 'success');
          state.userBadges.push({ badge_id: badge.id, user_email: state.user.email });
        }
      }
    }

    renderProfil();
  }

  // ==================== MODAL HELPERS ====================
  function openModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.style.display = 'flex';
  }

  function closeAllModals() {
    $$('.modal').forEach(m => m.style.display = 'none');
  }

  function initModals() {
    // Close on overlay click
    $$('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', closeAllModals);
    });
    // Close buttons
    $$('.modal-close-btn').forEach(btn => {
      btn.addEventListener('click', closeAllModals);
    });
  }

  // ==================== UTILS ====================
  function escHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function escAttr(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  // ==================== INIT ====================
  async function init() {
    await initSupabase();

    initSwipe();
    initAuth();
    initModals();
    initPokedexTabs();
    initDefiFilters();
    initLeaderboardSearch();
    initProfil();
    initTeamClicks();
    initGoodiesClicks();

    // Check existing session
    await checkSession();
  }

  // Start
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
