/* TAAI 2026 — News search: pinned Fuse.js with a normalized-substring
   fallback, plus URL state helpers. See SEARCH-SPEC.md. */

import { getCategoryLabel } from "./news-core.js";

const FUSE_URL = "https://cdn.jsdelivr.net/npm/fuse.js@7.5.0/dist/fuse.mjs";

const FUSE_OPTIONS = {
  includeScore: true,
  threshold: 0.3,
  ignoreLocation: true,
  minMatchCharLength: 2,
  keys: [
    { name: "title", weight: 0.5 },
    { name: "tags", weight: 0.25 },
    { name: "summary", weight: 0.15 },
    { name: "categoryLabel", weight: 0.1 }
  ]
};

export function normalizeSearch(value = "") {
  return String(value).normalize("NFKC").trim().toLocaleLowerCase();
}

function buildSearchableText(record) {
  return normalizeSearch(
    [record.title, record.summary, record.categoryLabel, ...(record.tags || [])].join(" ")
  );
}

/** Project localized News items into the shape the search index needs. */
export function buildSearchProjection(localizedItems, locale) {
  return localizedItems.map(item => ({
    id: item.id,
    item,
    title: item.title,
    summary: item.summary,
    tags: item.tags,
    categoryLabel: getCategoryLabel(item.category, locale)
  }));
}

/** Returns an async `search(query) -> item[]` function. Falls back to
 *  normalized substring matching if Fuse.js cannot be loaded — search must
 *  never be a hard dependency for the archive page to function. */
export async function createSearcher(records) {
  try {
    const { default: Fuse } = await import(/* webpackIgnore: true */ FUSE_URL);
    const fuse = new Fuse(records, FUSE_OPTIONS);
    return query => fuse.search(query).map(result => result.item.item);
  } catch (error) {
    console.error("[news] Fuse.js unavailable; using substring fallback", error);
    return query => {
      const needle = normalizeSearch(query);
      return records
        .filter(record => buildSearchableText(record).includes(needle))
        .map(record => record.item);
    };
  }
}

const URL_KEYS = ["q", "category", "type"];

/** Parse News-relevant params from a URLSearchParams-compatible search
 *  string. Unknown enum values are dropped rather than causing an error. */
export function parseUrlState(search, { validCategories = [], validTypes = [] } = {}) {
  const params = new URLSearchParams(search);
  const state = { q: params.get("q") || "", category: "", type: "" };

  const category = params.get("category") || "";
  if (!validCategories.length || validCategories.includes(category)) {
    state.category = category;
  }

  const type = params.get("type") || "";
  if (!validTypes.length || validTypes.includes(type)) {
    state.type = type;
  }

  return state;
}

/** Merge News state into the current location, preserving unrelated params,
 *  and push it to history without a full reload. */
export function writeUrlState(state, { replace = false } = {}) {
  const params = new URLSearchParams(window.location.search);

  URL_KEYS.forEach(key => {
    const value = state[key];
    if (value) params.set(key, value);
    else params.delete(key);
  });

  const query = params.toString();
  const url = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
  const method = replace ? "replaceState" : "pushState";
  window.history[method](state, "", url);
}

export function clearUrlState() {
  writeUrlState({ q: "", category: "", type: "" });
}
