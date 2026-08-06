// POST/DELETE /api/calendar/login — password auth for the band calendar
// admin UI. POST verifies env.CALENDAR_PASSWORD and, on success, issues a
// signed session cookie (see functions/_calendar/auth.js). DELETE clears the
// cookie (logout). No GET here on purpose — logging in is never a bare link.

import { verifyPassword, issueSessionCookie, expiredCookie } from "../../_calendar/auth.js";

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
  return jsonResponse(
    { ok: false, error: "method_not_allowed" },
    405,
    { Allow: "POST, DELETE" }
  );
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function handlePost(request, env) {
  if (
    !env.CALENDAR_PASSWORD ||
    !env.CALENDAR_SESSION_SECRET ||
    typeof env.CALENDAR_PASSWORD !== "string" ||
    typeof env.CALENDAR_SESSION_SECRET !== "string"
  ) {
    // Misconfigured project (secrets not set), not a client error.
    console.error("calendar/login: CALENDAR_PASSWORD or CALENDAR_SESSION_SECRET missing");
    return jsonResponse({ error: "server_error" }, 500);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ ok: false, error: "malformed_body" }, 400);
  }
  if (!body || typeof body !== "object" || typeof body.password !== "string") {
    return jsonResponse({ ok: false, error: "malformed_body" }, 400);
  }

  const valid = await verifyPassword(body.password, env);
  if (!valid) {
    // Artificial delay slows down online brute-forcing; there is no
    // server-side rate-limit store for this single shared password.
    await delay(300);
    return jsonResponse({ ok: false, error: "unauthorized" }, 401);
  }

  const cookie = await issueSessionCookie(env);
  return jsonResponse({ ok: true }, 200, { "Set-Cookie": cookie });
}

function handleDelete() {
  return jsonResponse({ ok: true }, 200, { "Set-Cookie": expiredCookie() });
}

export async function onRequest({ request, env }) {
  if (request.method === "POST") return handlePost(request, env);
  if (request.method === "DELETE") return handleDelete();
  return methodNotAllowed();
}
