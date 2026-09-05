/* TAAI 2026 — News Archive page. Chronological by default; fuzzy relevance
   when searching. Category/type are exact filters. URL state is
   shareable and survives Back/Forward (SEARCH-SPEC.md). */

import { getArchiveNews, getCategoryLabel, CATEGORY_LABELS } from "./news-core.js";
import { buildSearchProjection, createSearcher, parseUrlState, writeUrlState, clearUrlState } from "./news-search.js";
import { buildNewsCard, buildEmptyState, buildErrorState } from "./news-render.js";

const TYPES = ["conference-update", "deadline", "program-update", "logistics", "partner-event", "urgent"];

const STRINGS = {
  zh: {
    error: "News 資料暫時無法載入，請稍後再試。",
    empty: "找不到符合條件的消息。",
    clear: "清除篩選",
    all: "全部",
    resultCount: n => `共 ${n} 則消息`,
    searchLabel: "搜尋消息",
    searchPlaceholder: "搜尋標題、標籤或摘要…",
    typeLabel: "類型",
    typeNames: {
      "conference-update": "大會公告",
      deadline: "截止日期",
      "program-update": "議程更新",
      logistics: "交通與後勤",
      "partner-event": "合作活動",
      urgent: "緊急通知"
    }
  },
  en: {
    error: "News data is temporarily unavailable. Please try again later.",
    empty: "No news matches your filters.",
    clear: "Clear filters",
    all: "All",
    resultCount: n => `${n} item${n === 1 ? "" : "s"}`,
    searchLabel: "Search news",
    searchPlaceholder: "Search title, tags, or summary…",
    typeLabel: "Type",
    typeNames: {
      "conference-update": "Conference update",
      deadline: "Deadline",
      "program-update": "Program update",
      logistics: "Logistics",
      "partner-event": "Partner event",
      urgent: "Urgent"
    }
  }
};

async function fetchJson(url) {
  const response = await fetch(url, { cache: "no-cache" });
  if (!response.ok) throw new Error(`Failed to load ${url}: ${response.status}`);
  return response.json();
}

function debounce(fn, wait) {
  let timer = null;
  const debounced = (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
  debounced.cancel = () => clearTimeout(timer);
  return debounced;
}

async function init() {
  const root = document.getElementById("news-archive");
  if (!root) return;

  const locale = root.dataset.locale === "zh" ? "zh" : "en";
  const dataBase = root.dataset.dataBase || "assets/data";
  const strings = STRINGS[locale];

  const searchInput = root.querySelector("[data-news-search]");
  const chipsEl = root.querySelector("[data-news-chips]");
  const typeSelect = root.querySelector("[data-news-type]");
  const clearBtn = root.querySelector("[data-news-clear]");
  const countEl = root.querySelector("[data-news-count]");
  const resultsEl = root.querySelector("[data-news-results]");

  let archive = [];
  let searchRecords = [];
  let search = async () => [];
  let state = { q: "", category: "", type: "" };

  function render() {
    resultsEl.innerHTML = "";

    let list;
    if (state.q) {
      list = searchRecords.__lastResults ?? archive;
    } else {
      list = archive;
    }

    if (state.category) list = list.filter(item => item.category === state.category);
    if (state.type) list = list.filter(item => item.type === state.type);

    countEl.textContent = strings.resultCount(list.length);

    if (!list.length) {
      resultsEl.appendChild(buildEmptyState(strings.empty));
      return;
    }

    const now = Date.now();
    list.forEach(item => resultsEl.appendChild(buildNewsCard(item, locale, now)));
  }

  async function runSearch() {
    if (!state.q) {
      searchRecords.__lastResults = null;
      render();
      return;
    }
    const results = await search(state.q);
    searchRecords.__lastResults = results;
    render();
  }

  function syncControls() {
    searchInput.value = state.q;
    typeSelect.value = state.type;
    chipsEl.querySelectorAll("[data-category]").forEach(chip => {
      const active = chip.dataset.category === state.category;
      chip.setAttribute("aria-pressed", String(active));
    });
  }

  function updateState(patch, { pushHistory = true } = {}) {
    state = { ...state, ...patch };
    syncControls();
    writeUrlState(state, { replace: !pushHistory });
    runSearch();
  }

  try {
    const [conference, news] = await Promise.all([
      fetchJson(`${dataBase}/conference.json`),
      fetchJson(`${dataBase}/news.json`)
    ]);
    void conference; // reserved for future deadline-aware archive features
    archive = getArchiveNews(news.items, locale);
    searchRecords = buildSearchProjection(archive, locale);
    search = await createSearcher(searchRecords);
  } catch (error) {
    console.error("[news] archive load failed", error);
    resultsEl.innerHTML = "";
    resultsEl.appendChild(buildErrorState(strings.error));
    countEl.textContent = "";
    return;
  }

  const validCategories = Object.keys(CATEGORY_LABELS);
  const validTypes = TYPES;

  const allChip = document.createElement("button");
  allChip.type = "button";
  allChip.className = "news-chip-filter";
  allChip.dataset.category = "";
  allChip.setAttribute("aria-pressed", "true");
  allChip.textContent = strings.all;
  chipsEl.appendChild(allChip);

  validCategories.forEach(category => {
    if (!archive.some(item => item.category === category)) return;
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "news-chip-filter";
    chip.dataset.category = category;
    chip.setAttribute("aria-pressed", "false");
    chip.textContent = getCategoryLabel(category, locale);
    chipsEl.appendChild(chip);
  });

  chipsEl.addEventListener("click", event => {
    const chip = event.target.closest("[data-category]");
    if (!chip) return;
    updateState({ category: chip.dataset.category });
  });

  const defaultOption = document.createElement("option");
  defaultOption.value = "";
  defaultOption.textContent = strings.all;
  typeSelect.appendChild(defaultOption);
  validTypes.forEach(type => {
    if (!archive.some(item => item.type === type)) return;
    const option = document.createElement("option");
    option.value = type;
    option.textContent = strings.typeNames[type] ?? type;
    typeSelect.appendChild(option);
  });
  typeSelect.addEventListener("change", () => {
    updateState({ type: typeSelect.value });
  });

  const debouncedSearch = debounce(value => updateState({ q: value }), 300);
  searchInput.addEventListener("input", () => debouncedSearch(searchInput.value));
  searchInput.addEventListener("keydown", event => {
    if (event.key === "Enter") {
      debouncedSearch.cancel();
      updateState({ q: searchInput.value });
    }
  });

  clearBtn.addEventListener("click", () => {
    clearUrlState();
    updateState({ q: "", category: "", type: "" }, { pushHistory: false });
  });

  window.addEventListener("popstate", () => {
    state = parseUrlState(window.location.search, { validCategories, validTypes });
    syncControls();
    runSearch();
  });

  state = parseUrlState(window.location.search, { validCategories, validTypes });
  syncControls();
  runSearch();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
