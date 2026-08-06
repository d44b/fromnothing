// POST /api/calendar/resync — authenticated catch-up sync: pushes any D1
// calendar_entries row that has never made it to Google Calendar (i.e.
// google_event_id IS NULL — either because Google wasn't configured yet, or
// because a previous best-effort push failed) into the band's Google
// Calendar. See functions/_calendar/google.js for the sync mechanics and
// functions/api/calendar/entries.js for the normal on-write sync path this
// backfills.
//
// Unlike the entries.js/[id].js sync calls, this one is awaited directly in
// the handler (not context.waitUntil) — the whole point of resync is for the
// caller to see how many rows actually got synced.

import { checkAuth } from "../../_calendar/auth.js";
import { isConfigured, insertEventForEntry } from "../../_calendar/google.js";

function jsonResponse(body, status, extraHeaders) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "X-Robots-Tag": "noindex",
      "Cache-Control": "no-store",
      ...extraHeaders,
    },
  });
}

function methodNotAllowed() {
  return jsonResponse({ ok: false, error: "method_not_allowed" }, 405, { Allow: "POST" });
}

export async function onRequest({ request, env }) {
  if (request.method !== "POST") return methodNotAllowed();

  if (!env.DB) {
    console.error("calendar/resync: DB binding missing");
    return jsonResponse({ error: "server_error" }, 500);
  }

  const authed = await checkAuth(request, env);
  if (!authed) return jsonResponse({ ok: false, error: "unauthorized" }, 401);

  if (!isConfigured(env)) {
    return jsonResponse({ ok: true, synced: 0, skipped: "not_configured" }, 200);
  }

  let result;
  try {
    result = await env.DB.prepare(
      `SELECT id, type, member, status, blocks, date_from, date_to, title
       FROM calendar_entries
       WHERE google_event_id IS NULL
       ORDER BY id ASC`
    ).all();
  } catch (err) {
    console.error("calendar/resync: D1 query failed", err);
    return jsonResponse({ error: "server_error" }, 500);
  }

  const entries = (result && result.results) || [];

  let synced = 0;
  let failed = 0;

  // Sequential and awaited (not waitUntil) so the response reflects the
  // real outcome. Per-entry failures are counted, never thrown — one bad
  // entry must not abort the rest of the backfill.
  for (const entry of entries) {
    try {
      const eventId = await insertEventForEntry(entry, env);
      await env.DB.prepare(
        `UPDATE calendar_entries SET google_event_id = ?, updated_at = datetime('now') WHERE id = ?`
      )
        .bind(eventId, entry.id)
        .run();
      synced++;
    } catch (err) {
      console.error("calendar/resync: sync failed for entry", entry.id, err);
      failed++;
    }
  }

  return jsonResponse({ ok: true, synced, failed }, 200);
}
