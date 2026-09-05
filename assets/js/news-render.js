/* TAAI 2026 — shared News card rendering. Safe DOM only: JSON content is
   never assigned via innerHTML (SDD-NEWS.md §23). Shared by news-home.js
   and news-page.js so the two surfaces stay visually consistent. */

import { getNextMilestone, getCategoryLabel, isNew } from "./news-core.js";

const ALLOWED_PROTOCOLS = new Set(["https:", "http:", "mailto:"]);

const RELATIONSHIP_LABELS = {
  "partner-event": { zh: "合作活動", en: "Partner Event" },
  "co-organized": { zh: "共同主辦", en: "Co-organized" },
  "co-located": { zh: "同期活動", en: "Co-located" },
  related: { zh: "相關活動", en: "Related" },
  official: { zh: "官方公告", en: "Official" }
};

const STRINGS = {
  zh: {
    new: "NEW",
    urgent: "緊急",
    externalLink: "（外部連結）",
    noMilestone: null
  },
  en: {
    new: "NEW",
    urgent: "Urgent",
    externalLink: " (external link)",
    noMilestone: null
  }
};

function safeUrl(url) {
  if (!url) return null;
  try {
    const resolved = new URL(url, window.location.href);
    return ALLOWED_PROTOCOLS.has(resolved.protocol) ? url : null;
  } catch {
    // Relative paths without a scheme (e.g. "cfp.html#templates") are safe.
    return /^[a-z0-9]/i.test(url) ? url : null;
  }
}

function isExternal(url) {
  try {
    return new URL(url, window.location.href).origin !== window.location.origin;
  } catch {
    return false;
  }
}

function formatDate(iso, locale) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(locale === "zh" ? "zh-TW" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric"
  }).format(date);
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** Build one <article class="news-card"> for a localized item. */
export function buildNewsCard(item, locale, now) {
  const strings = STRINGS[locale] ?? STRINGS.en;
  const article = el("article", "news-card");
  article.dataset.newsId = item.id;

  const meta = el("div", "news-card-meta");
  meta.appendChild(el("span", "news-chip news-chip-category", getCategoryLabel(item.category, locale)));

  const role = item.relationship?.role;
  if (role && RELATIONSHIP_LABELS[role]) {
    meta.appendChild(
      el("span", "news-chip news-chip-relationship", RELATIONSHIP_LABELS[role][locale] ?? role)
    );
  }
  if (item.urgent) {
    meta.appendChild(el("span", "news-chip news-chip-urgent", strings.urgent));
  }
  if (isNew(item, now)) {
    meta.appendChild(el("span", "news-chip news-chip-new", strings.new));
  }
  article.appendChild(meta);

  article.appendChild(el("h3", "news-card-title", item.title));

  if (item.summary) {
    article.appendChild(el("p", "news-card-summary", item.summary));
  }

  const milestone = getNextMilestone(item, now);
  if (milestone) {
    const p = el("p", "news-card-milestone");
    const time = document.createElement("time");
    time.dateTime = milestone.at;
    time.textContent = formatDate(milestone.at, locale);
    p.appendChild(time);
    p.appendChild(document.createTextNode(" · " + (milestone.i18n?.[locale] ?? milestone.id)));
    article.appendChild(p);
  }

  const footer = el("div", "news-card-footer");
  const time = document.createElement("time");
  time.className = "news-card-date";
  time.dateTime = item.publishedAt;
  time.textContent = formatDate(item.publishedAt, locale);
  footer.appendChild(time);

  const url = safeUrl(item.link);
  if (url && item.linkLabel) {
    const a = document.createElement("a");
    a.href = url;
    a.className = "news-card-cta";
    a.appendChild(document.createTextNode(item.linkLabel));
    if (isExternal(url)) {
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      const note = el("span", "news-card-cta-external", strings.externalLink);
      a.appendChild(note);
    }
    footer.appendChild(a);
  }
  article.appendChild(footer);

  return article;
}

export function buildEmptyState(message) {
  const p = el("p", "news-empty-state", message);
  p.setAttribute("role", "status");
  return p;
}

export function buildErrorState(message) {
  const p = el("p", "news-error-state", message);
  p.setAttribute("role", "alert");
  return p;
}
