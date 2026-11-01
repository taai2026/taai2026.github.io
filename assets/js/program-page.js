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
    typeNames: { "international-oral": "International oral", "domestic-oral": "Domestic oral", poster: "Poster" },
    scopeNames: { all: "All fields", title: "Title", author: "Author", keyword: "Keyword", topic: "Topic" },
    searchAuthor: name => `Show papers by ${name}`,
    searchKeyword: kw => `Show papers with keyword “${kw}”`,
    filterTopic: topic => `Show papers in ${topic}`
  },
  zh: {
    all: "全部",
    count: (papers, sessions) => `${sessions} 個場次，共 ${papers} 篇論文`,
    dayShort: { 1: "第 1 天（11/20 五）", 2: "第 2 天（11/21 六）" },
    typeNames: { "international-oral": "國際口頭", "domestic-oral": "國內口頭", poster: "海報" },
    scopeNames: { all: "全部欄位", title: "題目", author: "作者", keyword: "關鍵字", topic: "主題" },
    searchAuthor: name => `顯示 ${name} 的論文`,
    searchKeyword: kw => `顯示關鍵字為「${kw}」的論文`,
    filterTopic: topic => `顯示「${topic}」主題的論文`
  }
};

const TYPES = ["international-oral", "domestic-oral", "poster"];
const DAYS = ["1", "2"];
const SCOPES = ["all", "title", "author", "keyword", "topic"];
const TOPICS = ["optimization", "games", "speech", "data-mining", "health", "vision", "nlp", "agents", "security", "education", "other"];
const URL_KEYS = ["q", "in", "day", "type", "topic"];

/** Fuse keys per search scope. */
const SCOPE_KEYS = {
  all: [
    { name: "title", weight: 0.4 },
    { name: "authors", weight: 0.25 },
    { name: "keywords", weight: 0.2 },
    { name: "topic", weight: 0.1 },
    { name: "board", weight: 0.05 }
  ],
  title: [{ name: "title", weight: 1 }],
  author: [{ name: "authors", weight: 1 }],
  keyword: [{ name: "keywords", weight: 1 }],
  topic: [{ name: "topic", weight: 1 }]
};

/** Scopes where an exact (normalized substring) hit is preferred over fuzzy
 *  matches, so "Ching-Ting Tu" does not also return "Ching-Ting Chen". */
const EXACT_FIRST = { author: "authors", keyword: "keywords", topic: "topic" };

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
    topic: text(paper, ".ps-paper-topic"),
    board: text(paper, ".ps-paper-when strong")
  })));
  const paperById = new Map(records.map(r => [Number(r.item.id.slice("paper-".length)), r.item]));
  const topicLabels = new Map(records.map(r => [r.item.dataset.topic, r.topic]));

  const searchers = new Map();
  async function searchIn(scope, query) {
    const field = EXACT_FIRST[scope];
    if (field) {
      const exact = exactMatches(records, field, query);
      if (exact.length) return exact;
    }
    if (!searchers.has(scope)) searchers.set(scope, createSearcher(records, SCOPE_KEYS[scope]));
    return (await searchers.get(scope))(query);
  }

  let state = { q: "", in: "", day: "", type: "", topic: "" };
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
          && (!matches || matches.has(paper));
        paper.hidden = !show;
        if (show) visible += 1;
      });
      session.el.hidden = !inFilter || ((matches || state.topic) && !visible);
      if (!session.el.hidden) {
        sessionCount += 1;
        paperCount += visible;
      }
    });
    slots.forEach(slot => { slot.hidden = !slot.querySelector(".ps-session:not([hidden])"); });
    days.forEach(day => { day.hidden = !day.querySelector(".ps-slot-group:not([hidden])"); });

    countEl.textContent = strings.count(paperCount, sessionCount);
    emptyEl.hidden = sessionCount !== 0;
  }

  function syncControls() {
    searchInput.value = state.q;
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

  clearBtn.addEventListener("click", () => setState({ q: "", in: "", day: "", type: "", topic: "" }));

  // Click-to-search: authors and keywords search their field; a topic filters.
  root.querySelectorAll(".ps-author").forEach(el => makeActionable(el, strings.searchAuthor(el.textContent)));
  root.querySelectorAll(".ps-kw").forEach(el => makeActionable(el, strings.searchKeyword(el.textContent)));
  root.querySelectorAll(".ps-paper-topic").forEach(el => makeActionable(el, strings.filterTopic(el.textContent)));
  function activate(event) {
    const el = event.target.closest(".ps-author, .ps-kw, .ps-paper-topic");
    if (!el) return false;
    event.preventDefault();
    debouncedSearch.cancel();
    if (el.classList.contains("ps-paper-topic")) {
      setState({ topic: el.closest(".ps-paper").dataset.topic, q: "", in: "" });
    } else {
      setState({ q: el.textContent, in: el.classList.contains("ps-author") ? "author" : "keyword", topic: "" });
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
