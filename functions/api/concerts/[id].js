// PUT/DELETE /api/concerts/:id — authenticated full-record update and
// hard-delete of a single concert. Pages Functions dynamic routing supplies
// the segment as `params.id` (always a string).
//
// Both verbs keep the linked functions/api/calendar row (concerts.
// calendar_entry_id) in sync: PUT updates its title/dates and re-syncs the
// Google Calendar event (delete-then-reinsert, since Google has no partial
// all-day-event update helper here); DELETE removes the linked row outright
// and best-effort deletes its Google event. Same waitUntil pattern as
// functions/api/calendar/entries.js / entries/[id].js.
//
// GET (list) + POST (create) live in functions/api/concerts/index.js, which
// also owns validateConcert() (imported from here so PUT validates the exact
// same full record shape as POST).

import { checkAuth } from "../../_calendar/auth.js";
import { isConfigured, insertEventForEntry, deleteEvent } from "../../_calendar/google.js";
import { validateConcert } from "./index.js";

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
  return jsonResponse({ ok: false, error: "method_not_allowed" }, 405, { Allow: "PUT, DELETE" });
}

function unauthorized() {
  return jsonResponse({ ok: false, error: "unauthorized" }, 401);
}

function validationError(field) {
  return jsonResponse({ ok: false, error: "validation", field }, 400);
}

function notFound() {
  return jsonResponse({ ok: false, error: "not_found" }, 404);
}

function parseId(params) {
  const rawId = params && params.id;
  if (typeof rawId !== "string" || !/^\d+$/.test(rawId)) return null;
  return Number(rawId);
}

async function handlePut(request, env, id, waitUntil) {
  let body;
  try {
    body = await request.json();
  } catch {
    return validationError("body");
  }

  const outcome = validateConcert(body);
  if (outcome.field) return validationError(outcome.field);
  const record = outcome.record;

  // Read the current row first: we need its calendar_entry_id to know which
  // linked entry (if any) to update, and that entry's google_event_id (read
  // below) before it gets overwritten.
  let existing;
  try {
    existing = await env.DB.prepare(`SELECT calendar_entry_id FROM concerts WHERE id = ?`)
      .bind(id)
      .first();
  } catch (err) {
    console.error("concerts/[id] PUT: D1 select failed", err);
    return jsonResponse({ error: "server_error" }, 500);
  }
  if (!existing) return notFound();

  try {
    await env.DB.prepare(
      `UPDATE concerts SET
         date = ?, city = ?, venue_name = ?, venue_url = ?,
         address_street = ?, address_postal = ?, address_locality = ?, address_country = ?,
         published = ?, ticket_url = ?, gallery_url = ?, thanks_pl = ?, thanks_en = ?,
         updated_at = datetime('now')
       WHERE id = ?`
    )
      .bind(
        record.date,
        record.city,
        record.venue_name,
        record.venue_url,
        record.address_street,
        record.address_postal,
        record.address_locality,
        record.address_country,
        record.published,
        record.ticket_url,
        record.gallery_url,
        record.thanks_pl,
        record.thanks_en,
        id
      )
      .run();
  } catch (err) {
    console.error("concerts/[id] PUT: D1 update failed", err);
    return jsonResponse({ error: "server_error" }, 500);
  }

  // --- Linked calendar entry: title/dates follow the concert -----------------
  const title = `${record.venue_name} (${record.city})`;
  const calendarEntryId = existing.calendar_entry_id;
  let oldGoogleEventId = null;
  let calendarEntryFound = false;

  if (calendarEntryId) {
    let entryRow;
    try {
      entryRow = await env.DB.prepare(`SELECT google_event_id FROM calendar_entries WHERE id = ?`)
        .bind(calendarEntryId)
        .first();
    } catch (err) {
      console.error("concerts/[id] PUT: linked calendar_entries select failed", err);
      return jsonResponse({ error: "server_error" }, 500);
    }
    if (entryRow) {
      calendarEntryFound = true;
      oldGoogleEventId = entryRow.google_event_id || null;
      try {
        await env.DB.prepare(
          `UPDATE calendar_entries SET title = ?, date_from = ?, date_to = ?, updated_at = datetime('now') WHERE id = ?`
        )
          .bind(title, record.date, record.date, calendarEntryId)
          .run();
      } catch (err) {
        console.error("concerts/[id] PUT: linked calendar_entries update failed", err);
        return jsonResponse({ error: "server_error" }, 500);
      }
    }
  }

  // --- Google Calendar sync (best-effort): drop the old event, if any, then
  // insert a fresh one and record its id. Mirrors the delete-then-insert
  // shape because there is no in-place "move" helper in _calendar/google.js.
  if (isConfigured(env) && calendarEntryFound) {
    const syncPromise = (async () => {
      try {
        if (oldGoogleEventId) {
          await deleteEvent(oldGoogleEventId, env);
        }
        const syncEntry = {
          type: "concert",
          date_from: record.date,
          date_to: record.date,
          title,
          id: calendarEntryId,
        };
        const eventId = await insertEventForEntry(syncEntry, env);
        await env.DB.prepare(
          `UPDATE calendar_entries SET google_event_id = ?, updated_at = datetime('now') WHERE id = ?`
        )
          .bind(eventId, calendarEntryId)
          .run();
      } catch (err) {
        console.error("concerts/[id] PUT: Google sync failed", err);
      }
    })();
    if (typeof waitUntil === "function") waitUntil(syncPromise);
  }
  // -------------------------------------------------------------------------

  return jsonResponse({ ok: true }, 200);
}

