// POST /api/contact — lead capture, writes to D1 (binding `DB`).
//
// Accepts JSON or form-encoded bodies (application/x-www-form-urlencoded or
// multipart/form-data — both are handled by the Fetch API's formData()).
// Responses are always JSON; nothing from the request body is ever echoed
// back, so there is nothing here for an attacker to reflect into a client.
//
// Honeypot: a non-empty `website` field means the submitter is a bot. We
// answer exactly like a real success (200, {ok:true}, no `id`) but skip the
// D1 write — a real client never sees the difference, so there is nothing
// to learn from probing the response.

const LIMITS = { name: 200, email: 320, subject: 300, message: 5000 };
const USER_AGENT_LIMIT = 300;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function jsonResponse(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

// Verify a Turnstile token with Cloudflare's siteverify endpoint. Any failure
// mode — missing/wrong secret, malformed response, network error — resolves
// to `false` (fail closed): a broken captcha check must reject, not admit.
async function verifyTurnstile(token, secret, ip) {
  try {
    const body = new URLSearchParams({ secret, response: token });
    if (ip) body.set("remoteip", ip);
    const res = await fetch(SITEVERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!res.ok) return false;
    const result = await res.json();
    return result && result.success === true;
  } catch {
    return false;
  }
}

const TRELLO_TIMEOUT_MS = 5000;

// Create a Trello card for a lead. Returns the card id, or `null` on any
// failure (bad response, timeout, network error) — never throws. The caller
// treats a Trello outage as non-fatal: the lead is already in D1.
async function createTrelloCard(env, lead) {
  const base = env.TRELLO_API_BASE || "https://api.trello.com";
  const cardName = lead.subject ? `${lead.subject} — ${lead.name}` : `Kontakt — ${lead.name}`;
  const desc = [
    lead.message,
    "",
    "---",
    `E-mail: [${lead.email}](mailto:${lead.email})`,
    `Lang: ${lead.lang || "—"}`,
    `Lead #${lead.id}`,
  ].join("\n");

  const params = new URLSearchParams({
    key: env.TRELLO_KEY,
    token: env.TRELLO_TOKEN,
    idList: env.TRELLO_LIST_ID,
    name: cardName,
    desc,
  });

  const res = await fetch(`${base}/1/cards?${params.toString()}`, {
    method: "POST",
    signal: AbortSignal.timeout(TRELLO_TIMEOUT_MS),
  });
  if (!res.ok) return null;
  const card = await res.json();
  return card && typeof card.id === "string" ? card.id : null;
}

function methodNotAllowed() {
  return new Response(JSON.stringify({ ok: false, error: "method_not_allowed" }), {
    status: 405,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      Allow: "POST",
    },
  });
}

// Read name/email/subject/message/lang/website out of whatever shape the
// client sent. request.formData() parses both urlencoded and multipart
// bodies in the Workers runtime, so JSON is the only branch needed besides it.
async function parseBody(request) {
  const contentType = (request.headers.get("Content-Type") || "").toLowerCase();

  if (contentType.includes("application/json")) {
    const data = await request.json(); // throws on malformed JSON — caught by caller
    if (!data || typeof data !== "object") throw new Error("bad_json_shape");
    return data;
  }

  if (
    contentType.includes("application/x-www-form-urlencoded") ||
    contentType.includes("multipart/form-data")
  ) {
    const form = await request.formData();
    return Object.fromEntries(form.entries());
  }

  throw new Error("unsupported_content_type");
}

// A field value must be a plain string (form-data can hand back a File for
// an unexpected field) and, once trimmed, non-empty and within its cap.
function readField(data, key, maxLength, required) {
  const raw = data[key];
  if (raw === undefined || raw === null) {
    if (required) throw new Error(`${key}_required`);
    return "";
  }
  if (typeof raw !== "string") throw new Error(`${key}_invalid`);
  const value = raw.trim();
  if (required && value === "") throw new Error(`${key}_required`);
  if (value.length > maxLength) throw new Error(`${key}_too_long`);
  return value;
}

