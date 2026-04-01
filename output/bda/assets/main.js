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
    hotlinesConfig: null,
    hotlinesMenu: [],
    hotlinesOrders: [],
    hotlinesMyOrder: null,
    hotlinesCart: {},
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
    const btnHotlines = $('#mode-btn-hotlines');
    if (btnGame) btnGame.addEventListener('click', () => switchMode('game'));
    if (btnInfo) btnInfo.addEventListener('click', () => switchMode('info'));
    if (btnHotlines) btnHotlines.addEventListener('click', () => switchMode('hotlines'));

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
    const hotlinesContainer = $('#hotlines-container');
    const gameNav = $('#bottom-nav');
    const infoNav = $('#bottom-nav-info');
    const btnGame = $('#mode-btn-game');
    const btnInfo = $('#mode-btn-info');
    const btnHotlines = $('#mode-btn-hotlines');

    state.mode = newMode;

    // Hide all
    gameContainer.style.display = 'none';
    infoContainer.style.display = 'none';
    hotlinesContainer.style.display = 'none';
    gameNav.style.display = 'none';
    infoNav.style.display = 'none';
    btnGame.classList.remove('active');
    btnInfo.classList.remove('active');
    btnHotlines.classList.remove('active');

    if (newMode === 'info') {
      infoContainer.style.display = 'block';
      infoContainer.classList.add('mode-transition-enter');
      infoNav.style.display = 'flex';
      btnInfo.classList.add('active');
      state.infoPage = 2;
      goToInfoPage(state.infoPage, false);
      initEcocups();
      setTimeout(() => infoContainer.classList.remove('mode-transition-enter'), 400);
    } else if (newMode === 'hotlines') {
      hotlinesContainer.style.display = 'block';
      hotlinesContainer.classList.add('mode-transition-enter');
      btnHotlines.classList.add('active');
      renderHotlines();
      setTimeout(() => hotlinesContainer.classList.remove('mode-transition-enter'), 400);
    } else {
      gameContainer.style.display = 'block';
      gameContainer.classList.add('mode-transition-enter');
      gameNav.style.display = 'flex';
      btnGame.classList.add('active');
      goToPage(state.currentPage, false);
      setTimeout(() => gameContainer.classList.remove('mode-transition-enter'), 400);
    }
  }

  // ==================== TEAM MEMBERS DATA ====================
  const membersData = {
    anne:      { name: 'Anne',      role: 'Présidente',            pole: 'Le Bureau',          photo: 'images/team/Anne.jpg',      desc: 'La cheffe d\'orchestre du Dinos\'Art ! Anne coordonne toutes les opérations et veille à ce que chaque projet avance dans les temps.' },
    cyrielle:  { name: 'Cyrielle',  role: 'Trésorière',            pole: 'Le Bureau',          photo: 'images/team/Cyrielle.jpg',  desc: 'La gardienne des finances ! Cyrielle s\'assure que chaque centime est bien dépensé et que le budget tient la route.' },
    candy:     { name: 'Candy',     role: 'Secrétaire',            pole: 'Le Bureau',          photo: 'images/team/Candy.jpg',     desc: 'La mémoire du Dinos\'Art. Candy rédige les comptes-rendus, organise les réunions et garde une trace de tout.' },
    kimlee:    { name: 'Kimlee',    role: 'VP Externe',            pole: 'Le Bureau',          photo: 'images/team/Kimlee.jpg',    desc: 'Kimlee gère les relations avec les partenaires extérieurs et représente le Dinos\'Art auprès des sponsors et associations.' },
    anais:     { name: 'Anaïs',     role: 'VP Interne',            pole: 'Le Bureau',          photo: 'images/team/Anais.jpg',     desc: 'Anaïs veille à la cohésion interne du Dinos\'Art, coordonne les pôles et s\'assure que tout le monde travaille dans de bonnes conditions.' },
    ingrid:    { name: 'Ingrid',    role: 'Vice-Trésorière / Event', pole: 'Le Bureau',        photo: 'images/team/Ingrid.jpg',    desc: 'Double casquette pour Ingrid : elle appuie la trésorière sur les finances et donne un coup de main sur les events !' },
    marie:     { name: 'Marie',     role: 'Respo Communication',   pole: 'Communication',      photo: 'images/team/Marie.jpg',     desc: 'Marie pilote toute la communication du Dinos\'Art : réseaux, affiches, identité visuelle... Rien ne lui échappe.' },
    anouk:     { name: 'Anouk',     role: 'Comm',                  pole: 'Communication',      photo: 'images/team/Anouk.jpg',     desc: 'Toujours créative, Anouk apporte sa touche perso à chaque visuel et post du Dinos\'Art.' },
    jade:      { name: 'Jade',      role: 'Comm',                  pole: 'Communication',      photo: 'images/team/Jade.jpg',      desc: 'Jade met son oeil artistique au service de la comm pour des contenus qui claquent.' },
    timothee:  { name: 'Timothée', role: 'Comm',                  pole: 'Communication',      photo: 'images/team/Thimote.jpg',   desc: 'Timothée est un couteau suisse de la communication, toujours partant pour un nouveau projet créatif.' },
    annael:    { name: 'Annaël',    role: 'Comm',                  pole: 'Communication',      photo: 'images/team/Annael.jpg',    desc: 'Annaël apporte son énergie et ses idées fraîches pour faire briller le Dinos\'Art sur les réseaux.' },
    ismail:    { name: 'Ismail',    role: 'Comm',                  pole: 'Communication',      photo: 'images/team/Ismail.jpg',    desc: 'Ismail est là pour tous les coups de main visuels et contribue à l\'image du Dinos\'Art.' },
    amicie:    { name: 'Amicie',    role: 'Comm',                  pole: 'Communication',      photo: 'images/team/Amicie.jpg',    desc: 'Amicie complète l\'équipe comm avec bonne humeur et créativité.' },
    bastien:   { name: 'Bastien',   role: 'Respo Événementiel',    pole: 'Événementiel',       photo: 'images/team/Bastien.jpg',   desc: 'Bastien planifie et orchestre les événements du Dinos\'Art de A à Z. Les soirées qui marquent, c\'est lui !' },
    yann:      { name: 'Yann',      role: 'Respo Événementiel',    pole: 'Événementiel',       photo: 'images/team/Yann.jpg',      desc: 'Co-respo événementiel, Yann s\'assure que chaque event se passe sans accroc et dans la bonne humeur.' },
    edouard:   { name: 'Edouard',   role: 'Event',                 pole: 'Événementiel',       photo: 'images/team/Edouard.jpg',   desc: 'Edouard est sur tous les fronts pendant les events : montage, ambiance, logistique.' },
    manu:      { name: 'Manu',      role: 'Event',                 pole: 'Événementiel',       photo: 'images/team/Manu.jpg',      desc: 'Manu c\'est le gars sur qui on peut toujours compter pour la logistique et le bon déroulement des events.' },
    ambre:     { name: 'Ambre',     role: 'Respo Logistique',      pole: 'L3D',                photo: 'images/team/Ambre.jpg',     desc: 'Ambre sait exactement ce qu\'il faut, combien et où le trouver. La reine de la logistique !' },
    gaetan:    { name: 'Gaetan',    role: 'Logistique',            pole: 'L3D',                photo: 'images/team/Gaetan.jpg',    desc: 'Gaetan prête main forte à la logistique et ne recule devant aucune manutention.' },
    eliott:    { name: 'Eliott',    role: 'Logistique',            pole: 'L3D',                photo: 'images/team/Eliott.jpg',    desc: 'Eliott complète l\'équipe logistique et veille à ce que tout le matériel soit au bon endroit au bon moment.' },
    nicolas:   { name: 'Nicolas',   role: 'Respo Démarches',       pole: 'L3D',                photo: 'images/team/Nicolas.jpg',   desc: 'Nicolas parcourt la ville pour décrocher les meilleurs partenariats et s\'occupe de toutes les démarches administratives.' },
    tanguy:    { name: 'Tanguy',    role: 'Démarches',             pole: 'L3D',                photo: 'images/team/Tanguy.jpg',    desc: 'Tanguy appuie Nicolas sur les démarches et donne un coup de main pour les partenariats.' },
    iuri:      { name: 'Iuri',      role: 'Démarches',             pole: 'L3D',                photo: 'images/team/Iuri.jpg',      desc: 'Iuri ne recule devant aucun challenge et s\'implique dans toutes les démarches du Dinos\'Art.' },
    pauline:   { name: 'Pauline',   role: 'Respo Dév. Durable',    pole: 'L3D',                photo: 'images/team/Pauline.jpg',   desc: 'Pauline veille au développement durable : écocups, tri, bilan carbone... La planète, c\'est important !' },
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
      { canvasId: 'ecocup-canvas-normal', texture: 'images/goodies/Ecocup.jpg' },
      { canvasId: 'ecocup-canvas-collector', texture: 'images/goodies/Ecocup_Collector.jpg' },
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
    // Reset to choice screen
    showAuthStep('choice');
  }

  function showApp() {
    els.authGate.style.display = 'none';
    els.app.style.display = 'block';
    goToPage(2, false); // Start on Classement
    loadAllData();
  }

  function initAuth() {
    // Choice buttons
    $('#btn-go-register').addEventListener('click', () => showAuthStep('register'));
    $('#btn-go-login').addEventListener('click', () => showAuthStep('login'));
    $('#btn-guest').addEventListener('click', handleGuest);
    $('#btn-logout').addEventListener('click', handleLogout);
    $('#btn-guest-login').addEventListener('click', () => { handleLogout(); });

    // Register flow
    $('#btn-send-register').addEventListener('click', () => handleSendOtp('register'));
    $('#btn-verify-register').addEventListener('click', () => handleVerifyOtp('register'));
    $('#register-back').addEventListener('click', (e) => { e.preventDefault(); showAuthStep('choice'); });
    $('#register-code-back').addEventListener('click', (e) => {
      e.preventDefault();
      $('#register-step-code').style.display = 'none';
      $('#register-step-email').style.display = 'block';
      $('#register-code').value = '';
      $('#auth-error').textContent = '';
    });

    // Login flow (single screen: email + code + verify)
    $('#btn-verify-login').addEventListener('click', handleLoginVerify);
    $('#login-resend').addEventListener('click', handleLoginResend);
    $('#login-back').addEventListener('click', (e) => { e.preventDefault(); showAuthStep('choice'); });

    // Enter key
    $('#register-email').addEventListener('keydown', (e) => { if (e.key === 'Enter') handleSendOtp('register'); });
    $('#register-pseudo').addEventListener('keydown', (e) => { if (e.key === 'Enter') handleSendOtp('register'); });
    $('#register-code').addEventListener('keydown', (e) => { if (e.key === 'Enter') handleVerifyOtp('register'); });
    $('#login-code').addEventListener('keydown', (e) => { if (e.key === 'Enter') handleLoginVerify(); });
  }

  function showAuthStep(step) {
    $('#auth-choice').style.display = step === 'choice' ? 'block' : 'none';
    $('#auth-register').style.display = step === 'register' ? 'block' : 'none';
    $('#auth-login').style.display = step === 'login' ? 'block' : 'none';
    $('#auth-error').textContent = '';
    // Reset sub-steps
    if (step === 'register') {
      $('#register-step-email').style.display = 'block';
      $('#register-step-code').style.display = 'none';
    }
  }

  async function handleSendOtp(mode) {
    const email = $('#register-email').value.trim();
    const pseudo = ($('#register-pseudo').value || '').trim();
    const errEl = $('#auth-error');
    errEl.textContent = '';

    if (!email) { errEl.textContent = 'Entre ton adresse email.'; return; }
    if (!pseudo) { errEl.textContent = 'Entre un pseudo.'; return; }
    if (!supabase) { errEl.textContent = 'Connexion au serveur impossible.'; return; }

    try {
      const opts = { shouldCreateUser: true };
      if (pseudo) opts.data = { pseudo };
      const { error } = await supabase.auth.signInWithOtp({ email, options: opts });
      if (error) { errEl.textContent = error.message; return; }

      // Store for verification step
      state._otpEmail = email;
      state._otpPseudo = pseudo;
      state._otpMode = mode;

      // Show code step
      $('#register-step-email').style.display = 'none';
      $('#register-step-code').style.display = 'block';
      $('#register-code').focus();
    } catch (e) {
      errEl.textContent = 'Erreur lors de l\'envoi du code.';
    }
  }

  // Login: resend code for existing account
  async function handleLoginResend(e) {
    if (e) e.preventDefault();
    const email = $('#login-email').value.trim();
    const errEl = $('#auth-error');
    errEl.textContent = '';

    if (!email) { errEl.textContent = 'Entre ton adresse email.'; return; }
    if (!supabase) { errEl.textContent = 'Connexion au serveur impossible.'; return; }

    try {
      const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
      if (error) {
        if (error.message.toLowerCase().includes('user not found')) {
          errEl.textContent = 'Aucun compte avec cet email. Cr\u00e9e un compte d\'abord.';
        } else {
          errEl.textContent = error.message;
        }
        return;
      }
      toast('Code envoy\u00e9 !', 'success');
    } catch (e) {
      errEl.textContent = 'Erreur lors de l\'envoi du code.';
    }
  }

  // Login: verify email + code on single screen
  async function handleLoginVerify() {
    const email = $('#login-email').value.trim();
    const token = ($('#login-code').value || '').trim();
    const errEl = $('#auth-error');
    errEl.textContent = '';

    if (!email) { errEl.textContent = 'Entre ton adresse email.'; return; }
    if (!token || token.length !== 8) { errEl.textContent = 'Entre le code \u00e0 8 chiffres.'; return; }
    if (!supabase) { errEl.textContent = 'Connexion au serveur impossible.'; return; }

    state._otpEmail = email;
    state._otpPseudo = '';

    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token,
        type: 'email'
      });
      if (error) { errEl.textContent = 'Code invalide ou expir\u00e9.'; return; }

      state.user = data.user;
      if (state.user && !state.user.email) state.user.email = email;
      state.isGuest = false;

      await loadProfile();
      showApp();
    } catch (e) {
      errEl.textContent = 'Erreur de v\u00e9rification.';
    }
  }

  // Register: verify OTP code
  async function handleVerifyOtp() {
    const token = ($('#register-code').value || '').trim();
    const errEl = $('#auth-error');
    errEl.textContent = '';

    if (!token || token.length !== 8) { errEl.textContent = 'Entre le code \u00e0 8 chiffres.'; return; }
    if (!supabase) { errEl.textContent = 'Connexion au serveur impossible.'; return; }

    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: state._otpEmail,
        token,
        type: 'email'
      });
      if (error) { errEl.textContent = 'Code invalide ou expir\u00e9.'; return; }

      state.user = data.user;
      if (state.user && !state.user.email) state.user.email = state._otpEmail;
      state.isGuest = false;

      // Check if etudiants row exists, create if needed
      const { data: profile } = await supabase
        .from('etudiants')
        .select('id')
        .eq('site_id', SITE_ID)
        .eq('email', state._otpEmail)
        .single();

      if (!profile) {
        const pseudo = state._otpPseudo || state._otpEmail.split('@')[0];
        const { error: insertErr } = await supabase.from('etudiants').insert({
          site_id: SITE_ID,
          email: state._otpEmail,
          pseudo: pseudo,
          solde: 0,
          is_admin: false,
          is_super_admin: false,
          is_creator: false,
        });
        if (insertErr) console.warn('Profile insert:', insertErr);
        toast('Bienvenue ' + pseudo + ' !', 'success');
      }

      await loadProfile();
      showApp();
    } catch (e) {
      errEl.textContent = 'Erreur de v\u00e9rification.';
    }
  }

  function handleGuest() {
    state.user = null;
    state.profile = null;
    state.isGuest = true;
    state.isAdmin = false;
    showApp();
    toast('Mode Invit\u00e9 \u2014 Lecture seule', '');
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
      loadHotlinesConfig(),
      loadHotlinesMenu(),
      loadHotlinesOrders(),
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
      case 2: loadLeaderboard().then(renderClassement); break;
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
    renderHotlines();
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

    container.innerHTML = state.packs.map(function(pack, i) {
      var eggTier = i === 0 ? 'green' : i === 1 ? 'purple' : 'gold';
      return '<div class="pack-card tier-' + i + '">' +
        '<div class="pack-egg-icon">' + getEggSVG(eggTier, 80) + '</div>' +
        '<div class="pack-info">' +
          '<div class="pack-name">' + escHtml(pack.name) + '</div>' +
          '<div class="pack-desc">' + (i === 0 ? '1\u20137 cartes \u00b7 1% shiny' : i === 1 ? '3\u20139 cartes \u00b7 5% shiny' : '5\u201312 cartes \u00b7 10% shiny') + '</div>' +
          '<div class="pack-actions">' +
            '<button class="pack-price" data-pack-id="' + pack.id + '"' + (state.isGuest || (state.profile && state.profile.solde < pack.price) ? ' disabled' : '') + '>' +
              pack.price +
            '</button>' +
            '<button class="pack-info-btn" data-pack-info="' + pack.id + '">i</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    }).join('');


    // Buy pack handlers
    container.querySelectorAll('.pack-price').forEach(btn => {
      btn.addEventListener('click', () => buyPack(parseInt(btn.dataset.packId)));
    });
    container.querySelectorAll('.pack-info-btn').forEach(btn => {
      btn.addEventListener('click', () => showPackInfo(parseInt(btn.dataset.packInfo)));
    });

    renderSutom();
  }

  /* ===== SUTOM — fullscreen game engine ===== */
  const SUTOM_MAX = 6;
  const AZERTY = [
    ['A','Z','E','R','T','Y','U','I','O','P'],
    ['Q','S','D','F','G','H','J','K','L','M'],
    ['ENVOI','W','X','C','V','B','N','SUPPR'],
  ];

  function normalizeWord(raw) {
    return (raw || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Za-z]/g,'').toUpperCase();
  }

  function getTodaySutomWord() {
    const today = new Date().toISOString().slice(0,10);
    const entry = state.sutomWords.find(w => w.play_date === today);
    if (entry) return { word: normalizeWord(entry.word), points: Number(entry.points||120) };
    return { word: 'DINOS', points: 100 };
  }

  function sutomInitSession() {
    const today = new Date().toISOString().slice(0,10);
    const { word, points } = getTodaySutomWord();
    const solvedKey = 'bda_sutom_solved_' + today + '_' + word + '_' + (state.user?.email||'guest');
    const alreadySolved = localStorage.getItem(solvedKey) === '1';
    if (!state.sutomSession || state.sutomSession.date !== today || state.sutomSession.word !== word) {
      state.sutomSession = { date: today, word, points, tries: [], solved: alreadySolved, lost: false, currentRow: 0, currentCol: 1 };
    } else {
      state.sutomSession.points = points;
      if (alreadySolved) state.sutomSession.solved = true;
    }
  }

  /* --- Launch card in boutique page --- */
  function renderSutom() {
    const wrap = $('#sutom-widget');
    if (!wrap) return;
    sutomInitSession();
    const s = state.sutomSession;

    const previewCells = s.word.split('').map((ch,i) =>
      '<span class="sutom-preview-cell' + (s.solved ? ' well' : (i === 0 ? '' : ' empty')) + '">' + (s.solved ? escHtml(ch) : (i === 0 ? escHtml(ch) : '')) + '</span>'
    ).join('');

    const canAdminSutom = !!(state.profile && (state.profile.is_super_admin || state.profile.is_admin || state.profile.is_creator));
    wrap.innerHTML =
      '<div class="sutom-launch-card' + (s.solved ? ' solved' : '') + '" id="sutom-launch">' +
        '<div class="sutom-launch-title">SUTOM</div>' +
        '<div class="sutom-launch-sub">' + s.word.length + ' lettres &middot; ' + SUTOM_MAX + ' essais</div>' +
        '<div class="sutom-launch-preview">' + previewCells + '</div>' +
        (s.solved
          ? '<div class="sutom-launch-done">Deja joue aujourd\'hui !</div>'
          : '<div class="sutom-launch-reward">+' + s.points + ' pts</div>') +
      '</div>' +
      (canAdminSutom ? '<button class="sutom-admin-btn" id="sutom-admin-open">Changer le mot (admin)</button>' : '');

    const launch = $('#sutom-launch');
    if (launch && !s.solved) launch.addEventListener('click', openSutomGame);
    const adminBtn = $('#sutom-admin-open');
    if (adminBtn) adminBtn.addEventListener('click', openSutomAdmin);
  }

  /* --- Open fullscreen game modal --- */
  function openSutomGame() {
    sutomInitSession();
    const s = state.sutomSession;
    if (s.solved || s.lost) return;
    const modal = $('#modal-sutom');
    if (!modal) return;
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    // Sub text
    const sub = $('#sutom-modal-sub');
    if (sub) sub.textContent = s.word.length + ' lettres \u00b7 ' + s.points + ' pts';

    buildSutomBoard();
    buildSutomKeyboard();
    restoreSutomTries();

    // Close btn
    const closeBtn = $('#sutom-close-btn');
    if (closeBtn) closeBtn.onclick = closeSutomGame;
    const overlay = modal.querySelector('.modal-overlay');
    if (overlay) overlay.onclick = closeSutomGame;

    // Physical keyboard
    document.addEventListener('keydown', handleSutomKey);
  }

  function closeSutomGame() {
    const modal = $('#modal-sutom');
    if (modal) modal.style.display = 'none';
    document.body.style.overflow = '';
    document.removeEventListener('keydown', handleSutomKey);
    renderSutom();
  }

  /* --- Build the 6-row grid --- */
  function buildSutomBoard() {
    const board = $('#sutom-board');
    if (!board) return;
    const s = state.sutomSession;
    const len = s.word.length;
    board.innerHTML = '';
    for (let r = 0; r < SUTOM_MAX; r++) {
      const row = document.createElement('div');
      row.className = 'sutom-row';
      for (let c = 0; c < len; c++) {
        const cell = document.createElement('span');
        cell.className = 'sutom-cell';
        cell.dataset.row = r; cell.dataset.col = c;
        // First column of current row shows first letter
        if (c === 0 && r === 0) {
          cell.textContent = s.word[0];
          cell.classList.add('first-letter');
        }
        row.appendChild(cell);
      }
      board.appendChild(row);
    }
  }

  /* --- Build AZERTY keyboard --- */
  function buildSutomKeyboard() {
    const kb = $('#sutom-keyboard');
    if (!kb) return;
    kb.innerHTML = '';
    for (const row of AZERTY) {
      const rowEl = document.createElement('div');
      rowEl.className = 'sutom-kb-row';
      for (const key of row) {
        const btn = document.createElement('button');
        btn.className = 'sutom-key';
        btn.dataset.key = key;
        if (key === 'ENVOI' || key === 'SUPPR') btn.classList.add('key-wide');
        btn.textContent = key === 'SUPPR' ? '\u2190' : key === 'ENVOI' ? 'ENVOI' : key;
        btn.addEventListener('click', () => onSutomKeyPress(key));
        rowEl.appendChild(btn);
      }
      kb.appendChild(rowEl);
    }
  }

  /* --- Restore previous tries on reopen --- */
  function restoreSutomTries() {
    const s = state.sutomSession;
    const board = $('#sutom-board');
    if (!board) return;
    s.tries.forEach((guess, rowIdx) => {
      const result = evaluateSutomGuess(guess, s.word);
      const cells = board.querySelectorAll('.sutom-cell[data-row="' + rowIdx + '"]');
      guess.split('').forEach((ch, ci) => {
        if (cells[ci]) {
          cells[ci].textContent = ch;
          cells[ci].classList.add(result[ci]);
        }
      });
    });
    // Set current row/col
    s.currentRow = s.tries.length;
    s.currentCol = 1;
    // First letter hint on current row
    if (s.currentRow < SUTOM_MAX) {
      const firstCell = board.querySelector('[data-row="' + s.currentRow + '"][data-col="0"]');
      if (firstCell) {
        firstCell.textContent = s.word[0];
        firstCell.classList.add('first-letter');
      }
    }
    // Restore keyboard colors
    restoreKeyboardColors();
    // Show end message if needed
    if (s.solved) showSutomMessage('Bravo ! +' + s.points + ' pts', 'win');
    else if (s.tries.length >= SUTOM_MAX) showSutomMessage('Perdu ! Le mot \u00e9tait : ' + s.word, 'lose');
  }

  function restoreKeyboardColors() {
    const s = state.sutomSession;
    const keyStatus = {};
    s.tries.forEach(guess => {
      const result = evaluateSutomGuess(guess, s.word);
      guess.split('').forEach((ch, i) => {
        const st = result[i];
        const cur = keyStatus[ch] || '';
        if (st === 'well') keyStatus[ch] = 'well';
        else if (st === 'present' && cur !== 'well') keyStatus[ch] = 'present';
        else if (st === 'absent' && !cur) keyStatus[ch] = 'absent';
      });
    });
    const kb = $('#sutom-keyboard');
    if (!kb) return;
    kb.querySelectorAll('.sutom-key').forEach(btn => {
      const k = btn.dataset.key;
      if (keyStatus[k]) btn.classList.add('key-' + keyStatus[k]);
    });
  }

  /* --- Evaluate guess (proper Sutom algorithm with letter counting) --- */
  function evaluateSutomGuess(guess, target) {
    const len = target.length;
    const result = new Array(len).fill('absent');
    const targetCounts = {};
    // Count letters in target
    for (const ch of target) targetCounts[ch] = (targetCounts[ch] || 0) + 1;
    // First pass: exact matches (well)
    for (let i = 0; i < len; i++) {
      if (guess[i] === target[i]) {
        result[i] = 'well';
        targetCounts[guess[i]]--;
      }
    }
    // Second pass: present (wrong position)
    for (let i = 0; i < len; i++) {
      if (result[i] === 'well') continue;
      if (targetCounts[guess[i]] && targetCounts[guess[i]] > 0) {
        result[i] = 'present';
        targetCounts[guess[i]]--;
      }
    }
    return result;
  }

  /* --- Keyboard input --- */
  function handleSutomKey(e) {
    if ($('#modal-sutom')?.style.display === 'none') return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'Enter') { e.preventDefault(); onSutomKeyPress('ENVOI'); }
    else if (e.key === 'Backspace') { e.preventDefault(); onSutomKeyPress('SUPPR'); }
    else if (/^[a-zA-Z]$/.test(e.key)) { e.preventDefault(); onSutomKeyPress(e.key.toUpperCase()); }
  }

  function onSutomKeyPress(key) {
    const s = state.sutomSession;
    if (!s || s.solved || s.tries.length >= SUTOM_MAX) return;
    const board = $('#sutom-board');
    if (!board) return;
    const len = s.word.length;

    if (key === 'SUPPR') {
      if (s.currentCol <= 1) return; // Can't delete first letter
      s.currentCol--;
      const cell = board.querySelector('[data-row="' + s.currentRow + '"][data-col="' + s.currentCol + '"]');
      if (cell) { cell.textContent = ''; cell.classList.remove('filled','current'); }
      // Mark new current
      const prev = board.querySelector('[data-row="' + s.currentRow + '"][data-col="' + s.currentCol + '"]');
      if (prev) prev.classList.add('current');
      return;
    }

    if (key === 'ENVOI') {
      if (s.currentCol < len) { shakeRow(s.currentRow); return; }
      submitSutomRow();
      return;
    }

    // Letter input
    if (s.currentCol >= len) return;
    const cell = board.querySelector('[data-row="' + s.currentRow + '"][data-col="' + s.currentCol + '"]');
    if (cell) {
      cell.textContent = key;
      cell.classList.add('filled');
      cell.classList.remove('current');
    }
    s.currentCol++;
    // Mark next as current
    if (s.currentCol < len) {
      const next = board.querySelector('[data-row="' + s.currentRow + '"][data-col="' + s.currentCol + '"]');
      if (next) next.classList.add('current');
    }
  }

  function shakeRow(rowIdx) {
    const board = $('#sutom-board');
    if (!board) return;
    const cells = board.querySelectorAll('.sutom-cell[data-row="' + rowIdx + '"]');
    cells.forEach(c => { c.style.animation = 'none'; c.offsetHeight; c.style.animation = 'sutomShake 0.3s ease'; });
    setTimeout(() => cells.forEach(c => c.style.animation = ''), 350);
  }

  /* --- Submit a row --- */
  async function submitSutomRow() {
    const s = state.sutomSession;
    const board = $('#sutom-board');
    if (!board) return;

    // Collect guess from cells
    let guess = '';
    for (let c = 0; c < s.word.length; c++) {
      const cell = board.querySelector('[data-row="' + s.currentRow + '"][data-col="' + c + '"]');
      guess += (cell?.textContent || '').toUpperCase();
    }
    guess = normalizeWord(guess);
    if (guess.length !== s.word.length) return;

    // First letter must match
    if (guess[0] !== s.word[0]) {
      shakeRow(s.currentRow);
      showSutomMessage('La 1re lettre doit \u00eatre ' + s.word[0], '');
      setTimeout(() => showSutomMessage('', ''), 1500);
      return;
    }

    const result = evaluateSutomGuess(guess, s.word);
    s.tries.push(guess);

    // Animate reveal row
    await revealSutomRow(s.currentRow, guess, result);

    // Update keyboard colors
    updateKeyboardAfterGuess(guess, result);

    const isWin = result.every(r => r === 'well');
    if (isWin) {
      s.solved = true;
      showSutomMessage('Bravo ! +' + s.points + ' pts', 'win');
      await rewardSutomPoints();
    } else if (s.tries.length >= SUTOM_MAX) {
      s.lost = true;
      showSutomMessage('Perdu ! Le mot \u00e9tait : ' + s.word, 'lose');
    } else {
      // Move to next row
      s.currentRow++;
      s.currentCol = 1;
      // Set first letter on new row
      const firstCell = board.querySelector('[data-row="' + s.currentRow + '"][data-col="0"]');
      if (firstCell) {
        firstCell.textContent = s.word[0];
        firstCell.classList.add('first-letter');
      }
    }
  }

  /* --- Animate row reveal (flip each cell sequentially) --- */
  function revealSutomRow(rowIdx, guess, result) {
    return new Promise(resolve => {
      const board = $('#sutom-board');
      if (!board) { resolve(); return; }
      const cells = board.querySelectorAll('.sutom-cell[data-row="' + rowIdx + '"]');
      let i = 0;
      function flipNext() {
        if (i >= cells.length) { resolve(); return; }
        const cell = cells[i];
        const cls = result[i];
        cell.classList.add('reveal');
        setTimeout(() => {
          cell.className = 'sutom-cell ' + cls;
          cell.textContent = guess[i] || '';
          i++;
          flipNext();
        }, 250);
      }
      flipNext();
    });
  }

  function updateKeyboardAfterGuess(guess, result) {
    const kb = $('#sutom-keyboard');
    if (!kb) return;
    guess.split('').forEach((ch, i) => {
      const st = result[i];
      const btn = kb.querySelector('[data-key="' + ch + '"]');
      if (!btn) return;
      if (st === 'well') { btn.classList.remove('key-present','key-absent'); btn.classList.add('key-well'); }
      else if (st === 'present' && !btn.classList.contains('key-well')) { btn.classList.remove('key-absent'); btn.classList.add('key-present'); }
      else if (st === 'absent' && !btn.classList.contains('key-well') && !btn.classList.contains('key-present')) { btn.classList.add('key-absent'); }
    });
  }

  function showSutomMessage(text, type) {
    const el = $('#sutom-message');
    if (!el) return;
    el.textContent = text;
    el.className = 'sutom-message' + (type ? ' ' + type : '');
  }

  /* --- Reward points --- */
  async function rewardSutomPoints() {
    if (state.isGuest || !supabase || !state.user || !state.sutomSession) return;
    const day = state.sutomSession.date;
    const solvedKey = 'bda_sutom_solved_' + day + '_' + state.sutomSession.word + '_' + state.user.email;
    if (localStorage.getItem(solvedKey) === '1') return;
    const points = Number(state.sutomSession.points || 0);
    if (!points) return;
    const { error } = await supabase.rpc('rpc_reward_sutom', {
      p_site_id: SITE_ID,
      p_day: day,
      p_points: points,
    });
    if (!error) {
      localStorage.setItem(solvedKey, '1');
      await loadProfile();
      updateCoins();
      await loadLeaderboard();
      renderClassement();
    }
  }

  /* --- Admin: change active word --- */
  function openSutomAdmin() {
    const modal = $('#modal-sutom-admin');
    if (!modal) return;
    // Pre-fill current word
    const wordInput = $('#sutom-plan-word');
    const ptsInput = $('#sutom-plan-points');
    if (wordInput && state.sutomSession) wordInput.value = state.sutomSession.word;
    if (ptsInput && state.sutomSession) ptsInput.value = state.sutomSession.points;
    modal.style.display = 'flex';
    const saveBtn = $('#sutom-plan-save');
    if (saveBtn) saveBtn.onclick = saveSutomSchedule;
    modal.querySelectorAll('.modal-close-btn').forEach(b => b.onclick = () => { modal.style.display = 'none'; });
    const overlay = modal.querySelector('.modal-overlay');
    if (overlay) overlay.onclick = () => { modal.style.display = 'none'; };
  }

  async function saveSutomSchedule() {
    const word = normalizeWord($('#sutom-plan-word')?.value || '');
    const points = parseInt($('#sutom-plan-points')?.value || '0', 10);
    if (!word || word.length < 4) { toast('Mot trop court (min. 4 lettres).', 'error'); return; }
    if (!points || points < 10) { toast('Points invalides.', 'error'); return; }
    if (!supabase) { toast('Connexion serveur indisponible.', 'error'); return; }
    const today = new Date().toISOString().slice(0,10);
    // Essaie le RPC securise, sinon upsert direct (admin RLS)
    let error;
    const rpcRes = await supabase.rpc('rpc_admin_set_sutom_word', {
      p_site_id: SITE_ID, p_word: word, p_points: points, p_date: today,
    });
    if (rpcRes.error) {
      // RPC pas encore deploye : fallback upsert direct
      const upsertRes = await supabase.from('bda_sutom_words').upsert({
        site_id: SITE_ID, play_date: today, word: word, points: points,
        created_by: state.user?.email || 'admin',
      }, { onConflict: 'site_id,play_date' });
      error = upsertRes.error;
    } else {
      error = rpcRes.error;
    }
    if (error) { toast('Erreur: ' + error.message, 'error'); return; }
    await loadSutomWords();
    // Reset today's session so the new word takes effect
    state.sutomSession = null;
    sutomInitSession();
    const modal = $('#modal-sutom-admin');
    if (modal) modal.style.display = 'none';
    toast('Mot mis \u00e0 jour : ' + word, 'success');
    renderSutom();
  }

  /* ===== HOTLINES — food ordering system ===== */
  async function loadHotlinesConfig() {
    if (!supabase) return;
    const { data } = await supabase.from('bda_hotlines_config').select('*').eq('site_id', SITE_ID).single();
    state.hotlinesConfig = data || { is_active: false };
  }

  async function loadHotlinesMenu() {
    if (!supabase) return;
    const { data } = await supabase.from('bda_hotlines_menu').select('*').eq('site_id', SITE_ID).eq('available', true).order('display_order');
    state.hotlinesMenu = data || [];
  }

  async function loadHotlinesOrders() {
    if (!supabase || state.isGuest) { state.hotlinesOrders = []; return; }
    const isAdmin = state.profile && (state.profile.is_admin || state.profile.is_super_admin || state.profile.is_creator);
    if (isAdmin) {
      const { data } = await supabase.from('bda_hotlines_orders').select('*').eq('site_id', SITE_ID).order('created_at', { ascending: false });
      state.hotlinesOrders = data || [];
    } else {
      const { data } = await supabase.from('bda_hotlines_orders').select('*').eq('site_id', SITE_ID).eq('user_email', state.user.email).order('created_at', { ascending: false }).limit(1);
      state.hotlinesOrders = data || [];
    }
    state.hotlinesMyOrder = state.hotlinesOrders.find(o => o.user_email === (state.user?.email || '')) || null;
  }

  function renderHotlines() {
    const isAdmin = !!(state.profile && (state.profile.is_admin || state.profile.is_super_admin || state.profile.is_creator));
    const isActive = !!(state.hotlinesConfig && state.hotlinesConfig.is_active);

    // Admin bar
    const adminBar = $('#hotlines-admin-bar');
    if (adminBar) {
      adminBar.style.display = isAdmin ? 'block' : 'none';
      const statusText = $('#hotlines-status-text');
      const toggleBtn = $('#hotlines-toggle-btn');
      if (statusText) statusText.textContent = isActive ? 'Hotlines activees' : 'Hotlines desactivees';
      if (toggleBtn) {
        toggleBtn.textContent = isActive ? 'Desactiver' : 'Activer';
        toggleBtn.className = 'hotlines-toggle-btn' + (isActive ? ' active' : '');
      }
    }

    // Mode segmented hotlines button visibility
    const hotlinesBtn = $('#mode-btn-hotlines');
    if (hotlinesBtn) {
      // Always visible for admin, only visible when active for non-admin
      if (!isAdmin && !isActive) {
        hotlinesBtn.style.display = 'none';
      } else {
        hotlinesBtn.style.display = '';
      }
      // Green indicator when user has an order
      if (state.hotlinesMyOrder) {
        hotlinesBtn.classList.add('hotlines-has-order');
      } else {
        hotlinesBtn.classList.remove('hotlines-has-order');
      }
    }

    // Closed message
    const closedMsg = $('#hotlines-closed-msg');
    const menuGrid = $('#hotlines-menu-grid');
    const orderForm = $('#hotlines-order-form');
    const myOrder = $('#hotlines-my-order');
    const orderSection = $('#hotlines-order-section');

    // User already has an order? Show recap
    if (state.hotlinesMyOrder && !isAdmin) {
      if (orderSection) orderSection.style.display = 'none';
      if (myOrder) {
        myOrder.style.display = 'block';
        renderMyOrderRecap();
      }
      return;
    }

    if (orderSection) orderSection.style.display = 'block';
    if (myOrder) myOrder.style.display = 'none';

    if (!isActive && !isAdmin) {
      if (closedMsg) closedMsg.style.display = 'block';
      if (menuGrid) menuGrid.style.display = 'none';
      if (orderForm) orderForm.style.display = 'none';
      return;
    }

    if (closedMsg) closedMsg.style.display = 'none';
    if (menuGrid) menuGrid.style.display = '';

    // Render menu
    if (menuGrid) {
      if (state.hotlinesMenu.length === 0) {
        menuGrid.innerHTML = '<div class="empty-state"><p>Aucun plat disponible</p></div>';
      } else {
        menuGrid.innerHTML = state.hotlinesMenu.map(item => {
          const qty = state.hotlinesCart[item.id] || 0;
          return '<div class="hotlines-menu-item">' +
            (item.image_url ? '<img src="' + escAttr(item.image_url) + '" alt="" class="hotlines-item-img">' : '<div class="hotlines-item-img-placeholder"></div>') +
            '<div class="hotlines-item-info">' +
              '<div class="hotlines-item-name">' + escHtml(item.name) + '</div>' +
              (item.description ? '<div class="hotlines-item-desc">' + escHtml(item.description) + '</div>' : '') +
            '</div>' +
            '<div class="hotlines-qty-ctrl">' +
              '<button class="qty-btn qty-minus" data-item-id="' + item.id + '">-</button>' +
              '<span class="qty-value">' + qty + '</span>' +
              '<button class="qty-btn qty-plus" data-item-id="' + item.id + '">+</button>' +
            '</div>' +
          '</div>';
        }).join('');

        menuGrid.querySelectorAll('.qty-plus').forEach(btn => {
          btn.addEventListener('click', () => {
            const id = parseInt(btn.dataset.itemId);
            state.hotlinesCart[id] = (state.hotlinesCart[id] || 0) + 1;
            renderHotlines();
          });
        });
        menuGrid.querySelectorAll('.qty-minus').forEach(btn => {
          btn.addEventListener('click', () => {
            const id = parseInt(btn.dataset.itemId);
            if (state.hotlinesCart[id] > 0) state.hotlinesCart[id]--;
            renderHotlines();
          });
        });
      }
    }

    // Show order form if any item is selected
    const totalItems = Object.values(state.hotlinesCart).reduce((a, b) => a + b, 0);
    if (orderForm) {
      orderForm.style.display = totalItems > 0 ? 'block' : 'none';
    }

    // Cart summary
    if (totalItems > 0 && orderForm) {
      const summary = $('#hotlines-cart-summary');
      if (summary) {
        let lines = [];
        for (const [id, qty] of Object.entries(state.hotlinesCart)) {
          if (qty <= 0) continue;
          const item = state.hotlinesMenu.find(m => m.id === parseInt(id));
          if (!item) continue;
          lines.push(escHtml(item.name) + ' x' + qty);
        }
        summary.innerHTML = lines.map(l => '<div class="cart-line">' + l + '</div>').join('');
      }
    }
  }

  function renderMyOrderRecap() {
    const container = $('#hotlines-my-order-content');
    if (!container || !state.hotlinesMyOrder) return;
    const o = state.hotlinesMyOrder;
    const items = o.items || [];
    container.innerHTML =
      '<div class="order-recap-card order-confirmed">' +
        '<div class="order-recap-badge">Commande validee</div>' +
        '<div class="order-recap-info">' +
          '<div><strong>' + escHtml(o.prenom) + ' ' + escHtml(o.nom) + '</strong></div>' +
          '<div>Tel : ' + escHtml(o.telephone) + '</div>' +
          '<div>Lieu : ' + escHtml(o.lieu) + '</div>' +
        '</div>' +
        '<div class="order-recap-items">' +
          items.map(i => '<div class="order-recap-line">' + escHtml(i.name) + ' x' + i.qty + '</div>').join('') +
        '</div>' +
      '</div>';
  }

  function initHotlines() {
    // Toggle active
    const toggleBtn = $('#hotlines-toggle-btn');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', async () => {
        if (!supabase) return;
        const newState = !(state.hotlinesConfig && state.hotlinesConfig.is_active);
        // Upsert config
        const { error } = await supabase.from('bda_hotlines_config').upsert({
          site_id: SITE_ID, is_active: newState, updated_by: state.user?.email || 'admin',
        }, { onConflict: 'site_id' });
        if (error) { toast('Erreur: ' + error.message, 'error'); return; }
        if (!state.hotlinesConfig) state.hotlinesConfig = {};
        state.hotlinesConfig.is_active = newState;
        toast(newState ? 'Hotlines activees !' : 'Hotlines desactivees.', 'success');
        renderHotlines();
      });
    }

    // Manage menu
    const manageBtn = $('#hotlines-manage-menu');
    if (manageBtn) manageBtn.addEventListener('click', openHotlinesMenuAdmin);

    // Dashboard
    const dashBtn = $('#hotlines-view-dashboard');
    if (dashBtn) dashBtn.addEventListener('click', openHotlinesDashboard);

    // Submit order
    const submitBtn = $('#hotlines-submit-order');
    if (submitBtn) submitBtn.addEventListener('click', submitHotlinesOrder);

    // File input in menu admin
    const hmImage = $('#hm-image');
    if (hmImage) hmImage.addEventListener('change', () => {
      const name = hmImage.files[0]?.name || '';
      const label = $('#hm-image-name');
      if (label) label.textContent = name;
    });

    // Add menu item
    const addBtn = $('#hm-add-btn');
    if (addBtn) addBtn.addEventListener('click', addHotlinesMenuItem);
  }

  async function submitHotlinesOrder() {
    if (state.isGuest) { toast('Connecte-toi pour commander.', 'error'); return; }
    if (!supabase) return;

    const nom = $('#hotlines-nom')?.value.trim();
    const prenom = $('#hotlines-prenom')?.value.trim();
    const telephone = $('#hotlines-telephone')?.value.trim();
    const lieu = $('#hotlines-lieu')?.value.trim();

    if (!nom || !prenom || !telephone || !lieu) { toast('Remplis tous les champs.', 'error'); return; }

    const items = [];
    for (const [id, qty] of Object.entries(state.hotlinesCart)) {
      if (qty <= 0) continue;
      const item = state.hotlinesMenu.find(m => m.id === parseInt(id));
      if (!item) continue;
      items.push({ menu_id: item.id, name: item.name, qty });
    }

    if (items.length === 0) { toast('Ajoute des plats a ta commande.', 'error'); return; }

    const { error } = await supabase.from('bda_hotlines_orders').insert({
      site_id: SITE_ID,
      user_email: state.user.email,
      nom, prenom, telephone, lieu,
      items, total: 0,
      status: 'pending',
    });
    if (error) { toast('Erreur: ' + error.message, 'error'); return; }

    toast('Commande envoyee !', 'success');
    state.hotlinesCart = {};
    await loadHotlinesOrders();
    renderHotlines();
  }

  /* --- Admin: menu management --- */
  function openHotlinesMenuAdmin() {
    const modal = $('#modal-hotlines-menu');
    if (!modal) return;
    modal.style.display = 'flex';
    renderHotlinesMenuAdmin();
  }

  async function renderHotlinesMenuAdmin() {
    // Reload all menu items (including unavailable ones for admin)
    if (!supabase) return;
    const { data } = await supabase.from('bda_hotlines_menu').select('*').eq('site_id', SITE_ID).order('display_order');
    const allMenuItems = data || [];

    const list = $('#hotlines-menu-admin-list');
    if (!list) return;

    if (allMenuItems.length === 0) {
      list.innerHTML = '<p style="color:var(--text-dim);font-size:0.85rem">Aucun plat dans le menu.</p>';
      return;
    }

    list.innerHTML = allMenuItems.map(item =>
      '<div class="hm-admin-item">' +
        (item.image_url ? '<img src="' + escAttr(item.image_url) + '" class="hm-admin-img">' : '') +
        '<div class="hm-admin-info">' +
          '<div class="hm-admin-name">' + escHtml(item.name) + '</div>' +
        '</div>' +
        '<button class="hm-admin-del" data-item-id="' + item.id + '">X</button>' +
      '</div>'
    ).join('');

    list.querySelectorAll('.hm-admin-del').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = parseInt(btn.dataset.itemId);
        await supabase.from('bda_hotlines_menu').delete().eq('id', id);
        toast('Plat supprime', 'success');
        renderHotlinesMenuAdmin();
        await loadHotlinesMenu();
        renderHotlines();
      });
    });
  }

  async function addHotlinesMenuItem() {
    if (!supabase) return;
    const name = $('#hm-name')?.value.trim();
    const desc = $('#hm-desc')?.value.trim() || '';
    const price = 0;
    const fileInput = $('#hm-image');

    if (!name) { toast('Nom du plat requis.', 'error'); return; }

    let imageUrl = '';
    if (fileInput && fileInput.files[0]) {
      try {
        imageUrl = await uploadImageToStorage(fileInput.files[0], 'hotlines');
      } catch (e) { toast('Erreur upload image', 'error'); console.warn('Image upload failed:', e); }
    }

    // Get next display order
    const order = state.hotlinesMenu.length;

    const { error } = await supabase.from('bda_hotlines_menu').insert({
      site_id: SITE_ID, name, description: desc, price, image_url: imageUrl, display_order: order,
    });
    if (error) { toast('Erreur: ' + error.message, 'error'); return; }

    toast('Plat ajoute !', 'success');
    // Reset form
    if ($('#hm-name')) $('#hm-name').value = '';
    if ($('#hm-desc')) $('#hm-desc').value = '';

    if (fileInput) fileInput.value = '';
    if ($('#hm-image-name')) $('#hm-image-name').textContent = '';

    await loadHotlinesMenu();
    renderHotlinesMenuAdmin();
    renderHotlines();
  }

  /* --- Admin: dashboard --- */
  function openHotlinesDashboard() {
    const modal = $('#modal-hotlines-dashboard');
    if (!modal) return;
    modal.style.display = 'flex';
    renderHotlinesDashboard();
  }

  async function renderHotlinesDashboard() {
    await loadHotlinesOrders();
    const orders = state.hotlinesOrders;

    // Stats
    const statsEl = $('#hotlines-dashboard-stats');
    if (statsEl) {
      const totalOrders = orders.length;
      const pending = orders.filter(o => o.status === 'pending').length;
      const delivered = orders.filter(o => o.status === 'delivered').length;
      statsEl.innerHTML =
        '<div class="dash-stat"><span class="dash-stat-value">' + totalOrders + '</span><span class="dash-stat-label">Commandes</span></div>' +
        '<div class="dash-stat"><span class="dash-stat-value">' + pending + '</span><span class="dash-stat-label">En attente</span></div>' +
        '<div class="dash-stat"><span class="dash-stat-value">' + delivered + '</span><span class="dash-stat-label">Livrees</span></div>';
    }

    // Order list
    const listEl = $('#hotlines-dashboard-list');
    if (!listEl) return;

    if (orders.length === 0) {
      listEl.innerHTML = '<p style="color:var(--text-dim);font-size:0.85rem">Aucune commande.</p>';
      return;
    }

    listEl.innerHTML = orders.map(o => {
      const items = o.items || [];
      const statusClass = o.status === 'delivered' ? 'delivered' : o.status === 'pending' ? 'pending' : '';
      return '<div class="dash-order ' + statusClass + '">' +
        '<div class="dash-order-header">' +
          '<strong>' + escHtml(o.prenom) + ' ' + escHtml(o.nom) + '</strong>' +
          '<span class="dash-order-status">' + (o.status === 'delivered' ? 'Livree' : 'En attente') + '</span>' +
        '</div>' +
        '<div class="dash-order-meta">Tel: ' + escHtml(o.telephone) + ' | Lieu: ' + escHtml(o.lieu) + '</div>' +
        '<div class="dash-order-items">' +
          items.map(i => escHtml(i.name) + ' x' + i.qty).join(', ') +
        '</div>' +
        (o.status !== 'delivered' ? '<button class="btn-sm btn-primary dash-deliver-btn" data-order-id="' + o.id + '">Marquer livree</button>' : '') +
      '</div>';
    }).join('');

    listEl.querySelectorAll('.dash-deliver-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const orderId = parseInt(btn.dataset.orderId);
        await supabase.from('bda_hotlines_orders').update({ status: 'delivered' }).eq('id', orderId);
        toast('Commande marquee livree', 'success');
        renderHotlinesDashboard();
      });
    });
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
    var packIdx = state.packs.indexOf(pack);
    var eggTier = packIdx <= 0 ? 'green' : packIdx === 1 ? 'purple' : 'gold';
    egg.className = 'pack-egg egg-' + eggTier;
    egg.innerHTML = getEggSVG(eggTier);
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

    // Animate: idle wobble -> intensify -> shake hard -> crack
    setTimeout(() => { egg.classList.add('shake-1'); }, 600);
    setTimeout(() => { egg.classList.remove('shake-1'); egg.classList.add('shake-2'); }, 1600);
    setTimeout(() => { egg.classList.remove('shake-2'); egg.classList.add('shake-3'); }, 2400);
    setTimeout(() => { egg.classList.add('cracking'); }, 3200);

    // After egg cracks, show sequential card stage
    setTimeout(() => {
      egg.style.display = 'none';
      stage.style.display = 'flex';
      $('#pack-reveal-total').textContent = drawnCards.length;
      $('#pack-reveal-count').textContent = '0';
      const container = $('#pack-card-container');
      container.classList.remove('summary-mode');
      container.innerHTML = '<div class="pack-tap-prompt">Touche pour r\u00e9v\u00e9ler</div>';
      container.onclick = revealNextCard;
    }, 4000);

    closeBtn.onclick = () => {
      modal.style.display = 'none';
      Promise.all([loadUserCards(), loadProfile()]).then(() => {
        updateCoins();
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
          showPackSummary();
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
            </div>
          </div>
        </div>
      `;
      requestAnimationFrame(() => {
        container.querySelector('.normal-flip-card').classList.add('flipped');
      });
      if (state.packRevealIndex >= cards.length) {
        setTimeout(() => { showPackSummary(); }, 700);
      }
    }
  }

  function showPackSummary() {
    var cards = state.packRevealCards;
    var container = $('#pack-card-container');
    container.onclick = null;
    container.classList.add('summary-mode');
    var html = '';
    for (var si = 0; si < cards.length; si++) {
      var sc = cards[si];
      html += '<div class="pack-summary-item' + (sc.is_shiny ? ' shiny' : '') + '" style="animation-delay:' + (si * 0.06) + 's">' +
        '<div class="pack-grid-card' + (sc.is_shiny ? ' shiny' : '') + ' flipped">' +
          '<div class="pack-grid-card-inner">' +
            '<div class="pack-grid-card-back"><span>?</span></div>' +
            '<div class="pack-grid-card-front">' +
              (sc.image_url ? '<img src="' + escAttr(sc.image_url) + '" alt="">' : '<div style="font-size:28px;color:var(--text-dim)">?</div>') +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="pack-summary-card-name">' + escHtml(sc.name) + (sc.is_shiny ? '<span class="pack-summary-shiny"> S</span>' : '') + '</div>' +
      '</div>';
    }
    container.innerHTML = html;
    $('#pack-close').style.display = 'block';
  }

  function drawCardsFromPack(pack) {
    // Merge admin cards + approved custom cards
    var available = state.cards.slice();
    var approvedCustom = state.customCards.filter(function(c) { return c.approved; });
    for (var ci = 0; ci < approvedCustom.length; ci++) {
      var cc = approvedCustom[ci];
      available.push({
        id: 'custom_' + cc.id,
        name: cc.card_name || cc.name || 'Carte custom',
        image_url: cc.image_url || '',
        is_shiny: false,
        card_number: 9000 + ci,
      });
    }
    if (available.length === 0) return [];

    // Variable card count: base ± 1-2
    var base = pack.cards_count || 5;
    var variance = Math.floor(base * 0.3) || 1;
    var count = base + Math.floor(Math.random() * (variance * 2 + 1)) - variance;
    if (count < 2) count = 2;
    if (count > 12) count = 12;

    var drawn = [];
    for (var i = 0; i < count; i++) {
      var isShiny = Math.random() < (pack.shiny_chance || 0.01);
      var pool = available.filter(function(c) { return c.is_shiny === isShiny; });
      if (pool.length === 0) pool = available.filter(function(c) { return !c.is_shiny; });
      if (pool.length === 0) pool = available;
      var card = pool[Math.floor(Math.random() * pool.length)];
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
      <div class="info-stat-row"><span class="info-stat-label">Chance Shiny</span><span class="info-stat-value">${((pack.shiny_chance || 0.01) * 100).toFixed(0)}%</span></div>
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
      ctx.fillText('ðŸƒ', W / 2, 210);
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
    link.download = (name || 'carte').replace(/[^a-zA-Z0-9àâéèêëîïôùûç_-]/gi, '_') + '.jpg';
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
      if (!badge) return '';
      var icon = getBadgeSVG(badge.condition_type) || badge.icon;
      return '<span class="lb-badge" title="' + escAttr(badge.name) + '">' + icon + '</span>';
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
  const DEFI_LEVELS = [
    {
      id: 'niveau1', name: 'NIVEAU 1 : Petit Raptor', sub: 'D\u00e9fis d\'\u00e9chauffement \u2014 10 \u00e0 50 Points',
      groups: [
        { points: 10, items: [
          { t: 'Ramener un gros b\u00e2ton \u00e0 notre Aprem Rez (+5 si d\u00e9cor\u00e9) (+20 si vainqueur du concours)', tag: 'Standard' },
          { t: 'Draguer Tanguy sobre (+15 point si smack \u00e0 la fin, consenti sinon Oscar)', tag: 'Standard' },
          { t: 'Demander \u00e0 Timoth\u00e9e de noter son outfit (de la personne qui demande) sur 10 (+15 si 10/10)', tag: 'Standard' },
          { t: 'Se mettre du vernis vert fonc\u00e9 (+5 sur les pieds, +5 si envoy\u00e9 \u00e0 Cyrielle (que les pieds))', tag: 'Standard' },
          { t: 'Expliquer \u00e0 Pauline pourquoi il faut \u00e9goutter son riz', tag: 'Standard' },
          { t: 'Tunnel Cyrielle sur le Cac40', tag: 'Standard' },
          { t: 'Demander \u00e0 Bastien comment s\'est pass\u00e9 son WEL', tag: 'Standard' },
          { t: 'Apporter un candy\'up \u00e0 Candy', tag: 'Standard' },
          { t: 'Expliquer l\'importance du tri s\u00e9lectif et son principe \u00e0 Bastien B\u00e9couarn', tag: 'DD' },
          { t: 'Planter une plante', tag: 'DD' },
          { t: 'Expliquer \u00e0 Eliott que Vald c\'est surcot\u00e9', tag: 'Standard' },
          { t: 'Expliquer \u00e0 Anne Joly pourquoi elle est jolie', tag: 'Standard' },
        ]},
        { points: 50, items: [
          { t: 'Trouver au moins 5 faux raccords du film (+2 point par faux raccord suppl\u00e9mentaire)', tag: 'Standard' },
          { t: 'Se poster en faisant la danse de liste en story insta avec musique', tag: 'Standard' },
          { t: 'Faire le poisson sur le bar en torchtot', tag: 'Standard' },
          { t: 'Offrir un plat picard \u00e0 Le Picart', tag: 'Standard' },
          { t: 'Ramener une manivelle \u00e0 Ga\u00ebtan Manouvel', tag: 'Standard' },
          { t: 'Offrir de la nourriture au matcha \u00e0 Kimlee', tag: 'Standard' },
          { t: 'Faire un po\u00e8me pour Yann (il en veut plein)', tag: 'Standard' },
          { t: 'Donner son vrai compte (appli de rencontre) pendant 15 minutes \u00e0 Manu, Yann, Bastien ou Eliott', tag: 'Standard' },
          { t: 'Offrir un Brie Soyeux \u00e0 Ana\u00efs Brissieux', tag: 'Standard' },
          { t: 'Manger des macaroni en Cuccaroni', tag: 'Standard' },
          { t: 'Ramener des cacahu\u00e8tes et une Goudale \u00e0 Manu (pour le go\u00fbter)', tag: 'Standard' },
          { t: 'Faire un d\u00e9bat houleux sur qui gagne entre un T-Rex et un spinosaure et s\'\u00e9nerver vraiment fort en torchot', tag: 'Standard' },
          { t: 'Mettre en bio insta "plus sauvage qu\'un T-Rex..." pendant les campagnes', tag: 'Standard' },
          { t: 'Passer une journ\u00e9e de cours en chausson', tag: 'Standard' },
          { t: 'Chanter une chanson en arabe \u00e0 Ismail le beau gosse', tag: 'Standard' },
          { t: 'Donner de la nourriture en forme de dinosaure \u00e0 Ambre', tag: 'Standard' },
          { t: 'Ecrire un po\u00e8me en portugais \u00e0 Jade', tag: 'Standard' },
          { t: 'Enterrer un os pour occuper les futurs arch\u00e9ologues', tag: 'Standard' },
          { t: 'Offrir un cubi de ros\u00e9 \u00e0 Nicolas', tag: 'Standard' },
          { t: 'Offrir de la peinture marron \u00e0 Yann le peintre', tag: 'Standard' },
          { t: 'Gagner un 1v1 \u00e0 brawlhalla contre Ana\u00efs', tag: 'Standard' },
          { t: 'Faire dire \u00e0 une personne de l\'autre liste que les Din\'s sont mieux', tag: 'Standard' },
          { t: 'Offrir un dessin de Tyrannus \u00e0 Ana\u00eblle', tag: 'Standard' },
          { t: 'Offrir du bicarbonate de soude \u00e0 Anouk', tag: 'Standard' },
          { t: 'Faire un film sur Marie', tag: 'Standard' },
          { t: 'Apprendre les deux chansons des dins (10 points par chanson)', tag: 'Standard' },
          { t: 'Trouver combien de temps a pris la voiture de Ga\u00ebtan pour arriver au WEL', tag: 'Standard' },
          { t: 'Trouver combien de temps d\'avance a pris la voiture de Yann pour arriver au WEL', tag: 'Standard' },
          { t: 'Ramener un caf\u00e9 chaud (avec lait et un peu de sucre) \u00e0 Ingrid', tag: 'Standard' },
          { t: '\u00c9crire "votez Din\'s" sur 5 tableaux dans Centrale', tag: 'Standard' },
          { t: 'Faire dire \u00e0 un inconnu "votez Dinz"', tag: 'Standard' },
          { t: 'Faire un dessert (g\u00e2teau/p\u00e2tisserie/etc) vegan \u00e0 Pauline', tag: 'DD' },
          { t: 'Faire un c\u00e2lin \u00e0 un arbre pendant 15 minutes', tag: 'DD' },
          { t: 'Ramener son propre mug et ses propres couverts et assiettes toute la semaine', tag: 'DD' },
        ]},
      ],
    },
    {
      id: 'niveau2', name: 'NIVEAU 2 : Chasseur de la Jungle', sub: 'D\u00e9fis Interm\u00e9diaires \u2014 100 \u00e0 200 Points',
      groups: [
        { points: 100, items: [
          { t: 'Faire un \u00e9dit sur Gaetan Manouvel qui fait foot (+10 pour la meilleure prestation)', tag: 'Standard' },
          { t: 'Venir \u00e0 notre aprem Rez / Venir \u00e0 notre torchtot / Venir \u00e0 notre fin d\'aprem', tag: 'Standard' },
          { t: '\u00c9tablir une correspondance entre Jeffrey Epstein et les dinos sur wikipedia', tag: 'Standard' },
          { t: '5 selfies avec des chauves', tag: 'Standard' },
          { t: 'Imprimer Pops le Tric\u00e9ratops au fablab', tag: 'Standard' },
          { t: 'Offrir un tutu rose \u00e0 manu, et le forcer \u00e0 le porter', tag: 'Standard' },
          { t: 'Faire un photomontage cringe de kendji girac en dinosaure et le poster sans contexte en story insta', tag: 'Standard' },
          { t: '\u00catre habill\u00e9 en vert toutes les campagnes', tag: 'Standard' },
          { t: 'Tunelle un madz/croco en lui expliquant que le vert des din\'s est bien plus beau', tag: 'Standard' },
          { t: 'Manger un piment en torchtot', tag: 'Standard' },
          { t: 'Battre Nicolas en cul-sec de 30 cl de ros\u00e9', tag: 'Standard' },
          { t: 'Draguer luri avec un air de guitare', tag: 'Standard' },
          { t: 'Voler les chaussures d\'\u00c9douard et les donner \u00e0 Amicie sans contexte', tag: 'Standard' },
          { t: 'Venir avec l\'objet le plus al\u00e9atoire \u00e0 la place du cartable en cours (bonus de 10 si performance remarquable)', tag: 'Standard' },
          { t: 'Gossiper un truc \u00e9norme, attention risque de diffusion (point variable)', tag: 'Standard' },
          { t: 'Faire une danse orientale \u00e0 Ismail', tag: 'Standard' },
          { t: 'Demander un autographe \u00e0 un inconnu "parce qu\'il est c\u00e9l\u00e8bre" (+10 point si vous arrivez \u00e0 vous faire signer sur le corps...)', tag: 'Standard' },
          { t: 'Dire "aller les Dinz" dans le groupe familial', tag: 'Standard' },
          { t: 'Faire du papier recycl\u00e9 et noter un cours dessus', tag: 'DD' },
          { t: 'Laver ses v\u00eatements dans la fontaine de grand\' place (+10 bonus si pleine journ\u00e9e)', tag: 'DD' },
          { t: 'Trouver le compte insta secret de la liste et s\'abonner', tag: 'Standard' },
          { t: 'Reproduire la sc\u00e8ne de combat du film', tag: 'Standard' },
        ]},
        { points: 200, items: [
          { t: 'Trouver qq de plus petit que Pauline (il doit \u00eatre majeur)', tag: 'Standard' },
          { t: 'Marquer un coup franc de plus de 20 m avec Gaetan comme gardien', tag: 'Standard' },
          { t: 'Battre Tanguy 1vs1 au basket', tag: 'Standard' },
          { t: 'Deviner la bi\u00e8re pr\u00e9f\u00e9r\u00e9e du respo bi\u00e8re (Eliott) et lui en ramener', tag: 'Standard' },
          { t: '\u00c9tablir une correspondance g\u00e9n\u00e9alogique entre Annael Lebel et Fran\u00e7ois Lebel', tag: 'Standard' },
          { t: 'Lancer une chenille de plus de 10 personnes dans le cours d\'honneur \u00e0 Centrale', tag: 'Standard' },
          { t: 'Faire une tier liste des races (de dinosaures) et l\'expliquer sur sanstrash', tag: 'Standard' },
          { t: 'Pr\u00e9parer un expos\u00e9 avec pdf/slides sur son dinosaure pr\u00e9f\u00e9r\u00e9 et le pr\u00e9senter sur sanstrash', tag: 'Standard' },
          { t: 'Se filmer en train de tunnel une personne dans la rue sur les dinosaures, et lui expliquer qu\'avec un peu de technique, un pt\u00e9ranodon peut tuer un T-Rex', tag: 'Standard' },
          { t: 'Faire une soir\u00e9e avec un panneau free hug', tag: 'Standard' },
          { t: 'Vid\u00e9o de ses darons qui crient "votez Din\'s"', tag: 'Standard' },
          { t: 'Se faire une green face (se peindre le visage en vert)', tag: 'Standard' },
          { t: 'Mettre un filtre soutien actif', tag: 'Standard' },
          { t: 'Faire un "ventriglisse"', tag: 'Standard' },
          { t: 'Faire la trend non patch\u00e9 : crier dans la rue pour que les gens te regarde, et prendre ensuite une photo pour aura farm', tag: 'Standard' },
          { t: 'Faire un before \u00e0 l\'un de nos event avec des bi\u00e8res et de la nourriture achet\u00e9es \u00e0 biocoop ou \u00e0 nous anti gaspi', tag: 'DD' },
          { t: 'Passer litt\u00e9ralement 24h avec un v\u00e9lo (le ramener avec soi dans centrale, dans sa chambre etc)', tag: 'DD' },
          { t: 'Avoir un temps d\'\u00e9cran de t\u00e9l\u00e9phone d\'1h00 par jour, pendant 3 jours', tag: 'DD' },
        ]},
      ],
    },
    {
      id: 'niveau3', name: 'NIVEAU 3 : Poids Lourd du Jurassique', sub: 'D\u00e9fis Difficiles \u2014 300 \u00e0 400 Points',
      groups: [
        { points: 300, items: [
          { t: 'Gagner 5.50 \u20ac en pratiquant son art dans la rue', tag: 'Standard' },
          { t: 'Courir 3 tours de la rez avec d\u00e9marches v\u00e9lociraptors + crie tr\u00e8s fort', tag: 'Standard' },
          { t: 'Faire un don du sang', tag: 'Standard' },
        ]},
        { points: 350, items: [
          { t: 'Faire une caricature d\'un prof de Centrale et lui offrir', tag: 'Standard' },
          { t: 'Venir \u00e0 un cours de L3 math \u00e0 la place de Manu (il peut vous fournir les dates de cours) (+bonus si se fait passer pour lui)', tag: 'Standard' },
          { t: 'Demander \u00e0 10 personnes dans la rue si "tu me trouves charismatique ?"', tag: 'Standard' },
          { t: 'Congeler de la pisse dans un ecocup et laisser fondre le gla\u00e7on sur le rebord de sa fen\u00eatre', tag: 'Standard' },
          { t: 'Avoir les cartes collectors d\'un p\u00f4le (D\u00e9m, Event, Log, Comm) (+20 par p\u00f4le suppl\u00e9mentaire)', tag: 'Standard' },
          { t: 'Se coller/scotcher sur la porte de centrale pour militer sur l\'\u00e9cologie', tag: 'DD' },
          { t: 'Faire une toilette s\u00e8che avec des copeaux de bois (pas dans la rez), derri\u00e8re un buisson et l\'utiliser', tag: 'DD' },
        ]},
        { points: 400, items: [
          { t: 'Se filmer en achetant des pr\u00e9servatifs au V2, et dire au caissier qu\'\u00e0 centrale, \u00e7a baise \u00e9norm\u00e9ment', tag: 'Standard' },
        ]},
      ],
    },
    {
      id: 'niveau4', name: 'NIVEAU 4 : Pr\u00e9dateur Alpha', sub: 'D\u00e9fis Experts \u2014 500 \u00e0 750 Points',
      groups: [
        { points: 500, items: [
          { t: 'Se prendre en photo devant un squelette d\'un dinosaure dans un mus\u00e9e', tag: 'Standard' },
        ]},
        { points: 750, items: [
          { t: 'Avoir les cartes collector du bureau (Prez, Trez, Screz, VPI, VPE, Vice-Trez)', tag: 'Standard' },
        ]},
      ],
    },
    {
      id: 'niveau5', name: 'NIVEAU 5 : L\'Extinction', sub: 'D\u00e9fis L\u00e9gendaires \u2014 900 \u00e0 1000 Points',
      groups: [
        { points: 900, items: [
          { t: 'Se raser un sourcil', tag: 'Standard' },
        ]},
        { points: 1000, items: [
          { t: 'Se faire tatouer un dinosaure (+100 point si vous vous le faites)', tag: 'Standard' },
          { t: 'Se faire une vasectomie pour ne pas avoir d\'enfant', tag: 'DD' },
        ]},
      ],
    },
  ];

  function renderDefis() {
    const container = $('#defis-list');
    if (!container) return;

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

    // Also render DB-based challenges if admin has created any (admin tools)
    const completedIds = new Set(state.validations.map(v => v.challenge_id));

    let levels = DEFI_LEVELS;
    if (state.defiFilter !== 'all') {
      levels = levels.filter(l => l.id === state.defiFilter);
    }

    // Search filter
    const searchQuery = ($('#defi-search')?.value || '').trim().toLowerCase();
    const normalize = function(s) { return (s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase(); };

    let html = '';
    let defiIdx = 0;
    for (const level of levels) {
      let levelHtml = '';
      for (const group of level.groups) {
        let groupHtml = '';
        for (const item of group.items) {
          if (searchQuery && normalize(item.t).indexOf(normalize(searchQuery)) === -1) continue;
          const tagClass = item.tag === 'DD' ? 'tag-dd' : 'tag-standard';
          groupHtml += '<div class="defi-card' + (state.isAdmin ? ' defi-admin-clickable' : '') + '" data-static-defi="' + defiIdx + '" data-static-pts="' + group.points + '" data-static-title="' + escAttr(item.t) + '">' +
            '<div class="defi-top"><div class="defi-title">' + escHtml(item.t) + '<span class="defi-tag ' + tagClass + '">' + escHtml(item.tag) + '</span></div><div class="defi-points ' + level.id + '">' + group.points + ' pts</div></div>' +
            (state.isAdmin ? '<div class="defi-admin-actions"><button class="defi-btn-validate-static" data-static-pts="' + group.points + '" data-static-title="' + escAttr(item.t) + '">Valider pour un joueur</button></div>' : '') +
            '</div>';
          defiIdx++;
        }
        if (groupHtml) {
          levelHtml += '<div class="defi-points-divider">' + group.points + ' POINTS</div>' + groupHtml;
        }
      }
      if (levelHtml) {
        html += '<div class="defi-level-section">' +
          '<div class="defi-level-header ' + level.id + '">' + escHtml(level.name) +
          '<span class="defi-level-pts">' + level.groups.map(function(g) { return g.points; }).join(' - ') + ' pts</span>' +
          '<div class="defi-level-sub">' + escHtml(level.sub) + '</div></div>' +
          '<div class="defi-level-body">' + levelHtml + '</div></div>';
      }
    }

    // Append DB challenges below if any (for admin validation)
    if (state.challenges.length > 0 && state.isAdmin) {
      html += '<div class="defi-level-header niveau1">D\u00e9fis personnalis\u00e9s (admin)<div class="defi-level-sub">D\u00e9fis cr\u00e9\u00e9s depuis l\'interface admin</div></div>';
      for (const ch of state.challenges) {
        if (searchQuery && normalize(ch.titre).indexOf(normalize(searchQuery)) === -1) continue;
        const done = completedIds.has(ch.id);
        html += '<div class="defi-card"><div class="defi-top"><div class="defi-title">' + escHtml(ch.titre) + '</div><div class="defi-points ' + (ch.difficulte || 'facile') + '">' + (ch.points || 0) + ' pts</div></div>';
        html += '<div class="defi-desc">' + escHtml(ch.description) + '</div>';
        if (done) html += '<div class="defi-status">D\u00e9fi compl\u00e9t\u00e9</div>';
        html += '<div class="defi-admin-actions"><button class="defi-btn-validate" data-validate-ch="' + ch.id + '">Valider</button><button class="defi-btn-edit" data-edit-ch="' + ch.id + '">Editer</button><button class="defi-btn-delete" data-delete-ch="' + ch.id + '">Suppr.</button></div></div>';
      }
    }

    if (!html) {
      html = '<div class="empty-state"><div class="empty-state-icon">--</div><p>Aucun d\u00e9fi trouv\u00e9</p></div>';
    }

    container.innerHTML = html;

    // Admin handlers for DB challenges
    container.querySelectorAll('.defi-btn-validate').forEach(btn => {
      btn.addEventListener('click', () => openValidateModal(parseInt(btn.dataset.validateCh)));
    });
    container.querySelectorAll('.defi-btn-edit').forEach(btn => {
      btn.addEventListener('click', () => openChallengeEditor(parseInt(btn.dataset.editCh)));
    });
    container.querySelectorAll('.defi-btn-delete').forEach(btn => {
      btn.addEventListener('click', () => deleteChallenge(parseInt(btn.dataset.deleteCh)));
    });
    // Admin handlers for static defis
    container.querySelectorAll('.defi-btn-validate-static').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        openStaticDefiValidateModal(btn.dataset.staticTitle, parseInt(btn.dataset.staticPts));
      });
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
    const searchInput = $('#defi-search');
    if (searchInput) {
      let debounce;
      searchInput.addEventListener('input', () => {
        clearTimeout(debounce);
        debounce = setTimeout(() => renderDefis(), 200);
      });
    }
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

  async function openStaticDefiValidateModal(title, points) {
    if (!state.isAdmin) return;
    $('#validate-challenge-name').textContent = title + ' (' + points + ' pts)';

    const select = $('#validate-user-select');
    select.innerHTML = '<option value="">Choisir un joueur\u2026</option>';
    state.allUsers.forEach(u => {
      const opt = document.createElement('option');
      opt.value = u.email;
      opt.textContent = u.pseudo || u.email;
      select.appendChild(opt);
    });

    $('#btn-confirm-validate').onclick = async () => {
      const email = select.value;
      if (!email) { toast('S\u00e9lectionne un joueur', 'error'); return; }

      const { data, error } = await supabase.rpc('bda_validate_static_defi', {
        p_site_id: SITE_ID,
        p_target_email: email,
        p_points: points,
        p_defi_title: title,
      });

      if (error) { toast('Erreur: ' + error.message, 'error'); return; }
      if (data?.error) { toast('Erreur: ' + data.error, 'error'); return; }

      toast('D\u00e9fi valid\u00e9 ! +' + points + ' pts pour ' + (state.allUsers.find(u => u.email === email)?.pseudo || email), 'success');
      closeAllModals();
      await loadLeaderboard();
      if (email === state.user?.email) { await loadProfile(); updateCoins(); }
      renderClassement();
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
    $('#profil-email').textContent = state.user?.email || state._otpEmail || '';
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
      var icon = getBadgeSVG(badge.condition_type) || badge.icon;
      return `
        <div class="badge-item ${earned ? 'earned' : 'locked'}">
          <div class="badge-icon">${icon}</div>
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
    $('#profil-avatar').addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        toast('Upload en cours...', '');
        try {
          const publicUrl = await uploadImageToStorage(file, 'avatars');
          await supabase.from('etudiants').update({ photo_profil: publicUrl }).eq('id', state.profile.id);
          state.profile.photo_profil = publicUrl;
          // Refresh leaderboard entry so photo appears immediately
          const lbEntry = state.leaderboard.find(p => p.email === state.user.email);
          if (lbEntry) lbEntry.photo_profil = publicUrl;
          toast('Avatar mis \u00e0 jour !', 'success');
          renderProfil();
        } catch (err) {
          console.error('Avatar upload error:', err);
          toast('Erreur upload: ' + (err.message || err), 'error');
        }
      };
      input.click();
    });

    // Card creator
    initCardCreator();

    // Change password
    $('#btn-change-password').addEventListener('click', async () => {
      const newPw = $('#new-password').value;
      const confirmPw = $('#confirm-password').value;
      if (!newPw || !confirmPw) { toast('Remplis les deux champs.', 'error'); return; }
      if (newPw.length < 6) { toast('Minimum 6 caracteres.', 'error'); return; }
      if (newPw !== confirmPw) { toast('Les mots de passe ne correspondent pas.', 'error'); return; }
      if (!supabase) { toast('Connexion serveur indisponible.', 'error'); return; }
      const { error } = await supabase.auth.updateUser({ password: newPw });
      if (error) { toast('Erreur: ' + error.message, 'error'); return; }
      toast('Mot de passe mis a jour !', 'success');
      $('#new-password').value = '';
      $('#confirm-password').value = '';
    });
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
        try {
          imageUrl = await uploadImageToStorage(selectedFile, 'custom-cards');
        } catch (e) {
          console.warn('Image upload failed:', e);
          toast('Erreur upload image', 'error');
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

  function getBadgeSVG(conditionType) {
    var svgs = {
      cards_collected: '<svg viewBox="0 0 32 32" width="28" height="28"><rect x="4" y="2" width="18" height="24" rx="3" fill="none" stroke="#22c55e" stroke-width="2"/><rect x="8" y="5" width="18" height="24" rx="3" fill="none" stroke="#4ade80" stroke-width="2"/><path d="M12 14l2 2 4-4" stroke="#22c55e" stroke-width="2" fill="none" stroke-linecap="round"/></svg>',
      shiny_collected: '<svg viewBox="0 0 32 32" width="28" height="28"><rect x="6" y="4" width="20" height="24" rx="3" fill="none" stroke="#f59e0b" stroke-width="2"/><path d="M16 10l1.5 3 3.5.5-2.5 2.5.5 3.5L16 18l-3 1.5.5-3.5L11 13.5l3.5-.5z" fill="#fbbf24" stroke="#f59e0b" stroke-width="1"/></svg>',
      all_normal: '<svg viewBox="0 0 32 32" width="28" height="28"><rect x="5" y="3" width="22" height="26" rx="3" fill="none" stroke="#60a5fa" stroke-width="2"/><path d="M11 10h10M11 15h10M11 20h6" stroke="#60a5fa" stroke-width="1.5" stroke-linecap="round"/><circle cx="23" cy="23" r="5" fill="#22c55e" stroke="none"/><path d="M21 23l1.5 1.5 3-3" stroke="white" stroke-width="1.5" fill="none" stroke-linecap="round"/></svg>',
      all_shiny: '<svg viewBox="0 0 32 32" width="28" height="28"><path d="M16 4l3.5 7 7.5 1-5.5 5.5 1.5 7.5L16 21l-7 4 1.5-7.5L5 12l7.5-1z" fill="none" stroke="#f59e0b" stroke-width="2"/><path d="M16 10l1.8 3.6 4 .6-2.9 2.8.7 3.9L16 18.5l-3.6 1.9.7-3.9-2.9-2.8 4-.6z" fill="#fbbf24"/></svg>',
      all_cards: '<svg viewBox="0 0 32 32" width="28" height="28"><path d="M8 22l8-16 8 16z" fill="none" stroke="#c084fc" stroke-width="2" stroke-linejoin="round"/><circle cx="16" cy="16" r="3" fill="#c084fc"/><path d="M6 25h20" stroke="#c084fc" stroke-width="2" stroke-linecap="round"/></svg>',
    };
    return svgs[conditionType] || null;
  }

  function getEggSVG(tier, size) {
    var w = size || 120;
    var h = Math.round(w * 1.3);
    var colors = {
      green:  { shell: '#4ade80', shade: '#22c55e', spot: '#166534', glow: '#4ade8066' },
      purple: { shell: '#c084fc', shade: '#a855f7', spot: '#581c87', glow: '#c084fc66' },
      gold:   { shell: '#fbbf24', shade: '#f59e0b', spot: '#92400e', glow: '#fbbf2466' },
    };
    var c = colors[tier] || colors.green;
    return '<svg viewBox="0 0 100 130" width="' + w + '" height="' + h + '" xmlns="http://www.w3.org/2000/svg">' +
      '<defs>' +
        '<radialGradient id="eg-' + tier + '" cx="40%" cy="35%" r="60%">' +
          '<stop offset="0%" stop-color="#fff" stop-opacity="0.4"/>' +
          '<stop offset="100%" stop-color="' + c.shade + '" stop-opacity="0"/>' +
        '</radialGradient>' +
        '<filter id="eg-glow-' + tier + '"><feDropShadow dx="0" dy="0" stdDeviation="6" flood-color="' + c.glow + '"/></filter>' +
      '</defs>' +
      '<ellipse cx="50" cy="72" rx="40" ry="55" fill="' + c.shell + '" filter="url(#eg-glow-' + tier + ')"/>' +
      '<ellipse cx="50" cy="72" rx="40" ry="55" fill="url(#eg-' + tier + ')"/>' +
      '<ellipse cx="35" cy="55" rx="8" ry="10" fill="' + c.spot + '" opacity="0.35" transform="rotate(-15 35 55)"/>' +
      '<ellipse cx="62" cy="45" rx="6" ry="8" fill="' + c.spot + '" opacity="0.25" transform="rotate(10 62 45)"/>' +
      '<ellipse cx="55" cy="80" rx="9" ry="7" fill="' + c.spot + '" opacity="0.3" transform="rotate(5 55 80)"/>' +
      (tier === 'gold' ? '<ellipse cx="50" cy="60" rx="12" ry="4" fill="#fff" opacity="0.25" transform="rotate(-8 50 60)"/>' : '') +
      (tier === 'purple' ? '<path d="M38 65 Q50 50 62 65" stroke="' + c.spot + '" stroke-width="2" fill="none" opacity="0.3"/>' : '') +
      '<ellipse cx="38" cy="42" rx="12" ry="18" fill="#fff" opacity="0.12" transform="rotate(-20 38 42)"/>' +
    '</svg>';
  }

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

  /* --- Client-side image compress + EXIF rotation fix --- */
  function compressImage(file, maxW, maxH, quality) {
    maxW = maxW || 1200; maxH = maxH || 1200; quality = quality || 0.82;
    return new Promise(function (resolve) {
      var reader = new FileReader();
      reader.onload = function (e) {
        var img = new Image();
        img.onload = function () {
          var w = img.width, h = img.height;
          if (w > maxW || h > maxH) {
            var ratio = Math.min(maxW / w, maxH / h);
            w = Math.round(w * ratio); h = Math.round(h * ratio);
          }
          var canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          var ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          canvas.toBlob(function (blob) {
            resolve(blob || file);
          }, 'image/jpeg', quality);
        };
        img.onerror = function () { resolve(file); };
        img.src = e.target.result;
      };
      reader.onerror = function () { resolve(file); };
      reader.readAsDataURL(file);
    });
  }

  /* --- Upload image to Supabase Storage (with compression) --- */
  async function uploadImageToStorage(file, folder) {
    var blob = await compressImage(file, 1200, 1200, 0.82);
    var safeName = folder + '/' + SITE_ID + '/' + Date.now() + '.jpg';
    var uploadFile = new File([blob], safeName.split('/').pop(), { type: 'image/jpeg' });
    var result = await supabase.storage.from('sites').upload(safeName, uploadFile, { upsert: true, contentType: 'image/jpeg' });
    if (result.error) throw result.error;
    var pub = supabase.storage.from('sites').getPublicUrl(safeName);
    return pub.data.publicUrl;
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
    initHotlines();
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
