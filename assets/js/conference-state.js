/* TAAI 2026 — conference lifecycle (pure functions, no DOM).
   Every time-dependent function accepts `now` (a Date or epoch ms) so it can
   be unit-tested deterministically instead of depending on the system clock. */

function toMs(now) {
  return now instanceof Date ? now.getTime() : now;
}

/** Resolve a canonical TAAI deadline key from conference.json. Returns an ISO
 *  string, or null if the key does not exist (callers must not throw on
 *  unknown deadlineRef — validation catches that case ahead of render time). */
export function getDeadline(conference, key) {
  return conference?.deadlines?.[key] ?? null;
}

/** Ordered lifecycle phases. `end` is the instant the phase's own concern
 *  closes; `null` means "open ended" (used only for the last phase). */
function buildPhaseTimeline(conference) {
  const d = conference?.deadlines ?? {};
  return [
    { id: "submission", end: d.paperSubmission },
    { id: "review", end: d.notification },
    { id: "camera-ready", end: d.cameraReady },
    { id: "registration", end: d.regularRegistration },
    { id: "pre-conference", end: conference?.conference?.start },
    { id: "conference", end: conference?.conference?.end },
    { id: "post-conference", end: null }
  ];
}

/** Returns { primary, active } describing which conceptual lifecycle phases
 *  are current. `active` may contain more than one phase (e.g. camera-ready
 *  and registration can overlap). */
export function getConferenceState(conference, now) {
  const nowMs = toMs(now);
  const timeline = buildPhaseTimeline(conference);
  const active = [];

  for (const phase of timeline) {
    const endMs = phase.end ? Date.parse(phase.end) : null;
    if (endMs === null || nowMs <= endMs) {
      active.push(phase.id);
    }
  }

  const primary = active[0] ?? timeline[timeline.length - 1].id;
  return { primary, active: active.length ? active : [primary] };
}
