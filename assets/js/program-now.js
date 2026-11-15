/* TAAI 2026 — "Happening now / Up next" box on the program page.
   Reads the static timetables (table.glance, one per day) so the box always
   matches what the page shows, then renders with safe DOM APIs. The time
   logic lives in program-now-core.js (TAAINowNext). Labels and the
   conference dates come from the mount's data attributes, so this file
   holds no page text. Supports ?now=2026-11-20T10:45+08:00 for previews. */
(function () {
  "use strict";
  const core = window.TAAINowNext;
  const mount = document.querySelector("[data-now-next]");
  const tables = document.querySelectorAll("table.glance");
  if (!core || !mount || !tables.length) return;

  const days = (mount.dataset.days || "").split(/\s+/).filter(Boolean);
  const TIME = /^\s*(\d{2}:\d{2})\s*[-–]\s*(\d{2}:\d{2})\s*$/;

  const clean = s => s.replace(/\s+/g, " ").trim();
  const textWithout = (el, selector) => {
    const c = el.cloneNode(true);
    c.querySelectorAll(selector).forEach(n => n.remove());
    return clean(c.textContent);
  };

  // Room label per column, from the header row ("Room A · 2F Lijing Hall A").
  function headers(table) {
    return [...table.tHead.rows[0].cells].map(th => {
      const sub = th.querySelector("small");
      const main = textWithout(th, "small, .sr-only");
      return sub ? `${main} · ${textWithout(sub, ".sr-only")}` : main;
    });
  }

  function parse() {
    const items = [];
    let order = 0;
    tables.forEach((table, d) => {
      const date = days[d];
      if (!date || !table.tBodies[0]) return;
      const heads = headers(table);
      const rows = [...table.tBodies[0].rows];
      const rowTimes = rows.map(r => {
        const m = r.cells[0] && r.cells[0].textContent.match(TIME);
        return m ? [m[1], m[2]] : null;
      });
      rows.forEach((row, ri) => {
        if (!rowTimes[ri]) return;
        let col = 0;
        [...row.cells].forEach((cell, ci) => {
          const span = cell.colSpan || 1;
          if (ci === 0) { col = 1; return; }
          const startCol = col;
          col += span;
          if (cell.classList.contains("g-dup")) return;
          // A cell may carry its own time (e.g. a 10:10-12:00 block).
          let start = rowTimes[ri][0], end = rowTimes[ri][1];
          const lastRow = Math.min(ri + (cell.rowSpan || 1) - 1, rows.length - 1);
          if (rowTimes[lastRow]) end = rowTimes[lastRow][1];
          let own = null;
          const walker = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT);
          for (let n = walker.nextNode(); n; n = walker.nextNode()) {
            const m = n.textContent.match(TIME);
            if (m) own = { start: m[1], end: m[2] };
          }
          if (own) { start = own.start; end = own.end; }
          // Title: the cell's main line; for linked sessions add the talk
          // title or subtitle. Chairs, times and [locations] stay out.
          const link = cell.querySelector('a[href^="#"]');
          const base = link || cell;
          const mainText = clean([...base.childNodes]
            .filter(n => n.nodeType === Node.TEXT_NODE).map(n => n.textContent).join(" "));
          const talk = base.querySelector(":scope > .g-talk");
          const sub = base.querySelector(":scope > small:not(.g-chair)");
          // first line only: a <br> may be followed by the block's own time
          const subText = sub ? clean(([...sub.childNodes].find(n => n.nodeType === Node.TEXT_NODE && n.textContent.trim()) || {}).textContent || "") : "";
          const usableSub = link && subText && !TIME.test(subText) && !/^\[.*\]$/.test(subText) ? subText : "";
          const title = [mainText, talk ? clean(talk.textContent) : usableSub].filter(Boolean).join(" · ");
          const speaker = talk && usableSub ? usableSub : "";
          if (!title) return;
          // Room: the cell's own label, a [location] note, or the column.
          let room = cell.dataset.room || "";
          const bracket = cell.querySelector("small") &&
            textWithout(cell.querySelector("small"), ".sr-only").match(/^\[(.+)\]$/);
          if (!room && bracket) room = bracket[1];
          if (!room && span < heads.length - 1) room = heads[startCol] || "";
          if (!room && cell.classList.contains("g-plenary")) room = heads[1] || "";
          const chair = cell.querySelector(".g-chair");
          items.push({
            start: core.at(date, start), end: core.at(date, end),
            label: `${start}–${end}`, day: d + 1,
            title, room, chair: [speaker, chair ? clean(chair.textContent) : ""].filter(Boolean).join(" · "),
            href: link ? link.getAttribute("href") : "", cell, order: order++
          });
        });
      });
    });
    return items;
  }

  const items = parse();
  if (!items.length) return;

  const params = new URLSearchParams(location.search);
  const preview = Date.parse(params.get("now") || "");
  const offset = Number.isNaN(preview) ? 0 : preview - Date.now();
  const clock = () => Date.now() + offset;

  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text) n.textContent = text;
    return n;
  };

  function list(group) {
    const ul = el("ul", "nn-list");
    group.forEach(i => {
      const li = el("li");
      const name = i.href ? el("a", "nn-title", i.title) : el("span", "nn-title", i.title);
      if (i.href) name.href = i.href;
      li.appendChild(name);
      const meta = [i.label, i.room, i.chair].filter(Boolean).join(" · ");
      if (meta) li.appendChild(el("small", "nn-meta", meta));
      ul.appendChild(li);
    });
    return ul;
  }

  function render() {
    const now = clock();
    items.forEach(i => i.cell.classList.remove("is-now"));
    if (!core.isLive(items, now)) { mount.hidden = true; return; }
    const { current, next } = core.nowNext(items, now);
    current.forEach(i => i.cell.classList.add("is-now"));
    mount.replaceChildren();
    const ds = mount.dataset;
    const head = el("p", "nn-kicker", ds.labelKicker || "");
    mount.appendChild(head);
    const blockNow = el("div", "nn-block nn-now");
    blockNow.appendChild(el("h2", "nn-h", ds.labelNow));
    blockNow.appendChild(current.length ? list(current) : el("p", "nn-empty", ds.labelNone || ""));
    mount.appendChild(blockNow);
    if (next.length) {
      const blockNext = el("div", "nn-block nn-next");
      const taipeiDay = ms => new Date(ms + 8 * 3600000).toISOString().slice(0, 10);
      const dayTag = taipeiDay(next[0].start) !== taipeiDay(now) ? ` (${ds[`labelDay${next[0].day}`] || ""})` : "";
      blockNext.appendChild(el("h2", "nn-h", `${ds.labelNext} · ${next[0].label.split("–")[0]}${dayTag}`));
      blockNext.appendChild(list(next));
      mount.appendChild(blockNext);
    }
    mount.hidden = false;
  }

  render();
  setInterval(render, 60000);
})();