async function handleDelete(env, id, waitUntil) {
  // Read the row (incl. its linked calendar entry's google_event_id) BEFORE
  // deleting anything — once the D1 rows are gone we'd have nothing to tell
  // Google which event to remove.
  let existing;
  try {
    existing = await env.DB.prepare(`SELECT calendar_entry_id FROM concerts WHERE id = ?`)
      .bind(id)
      .first();
  } catch (err) {
    console.error("concerts/[id] DELETE: D1 select failed", err);
    return jsonResponse({ error: "server_error" }, 500);
  }
  if (!existing) return notFound();

  const calendarEntryId = existing.calendar_entry_id;
  let googleEventId = null;
  if (calendarEntryId) {
    try {
      const entryRow = await env.DB.prepare(`SELECT google_event_id FROM calendar_entries WHERE id = ?`)
        .bind(calendarEntryId)
        .first();
      googleEventId = entryRow && entryRow.google_event_id;
    } catch (err) {
      console.error("concerts/[id] DELETE: linked calendar_entries select failed", err);
      return jsonResponse({ error: "server_error" }, 500);
    }
  }

  try {
    await env.DB.prepare(`DELETE FROM concerts WHERE id = ?`).bind(id).run();
    if (calendarEntryId) {
      await env.DB.prepare(`DELETE FROM calendar_entries WHERE id = ?`).bind(calendarEntryId).run();
    }
  } catch (err) {
    console.error("concerts/[id] DELETE: D1 delete failed", err);
    return jsonResponse({ error: "server_error" }, 500);
  }

  // --- Google Calendar sync (best-effort) -----------------------------------
  if (isConfigured(env) && googleEventId) {
    const syncPromise = (async () => {
      try {
        await deleteEvent(googleEventId, env);
      } catch (err) {
        console.error("concerts/[id] DELETE: Google sync failed", err);
      }
    })();
    if (typeof waitUntil === "function") waitUntil(syncPromise);
  }
  // -------------------------------------------------------------------------

  return jsonResponse({ ok: true }, 200);
}

export async function onRequest({ request, env, params, waitUntil }) {
  if (request.method !== "PUT" && request.method !== "DELETE") {
    return methodNotAllowed();
  }
  if (!env.DB) {
    console.error("concerts/[id]: DB binding missing");
    return jsonResponse({ error: "server_error" }, 500);
  }

  const authed = await checkAuth(request, env);
  if (!authed) return unauthorized();

  const id = parseId(params);
  if (id === null) return validationError("id");

  if (request.method === "PUT") return handlePut(request, env, id, waitUntil);
  return handleDelete(env, id, waitUntil);
}
