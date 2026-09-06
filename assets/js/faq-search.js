/* TAAI 2026 — FAQ search: pinned Fuse.js with a normalized-substring
   fallback, layered on top of the static FAQ list (no JSON, no fetch).
   Multi-select topic tags; #faq-qN deep links stay reliable. See
   assets/js/news-search.js for the shared searcher/fallback logic. */

import { createSearcher } from "./news-search.js";

const STRINGS = {
  en: {
    tagLabels: {
      concepts: "Concepts",
      publish: "Publish decision",
      international: "International Track",
      "domestic-full": "Domestic full paper",
      "domestic-abstract": "Extended abstract",
      "high-school": "High School Session",
      examples: "Examples"
    },
    searchLabel: "Search FAQ",
    searchPlaceholder: "Search questions and answers…",
    tagsLabel: "Filter by topic",
    clear: "Clear filters",
    empty: "No questions match your search.",
    resultCount: (n, total) => (n === total ? `${total} questions` : `${n} of ${total} questions`)
  },
  zh: {
    tagLabels: {
      concepts: "基本概念",
      publish: "出版決定",
      international: "國際論文組",
      "domestic-full": "國內完整論文",
      "domestic-abstract": "延伸摘要",
      "high-school": "高中生專題組",
      examples: "範例總結"
    },
    searchLabel: "搜尋 FAQ",
    searchPlaceholder: "搜尋題目與答案…",
    tagsLabel: "依主題篩選",
    clear: "清除篩選",
    empty: "找不到符合的題目。",
    resultCount: (n, total) => (n === total ? `共 ${total} 題` : `符合 ${n} 題（共 ${total} 題）`)
  }
};

const TAG_ORDER = ["concepts", "publish", "international", "domestic-full", "domestic-abstract", "high-school", "examples"];

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
  const root = document.getElementById("faq-app");
  if (!root) return;

  const locale = root.dataset.locale === "zh" ? "zh" : "en";
  const strings = STRINGS[locale];

  const controls = root.querySelector("[data-faq-controls]");
  const searchInput = root.querySelector("[data-faq-search]");
  const searchLabel = root.querySelector('label[for="faq-search-input"]');
  const tagsRow = root.querySelector("[data-faq-tags]");
  const countEl = root.querySelector("[data-faq-count]");
  const clearBtn = root.querySelector("[data-faq-clear]");
  const emptyEl = root.querySelector("[data-faq-empty]");
  const items = [...root.querySelectorAll(".faq-item")];
  if (!controls || !items.length) return;

  if (searchLabel) searchLabel.textContent = strings.searchLabel;
  searchInput.placeholder = strings.searchPlaceholder;
  tagsRow.setAttribute("aria-label", strings.tagsLabel);
  clearBtn.textContent = strings.clear;
  emptyEl.textContent = strings.empty;

  const records = items.map(item => {
    const tags = (item.dataset.faqTags || "").split(/\s+/).filter(Boolean);
    return {
      item,
      tags,
      title: item.querySelector("summary")?.textContent || "",
      summary: item.querySelector(".faq-body")?.textContent || "",
      categoryLabel: tags.map(tag => strings.tagLabels[tag] || tag).join(" ")
    };
  });
  const recordByItem = new Map(records.map(r => [r.item, r]));

  const search = await createSearcher(records);
  const tagsPresent = TAG_ORDER.filter(tag => records.some(r => r.tags.includes(tag)));

  const state = { q: "", tags: [] };
  let matchedItems = null; // null = no active text search

  function applyFilters() {
    let visibleCount = 0;
    items.forEach(item => {
      const record = recordByItem.get(item);
      const matchesTags = !state.tags.length || record.tags.some(t => state.tags.includes(t));
      const matchesQuery = !matchedItems || matchedItems.has(item);
      const visible = matchesTags && matchesQuery;
      item.hidden = !visible;
      if (visible) visibleCount += 1;
    });
    countEl.textContent = strings.resultCount(visibleCount, items.length);
    emptyEl.hidden = visibleCount !== 0;
  }

  async function runSearch() {
    matchedItems = state.q ? new Set(await search(state.q)) : null;
    applyFilters();
  }

  function syncTagButtons() {
    tagsRow.querySelectorAll("[data-tag]").forEach(btn => {
      btn.setAttribute("aria-pressed", String(state.tags.includes(btn.dataset.tag)));
    });
  }

  function writeUrl() {
    const params = new URLSearchParams(window.location.search);
    if (state.q) params.set("q", state.q);
    else params.delete("q");
    if (state.tags.length) params.set("tags", state.tags.join(","));
    else params.delete("tags");
    const query = params.toString();
    const url = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
    window.history.replaceState(state, "", url);
  }

  function readUrl() {
    const params = new URLSearchParams(window.location.search);
    state.q = params.get("q") || "";
    const tagsParam = params.get("tags") || "";
    state.tags = tagsParam ? tagsParam.split(",").filter(t => tagsPresent.includes(t)) : [];
  }

  function clearFiltersIfHashTargetsItem() {
    const id = decodeURIComponent(window.location.hash || "").slice(1);
    const target = id && document.getElementById(id);
    if (!target || !target.classList.contains("faq-item")) return;
    state.q = "";
    state.tags = [];
    searchInput.value = "";
  }

  tagsPresent.forEach(tag => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "faq-chip-filter";
    btn.dataset.tag = tag;
    btn.setAttribute("aria-pressed", "false");
    btn.textContent = strings.tagLabels[tag] || tag;
    tagsRow.appendChild(btn);
  });

  tagsRow.addEventListener("click", event => {
    const btn = event.target.closest("[data-tag]");
    if (!btn) return;
    const tag = btn.dataset.tag;
    state.tags = state.tags.includes(tag) ? state.tags.filter(t => t !== tag) : [...state.tags, tag];
    syncTagButtons();
    writeUrl();
    applyFilters();
  });

  const debouncedSearch = debounce(value => {
    state.q = value;
    writeUrl();
    runSearch();
  }, 300);
  searchInput.addEventListener("input", () => debouncedSearch(searchInput.value));
  searchInput.addEventListener("keydown", event => {
    if (event.key === "Enter") {
      debouncedSearch.cancel();
      state.q = searchInput.value;
      writeUrl();
      runSearch();
    }
  });

  clearBtn.addEventListener("click", () => {
    state.q = "";
    state.tags = [];
    searchInput.value = "";
    syncTagButtons();
    writeUrl();
    runSearch();
  });

  window.addEventListener("hashchange", () => {
    clearFiltersIfHashTargetsItem();
    syncTagButtons();
    writeUrl();
    runSearch();
  });

  readUrl();
  clearFiltersIfHashTargetsItem();
  searchInput.value = state.q;
  syncTagButtons();
  await runSearch();

  controls.hidden = false;
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