export async function onRequest({ request, env }) {
  if (request.method !== "POST") return methodNotAllowed();

  let data;
  try {
    data = await parseBody(request);
  } catch {
    return jsonResponse({ ok: false, error: "invalid_body" }, 400);
  }

  let name, email, subject, message, website;
  try {
    name = readField(data, "name", LIMITS.name, true);
    email = readField(data, "email", LIMITS.email, true);
    subject = readField(data, "subject", LIMITS.subject, false);
    message = readField(data, "message", LIMITS.message, true);
    website = readField(data, "website", 500, false); // honeypot, generous cap
  } catch {
    return jsonResponse({ ok: false, error: "invalid_input" }, 400);
  }

  if (!EMAIL_RE.test(email)) {
    return jsonResponse({ ok: false, error: "invalid_input" }, 400);
  }

  // lang is optional and only ever 'pl' or 'en'; anything else is dropped
  // rather than rejected — it's metadata, not a required field.
  const rawLang = typeof data.lang === "string" ? data.lang.trim().toLowerCase() : "";
  const lang = rawLang === "pl" || rawLang === "en" ? rawLang : null;

  const ip = request.headers.get("CF-Connecting-IP") || null;
  const userAgent = (request.headers.get("User-Agent") || "").slice(0, USER_AGENT_LIMIT) || null;

  // --- Honeypot -------------------------------------------------------
  // Bots fill every field they can see; real visitors never see `website`
  // (it's hidden from assistive tech too — see index.html). Pretend success,
  // write nothing.
  if (website !== "") {
    return jsonResponse({ ok: true }, 200);
  }

  // --- Turnstile (phase 3) ---------------------------------------------
  // Skipped entirely when the binding is absent — local dev without the
  // secret configured (e.g. the phase-2 harness) gets no captcha check.
  if (env.TURNSTILE_SECRET) {
    const rawToken = data["cf-turnstile-response"];
    const token = typeof rawToken === "string" ? rawToken.trim() : "";
    const passed = token !== "" && (await verifyTurnstile(token, env.TURNSTILE_SECRET, ip));
    if (!passed) {
      return jsonResponse({ ok: false, error: "captcha_failed" }, 403);
    }
  }

  if (!env.DB) {
    // Misconfigured project (binding missing), not a client error.
    return jsonResponse({ ok: false, error: "server_error" }, 500);
  }

  let id;
  try {
    const row = await env.DB.prepare(
      `INSERT INTO leads (name, email, subject, message, lang, ip, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       RETURNING id`
    )
      .bind(name, email, subject || null, message, lang, ip, userAgent)
      .first();
    id = row && row.id;
    if (typeof id !== "number") throw new Error("no_id_returned");
  } catch (err) {
    console.error("contact: D1 insert failed", err);
    return jsonResponse({ ok: false, error: "server_error" }, 500);
  }

  // --- Trello card (phase 4) --------------------------------------------
  // Skipped silently when the board isn't configured (local dev). A Trello
  // failure must never fail this response — the lead is already in D1.
  if (env.TRELLO_KEY && env.TRELLO_TOKEN && env.TRELLO_LIST_ID) {
    try {
      const cardId = await createTrelloCard(env, { name, email, subject, message, lang, id });
      if (cardId) {
        await env.DB.prepare(`UPDATE leads SET trello_card_id = ? WHERE id = ?`)
          .bind(cardId, id)
          .run();
      }
    } catch (err) {
      console.error("contact: Trello card failed", err);
    }
  }

  // --- MAILER notification (phase 5) ------------------------------------
  // Skipped silently when there's no service binding (local dev). A mailer
  // failure must never fail this response — the lead is already in D1.
  if (env.MAILER) {
    try {
      const res = await env.MAILER.fetch("https://mailer.internal/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(env.MAILER_KEY ? { "x-mailer-key": env.MAILER_KEY } : {}),
        },
        body: JSON.stringify({ id, name, email, subject, message, lang }),
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        await env.DB.prepare(`UPDATE leads SET mail_sent = 1 WHERE id = ?`).bind(id).run();
      }
    } catch (err) {
      console.error("contact: MAILER notification failed", err);
    }
  }

  return jsonResponse({ ok: true, id }, 200);
}
