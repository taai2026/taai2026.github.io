/* TAAI 2026 — News business logic (pure functions, no DOM).
   Ranking, eligibility, and urgency are computed here so the renderer never
   has to make editorial decisions. All time-dependent functions accept
   `now` for deterministic testing. */

import { getDeadline } from "./conference-state.js";

function toMs(now) {
  return now instanceof Date ? now.getTime() : now;
}

/** Resolve one item into a flat, locale-specific view. Returns null when the
 *  item has no payload for `locale` — callers MUST NOT fall back to another
 *  locale's content (see DATA-MODEL.md §9, Missing Translation Policy). */
export function localizeNews(item, locale) {
  const payload = item?.i18n?.[locale];
  if (!payload || !payload.title) return null;

  return {
    id: item.id,
    type: item.type,
    category: item.category,
    status: item.status,
    publishedAt: item.publishedAt,
    updatedAt: item.updatedAt ?? null,
    priority: item.priority ?? 50,
    featured: Boolean(item.featured),
    urgent: Boolean(item.urgent),
    deadlineRef: item.deadlineRef ?? null,
    milestones: item.milestones ?? null,
    homepage: item.homepage ?? null,
    source: item.source ?? null,
    relationship: item.relationship ?? null,
    event: item.event ?? null,
    audience: item.audience ?? [],
    title: payload.title,
    summary: payload.summary ?? "",
    linkLabel: payload.linkLabel ?? "",
    tags: payload.tags ?? [],
    link: item.links?.[locale] ?? null,
    venue: item.event?.venue?.[locale] ?? null
  };
}

/** Localize every item, dropping ones without a payload for `locale`, and
 *  optionally filtering to a status (defaults to "published"). */
export function localizeAll(items, locale, { status = "published" } = {}) {
  return items
    .filter(item => !status || item.status === status)
    .map(item => localizeNews(item, locale))
    .filter(Boolean);
}

/** Whether an item is eligible to appear in the homepage relevance surface
 *  right now. Does not decide ranking — only presence. */
export function isHomepageActive(localized, now) {
  const nowMs = toMs(now);
  const hp = localized?.homepage;
  if (!hp || hp.enabled !== true) return false;
  if (hp.from && nowMs < Date.parse(hp.from)) return false;
  if (hp.until && nowMs > Date.parse(hp.until)) return false;
  return true;
}

/** First milestone whose `at` is not in the past. Milestones are sorted by
 *  `at` regardless of source-file order. Returns null once all have passed. */
export function getNextMilestone(localized, now) {
  const milestones = localized?.milestones;
  if (!Array.isArray(milestones) || !milestones.length) return null;

  const nowMs = toMs(now);
  const upcoming = milestones
    .filter(m => Date.parse(m.at) >= nowMs)
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at));

  return upcoming[0] ?? null;
}

/** Urgency score per SDD-NEWS.md §20. Looks at the item's own deadlineRef
 *  (resolved against conference.json) first, then its next milestone.
 *  `urgent: true` is an explicit editorial signal handled separately by the
 *  ranking tuple — this function only scores time pressure. */
export function getUrgencyScore(localized, conference, now) {
  const nowMs = toMs(now);

  let targetIso = null;
  if (localized.deadlineRef) {
    targetIso = getDeadline(conference, localized.deadlineRef);
  }
  if (!targetIso) {
    const next = getNextMilestone(localized, now);
    targetIso = next?.at ?? null;
  }
  if (!targetIso) return 0;

  const targetMs = Date.parse(targetIso);
  const remainingMs = targetMs - nowMs;
  if (remainingMs <= 0) return 0;

  const HOUR = 3600000;
  const DAY = 24 * HOUR;
  if (remainingMs <= DAY) return 40;
  if (remainingMs <= 3 * DAY) return 30;
  if (remainingMs <= 7 * DAY) return 20;
  if (remainingMs <= 14 * DAY) return 10;
  return 0;
}

/** Deterministic ranking tuple, descending, per SDD-NEWS.md §10.4:
 *  urgent > featured > urgencyScore > priority > publishedAt > id (tie-break). */
function rankTuple(localized, conference, now) {
  return [
    localized.urgent ? 1 : 0,
    localized.featured ? 1 : 0,
    getUrgencyScore(localized, conference, now),
    localized.priority ?? 50,
    Date.parse(localized.publishedAt) || 0
  ];
}

function compareTuples(a, b) {
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return b[i] - a[i];
  }
  return 0;
}

/** Rank homepage-eligible items. Does not apply the display limit. */
export function rankHomepageNews(localizedItems, conference, now) {
  return localizedItems
    .filter(item => isHomepageActive(item, now))
    .map(item => ({ item, tuple: rankTuple(item, conference, now) }))
    .sort((a, b) => compareTuples(a.tuple, b.tuple) || a.item.id.localeCompare(b.item.id))
    .map(entry => entry.item);
}

/** Homepage News: at most `normalLimit` non-urgent items, plus at most one
 *  urgent item on top (SDD-NEWS.md §10.2). */
export function getHomepageNews(items, conference, locale, now, normalLimit = 3) {
  const localized = localizeAll(items, locale);
  const ranked = rankHomepageNews(localized, conference, now);

  const urgent = ranked.find(item => item.urgent);
  const normal = ranked.filter(item => item !== urgent).slice(0, normalLimit);

  return urgent ? [urgent, ...normal] : normal;
}

/** Full archive, default publishedAt DESC (SDD-NEWS.md §14). */
export function getArchiveNews(items, locale) {
  return localizeAll(items, locale).sort(
    (a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt)
  );
}

/** "NEW" badge: published within `days` of `now`. Never stored in data. */
export function isNew(localized, now, days = 7) {
  const publishedMs = Date.parse(localized.publishedAt);
  if (Number.isNaN(publishedMs)) return false;
  const nowMs = toMs(now);
  return nowMs - publishedMs <= days * 86400000 && nowMs >= publishedMs;
}

export const CATEGORY_LABELS = {
  general: { zh: "一般", en: "General" },
  submission: { zh: "投稿", en: "Submission" },
  acceptance: { zh: "錄取", en: "Acceptance" },
  "camera-ready": { zh: "完稿", en: "Camera-ready" },
  registration: { zh: "報名", en: "Registration" },
  competition: { zh: "競賽", en: "Competition" },
  program: { zh: "議程", en: "Program" },
  speaker: { zh: "講者", en: "Speaker" },
  workshop: { zh: "工作坊", en: "Workshop" },
  venue: { zh: "會場", en: "Venue" },
  transportation: { zh: "交通", en: "Transportation" },
  conference: { zh: "會議", en: "Conference" },
  important: { zh: "重要", en: "Important" }
};

export function getCategoryLabel(category, locale) {
  return CATEGORY_LABELS[category]?.[locale] ?? category;
}
