// GET/POST /api/presspack/files — authenticated management of the shared
// presspack assets stored in R2 (bucket binding `MEDIA`, key prefix
// `presspack/`). These files are shared across every concert — the
// per-concert ZIP assembled in Phase 4 (functions/presspack/[token].js)
// packs every object under this prefix alongside a generated info file.
//
// Auth: functions/_calendar/auth.js checkAuth() via the fn_cal cookie — same
// shared password as /kalendarz and /koncerty, no second login.
//
// Deletion of a single file lives in
// functions/api/presspack/files/[name].js (Pages Functions dynamic routing
// on the name segment), which imports sanitizeFilename() from here so DELETE
// rejects exactly the same names POST would have refused to store.

import { checkAuth } from "../../_calendar/auth.js";

const PREFIX = "presspack/";
const MAX_NAME_LEN = 200;
const NAME_RE = /^[A-Za-z0-9._ ()-]+$/;

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

function validationError(field) {
  return jsonResponse({ ok: false, error: "validation", field }, 400);
}

// Shared sanitization rule: non-empty after trim, ≤200 chars, only
// [A-Za-z0-9._ ()-], and never starting with a dot (blocks dotfiles and,
// combined with the charset, any `../` traversal attempt). Returns the
// trimmed name or null.
export function sanitizeFilename(raw) {
  if (typeof raw !== "string") return null;
  const name = raw.trim();
  if (name === "" || name.length > MAX_NAME_LEN) return null;
  if (name.startsWith(".")) return null;
  if (!NAME_RE.test(name)) return null;
  return name;
}

async function handleGet(env) {
  const files = [];
  let cursor;
  try {
    do {
      const listing = await env.MEDIA.list({ prefix: PREFIX, cursor });
      for (const obj of listing.objects) {
        files.push({ name: obj.key.slice(PREFIX.length), size: obj.size });
      }
      cursor = listing.truncated ? listing.cursor : undefined;
    } while (cursor);
  } catch (err) {
    console.error("presspack/files GET: R2 list failed", err);
    return jsonResponse({ error: "server_error" }, 500);
  }
  return jsonResponse({ ok: true, files }, 200);
}

async function handlePost(request, env) {
  let form;
  try {
    form = await request.formData();
  } catch {
    return validationError("file");
  }

  const file = form.get("file");
  if (!(file instanceof File)) return validationError("file");

  const name = sanitizeFilename(file.name);
  if (!name) return validationError("file");

  try {
    // File is itself a Blob — R2Bucket.put() accepts it directly, no need
    // to go via file.stream().
    await env.MEDIA.put(PREFIX + name, file, {
      httpMetadata: { contentType: file.type || "application/octet-stream" },
    });
  } catch (err) {
    console.error("presspack/files POST: R2 put failed", err);
    return jsonResponse({ error: "server_error" }, 500);
  }

  return jsonResponse({ ok: true, name }, 201);
}

export async function onRequest({ request, env }) {
  if (request.method !== "GET" && request.method !== "POST") {
    return methodNotAllowed();
  }
  if (!env.MEDIA) {
    console.error("presspack/files: MEDIA binding missing");
    return jsonResponse({ error: "server_error" }, 500);
  }

  const authed = await checkAuth(request, env);
  if (!authed) return unauthorized();

  if (request.method === "GET") return handleGet(env);
  return handlePost(request, env);
}
