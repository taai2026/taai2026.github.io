/* ==========================================================================
   TAAI 2026 — Shared JS
   ========================================================================== */

(function () {
  'use strict';

  /* ---- Mobile nav toggle ---- */
  const toggle = document.querySelector('.nav-toggle');
  const links  = document.querySelector('.nav-links');
  if (toggle && links) {
    toggle.addEventListener('click', () => {
      const open = links.classList.toggle('open');
      toggle.textContent = open ? 'Close' : 'Menu';
      document.body.style.overflow = open ? 'hidden' : '';
    });
    // Close on link click (mobile)
    links.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', () => {
        if (window.innerWidth <= 900) {
          links.classList.remove('open');
          toggle.textContent = 'Menu';
          document.body.style.overflow = '';
        }
      });
    });
  }

  /* ---- Active nav state (by pathname) ---- */
  const path = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-links a').forEach(a => {
    const href = a.getAttribute('href');
    if (href === path || (path === '' && href === 'index.html')) {
      a.classList.add('active');
    }
  });

  /* ---- Scroll reveal (IntersectionObserver) ---- */
  const revealEls = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add('in');
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    revealEls.forEach(el => io.observe(el));
  } else {
    revealEls.forEach(el => el.classList.add('in'));
  }

  /* ---- Countdown to TAAI 2026 (Nov 20, 2026, 09:00 Asia/Taipei) ---- */
  const cdEl = document.getElementById('countdown');
  if (cdEl) {
    // Taipei is UTC+8 — conference starts Nov 20, 2026 at 09:00 local = Nov 20 01:00 UTC
    const target = new Date('2026-11-20T01:00:00Z').getTime();
    const pad = n => String(n).padStart(2, '0');

    const tick = () => {
      const now  = Date.now();
      const diff = Math.max(0, target - now);
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      cdEl.innerHTML = `
        <div class="unit"><span class="n">${pad(d)}</span><span class="l">Days</span></div>
        <div class="unit"><span class="n">${pad(h)}</span><span class="l">Hours</span></div>
        <div class="unit"><span class="n">${pad(m)}</span><span class="l">Minutes</span></div>
        <div class="unit"><span class="n">${pad(s)}</span><span class="l">Seconds</span></div>
      `;
    };
    tick();
    setInterval(tick, 1000);
  }

  /* ---- Current year in footer ---- */
  document.querySelectorAll('[data-year]').forEach(el => {
    el.textContent = new Date().getFullYear();
  });

})();
