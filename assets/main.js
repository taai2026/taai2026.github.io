/* ==========================================================================
   TAAI 2026 — Shared JS
   ========================================================================== */

(function () {
  'use strict';

  /* ---- Navigation: mobile drawer + dropdown groups ---- */
  const toggle = document.querySelector('.nav-toggle');
  const links = document.querySelector('.nav-links');
  const primaryNav = document.getElementById('primary-nav');
  const groups = document.querySelectorAll('.nav-group');
  const mobileQuery = window.matchMedia('(max-width: 1100px)');
  const isMobile = () => mobileQuery.matches;

  const setGroupOpen = (group, open) => {
    group.classList.toggle('open', open);
    const btn = group.querySelector('.nav-drop-btn');
    if (btn) btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  };

  // One group open at a time (mobile accordion; also collapses
  // click-opened groups on desktop)
  const closeGroups = (except) => {
    groups.forEach(g => {
      if (g !== except) setGroupOpen(g, false);
    });
  };

  if (toggle && links) {
    const navInner = toggle.closest('.nav-inner');
    // Localized labels come from the page markup so shared JS never
    // writes English text into non-English pages; <html lang> is the
    // fallback for pages missing the data attributes
    const isZh = (document.documentElement.lang || '').toLowerCase().indexOf('zh') === 0;
    const labelOpen = toggle.dataset.labelOpen || (isZh ? '開啟選單' : 'Open menu');
    const labelClose = toggle.dataset.labelClose || (isZh ? '關閉選單' : 'Close menu');
    const textOpen = toggle.dataset.textOpen || (isZh ? '選單' : 'Menu');
    const textClose = toggle.dataset.textClose || (isZh ? '關閉' : 'Close');
    const toggleText = toggle.querySelector('.nav-toggle-text') || toggle.querySelector('.sr-only');
    const hasIcon = !!toggle.querySelector('.nav-toggle-icon');

    // aria-hidden only marks the closed drawer on mobile; the desktop
    // nav must never carry it
    const syncNavHidden = () => {
      if (!primaryNav) return;
      if (isMobile() && !links.classList.contains('open')) {
        primaryNav.setAttribute('aria-hidden', 'true');
      } else {
        primaryNav.removeAttribute('aria-hidden');
      }
    };

    const setMenu = (open) => {
      links.classList.toggle('open', open);
      document.body.classList.toggle('menu-open', open);
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      toggle.setAttribute('aria-label', open ? labelClose : labelOpen);
      if (toggleText) {
        toggleText.textContent = open ? textClose : textOpen;
      } else if (!hasIcon) {
        toggle.textContent = open ? textClose : textOpen;
      }
      if (!open) {
        closeGroups();
        // never leave focus inside an aria-hidden drawer
        if (links.contains(document.activeElement)) toggle.focus();
      }
      syncNavHidden();
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

    // Close on outside click — includes taps on the drawer backdrop
    document.addEventListener('click', (e) => {
      if (!links.classList.contains('open')) return;
      if (navInner && !navInner.contains(e.target)) setMenu(false);
    });

    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (links.classList.contains('open')) setMenu(false);
      else closeGroups();
    });

    // Crossing the breakpoint: close the drawer and clear mobile-only
    // aria state in both directions. window resize doubles as a fallback
    // where the media-query change event is unreliable.
    const onViewportChange = () => {
      if (!isMobile() && links.classList.contains('open')) {
        setMenu(false);
      } else {
        syncNavHidden();
      }
    };

    mobileQuery.addEventListener('change', () => {
      closeGroups();
      onViewportChange();
    });

    window.addEventListener('resize', onViewportChange);

    syncNavHidden();
  }

  if (groups.length) {
    groups.forEach(g => {
      const btn = g.querySelector('.nav-drop-btn');
      if (!btn) return;
      btn.addEventListener('click', () => {
        const open = !g.classList.contains('open');
        closeGroups(g);
        setGroupOpen(g, open);
      });
    });

    document.addEventListener('click', (e) => {
      if (![...groups].some(g => g.contains(e.target))) closeGroups();
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

  /* ---- Conference phase (drives hero CTAs and start-here cards) ----
     submission → until Sep 28 23:59 AoE · earlybird → until Oct 31 23:59 AoE
     regular → until Nov 13 23:59 AoE · conference → until the conference ends
     (Nov 21 18:00 Taipei) · post → afterwards.
     Any element with data-phase="a b" is shown only in those phases.
     For previews, ?now=2026-11-22T09:00+08:00 renders the page at that instant. */
  const PHASES = [
    ['submission', '2026-09-28T23:59:59-12:00'],
    ['earlybird', '2026-10-31T23:59:59-12:00'],
    ['regular', '2026-11-13T23:59:59-12:00'],
    ['conference', '2026-11-21T18:00:00+08:00'],
    ['post', null]
  ];
  const phaseAt = nowMs => (PHASES.find(([, end]) => !end || nowMs <= Date.parse(end)) || PHASES[PHASES.length - 1])[0];
  const previewNow = Date.parse(new URLSearchParams(location.search).get('now') || '');
  const phaseNow = phaseAt(Number.isNaN(previewNow) ? Date.now() : previewNow);
  document.documentElement.dataset.phase = phaseNow;
  document.querySelectorAll('[data-phase]').forEach(el => {
    if (el === document.documentElement) return;
    el.hidden = !el.dataset.phase.split(/\s+/).includes(phaseNow);
  });

  /* ---- Timeline status tags: auto-update from data-deadline / data-event ----
     <div class="timeline-row" data-deadline="2026-09-14">            deadline: Open → Closed
     <div class="timeline-row" data-deadline="…" data-opens="…">     Upcoming until data-opens, then Open → Closed
     <div class="timeline-row" data-event="2026-10-23">               Upcoming → Completed
     Optional data-tz="+08:00" (default is AoE, UTC-12). Rows without these attributes keep their static tag. */
  const timelineRows = document.querySelectorAll('.timeline-row[data-deadline], .timeline-row[data-event]');
  if (timelineRows.length) {
    const zhPage = /^zh/i.test(document.documentElement.lang || '') || /\/zh\//.test(location.pathname);
    const LABELS = zhPage
      ? { upcoming: '即將到來', open: '開放中', closed: '已截止', done: '已完成' }
      : { upcoming: 'Upcoming', open: 'Open', closed: 'Closed', done: 'Completed' };
    const CLASSES = { upcoming: 'timeline-tag', open: 'timeline-tag hot', closed: 'timeline-tag closed', done: 'timeline-tag closed' };
    const at = (ymd, time, tz) => {
      const t = new Date(`${ymd}T${time}${tz || '-12:00'}`).getTime();
      return Number.isNaN(t) ? null : t;
    };
    const now = Date.now();

    timelineRows.forEach(row => {
      const tag = row.querySelector('.timeline-tag');
      if (!tag) return;
      const tz = row.dataset.tz;
      let state;
      if (row.dataset.event) {
        const end = at(row.dataset.event, '23:59:59', tz);
        if (end === null) return;
        state = now > end ? 'done' : 'upcoming';
      } else {
        const end = at(row.dataset.deadline, '23:59:59', tz);
        if (end === null) return;
        const opens = row.dataset.opens ? at(row.dataset.opens, '00:00:00', tz) : null;
        state = now > end ? 'closed' : (opens !== null && now < opens) ? 'upcoming' : 'open';
      }
      tag.className = CLASSES[state];
      tag.textContent = LABELS[state];
      row.dataset.status = state;
    });
  }

  /* ---- Current year in footer ---- */
  document.querySelectorAll('[data-year]').forEach(el => {
    el.textContent = new Date().getFullYear();
  });

  /* ---- FAQ expand all / collapse all ---- */
  const faqToggleAll = document.getElementById('faq-toggle-all');
  const faqItems = document.querySelectorAll('.faq-item');
  if (faqToggleAll && faqItems.length) {
    const labelExpand = faqToggleAll.dataset.labelExpand || faqToggleAll.textContent;
    const labelCollapse = faqToggleAll.dataset.labelCollapse || labelExpand;
    faqToggleAll.addEventListener('click', () => {
      const shouldExpand = [...faqItems].some(item => !item.open);
      faqItems.forEach(item => { item.open = shouldExpand; });
      faqToggleAll.textContent = shouldExpand ? labelCollapse : labelExpand;
    });
  }

  /* ---- Deep-link to a single FAQ item (e.g. cfp.html#faq-q3) ---- */
  const openFaqFromHash = () => {
    const id = decodeURIComponent(location.hash || '').slice(1);
    if (!id) return;
    const item = document.getElementById(id);
    if (item && item.classList.contains('faq-item')) {
      item.open = true;
      item.scrollIntoView({ block: 'start' });
    }
  };
  if (document.querySelector('.faq-item')) {
    openFaqFromHash();
    window.addEventListener('hashchange', openFaqFromHash);
  }

  /* ---- Data tables: label each cell with its column header so phones can
     show rows as stacked cards (.stack-sm in styles.css). Without this
     script the tables keep their horizontal scroll. ---- */
  document.querySelectorAll('table.fee-table:not(.shuttle-table)').forEach(table => {
    const head = table.tHead && table.tHead.rows[0];
    if (!head) return;
    const labels = [];
    [...head.cells].forEach(th => {
      const clone = th.cloneNode(true);
      clone.querySelectorAll('.th-sub, .sr-only').forEach(n => n.remove());
      const text = clone.textContent.replace(/\s+/g, ' ').trim();
      for (let i = 0; i < th.colSpan; i++) labels.push(text);
    });
    let hasLongCell = false;
    [...table.tBodies].forEach(body => [...body.rows].forEach(row => {
      let col = 0;
      [...row.cells].forEach(cell => {
        if (cell.tagName === 'TD' && labels[col]) {
          cell.dataset.label = labels[col];
          if (cell.textContent.trim().length > 32) hasLongCell = true;
        }
        col += cell.colSpan;
      });
    }));
    table.classList.add('stack-sm');
    // Long answers read better with the label above the value.
    if (hasLongCell) table.classList.add('stack-sm-top');
  });

  /* ---- Back to top (long pages, phones) ---- */
  const main = document.getElementById('main-content');
  if (main) {
    const zh = (document.documentElement.lang || '').startsWith('zh');
    const toTop = document.createElement('button');
    toTop.type = 'button';
    toTop.className = 'to-top';
    toTop.setAttribute('aria-label', zh ? '回到頁首' : 'Back to top');
    toTop.innerHTML = '<span aria-hidden="true">↑</span>';
    toTop.hidden = true;
    toTop.addEventListener('click', () => {
      window.scrollTo({ top: 0 });
      main.focus({ preventScroll: true });
    });
    document.body.appendChild(toTop);
    let ticking = false;
    const updateToTop = () => {
      ticking = false;
      const longPage = document.documentElement.scrollHeight > window.innerHeight * 4;
      toTop.hidden = !(longPage && window.scrollY > window.innerHeight * 2);
    };
    window.addEventListener('scroll', () => {
      if (!ticking) { ticking = true; requestAnimationFrame(updateToTop); }
    }, { passive: true });
    updateToTop();
  }

})();
