// GET /api/calendar/availability — public read-only endpoint for the band
// calendar. Computes the free Friday/Saturday/Sunday days over the next 12
// months from D1 (binding `DB`, table `calendar_entries`) and returns
// nothing beyond {from, to, days}. No member names, titles, statuses, or
// google_event_id ever leave this function — the D1 query itself only reads
// the columns the availability rule needs.

import { computeAvailability } from "../../_calendar/logic.js";

function jsonResponse(body, status, extraHeaders) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "X-Robots-Tag": "noindex",
      ...extraHeaders,
    },
  });
}

function methodNotAllowed() {
  return jsonResponse(
    { ok: false, error: "method_not_allowed" },
    405,
    { "Cache-Control": "no-store", Allow: "GET" }
  );
}

// epoch ms (UTC midnight) -> 'YYYY-MM-DD'.
function formatUTCDate(ms) {
  const dt = new Date(ms);
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const d = String(dt.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// [today, today + 12 months] as inclusive 'YYYY-MM-DD' strings, UTC. The
// horizon only ever deals in whole dates, so the server's local timezone
// does not matter (see roadmap decision on Europe/Warsaw).
function horizon() {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const d = now.getUTCDate();
  return {
    from: formatUTCDate(Date.UTC(y, m, d)),
    to: formatUTCDate(Date.UTC(y, m + 12, d)),
  };
}

export async function onRequest({ request, env }) {
  if (request.method !== "GET") return methodNotAllowed();

  if (!env.DB) {
    // Misconfigured project (binding missing), not a client error.
    console.error("calendar/availability: DB binding missing");
    return jsonResponse({ error: "server_error" }, 500, { "Cache-Control": "no-store" });
  }

  const { from, to } = horizon();

  let entries;
  try {
    // Only the columns the availability rule needs — member/status/title/
    // google_event_id never even enter this process, let alone the response.
    const result = await env.DB.prepare(
      `SELECT type, blocks, date_from, date_to
       FROM calendar_entries
       WHERE date_to >= ? AND date_from <= ?`
    )
      .bind(from, to)
      .all();
    entries = (result && result.results) || [];
  } catch (err) {
    console.error("calendar/availability: D1 query failed", err);
    return jsonResponse({ error: "server_error" }, 500, { "Cache-Control": "no-store" });
  }

  const days = computeAvailability(entries, from, to);

  return jsonResponse({ from, to, days }, 200, { "Cache-Control": "public, max-age=300" });
}
