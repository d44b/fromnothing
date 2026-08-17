// GET/POST /api/concerts — authenticated CRUD for the band's concert list
// (Phase 1 of specs/koncerty-presspack/roadmap.md).
//
// Auth: functions/_calendar/auth.js checkAuth() via the fn_cal cookie — same
// shared password as /kalendarz, no second login.
//
// GET returns every column of every row (admin view, behind auth). POST
// creates a concert AND its linked blocking functions/api/calendar row (type
// 'concert') so the date is cut from /kalendarz + /terminy availability and,
// best-effort, synced to Google Calendar — same waitUntil pattern as
// functions/api/calendar/entries.js.
//
// Update/delete of a single concert lives in functions/api/concerts/[id].js
// (Pages Functions dynamic routing on the numeric id segment); presspack
// token generation/revocation lives in
// functions/api/concerts/[id]/presspack-link.js.

import { checkAuth } from "../../_calendar/auth.js";
import { isConfigured, insertEventForEntry } from "../../_calendar/google.js";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const URL_RE = /^https?:\/\//;
const COUNTRY_RE = /^[A-Z]{2}$/;
const MAX_SHORT_LEN = 200;
const MAX_URL_LEN = 500;
const MAX_THANKS_LEN = 500;

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
  return jsonResponse({ ok: false, error: "method_not_allowed" }, 405, { Allow: "GET, POST" });
}

function unauthorized() {
  return jsonResponse({ ok: false, error: "unauthorized" }, 401);
}

// Never echoes the offending value back — only the field name.
function validationError(field) {
  return jsonResponse({ ok: false, error: "validation", field }, 400);
}

