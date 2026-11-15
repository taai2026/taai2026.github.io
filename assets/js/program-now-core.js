/* TAAI 2026 — "Happening now / Up next" logic for the program page.
   Pure functions, no DOM: every time-dependent function takes `now` (a Date
   or epoch ms) so it can be checked at any instant (?now= preview).
   A classic script (not a module) so the program page keeps working when
   opened from file://; it exposes one global, TAAINowNext. */
(function (global) {
  "use strict";

  const toMs = now => (now instanceof Date ? now.getTime() : now);

  /** Absolute time for a timetable clock string on a conference day.
   *  dateIso is "2026-11-20"; times are Asia/Taipei (+08:00). */
  function at(dateIso, hhmm) {
    return Date.parse(`${dateIso}T${hhmm}:00+08:00`);
  }

  /** Items whose [start, end) contains now, and the group of items with the
   *  next start time after now. Items: { start, end, ... } in epoch ms.
   *  Long background items (e.g. all-day registration) are skipped. */
  function nowNext(items, now, maxMinutes = 240) {
    const t = toMs(now);
    const usable = items.filter(i => i.end - i.start <= maxMinutes * 60000);
    const current = usable.filter(i => i.start <= t && t < i.end)
      .sort((a, b) => a.start - b.start || a.order - b.order);
    const upcoming = usable.filter(i => i.start > t);
    const nextStart = upcoming.length ? Math.min(...upcoming.map(i => i.start)) : null;
    const next = nextStart === null ? [] :
      upcoming.filter(i => i.start === nextStart).sort((a, b) => a.order - b.order);
    return { current, next };
  }

  /** True while the live box should show: from shortly before the first
   *  item of the conference until the last item ends. */
  function isLive(items, now, leadMinutes = 90) {
    if (!items.length) return false;
    const t = toMs(now);
    const first = Math.min(...items.map(i => i.start));
    const last = Math.max(...items.map(i => i.end));
    return t >= first - leadMinutes * 60000 && t < last;
  }

  global.TAAINowNext = { at, nowNext, isLive };
})(window);
