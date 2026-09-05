/* TAAI 2026 — homepage News mount point. Progressive enhancement: if data
   fails to load, the section shows a compact fallback instead of breaking
   the rest of the homepage (SDD-NEWS.md §25). */

import { getHomepageNews } from "./news-core.js";
import { buildNewsCard, buildErrorState } from "./news-render.js";

const STRINGS = {
  zh: {
    error: "最新消息暫時無法載入，請直接前往",
    viewAll: "查看全部消息"
  },
  en: {
    error: "News is temporarily unavailable. Please visit",
    viewAll: "View all news"
  }
};

async function fetchJson(url) {
  const response = await fetch(url, { cache: "no-cache" });
  if (!response.ok) throw new Error(`Failed to load ${url}: ${response.status}`);
  return response.json();
}

async function init() {
  const mount = document.getElementById("news-home-mount");
  if (!mount) return;

  const locale = mount.dataset.locale === "zh" ? "zh" : "en";
  const dataBase = mount.dataset.dataBase || "assets/data";
  const archiveHref = mount.dataset.archiveHref || "news.html";
  const strings = STRINGS[locale];

  try {
    const [conference, news] = await Promise.all([
      fetchJson(`${dataBase}/conference.json`),
      fetchJson(`${dataBase}/news.json`)
    ]);

    const now = Date.now();
    const items = getHomepageNews(news.items, conference, locale, now);

    mount.innerHTML = "";
    if (!items.length) return;

    const grid = document.createElement("div");
    grid.className = "news-grid";
    items.forEach(item => grid.appendChild(buildNewsCard(item, locale, now)));
    mount.appendChild(grid);
  } catch (error) {
    console.error("[news] homepage load failed", error);
    mount.innerHTML = "";
    const fallback = buildErrorState(strings.error);
    const link = document.createElement("a");
    link.href = archiveHref;
    link.textContent = strings.viewAll;
    fallback.appendChild(document.createTextNode(" "));
    fallback.appendChild(link);
    mount.appendChild(fallback);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
