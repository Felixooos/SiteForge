/* SiteForge - Generated JS */

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
