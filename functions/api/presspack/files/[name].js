// DELETE /api/presspack/files/:name — authenticated removal of a single
// shared presspack asset from R2 (bucket binding `MEDIA`, key prefix
// `presspack/`). Listing + upload live in functions/api/presspack/files.js,
// which also owns sanitizeFilename() (imported from there so this route
// rejects exactly the same names POST would have refused to store).
//
// Pages Functions dynamic routing supplies the raw path segment as
// `params.name` — still percent-encoded, since the client built the URL with
// encodeURIComponent(name) (see functions/koncerty.js).

import { checkAuth } from "../../../_calendar/auth.js";
import { sanitizeFilename } from "../files.js";

const PREFIX = "presspack/";

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

function unauthorized() {
  return jsonResponse({ ok: false, error: "unauthorized" }, 401);
}

function validationError(field) {
  return jsonResponse({ ok: false, error: "validation", field }, 400);
}

function notFound() {
  return jsonResponse({ ok: false, error: "not_found" }, 404);
}

async function handleDelete(env, name) {
  const key = PREFIX + name;

  let head;
  try {
    head = await env.MEDIA.head(key);
  } catch (err) {
    console.error("presspack/files/[name] DELETE: R2 head failed", err);
    return jsonResponse({ error: "server_error" }, 500);
  }
  if (!head) return notFound();

  try {
    await env.MEDIA.delete(key);
  } catch (err) {
    console.error("presspack/files/[name] DELETE: R2 delete failed", err);
    return jsonResponse({ error: "server_error" }, 500);
  }

  return jsonResponse({ ok: true }, 200);
}

export async function onRequest({ request, env, params }) {
  if (request.method !== "DELETE") {
    return methodNotAllowed();
  }
  if (!env.MEDIA) {
    console.error("presspack/files/[name]: MEDIA binding missing");
    return jsonResponse({ error: "server_error" }, 500);
  }

  const authed = await checkAuth(request, env);
  if (!authed) return unauthorized();

  const rawName = params && params.name;
  let decoded;
  try {
    decoded = decodeURIComponent(typeof rawName === "string" ? rawName : "");
  } catch {
    return validationError("name");
  }

  const name = sanitizeFilename(decoded);
  if (!name) return validationError("name");

  return handleDelete(env, name);
}