function isRealDate(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  if (m < 1 || m > 12) return false;
  const isLeap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  const daysInMonth = [31, isLeap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (d < 1 || d > daysInMonth[m - 1]) return false;
  return true;
}

// Trims, treats empty-after-trim as "not provided" (-> null), enforces a max
// length. Returns { field } on violation or { value } (string or null).
function optionalShortText(value, field, maxLen) {
  if (value === undefined || value === null || value === "") return { value: null };
  if (typeof value !== "string") return { field };
  const trimmed = value.trim();
  if (trimmed === "") return { value: null };
  if (trimmed.length > maxLen) return { field };
  return { value: trimmed };
}

// Same as optionalShortText but also requires an http(s) URL shape.
function optionalUrl(value, field) {
  const result = optionalShortText(value, field, MAX_URL_LEN);
  if (result.field || result.value === null) return result;
  if (!URL_RE.test(result.value)) return { field };
  return result;
}

// Returns { field } on the first violation found, or { record } with a
// fully-normalized row ready to bind into INSERT/UPDATE. Shared by the POST
// handler here and the PUT handler in functions/api/concerts/[id].js (this
// is the *entire* record — concerts are updated whole, not patched).
export function validateConcert(body) {
  if (!body || typeof body !== "object") return { field: "body" };

  if (typeof body.date !== "string" || !DATE_RE.test(body.date) || !isRealDate(body.date)) {
    return { field: "date" };
  }

  if (typeof body.city !== "string") return { field: "city" };
  const city = body.city.trim();
  if (city === "" || city.length > MAX_SHORT_LEN) return { field: "city" };

  if (typeof body.venue_name !== "string") return { field: "venue_name" };
  const venueName = body.venue_name.trim();
  if (venueName === "" || venueName.length > MAX_SHORT_LEN) return { field: "venue_name" };

  const venueUrl = optionalUrl(body.venue_url, "venue_url");
  if (venueUrl.field) return venueUrl;
  const ticketUrl = optionalUrl(body.ticket_url, "ticket_url");
  if (ticketUrl.field) return ticketUrl;
  const galleryUrl = optionalUrl(body.gallery_url, "gallery_url");
  if (galleryUrl.field) return galleryUrl;

  const street = optionalShortText(body.address_street, "address_street", MAX_SHORT_LEN);
  if (street.field) return street;
  const postal = optionalShortText(body.address_postal, "address_postal", MAX_SHORT_LEN);
  if (postal.field) return postal;
  const locality = optionalShortText(body.address_locality, "address_locality", MAX_SHORT_LEN);
  if (locality.field) return locality;

  let country = "PL";
  if (body.address_country !== undefined && body.address_country !== null && body.address_country !== "") {
    if (typeof body.address_country !== "string" || !COUNTRY_RE.test(body.address_country)) {
      return { field: "address_country" };
    }
    country = body.address_country;
  }

  let published = 1;
  if (body.published !== undefined && body.published !== null) {
    if (body.published !== 0 && body.published !== 1) return { field: "published" };
    published = body.published;
  }

  const thanksPl = optionalShortText(body.thanks_pl, "thanks_pl", MAX_THANKS_LEN);
  if (thanksPl.field) return thanksPl;
  const thanksEn = optionalShortText(body.thanks_en, "thanks_en", MAX_THANKS_LEN);
  if (thanksEn.field) return thanksEn;

  return {
    record: {
      date: body.date,
      city,
      venue_name: venueName,
      venue_url: venueUrl.value,
      address_street: street.value,
      address_postal: postal.value,
      address_locality: locality.value,
      address_country: country,
      published,
      ticket_url: ticketUrl.value,
      gallery_url: galleryUrl.value,
      thanks_pl: thanksPl.value,
      thanks_en: thanksEn.value,
    },
  };
}

async function handleGet(env) {
  let result;
  try {
    result = await env.DB.prepare(`SELECT * FROM concerts ORDER BY date ASC`).all();
  } catch (err) {
    console.error("concerts GET: D1 query failed", err);
    return jsonResponse({ error: "server_error" }, 500);
  }
  const concerts = (result && result.results) || [];
  return jsonResponse({ ok: true, concerts }, 200);
}

async function handlePost(request, env, waitUntil) {
  let body;
  try {
    body = await request.json();
  } catch {
    return validationError("body");
  }

  const outcome = validateConcert(body);
  if (outcome.field) return validationError(outcome.field);
  const record = outcome.record;

  let insertResult;
  try {
    insertResult = await env.DB.prepare(
      `INSERT INTO concerts (
         date, city, venue_name, venue_url,
         address_street, address_postal, address_locality, address_country,
         published, ticket_url, gallery_url, thanks_pl, thanks_en
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
        record.thanks_en
      )
      .run();
  } catch (err) {
    console.error("concerts POST: D1 insert failed", err);
    return jsonResponse({ error: "server_error" }, 500);
  }

  const id = insertResult && insertResult.meta && insertResult.meta.last_row_id;

  // --- Linked blocking calendar entry ---------------------------------------
  // Every concert blocks its own date in /kalendarz + /terminy the same way
  // an 'out' absence does. title mirrors what /koncerty (Phase 3) will show:
  // "<venue> (<city>)".
  const title = `${record.venue_name} (${record.city})`;
  let calendarEntryId = null;
  try {
    const entryResult = await env.DB.prepare(
      `INSERT INTO calendar_entries (type, member, status, blocks, date_from, date_to, title)
       VALUES ('concert', NULL, 'out', 1, ?, ?, ?)`
    )
      .bind(record.date, record.date, title)
      .run();
    calendarEntryId = entryResult && entryResult.meta && entryResult.meta.last_row_id;
    if (calendarEntryId) {
      await env.DB.prepare(`UPDATE concerts SET calendar_entry_id = ? WHERE id = ?`)
        .bind(calendarEntryId, id)
        .run();
    }
  } catch (err) {
    console.error("concerts POST: linked calendar_entries insert failed", err);
    return jsonResponse({ error: "server_error" }, 500);
  }

  // --- Google Calendar sync (best-effort, same pattern as
  // functions/api/calendar/entries.js) --------------------------------------
  if (isConfigured(env) && calendarEntryId) {
    const syncEntry = {
      type: "concert",
      date_from: record.date,
      date_to: record.date,
      title,
      id: calendarEntryId,
    };
    const syncPromise = (async () => {
      try {
        const eventId = await insertEventForEntry(syncEntry, env);
        await env.DB.prepare(
          `UPDATE calendar_entries SET google_event_id = ?, updated_at = datetime('now') WHERE id = ?`
        )
          .bind(eventId, calendarEntryId)
          .run();
      } catch (err) {
        console.error("concerts POST: Google sync failed", err);
      }
    })();
    if (typeof waitUntil === "function") waitUntil(syncPromise);
  }
  // -------------------------------------------------------------------------

  return jsonResponse({ ok: true, id }, 201);
}

export async function onRequest({ request, env, waitUntil }) {
  if (request.method !== "GET" && request.method !== "POST") {
    return methodNotAllowed();
  }
  if (!env.DB) {
    console.error("concerts: DB binding missing");
    return jsonResponse({ error: "server_error" }, 500);
  }

  const authed = await checkAuth(request, env);
  if (!authed) return unauthorized();

  if (request.method === "GET") return handleGet(env);
  return handlePost(request, env, waitUntil);
}
