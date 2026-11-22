/* Certificate pages: "Copy link" button (shown only when the Clipboard API
   is available). Copies the page's canonical URL. */
(() => {
  const btn = document.querySelector('[data-copy-link]');
  if (!btn || !navigator.clipboard) return;
  const canonical = document.querySelector('link[rel="canonical"]');
  const url = canonical ? canonical.href : location.href;
  const label = btn.textContent;
  btn.hidden = false;
  btn.setAttribute('aria-live', 'polite');
  btn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(url);
      btn.textContent = btn.dataset.copied || label;
      setTimeout(() => { btn.textContent = label; }, 2000);
    } catch {
      window.prompt(label, url);
    }
  });
})();

/* Certificate index: open an FAQ item when a link or the URL targets it. */
(() => {
  const openTarget = () => {
    const id = decodeURIComponent(location.hash.slice(1));
    const el = id && document.getElementById(id);
    if (el && el.tagName === 'DETAILS') el.open = true;
  };
  openTarget();
  window.addEventListener('hashchange', openTarget);
})();

/* Certificate index: search and award filter. Matching is a normalized
   (NFKC, case-insensitive) substring match on each card's data-search text;
   every word must match. A bare paper ID ("20" or "#20") matches only that
   paper, not #120 or #200. State lives in the URL (?q=…&award=…) so a search
   can be linked, and Back/Forward restore it. Without JavaScript the
   controls stay hidden and the page shows every certificate. */
(() => {
  const root = document.querySelector('[data-cert-search]');
  if (!root) return;
  const input = root.querySelector('[data-cert-q]');
  const chips = [...root.querySelectorAll('[data-award]')];
  const countEl = root.querySelector('[data-cert-count]');
  const clearBtn = root.querySelector('[data-cert-clear]');
  const emptyEl = document.querySelector('[data-cert-empty]');
  const groups = [...document.querySelectorAll('.cert-award')];
  const cards = [...document.querySelectorAll('.cert-card')];
  const awards = new Set(chips.map(c => c.dataset.award).filter(Boolean));
  const norm = s => String(s).normalize('NFKC').toLocaleLowerCase().trim();
  const texts = new Map(cards.map(c => [c, norm(c.dataset.search || c.textContent)]));

  const readUrl = () => {
    const params = new URLSearchParams(location.search);
    const award = params.get('award') || '';
    return { q: params.get('q') || '', award: awards.has(award) ? award : '' };
  };
  let state = readUrl();

  const writeUrl = () => {
    const params = new URLSearchParams(location.search);
    state.q ? params.set('q', state.q) : params.delete('q');
    state.award ? params.set('award', state.award) : params.delete('award');
    const query = params.toString();
    const url = `${location.pathname}${query ? `?${query}` : ''}${location.hash}`;
    if (url !== `${location.pathname}${location.search}${location.hash}`) history.pushState(null, '', url);
  };

  const matches = (card, q) => {
    const id = q.match(/^#?(\d{1,4})$/);
    if (id) return card.dataset.paper === String(Number(id[1]));
    const text = texts.get(card);
    return q.split(/\s+/).every(word => text.includes(word));
  };

  const render = () => {
    const q = norm(state.q);
    let shown = 0;
    groups.forEach(group => {
      const inAward = !state.award || group.dataset.award === state.award;
      let groupShown = 0;
      group.querySelectorAll('.cert-track').forEach(track => {
        let trackShown = 0;
        track.querySelectorAll('.cert-card').forEach(card => {
          const ok = inAward && (!q || matches(card, q));
          card.hidden = !ok;
          if (ok) trackShown += 1;
        });
        track.hidden = trackShown === 0;
        groupShown += trackShown;
      });
      group.hidden = groupShown === 0;
      shown += groupShown;
    });
    const filtered = Boolean(q || state.award);
    countEl.textContent = root.dataset.count.replace('{n}', shown).replace('{total}', cards.length);
    clearBtn.hidden = !filtered;
    emptyEl.hidden = shown !== 0;
    chips.forEach(c => c.setAttribute('aria-pressed', String(c.dataset.award === state.award)));
    if (input.value !== state.q && document.activeElement !== input) input.value = state.q;
  };

  const setState = next => {
    state = { ...state, ...next };
    writeUrl();
    render();
  };

  let timer;
  input.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => setState({ q: input.value.trim() }), 300);
  });
  input.addEventListener('keydown', event => {
    if (event.key === 'Enter') { clearTimeout(timer); setState({ q: input.value.trim() }); }
  });
  root.querySelector('[data-cert-awards]').addEventListener('click', event => {
    const chip = event.target.closest('[data-award]');
    if (chip) setState({ award: chip.dataset.award });
  });
  clearBtn.addEventListener('click', () => {
    clearTimeout(timer);
    input.value = '';
    setState({ q: '', award: '' });
    input.focus();
  });
  window.addEventListener('popstate', () => {
    state = readUrl();
    input.value = state.q;
    render();
  });

  input.value = state.q;
  root.hidden = false;
  render();
})();
