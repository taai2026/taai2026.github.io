/* Newsroom: render the media coverage list from assets/data/press-coverage.json.
   Values are written with textContent / setAttribute only (never innerHTML).
   Without JavaScript, or if the data cannot be loaded, the page keeps its
   static empty-state message. */
(() => {
  const root = document.querySelector('[data-press-coverage]');
  if (!root || !window.fetch) return;
  const zh = root.dataset.locale === 'zh';
  const TYPES = {
    news: ['新聞報導', 'News'], interview: ['專訪', 'Interview'], feature: ['專題', 'Feature'],
    broadcast: ['廣播／電視', 'Broadcast'], blog: ['部落格', 'Blog'],
    'press-release-repost': ['新聞稿轉載', 'Press release'],
  };
  const pick = v => (v && typeof v === 'object' ? (zh ? v.zh || v.en : v.en || v.zh) : v) || '';
  const valid = it => it && typeof it.title === 'string' && it.title.trim() &&
    typeof it.url === 'string' && /^https:\/\//.test(it.url) &&
    /^\d{4}-\d{2}-\d{2}$/.test(it.publishedAt || '') && pick(it.outlet);
  const fmt = iso => {
    const [y, m, d] = iso.split('-').map(Number);
    return zh ? `${y} 年 ${m} 月 ${d} 日`
      : new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
  };
  const message = (text, cls) => {
    const p = document.createElement('p');
    p.className = cls;
    p.textContent = text;
    root.replaceChildren(p);
  };

  fetch(root.dataset.src, { cache: 'no-cache' })
    .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(data => {
      const items = (Array.isArray(data?.items) ? data.items : []).filter(valid)
        .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
      const count = document.querySelector('[data-press-count]');
      if (count) count.textContent = items.length ? (zh ? `（${items.length}）` : `(${items.length})`) : '';
      if (!items.length) { message(root.dataset.empty, 'news-empty-state'); return; }
      const ul = document.createElement('ul');
      ul.className = 'press-coverage-list';
      for (const it of items) {
        const li = document.createElement('li');
        const meta = document.createElement('p');
        meta.className = 'press-coverage-meta';
        const time = document.createElement('time');
        time.dateTime = it.publishedAt;
        time.textContent = fmt(it.publishedAt);
        const outlet = document.createElement('strong');
        outlet.textContent = pick(it.outlet);
        meta.append(time, ' · ', outlet);
        const type = TYPES[it.type];
        if (type) meta.append(' · ', zh ? type[0] : type[1]);
        const title = document.createElement('p');
        title.className = 'press-coverage-title';
        const a = document.createElement('a');
        a.href = it.url;
        a.target = '_blank';
        a.rel = 'noopener';
        if (it.language) a.lang = it.language;
        a.textContent = it.title;
        const sr = document.createElement('span');
        sr.className = 'sr-only';
        sr.textContent = zh ? '（外部網站，另開新分頁）' : ' (external site, opens in a new tab)';
        a.append(sr);
        title.append(a);
        li.append(meta, title);
        ul.append(li);
      }
      root.replaceChildren(ul);
    })
    .catch(err => {
      console.error('[press] coverage list unavailable', err);
      message(root.dataset.error, 'news-error-state');
    });
})();
