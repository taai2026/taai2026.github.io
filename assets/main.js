/* ==========================================================================
   TAAI 2026 — Shared JS
   ========================================================================== */

(function () {
  'use strict';

  /* ---- Mobile nav toggle ---- */
  const toggle = document.querySelector('.nav-toggle');
  const links = document.querySelector('.nav-links');
  if (toggle && links) {
    const navInner = toggle.closest('.nav-inner');
    const isMobile = () => window.matchMedia('(max-width: 960px)').matches;
    const setMenu = (open) => {
      links.classList.toggle('open', open);
      document.body.classList.toggle('menu-open', open);
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      toggle.textContent = open ? 'Close' : 'Menu';
    };

    toggle.addEventListener('click', () => {
      setMenu(!links.classList.contains('open'));
    });

    // Close on link click (mobile)
    links.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', () => {
        if (isMobile()) setMenu(false);
      });
    });

    // Close on outside click, Escape, and when resizing back to desktop.
    document.addEventListener('click', (e) => {
      if (!links.classList.contains('open')) return;
      if (navInner && !navInner.contains(e.target)) setMenu(false);
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && links.classList.contains('open')) setMenu(false);
    });

    window.addEventListener('resize', () => {
      if (!isMobile() && links.classList.contains('open')) setMenu(false);
    });
  }

  /* ---- Dropdown nav groups ---- */
  const groups = document.querySelectorAll('.nav-group');
  if (groups.length) {
    const mobileQuery = window.matchMedia('(max-width: 960px)');

    const closeGroups = (except) => {
      groups.forEach(g => {
        if (g === except) return;
        g.classList.remove('open');
        const btn = g.querySelector('.nav-drop-btn');
        if (btn && !mobileQuery.matches) btn.setAttribute('aria-expanded', 'false');
      });
    };

    // In the mobile panel the group children are always visible
    const syncMode = () => {
      groups.forEach(g => {
        g.classList.remove('open');
        const btn = g.querySelector('.nav-drop-btn');
        if (btn) btn.setAttribute('aria-expanded', mobileQuery.matches ? 'true' : 'false');
      });
    };
    syncMode();
    mobileQuery.addEventListener('change', syncMode);

    groups.forEach(g => {
      const btn = g.querySelector('.nav-drop-btn');
      if (!btn) return;
      btn.addEventListener('click', () => {
        if (mobileQuery.matches) return;
        const open = !g.classList.contains('open');
        closeGroups(g);
        g.classList.toggle('open', open);
        btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
    });

    document.addEventListener('click', (e) => {
      if (![...groups].some(g => g.contains(e.target))) closeGroups();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeGroups();
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

  // Highlight the group button when one of its children is the current page
  groups.forEach(g => {
    if (g.querySelector('a.active')) {
      const btn = g.querySelector('.nav-drop-btn');
      if (btn) btn.classList.add('active');
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
    cdEl.setAttribute('role', 'timer');
    cdEl.setAttribute('aria-live', 'polite');
    cdEl.innerHTML = ['Days', 'Hours', 'Minutes', 'Seconds'].map(label => `
      <div class="unit">
        <span class="n">00</span>
        <span class="l">${label}</span>
      </div>
    `).join('');
    const values = cdEl.querySelectorAll('.n');

    const tick = () => {
      const now = Date.now();
      const diff = Math.max(0, target - now);
      const parts = [
        Math.floor(diff / 86400000),
        Math.floor((diff % 86400000) / 3600000),
        Math.floor((diff % 3600000) / 60000),
        Math.floor((diff % 60000) / 1000)
      ];
      values.forEach((value, index) => {
        value.textContent = pad(parts[index]);
      });
    };
    tick();
    setInterval(tick, 1000);
  }

  /* ---- Current year in footer ---- */
  document.querySelectorAll('[data-year]').forEach(el => {
    el.textContent = new Date().getFullYear();
  });

})();
