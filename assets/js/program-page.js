/* TAAI 2026 — Paper sessions (program page). The session list is static
   HTML pre-rendered from program.json by scripts/build-program-html.py, so
   it works without JavaScript and is indexable. This script only layers on
   "find your paper" search — across all fields or scoped to title, author,
   keyword, or topic, plus paper-ID lookup — day/type/topic filters,
   click-to-search on authors, keywords and topics, shareable URL state, and
   #session-xxx / #paper-nnn links that clear any filter hiding their
   target.

   A classic (non-module) script on purpose: browsers block module scripts
   on file:// pages, and this page must stay fully usable when opened from
   disk. Fuse.js (pinned, as in news-search.js) is loaded on demand; if it
   cannot load, search falls back to normalized substring matching. */

(function (global) {
"use strict";

const FUSE_URL = "https://cdn.jsdelivr.net/npm/fuse.js@7.5.0/dist/fuse.mjs";
const FUSE_OPTIONS = { includeScore: true, threshold: 0.3, ignoreLocation: true, minMatchCharLength: 2 };

const STRINGS = {
  en: {
    all: "All",
    count: (papers, sessions) => `${papers} paper${papers === 1 ? "" : "s"} in ${sessions} session${sessions === 1 ? "" : "s"}`,
    dayShort: { 1: "Day 1 (Fri, Nov 20)", 2: "Day 2 (Sat, Nov 21)" },
    typeNames: { "international-oral": "International oral", "domestic-oral": "Domestic oral", poster: "Poster", keynote: "Keynotes & panel", invited: "Invited talks", "high-school": "High school", partner: "Partner events", other: "Other sessions" },
    kindNames: { keynote: "Keynote", panel: "Panel", invited: "Invited talk", "high-school": "High school paper", partner: "Partner event", other: "Session" },
    extraTitle: n => `Other program items (${n})`,
    extraCount: n => ` · ${n} other program item${n === 1 ? "" : "s"}`,
    scopeNames: { all: "All fields", title: "Title", author: "Author", affiliation: "Affiliation", keyword: "Keyword", abstract: "Abstract", topic: "Topic" },
    searchAuthor: name => `Show papers by ${name}`,
    searchAffiliation: aff => `Show papers from ${aff}`,
    abstractMore: "Show full abstract",
    abstractLess: "Show less",
    save: "Save",
    saved: "Saved",
    saveLabel: id => `Add paper #${id} to My program`,
    savedLabel: id => `Remove paper #${id} from My program`,
    mine: n => `My program (${n})`,
    mineHint: "Save talks, papers and events to build your own program. Saved items stay in this browser.",
    exportIcs: "Download calendar (.ics)",
    sessionIcs: "Add to calendar",
    sessionIcsLabel: name => `Download ${name} as a calendar event (.ics)`,
    venue: "The Great Roots Forestry Spa Resort, New Taipei City, Taiwan",
    paper: "Paper",
    plenaryRoom: "Plenary Hall · 5F Lishan Hall",
    mineListTitle: "Saved items, by time",
    itemSaveLabel: name => `Add “${name}” to My program`,
    itemSavedLabel: name => `Remove “${name}” from My program`,
    itemIcsLabel: name => `Download “${name}” as a calendar event (.ics)`,
    searchKeyword: kw => `Show papers with keyword “${kw}”`,
    filterTopic: topic => `Show papers in ${topic}`
  },
  zh: {
    all: "全部",
    count: (papers, sessions) => `${sessions} 個場次，共 ${papers} 篇論文`,
    dayShort: { 1: "第 1 天（11/20 五）", 2: "第 2 天（11/21 六）" },
    typeNames: { "international-oral": "國際口頭", "domestic-oral": "國內口頭", poster: "海報", keynote: "主題演講與座談", invited: "特邀場次", "high-school": "高中生", partner: "合作活動", other: "其他場次" },
    kindNames: { keynote: "主題演講", panel: "國際座談", invited: "特邀演講", "high-school": "高中生論文", partner: "合作活動", other: "場次" },
    extraTitle: n => `其他議程（${n}）`,
    extraCount: n => `；另有 ${n} 項其他議程`,
    scopeNames: { all: "全部欄位", title: "題目", author: "作者", affiliation: "單位", keyword: "關鍵字", abstract: "摘要", topic: "主題" },
    searchAuthor: name => `顯示 ${name} 的論文`,
    searchAffiliation: aff => `顯示「${aff}」的論文`,
    abstractMore: "看完整摘要",
    abstractLess: "收合摘要",
    save: "收藏",
    saved: "已收藏",
    saveLabel: id => `將論文 #${id} 加入我的議程`,
    savedLabel: id => `將論文 #${id} 移出我的議程`,
    mine: n => `我的議程（${n}）`,
    mineHint: "收藏主題演講、論文或活動即可建立自己的議程，收藏只保存在這個瀏覽器。",
    exportIcs: "下載行事曆（.ics）",
    sessionIcs: "加入行事曆",
    sessionIcsLabel: name => `下載「${name}」的行事曆檔（.ics）`,
    venue: "大板根森林溫泉酒店，新北市三峽區",
    paper: "論文",
    plenaryRoom: "大會廳 · 5F 麗山廳",
    mineListTitle: "已收藏的項目（依時間排序）",
    itemSaveLabel: name => `將「${name}」加入我的議程`,
    itemSavedLabel: name => `將「${name}」移出我的議程`,
    itemIcsLabel: name => `下載「${name}」的行事曆檔（.ics）`,
    searchKeyword: kw => `顯示關鍵字為「${kw}」的論文`,
    filterTopic: topic => `顯示「${topic}」主題的論文`
  }
};

const PAPER_TYPES = ["international-oral", "domestic-oral", "poster"];
/** Program items outside the paper list that the search also covers. */
const EXTRA_TYPES = ["keynote", "invited", "high-school", "partner", "other"];
const TYPES = [...PAPER_TYPES, ...EXTRA_TYPES];
const DAYS = ["1", "2"];
const SCOPES = ["all", "title", "author", "affiliation", "keyword", "abstract", "topic"];
const TOPICS = ["optimization", "games", "speech", "data-mining", "health", "vision", "nlp", "agents", "security", "education", "other"];
const URL_KEYS = ["q", "in", "day", "type", "topic"];

/** Fuse keys per search scope. */
const SCOPE_KEYS = {
  all: [
    { name: "title", weight: 0.35 },
    { name: "authors", weight: 0.25 },
    { name: "affiliations", weight: 0.15 },
    { name: "keywords", weight: 0.15 },
    { name: "topic", weight: 0.05 },
    { name: "board", weight: 0.05 }
  ],
  title: [{ name: "title", weight: 1 }],
  author: [{ name: "authors", weight: 1 }],
  affiliation: [{ name: "affiliations", weight: 1 }],
  abstract: [{ name: "abstract", weight: 1 }],
  keyword: [{ name: "keywords", weight: 1 }],
  topic: [{ name: "topic", weight: 1 }]
};

/** Scopes where an exact (normalized substring) hit is preferred over fuzzy
 *  matches, so "Ching-Ting Tu" does not also return "Ching-Ting Chen". */
const EXACT_FIRST = { author: "authors", affiliation: "affiliations", keyword: "keywords", abstract: "abstract", topic: "topic" };

/* ---------- pure logic (no DOM) ---------- */

function normalizeSearch(value = "") {
  return String(value).normalize("NFKC").trim().toLocaleLowerCase();
}

/** Returns an async `search(query) -> item[]` over `keys`. Falls back to
 *  normalized substring matching if Fuse.js cannot be loaded. */
async function createSearcher(records, keys) {
  try {
    const { default: Fuse } = await import(FUSE_URL);
    const fuse = new Fuse(records, { ...FUSE_OPTIONS, keys });
    return query => fuse.search(query).map(result => result.item.item);
  } catch (error) {
    console.error("[program] Fuse.js unavailable; using substring fallback", error);
    const text = record => normalizeSearch(keys.flatMap(key => record[key.name] ?? []).join(" "));
    return query => {
      const needle = normalizeSearch(query);
      return records.filter(record => text(record).includes(needle)).map(record => record.item);
    };
  }
}

/** A query like "148" or "#148" is a paper-ID lookup, not a fuzzy search. */
function parsePaperIdQuery(query) {
  const match = normalizeSearch(query).match(/^#?(\d{1,4})$/);
  return match ? Number(match[1]) : null;
}

function parseUrlState(search) {
  const params = new URLSearchParams(search);
  const pick = (key, valid) => (valid.includes(params.get(key)) ? params.get(key) : "");
  return {
    q: params.get("q") || "",
    in: pick("in", SCOPES) === "all" ? "" : pick("in", SCOPES),
    day: pick("day", DAYS),
    type: pick("type", TYPES),
    topic: pick("topic", TOPICS)
  };
}

/** Does a session pass the day/type filters? */
function sessionMatches({ day, type }, session) {
  return (!day || session.day === day) && (!type || session.type === type);
}

/** Records whose field (string or array) contains the query. Latin-script
 *  queries must start at a word boundary ("RAG" ≠ "aveRAGes"); CJK text has
 *  no word boundaries, so it matches as a plain substring. */
function exactMatches(records, field, query) {
  const needle = normalizeSearch(query);
  if (!needle) return [];
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = /^[a-z0-9]/.test(needle) ? new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}`, "u") : null;
  const hit = value => {
    const text = normalizeSearch(value);
    return pattern ? pattern.test(text) : text.includes(needle);
  };
  return records
    .filter(record => [].concat(record[field]).some(hit))
    .map(record => record.item);
}

/* ---------- My program (bookmarks) and calendar export ---------- */

const SAVED_KEY = "taai2026-my-program";

/** Saved paper IDs. Browser storage can be unavailable (private mode,
 *  blocked site data), so failures fall back to an in-page list. */
function loadSaved() {
  try {
    const ids = JSON.parse(window.localStorage.getItem(SAVED_KEY) || "[]");
    if (!Array.isArray(ids)) return new Set();
    // Items are stored by their anchor ID (paper-83, keynote1, session-napai …);
    // early versions stored paper numbers only.
    return new Set(ids.map(id => (Number.isInteger(id) ? `paper-${id}` : id)).filter(id => typeof id === "string" && /^[\w-]+$/.test(id)));
  } catch {
    return new Set();
  }
}

function storeSaved(ids) {
  try {
    window.localStorage.setItem(SAVED_KEY, JSON.stringify([...ids]));
  } catch {
    /* not persisted; the page keeps working */
  }
}

/** "2026-11-20T10:40+08:00" -> "20261120T024000Z" (UTC, RFC 5545). */
function icsDate(iso) {
  return new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function icsText(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Fold content lines at 75 octets (RFC 5545 §3.1), counting UTF-8 bytes. */
function icsFold(line) {
  const encoder = new TextEncoder();
  let out = "";
  let bytes = 0;
  for (const ch of line) {
    const size = encoder.encode(ch).length;
    if (bytes + size > 74) {
      out += "\r\n ";
      bytes = 1;
    }
    out += ch;
    bytes += size;
  }
  return out;
}

/** events: [{ uid, start, end, summary, location, description, url }] */
function buildIcs(events) {
  const stamp = icsDate(new Date().toISOString());
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//TAAI 2026//Program//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH"];
  events.forEach(e => {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${e.uid}`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${icsDate(e.start)}`,
      `DTEND:${icsDate(e.end)}`,
      `SUMMARY:${icsText(e.summary)}`,
      `LOCATION:${icsText(e.location)}`,
      `DESCRIPTION:${icsText(e.description)}`,
      `URL:${e.url}`,
      "END:VEVENT"
    );
  });
  lines.push("END:VCALENDAR");
  return lines.map(icsFold).join("\r\n") + "\r\n";
}

function downloadFile(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ---------- DOM ---------- */

function debounce(fn, wait) {
  let timer = null;
  const debounced = (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
  debounced.cancel = () => clearTimeout(timer);
  return debounced;
}

function writeUrlState(state, { replace = false } = {}) {
  const params = new URLSearchParams(window.location.search);
  URL_KEYS.forEach(key => {
    if (state[key]) params.set(key, state[key]);
    else params.delete(key);
  });
  const query = params.toString();
  const url = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
  window.history[replace ? "replaceState" : "pushState"](state, "", url);
}

function fillSelect(select, options) {
  options.forEach(([value, label]) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    select.append(option);
  });
}

/** Make a static span act as a button (click + Enter/Space). */
function makeActionable(el, label) {
  el.setAttribute("role", "button");
  el.tabIndex = 0;
  el.title = label;
}

async function init() {
  const root = document.getElementById("program-sessions");
  if (!root) return;

  const strings = STRINGS[root.dataset.locale === "zh" ? "zh" : "en"];
  const controls = root.querySelector("[data-ps-controls]");
  const searchInput = root.querySelector("[data-ps-search]");
  const scopeSelect = root.querySelector("[data-ps-scope]");
  const topicSelect = root.querySelector("[data-ps-topic]");
  const daySelect = root.querySelector("[data-ps-day]");
  const chipsEl = root.querySelector("[data-ps-types]");
  const clearBtn = root.querySelector("[data-ps-clear]");
  const countEl = root.querySelector("[data-ps-count]");
  const emptyEl = root.querySelector("[data-ps-empty]");

  const days = [...root.querySelectorAll(".ps-day")];
  const slots = [...root.querySelectorAll(".ps-slot-group")];
  const sessions = [...root.querySelectorAll(".ps-session")].map(el => ({
    el,
    day: el.dataset.day,
    type: el.dataset.type,
    papers: [...el.querySelectorAll(".ps-paper")]
  }));
  if (!controls || !sessions.length) return;

  const text = (el, selector) => el.querySelector(selector)?.textContent || "";
  const records = sessions.flatMap(session => session.papers.map(paper => ({
    item: paper,
    title: text(paper, ".ps-paper-title"),
    authors: [...paper.querySelectorAll(".ps-author")].map(a => a.textContent),
    keywords: [...paper.querySelectorAll(".ps-kw")].map(k => k.textContent),
    affiliations: [...paper.querySelectorAll(".ps-aff")].map(a => a.textContent),
    abstract: text(paper, ".ps-abstract-text").replace(/\s+/g, " ").trim(),
    topic: text(paper, ".ps-paper-topic"),
    board: text(paper, ".ps-paper-when strong")
  })));
  const paperById = new Map(records.map(r => [Number(r.item.id.slice("paper-".length)), r.item]));
  const topicLabels = new Map(records.map(r => [r.item.dataset.topic, r.topic]));
  // Keynotes, invited talks, high-school papers, partner events and sessions
  // that only appear in the timetable; filled in once the page helpers exist.
  const extraRecords = [];
  const otherBox = document.createElement("div");
  otherBox.className = "ps-other-results";
  otherBox.hidden = true;

  const searchers = new Map();
  async function searchIn(scope, query) {
    const field = EXACT_FIRST[scope];
    if (field) {
      const exact = exactMatches(records, field, query);
      if (exact.length) return exact;
    }
    if (scope === "all") {
      // An exact phrase anywhere ("National Taipei University", "Komatani",
      // "Gemini" in an abstract) beats fuzzy matching, which would also
      // return every "National … University". Fuzzy is the fallback for typos.
      const exact = new Set(["title", "authors", "affiliations", "keywords", "topic", "abstract"]
        .flatMap(name => exactMatches(records, name, query)));
      if (exact.size) return [...exact];
    }
    if (!searchers.has(scope)) searchers.set(scope, createSearcher(records, SCOPE_KEYS[scope]));
    return (await searchers.get(scope))(query);
  }

  let state = { q: "", in: "", day: "", type: "", topic: "" };
  // "My program": saved papers live in this browser only, not in the URL.
  const saved = loadSaved();
  let showMine = false;
  let updateSeq = 0;

  async function update() {
    const run = ++updateSeq;
    let matches = null;
    if (state.q) {
      const id = !state.in ? parsePaperIdQuery(state.q) : null;
      matches = new Set(id != null ? [paperById.get(id)].filter(Boolean) : await searchIn(state.in || "all", state.q));
      // A newer update may have finished while this search was building its index.
      if (run !== updateSeq) return;
    }

    let paperCount = 0;
    let sessionCount = 0;
    sessions.forEach(session => {
      let visible = 0;
      const inFilter = sessionMatches(state, session);
      session.papers.forEach(paper => {
        const show = inFilter
          && (!state.topic || paper.dataset.topic === state.topic)
          && (!matches || matches.has(paper))
          && (!showMine || saved.has(paper.id) || saved.has(session.el.id));
        paper.hidden = !show;
        if (show) visible += 1;
      });
      session.el.hidden = !inFilter || ((matches || state.topic || showMine) && !visible);
      if (!session.el.hidden) {
        sessionCount += 1;
        paperCount += visible;
      }
    });
    slots.forEach(slot => { slot.hidden = !slot.querySelector(".ps-session:not([hidden])"); });
    days.forEach(day => { day.hidden = !day.querySelector(".ps-slot-group:not([hidden])"); });

    const extras = extraRecords.filter(r =>
      (state.q || EXTRA_TYPES.includes(state.type))
      && (!state.type || r.kind === state.type)
      && !state.topic
      && (!state.day || r.day === state.day)
      && (!matches || matches.has(r.item))
      && (!showMine || saved.has(r.item.id)));
    renderOther(extras);

    countEl.textContent = strings.count(paperCount, sessionCount) + (extras.length ? strings.extraCount(extras.length) : "");
    emptyEl.hidden = sessionCount !== 0 || extras.length > 0;
  }

  function syncControls() {
    // Only rewrite the box when the query really changed (Back/Forward, clear
    // filters, click-to-search). Rewriting it with the trimmed query while the
    // person is typing would delete the space they just typed ("National |").
    if (searchInput.value.trim() !== state.q) searchInput.value = state.q;
    scopeSelect.value = state.in || "all";
    topicSelect.value = state.topic;
    daySelect.value = state.day;
    chipsEl.querySelectorAll("[data-type]").forEach(chip => {
      chip.setAttribute("aria-pressed", String(chip.dataset.type === state.type));
    });
  }

  async function setState(patch, { pushHistory = true } = {}) {
    state = { ...state, ...patch };
    if (state.in === "all") state.in = "";
    syncControls();
    writeUrlState(state, { replace: !pushHistory });
    await update();
  }

  /** A #session-x / #paper-n link must always land on its target, so any
   *  filter that would hide it is cleared first. */
  async function revealHashTarget() {
    const id = decodeURIComponent(window.location.hash || "").slice(1);
    if (!/^(session|paper)-/.test(id)) return;
    const target = document.getElementById(id);
    if (!target) return;
    if (target.closest("[hidden]")) await setState({ q: "", in: "", day: "", type: "", topic: "" }, { pushHistory: false });
    // A link to one paper shows its whole abstract right away.
    if (target.classList.contains("ps-paper")) target.expandAbstract?.(true);
    target.classList.add("ps-target");
    setTimeout(() => target.classList.remove("ps-target"), 2400);
    target.scrollIntoView({ block: "start", behavior: "instant" });
  }

  /** Bring the controls into view after a click-to-search from deep in the list. */
  function showResults() {
    controls.scrollIntoView({ block: "start", behavior: "instant" });
  }

  // Controls
  fillSelect(scopeSelect, SCOPES.map(s => [s, strings.scopeNames[s]]));
  fillSelect(topicSelect, [["", strings.all], ...TOPICS.filter(t => topicLabels.has(t)).map(t => [t, topicLabels.get(t)])]);
  fillSelect(daySelect, [["", strings.all], ...DAYS.map(d => [d, strings.dayShort[d]])]);
  scopeSelect.addEventListener("change", () => setState({ in: scopeSelect.value }));
  topicSelect.addEventListener("change", () => setState({ topic: topicSelect.value }));
  daySelect.addEventListener("change", () => setState({ day: daySelect.value }));

  [["", strings.all], ...TYPES.map(t => [t, strings.typeNames[t]])].forEach(([type, label]) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "news-chip-filter";
    chip.dataset.type = type;
    chip.setAttribute("aria-pressed", "false");
    chip.textContent = label;
    chipsEl.append(chip);
  });
  chipsEl.addEventListener("click", event => {
    const chip = event.target.closest("[data-type]");
    if (chip) setState({ type: chip.dataset.type });
  });

  const debouncedSearch = debounce(value => setState({ q: value.trim() }), 300);
  searchInput.addEventListener("input", () => debouncedSearch(searchInput.value));
  searchInput.addEventListener("keydown", event => {
    if (event.key === "Enter") {
      debouncedSearch.cancel();
      setState({ q: searchInput.value.trim() });
    }
  });

  clearBtn.addEventListener("click", () => {
    showMine = false;
    mineBtn.setAttribute("aria-pressed", "false");
    mineList.hidden = true;
    setState({ q: "", in: "", day: "", type: "", topic: "" });
  });

  // Click-to-search: authors, affiliations and keywords search their field; a topic filters.
  root.querySelectorAll(".ps-author").forEach(el => makeActionable(el, strings.searchAuthor(el.textContent)));
  root.querySelectorAll(".ps-kw").forEach(el => makeActionable(el, strings.searchKeyword(el.textContent)));
  root.querySelectorAll(".ps-aff").forEach(el => makeActionable(el, strings.searchAffiliation(el.textContent)));
  root.querySelectorAll(".ps-paper-topic").forEach(el => makeActionable(el, strings.filterTopic(el.textContent)));

  // Abstracts start as a 3-line preview with a "show full abstract" button.
  // Clicking the paper title toggles it too.
  root.querySelectorAll(".ps-paper").forEach(paper => {
    const box = paper.querySelector(".ps-abstract-box");
    if (!box) return;
    const textEl = box.querySelector(".ps-abstract-text");
    box.classList.add("is-clamped");
    if (textEl.scrollHeight <= textEl.clientHeight + 2) {
      box.classList.remove("is-clamped"); // short enough to show in full
      return;
    }
    const button = document.createElement("button");
    button.type = "button";
    button.className = "ps-abstract-toggle";
    button.setAttribute("aria-controls", box.id);
    const set = expanded => {
      box.classList.toggle("is-clamped", !expanded);
      button.setAttribute("aria-expanded", String(expanded));
      button.textContent = expanded ? strings.abstractLess : strings.abstractMore;
    };
    set(false);
    button.addEventListener("click", () => set(button.getAttribute("aria-expanded") !== "true"));
    box.append(button);
    paper.expandAbstract = set;
    const title = paper.querySelector(".ps-paper-title");
    if (!title) return;
    title.classList.add("ps-title-toggle");
    title.addEventListener("click", () => {
      if (String(window.getSelection?.() || "")) return; // leave text selection alone
      set(button.getAttribute("aria-expanded") !== "true");
    });
  });

  // ---------- My program and calendar files ----------
  // Every dated item on the page can be saved and exported: keynotes, the
  // panel, invited talks, papers, high-school papers and partner events.
  const pageUrl = `${window.location.origin}${window.location.pathname}`;
  const clean = value => (value || "").replace(/\s+/g, " ").trim();
  const metaTimes = meta => [...(meta?.querySelectorAll("time") || [])].map(t => t.getAttribute("datetime"));
  /** Text after the time range in a "code · day · 10:40–12:00 · Room A" line. */
  const metaRoom = meta => {
    const parts = clean(meta?.textContent).split(" · ");
    const last = parts.map(p => /\d{1,2}:\d{2}/.test(p)).lastIndexOf(true);
    return last >= 0 ? parts.slice(last + 1).join(" · ") : "";
  };
  const sessionInfo = article => {
    const meta = article.querySelector(".ps-session-meta");
    const [start, end] = metaTimes(meta);
    return { id: article.id, title: clean(article.querySelector(".ps-session-title")?.textContent), room: metaRoom(meta), start, end };
  };

  /** id -> { el, kind, start, end, title, people, room, anchor } */
  const items = new Map();
  const addItem = (el, data) => { if (el?.id && data.start && data.end) items.set(el.id, { el, ...data }); };

  // Keynotes and the panel
  document.querySelectorAll("#keynotes article.keynote-card[id]").forEach(card => {
    const meta = card.querySelector(".keynote-meta");
    const [start, end] = metaTimes(meta);
    const label = clean(card.querySelector(".keynote-no")?.textContent);
    const heading = clean(card.querySelector("h3")?.textContent);
    addItem(card, {
      kind: "keynote", start, end,
      title: card.id === "panel" ? heading : `${label}: ${heading}`,
      people: clean(card.querySelector(".keynote-speaker")?.textContent),
      room: metaRoom(meta) || strings.plenaryRoom,
      anchor: meta
    });
  });

  // Session cards (paper sessions, invited, high-school and partner events)
  document.querySelectorAll("article.ps-session[id]").forEach(article => {
    const info = sessionInfo(article);
    const talks = [...article.querySelectorAll(".ps-paper[id]")];
    const kind = article.closest("#program-sessions") ? "paper" : "talk";
    // The whole session can be saved and exported too; its buttons sit on
    // the header line next to the time and room.
    addItem(article, { kind: "session", start: info.start, end: info.end, title: info.title, people: "", room: info.room, anchor: article.querySelector(".ps-session-meta") });
    if (!talks.length) return; // e.g. a partner event: the session is the item
    talks.forEach((talk, i) => {
      const own = talk.querySelector(".ps-paper-when time")?.getAttribute("datetime");
      const next = talks[i + 1]?.querySelector(".ps-paper-when time")?.getAttribute("datetime");
      const start = talk.dataset.start || own || info.start;
      const end = talk.dataset.end || (own ? next || info.end : info.end);
      const board = clean(talk.querySelector(".ps-paper-when strong")?.textContent);
      const people = [...talk.querySelectorAll(".ps-author, .ps-speaker")].map(a => clean(a.textContent)).join(", ");
      const title = clean(talk.querySelector(".ps-paper-title")?.textContent);
      const number = talk.id.startsWith("paper-") ? `${strings.paper} #${talk.id.slice(6)}: ` : "";
      addItem(talk, {
        kind, start, end, title: `${number}${title}`, people,
        room: [info.room, board].filter(Boolean).join(", "),
        session: info.title,
        anchor: talk.querySelector(".ps-paper-meta") || talk.querySelector(".ps-paper-authors") || talk.querySelector(".ps-paper-body")
      });
    });
  });

  const toEvent = (id, item) => ({
    uid: `taai2026-${id}@taai2026.github.io`,
    start: item.start,
    end: item.end,
    summary: item.title,
    location: [item.room, strings.venue].filter(Boolean).join(", "),
    description: [item.people, item.session, `${pageUrl}#${id}`].filter(Boolean).join("\n"),
    url: `${pageUrl}#${id}`
  });

  const mineRow = document.createElement("div");
  mineRow.className = "ps-mine-row";
  const mineBtn = document.createElement("button");
  mineBtn.type = "button";
  mineBtn.className = "news-chip-filter ps-mine-toggle";
  mineBtn.setAttribute("aria-pressed", "false");
  mineBtn.setAttribute("aria-controls", "ps-mine-list");
  const exportBtn = document.createElement("button");
  exportBtn.type = "button";
  exportBtn.className = "news-clear-btn ps-export-ics";
  exportBtn.textContent = strings.exportIcs;
  const mineHint = document.createElement("p");
  mineHint.className = "ps-mine-hint";
  mineHint.textContent = strings.mineHint;
  const mineList = document.createElement("div");
  mineList.id = "ps-mine-list";
  mineList.className = "ps-mine-list";
  mineList.hidden = true;
  mineRow.append(mineBtn, exportBtn, mineHint, mineList);
  controls.querySelector(".news-toolbar")?.before(mineRow);

  const fmtTime = iso => iso.slice(11, 16);
  const dayOf = iso => (iso.slice(0, 10) === "2026-11-20" ? strings.dayShort[1] : strings.dayShort[2]);
  function renderMineList() {
    mineList.replaceChildren();
    const chosen = [...saved].map(id => [id, items.get(id)]).filter(([, item]) => item)
      .sort((a, b) => a[1].start.localeCompare(b[1].start));
    if (!chosen.length) return;
    const heading = document.createElement("p");
    heading.className = "ps-mine-list-title";
    heading.textContent = strings.mineListTitle;
    const list = document.createElement("ol");
    chosen.forEach(([id, item]) => {
      const li = document.createElement("li");
      const when = document.createElement("span");
      when.className = "ps-mine-when";
      when.textContent = `${dayOf(item.start)} ${fmtTime(item.start)}–${fmtTime(item.end)}`;
      const link = document.createElement("a");
      link.href = `#${id}`;
      link.textContent = item.title;
      const where = document.createElement("span");
      where.className = "ps-mine-where";
      where.textContent = item.room;
      li.append(when, link, where);
      list.append(li);
    });
    mineList.append(heading, list);
  }

  const saveButtons = new Map();
  function syncSaved() {
    mineBtn.textContent = strings.mine(saved.size);
    exportBtn.disabled = saved.size === 0;
    saveButtons.forEach((button, id) => {
      const on = saved.has(id);
      const name = items.get(id)?.title || id;
      button.setAttribute("aria-pressed", String(on));
      button.setAttribute("aria-label", on ? strings.itemSavedLabel(name) : strings.itemSaveLabel(name));
      button.textContent = on ? `★ ${strings.saved}` : `☆ ${strings.save}`;
    });
    if (showMine) renderMineList();
  }

  const icsButton = (label, filename, events) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "ps-session-ics";
    button.textContent = strings.sessionIcs;
    button.setAttribute("aria-label", label);
    button.addEventListener("click", () => downloadFile(filename, buildIcs(events()), "text/calendar;charset=utf-8"));
    return button;
  };

  items.forEach((item, id) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "ps-save";
    button.addEventListener("click", () => {
      if (saved.has(id)) saved.delete(id);
      else saved.add(id);
      storeSaved(saved);
      syncSaved();
      if (showMine) update();
    });
    saveButtons.set(id, button);
    const extra = [" ", button];
    // Items that are not inside a session card get their own calendar button.
    if (item.kind === "keynote" || item.kind === "session") {
      extra.push(" ", icsButton(strings.itemIcsLabel(item.title), `taai2026-${id.replace(/^session-/, "")}.ics`, () => [toEvent(id, item)]));
    }
    item.anchor?.append(...extra);
  });

  mineBtn.addEventListener("click", () => {
    showMine = !showMine;
    mineBtn.setAttribute("aria-pressed", String(showMine));
    mineList.hidden = !showMine;
    if (showMine) renderMineList();
    update();
  });
  exportBtn.addEventListener("click", () => {
    const events = [...saved].filter(id => items.has(id)).map(id => toEvent(id, items.get(id)))
      .sort((a, b) => a.start.localeCompare(b.start));
    if (events.length) downloadFile("taai2026-my-program.ics", buildIcs(events), "text/calendar;charset=utf-8");
  });
  syncSaved();

  // ---------- Search beyond the paper list ----------
  const dateOf = d => (d === "1" ? "2026-11-20" : "2026-11-21");
  const textOf = (el, selector) => [...(el?.querySelectorAll(selector) || [])].map(x => clean(x.textContent)).filter(Boolean);
  const addExtra = (el, kind, data) => {
    if (!el?.id || !data.start) return;
    extraRecords.push({
      item: el, kind, title: data.title || "", authors: data.people || [], affiliations: data.affiliations || [],
      keywords: [], abstract: data.abstract || "", topic: "", board: "", badge: data.badge,
      start: data.start, end: data.end, room: data.room || "", day: data.start.slice(0, 10) === "2026-11-20" ? "1" : "2"
    });
  };
  document.querySelectorAll("#keynotes article.keynote-card[id]").forEach(card => {
    const item = items.get(card.id);
    if (!item) return;
    addExtra(card, "keynote", {
      badge: card.id === "panel" ? strings.kindNames.panel : "",
      title: item.title, start: item.start, end: item.end, room: item.room,
      people: [...textOf(card, ".keynote-speaker"), ...textOf(card, ".panel-list li")],
      affiliations: textOf(card, ".keynote-affil"),
      abstract: textOf(card, ".keynote-more p").join(" ")
    });
  });
  [["#invited-sessions", "invited"], ["#high-school-sessions", "high-school"], ["#partner-events", "partner"]].forEach(([section, kind]) => {
    document.querySelectorAll(`${section} article.ps-session[id]`).forEach(article => {
      const talks = [...article.querySelectorAll(".ps-paper[id]")];
      if (!talks.length) {
        const item = items.get(article.id);
        if (item) addExtra(article, kind, {
          title: item.title, start: item.start, end: item.end, room: item.room,
          people: textOf(article, ".ps-chair"),
          abstract: textOf(article, ".ps-paper-title, .ps-paper-meta").join(" ")
        });
        return;
      }
      talks.forEach(talk => {
        const item = items.get(talk.id);
        if (!item) return;
        addExtra(talk, kind, {
          title: [item.title, ...textOf(talk, ".ps-paper-title-alt")].join(" "),
          start: item.start, end: item.end, room: item.room,
          people: textOf(talk, ".ps-speaker"),
          affiliations: textOf(talk, ".ps-paper-meta")
        });
      });
    });
  });
  // Sessions that only appear in the timetable (AI CUP, industrial tracks,
  // ceremonies …). Breaks and cells linking to items above are skipped.
  document.querySelectorAll(".program-glance table.glance").forEach((table, index) => {
    const day = String(index + 1);
    table.querySelectorAll("tbody tr").forEach(row => {
      const range = clean(row.querySelector(".g-time")?.textContent).match(/(\d{2}:\d{2})\s*[-–]\s*(\d{2}:\d{2})/);
      if (!range) return;
      row.querySelectorAll("td:not(.g-time):not(.g-break):not(.g-dup)").forEach((cell, col) => {
        const link = cell.querySelector('a[href^="#"]')?.getAttribute("href") || "";
        if (/^#(keynote\d|panel|session-)/.test(link)) return;
        const copy = cell.cloneNode(true);
        copy.querySelectorAll("small, .sr-only").forEach(n => n.remove());
        const title = clean(copy.textContent);
        if (!title) return;
        const detail = textOf(cell, "small").join(" ");
        const span = clean(cell.querySelector("small")?.textContent).match(/(\d{2}:\d{2})-(\d{2}:\d{2})/);
        const [start, end] = span ? [span[1], span[2]] : [range[1], range[2]];
        if (!cell.id) cell.id = `timetable-d${day}-${range[1].replace(":", "")}-${col + 1}`;
        addExtra(cell, "other", {
          title: detail ? `${title} · ${detail}` : title,
          start: `${dateOf(day)}T${start}+08:00`, end: `${dateOf(day)}T${end}+08:00`,
          room: cell.dataset.room || ((cell.colSpan || 1) > 1 && /g-plenary|g-social/.test(cell.className) ? strings.plenaryRoom : "")
        });
      });
    });
  });
  records.push(...extraRecords);

  controls.querySelector(".ps-mine-row")?.after(otherBox);
  function renderOther(list) {
    otherBox.replaceChildren();
    otherBox.hidden = !list.length;
    if (!list.length) return;
    const heading = document.createElement("p");
    heading.className = "ps-other-title";
    heading.textContent = strings.extraTitle(list.length);
    const ol = document.createElement("ol");
    [...list].sort((a, b) => a.start.localeCompare(b.start)).forEach(r => {
      const li = document.createElement("li");
      const badge = document.createElement("span");
      badge.className = `ps-other-kind ps-other-${r.kind}`;
      badge.textContent = r.badge || strings.kindNames[r.kind];
      const when = document.createElement("span");
      when.className = "ps-mine-when";
      when.textContent = `${strings.dayShort[r.day]} ${r.start.slice(11, 16)}–${r.end.slice(11, 16)}${r.room ? ` · ${r.room}` : ""}`;
      const link = document.createElement("a");
      link.href = `#${r.item.id}`;
      link.textContent = r.title;
      li.append(badge, when, link);
      if (r.authors.length) {
        const who = document.createElement("span");
        who.className = "ps-mine-where";
        who.textContent = r.authors.join(", ");
        li.append(who);
      }
      ol.append(li);
    });
    otherBox.append(heading, ol);
  }

  function activate(event) {
    const el = event.target.closest(".ps-author, .ps-aff, .ps-kw, .ps-paper-topic");
    if (!el) return false;
    event.preventDefault();
    debouncedSearch.cancel();
    if (el.classList.contains("ps-paper-topic")) {
      setState({ topic: el.closest(".ps-paper").dataset.topic, q: "", in: "" });
    } else {
      const scope = el.classList.contains("ps-author") ? "author" : el.classList.contains("ps-aff") ? "affiliation" : "keyword";
      setState({ q: el.textContent, in: scope, topic: "" });
    }
    showResults();
    return true;
  }
  root.addEventListener("click", activate);
  root.addEventListener("keydown", event => {
    if (event.key === "Enter" || event.key === " ") activate(event);
  });

  window.addEventListener("popstate", () => {
    state = parseUrlState(window.location.search);
    syncControls();
    update();
  });
  window.addEventListener("hashchange", revealHashTarget);
  // Clicking a link to the hash already in the URL fires no hashchange.
  document.addEventListener("click", event => {
    const link = event.target.closest('a[href^="#session-"], a[href^="#paper-"]');
    if (!link || link.hash !== window.location.hash) return;
    event.preventDefault();
    revealHashTarget();
  });

  state = parseUrlState(window.location.search);
  syncControls();
  controls.hidden = false;
  await update();
  await revealHashTarget();
}

// Pure helpers, exposed for tests.
global.TAAIProgramSearch = { normalizeSearch, createSearcher, parsePaperIdQuery, parseUrlState, sessionMatches, exactMatches };

if (typeof document === "undefined") return;
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
})(globalThis);
