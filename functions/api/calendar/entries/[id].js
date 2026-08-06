// DELETE /api/calendar/entries/:id — authenticated hard-delete of a single
// calendar entry by numeric id. Pages Functions dynamic routing supplies the
// segment as `params.id` (always a string).

import { checkAuth } from "../../../_calendar/auth.js";
import { isConfigured, deleteEvent } from "../../../_calendar/google.js";

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
  return jsonResponse({ ok: false, error: "method_not_allowed" }, 405, { Allow: "DELETE" });
}

export async function onRequest({ request, env, params, waitUntil }) {
  if (request.method !== "DELETE") return methodNotAllowed();

  if (!env.DB) {
    console.error("calendar/entries/[id]: DB binding missing");
    return jsonResponse({ error: "server_error" }, 500);
  }

  const authed = await checkAuth(request, env);
  if (!authed) return jsonResponse({ ok: false, error: "unauthorized" }, 401);

  const rawId = params && params.id;
  if (typeof rawId !== "string" || !/^\d+$/.test(rawId)) {
    return jsonResponse({ ok: false, error: "validation", field: "id" }, 400);
  }
  const id = Number(rawId);

  // Read the row (incl. google_event_id) BEFORE deleting — once the D1 row
  // is gone we'd have nothing to tell Google which event to remove.
  let existing = null;
  try {
    existing = await env.DB.prepare(
      `SELECT google_event_id FROM calendar_entries WHERE id = ?`
    )
      .bind(id)
      .first();
  } catch (err) {
    console.error("calendar/entries/[id] DELETE: D1 select failed", err);
    return jsonResponse({ error: "server_error" }, 500);
  }

  let result;
  try {
    result = await env.DB.prepare(`DELETE FROM calendar_entries WHERE id = ?`).bind(id).run();
  } catch (err) {
    console.error("calendar/entries/[id] DELETE: D1 delete failed", err);
    return jsonResponse({ error: "server_error" }, 500);
  }

  const changes = result && result.meta && result.meta.changes;
  if (!changes) {
    return jsonResponse({ ok: false, error: "not_found" }, 404);
  }

  // --- Google Calendar sync (Phase 5) -----------------------------------
  // Best-effort delete of the linked event, if one was ever created. Runs
  // after the D1 delete already succeeded, wrapped in waitUntil + try/catch
  // so a Google outage never changes this endpoint's response.
  const googleEventId = existing && existing.google_event_id;
  if (isConfigured(env) && googleEventId) {
    const syncPromise = (async () => {
      try {
        await deleteEvent(googleEventId, env);
      } catch (err) {
        console.error("calendar/entries/[id] DELETE: Google sync failed", err);
      }
    })();
    if (typeof waitUntil === "function") waitUntil(syncPromise);
  }
  // -------------------------------------------------------------------------

  return jsonResponse({ ok: true }, 200);
}
