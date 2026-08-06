// Pure availability logic for the band calendar. No D1, no fetch, no I/O —
// importable both by Pages Functions (ESM) and by a plain node test.
//
// The `_calendar` directory name starts with `_`, which keeps Cloudflare
// Pages Functions routing from treating this as a route.

const DAY_MS = 24 * 60 * 60 * 1000;

// 'YYYY-MM-DD' -> epoch ms at UTC midnight. Only used for *stepping* through
// days; every comparison against entry ranges stays a plain string compare
// (lexicographic order on 'YYYY-MM-DD' is chronological order), so there is
// no timezone pitfall here.
function parseUTCDate(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

// epoch ms -> 'YYYY-MM-DD', UTC.
function formatUTCDate(ms) {
  const dt = new Date(ms);
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const d = String(dt.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Does this single entry cover `dateStr` and count as blocking?
// - concert: always blocks any day it covers.
// - absence: blocks only when blocks=1 (every 'out' has blocks=1 by schema
//   default/CHECK; 'tentative' may be 0 or 1). blocks=0 is ignored — the
//   concert takes priority and the day stays public.
function isBlocking(entry, dateStr) {
  if (!entry) return false;
  if (!(entry.date_from <= dateStr && dateStr <= entry.date_to)) return false;
  if (entry.type === "concert") return true;
  if (entry.type === "absence") return Number(entry.blocks) === 1;
  return false;
}

// entries: array of rows shaped like the `calendar_entries` table (or any
// subset of its columns — only type/blocks/date_from/date_to are read).
// fromDate/toDate: inclusive 'YYYY-MM-DD' bounds.
// Returns [{date:'YYYY-MM-DD', kind:'wolne'|'slask'}, ...] for every free
// Friday/Saturday/Sunday in the range, in chronological order. Monday–
// Thursday are never candidates and never appear.
export function computeAvailability(entries, fromDate, toDate) {
  const list = Array.isArray(entries) ? entries : [];
  const startMs = parseUTCDate(fromDate);
  const endMs = parseUTCDate(toDate);
  const days = [];

  for (let ms = startMs; ms <= endMs; ms += DAY_MS) {
    const dow = new Date(ms).getUTCDay(); // 0=Sun ... 5=Fri, 6=Sat
    if (dow !== 0 && dow !== 5 && dow !== 6) continue;

    const dateStr = formatUTCDate(ms);
    if (list.some((entry) => isBlocking(entry, dateStr))) continue;

    days.push({ date: dateStr, kind: dow === 5 ? "slask" : "wolne" });
  }

  return days;
}
