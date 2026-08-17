// POST/DELETE /api/concerts/:id/presspack-link — authenticated generate /
// revoke of a concert's public presspack download token
// (concerts.presspack_token). The public download route itself
// (GET /presspack/<token>, functions/presspack/[token].js) ships in Phase 4;
// this endpoint only manages the token value.
//
// POST always overwrites any previous token (rotate-on-generate — there is
// no separate "rotate" verb, calling POST again *is* rotation). DELETE nulls
// it out, revoking any link already handed out.

import { checkAuth } from "../../../_calendar/auth.js";

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
  return jsonResponse({ ok: false, error: "method_not_allowed" }, 405, { Allow: "POST, DELETE" });
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

// 16 random bytes -> 32 lowercase hex chars. crypto.getRandomValues is
// available in the Workers runtime without any import.
function generateToken() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function handlePost(env, id) {
  const token = generateToken();
  let result;
  try {
    result = await env.DB.prepare(`UPDATE concerts SET presspack_token = ?, updated_at = datetime('now') WHERE id = ?`)
      .bind(token, id)
      .run();
  } catch (err) {
    console.error("concerts/[id]/presspack-link POST: D1 update failed", err);
    return jsonResponse({ error: "server_error" }, 500);
  }
  const changes = result && result.meta && result.meta.changes;
  if (!changes) return notFound();

  return jsonResponse({ ok: true, token, url: `/presspack/${token}` }, 200);
}

async function handleDelete(env, id) {
  let result;
  try {
    result = await env.DB.prepare(`UPDATE concerts SET presspack_token = NULL, updated_at = datetime('now') WHERE id = ?`)
      .bind(id)
      .run();
  } catch (err) {
    console.error("concerts/[id]/presspack-link DELETE: D1 update failed", err);
    return jsonResponse({ error: "server_error" }, 500);
  }
  const changes = result && result.meta && result.meta.changes;
  if (!changes) return notFound();

  return jsonResponse({ ok: true }, 200);
}

export async function onRequest({ request, env, params }) {
  if (request.method !== "POST" && request.method !== "DELETE") {
    return methodNotAllowed();
  }
  if (!env.DB) {
    console.error("concerts/[id]/presspack-link: DB binding missing");
    return jsonResponse({ error: "server_error" }, 500);
  }

  const authed = await checkAuth(request, env);
  if (!authed) return unauthorized();

  const id = parseId(params);
  if (id === null) return validationError("id");

  if (request.method === "POST") return handlePost(env, id);
  return handleDelete(env, id);
}
