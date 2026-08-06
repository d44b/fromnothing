// GET/POST /api/calendar/entries — authenticated CRUD for the band calendar.
// Auth: functions/_calendar/auth.js checkAuth() via the fn_cal cookie (see
// functions/api/calendar/login.js for how that cookie gets issued).
//
// GET returns every row (this is the *admin* view — unlike
// functions/api/calendar/availability.js it is allowed to leak member/title/
// status because it is behind auth). POST creates one row.
//
// Deletion lives in functions/api/calendar/entries/[id].js (Pages Functions
// dynamic routing on the numeric id segment).

import { checkAuth } from "../../_calendar/auth.js";
import { isConfigured, insertEventForEntry } from "../../_calendar/google.js";

const MEMBERS = ["mery", "janusz", "patryk", "wojtek", "damian"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_RANGE_DAYS = 62;
const MAX_TITLE_LEN = 200;
const DAY_MS = 24 * 60 * 60 * 1000;

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

function daysBetween(fromStr, toStr) {
  const [fy, fm, fd] = fromStr.split("-").map(Number);
  const [ty, tm, td] = toStr.split("-").map(Number);
  const fromMs = Date.UTC(fy, fm - 1, fd);
  const toMs = Date.UTC(ty, tm - 1, td);
  return Math.round((toMs - fromMs) / DAY_MS);
}

// Returns { field } on the first violation found, or { record } with a
// fully-normalized row ready to bind into the INSERT.
function validateEntry(body) {
  if (!body || typeof body !== "object") return { field: "body" };

  if (body.type !== "absence" && body.type !== "concert") return { field: "type" };
  const type = body.type;

  if (typeof body.date_from !== "string" || !DATE_RE.test(body.date_from) || !isRealDate(body.date_from)) {
    return { field: "date_from" };
  }
  if (typeof body.date_to !== "string" || !DATE_RE.test(body.date_to) || !isRealDate(body.date_to)) {
    return { field: "date_to" };
  }
  if (!(body.date_from <= body.date_to)) return { field: "date_from" };
  if (daysBetween(body.date_from, body.date_to) > MAX_RANGE_DAYS) return { field: "date_to" };

  if (type === "absence") {
    if (typeof body.member !== "string" || !MEMBERS.includes(body.member)) {
      return { field: "member" };
    }
    if (body.status !== "out" && body.status !== "tentative") {
      return { field: "status" };
    }

    let blocks;
    if (body.status === "tentative") {
      if (body.blocks !== 0 && body.blocks !== 1) return { field: "blocks" };
      blocks = body.blocks;
    } else {
      // status='out' always blocks — forced server-side regardless of input.
      blocks = 1;
    }

    let title = null;
    if (body.title !== undefined && body.title !== null) {
      if (typeof body.title !== "string") return { field: "title" };
      const trimmed = body.title.trim();
      if (trimmed.length > MAX_TITLE_LEN) return { field: "title" };
      title = trimmed === "" ? null : trimmed;
    }

    return {
      record: {
        type: "absence",
        member: body.member,
        status: body.status,
        blocks,
        date_from: body.date_from,
        date_to: body.date_to,
        title,
      },
    };
  }

  // type === 'concert'
  if (body.member !== undefined && body.member !== null) return { field: "member" };
  if (typeof body.title !== "string") return { field: "title" };
  const trimmedTitle = body.title.trim();
  if (trimmedTitle === "" || trimmedTitle.length > MAX_TITLE_LEN) return { field: "title" };

  return {
    record: {
      type: "concert",
      member: null,
      status: "out", // irrelevant for concerts, stored for schema consistency
      blocks: 1,
      date_from: body.date_from,
      date_to: body.date_to,
      title: trimmedTitle,
    },
  };
}

async function handleGet(env) {
  let result;
  try {
    result = await env.DB.prepare(
      `SELECT id, type, member, status, blocks, date_from, date_to, title, google_event_id, created_at, updated_at
       FROM calendar_entries
       ORDER BY date_from ASC`
    ).all();
  } catch (err) {
    console.error("calendar/entries GET: D1 query failed", err);
    return jsonResponse({ error: "server_error" }, 500);
  }
  const entries = (result && result.results) || [];
  return jsonResponse({ ok: true, entries }, 200);
}

async function handlePost(request, env, waitUntil) {
  let body;
  try {
    body = await request.json();
  } catch {
    return validationError("body");
  }

  const outcome = validateEntry(body);
  if (outcome.field) return validationError(outcome.field);
  const record = outcome.record;

  let result;
  try {
    result = await env.DB.prepare(
      `INSERT INTO calendar_entries (type, member, status, blocks, date_from, date_to, title)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        record.type,
        record.member,
        record.status,
        record.blocks,
        record.date_from,
        record.date_to,
        record.title
      )
      .run();
  } catch (err) {
    console.error("calendar/entries POST: D1 insert failed", err);
    return jsonResponse({ error: "server_error" }, 500);
  }

  const id = result && result.meta && result.meta.last_row_id;

  // --- Google Calendar sync (Phase 5) -----------------------------------
  // Best-effort, one-way D1 -> Google push. Runs after the response would
  // already be correct on its own; wrapped in waitUntil so it doesn't delay
  // the response, and in try/catch so any failure (missing config, network,
  // bad creds, Google outage) only logs — it can never change what the API
  // told the caller. Same pattern as the Trello step in
  // functions/api/contact.js.
  if (isConfigured(env) && id) {
    const syncEntry = { ...record, id };
    const syncPromise = (async () => {
      try {
        const eventId = await insertEventForEntry(syncEntry, env);
        await env.DB.prepare(
          `UPDATE calendar_entries SET google_event_id = ?, updated_at = datetime('now') WHERE id = ?`
        )
          .bind(eventId, id)
          .run();
      } catch (err) {
        console.error("calendar/entries POST: Google sync failed", err);
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
    console.error("calendar/entries: DB binding missing");
    return jsonResponse({ error: "server_error" }, 500);
  }

  const authed = await checkAuth(request, env);
  if (!authed) return unauthorized();

  if (request.method === "GET") return handleGet(env);
  return handlePost(request, env, waitUntil);
}
