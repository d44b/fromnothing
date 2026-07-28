// fromnothing-mailer — standalone Worker (deployed separately, see
// wrangler.toml). Two jobs:
//
//   email(): incoming mail to kontakt@fromnothing.pl (Email Routing rule)
//   is forwarded to every address in RECIPIENTS.
//
//   fetch(): called by functions/api/contact.js (Pages service binding
//   `MAILER`) after a lead is written to D1; sends a plain-text
//   notification about that lead to the same RECIPIENTS, with Reply-To
//   set to the lead so a reply goes straight to them.
//
// Zero npm dependencies — MIME is built by hand below.
import { EmailMessage } from "cloudflare:email";

const LIMITS = { name: 200, email: 320, subject: 300, message: 5000 };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_BODY_BYTES = 32 * 1024;
const TRELLO_BOARD_URL = "https://trello.com/b/5DU3BaQM";

function jsonResponse(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function recipients(env) {
  return (env.RECIPIENTS || "")
    .split(",")
    .map((addr) => addr.trim())
    .filter(Boolean);
}

// A header value must never carry a raw newline through to the wire — that
// is header injection. Nothing here is meant to contain one anyway (email
// addresses, single-line subjects), so collapsing is a safety net, not a
// feature.
function stripCrlf(value) {
  return String(value).replace(/[\r\n]+/g, " ").trim();
}

function base64EncodeUtf8(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

// RFC 2047 encoded-word, for a Subject header that may contain Polish
// diacritics. A single encoded-word (no folding across multiple words) —
// subjects here are short enough that this is not a deliverability issue.
function encodeSubject(subject) {
  return `=?UTF-8?B?${base64EncodeUtf8(stripCrlf(subject))}?=`;
}

// Base64 body per RFC 2045 §6.8: lines wrapped at 76 characters.
function wrapBase64(b64) {
  return (b64.match(/.{1,76}/g) || []).join("\r\n");
}

function buildRawEmail({ from, to, replyTo, subject, bodyText }) {
  const headers = [
    `From: ${stripCrlf(from)}`,
    `To: ${stripCrlf(to)}`,
    replyTo ? `Reply-To: ${stripCrlf(replyTo)}` : null,
    `Subject: ${encodeSubject(subject)}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=utf-8",
    "Content-Transfer-Encoding: base64",
  ].filter(Boolean);

  return `${headers.join("\r\n")}\r\n\r\n${wrapBase64(base64EncodeUtf8(bodyText))}`;
}

function notificationSubject(lead) {
  const idPart = typeof lead.id === "number" ? `#${lead.id}` : "#?";
  return `Nowy lead ${idPart}: ${lead.subject || lead.name}`;
}

function notificationBody(lead) {
  return [
    "Nowy lead ze strony fromnothing.pl.",
    "",
    `Imię: ${lead.name}`,
    `E-mail: ${lead.email}`,
    `Temat: ${lead.subject || "(brak)"}`,
    `Język: ${lead.lang || "—"}`,
    `ID leada: ${typeof lead.id === "number" ? `#${lead.id}` : "nieznane"}`,
    "",
    "Wiadomość:",
    lead.message,
    "",
    `Tablica Trello: ${TRELLO_BOARD_URL}`,
  ].join("\n");
}

function parseLead(data) {
  if (!data || typeof data !== "object") throw new Error("invalid_body");

  const name = typeof data.name === "string" ? data.name.trim() : "";
  const email = typeof data.email === "string" ? data.email.trim() : "";
  const message = typeof data.message === "string" ? data.message.trim() : "";
  const subject = typeof data.subject === "string" ? data.subject.trim() : "";
  const rawLang = typeof data.lang === "string" ? data.lang.trim().toLowerCase() : "";
  const lang = rawLang === "pl" || rawLang === "en" ? rawLang : null;

  let id = null;
  if (typeof data.id === "number" && Number.isInteger(data.id)) {
    id = data.id;
  } else if (typeof data.id === "string" && /^\d+$/.test(data.id)) {
    id = Number(data.id);
  }

  if (!name || name.length > LIMITS.name) throw new Error("invalid_name");
  if (!email || email.length > LIMITS.email || !EMAIL_RE.test(email)) {
    throw new Error("invalid_email");
  }
  if (!message || message.length > LIMITS.message) throw new Error("invalid_message");
  if (subject.length > LIMITS.subject) throw new Error("invalid_subject");

  return { id, name, email, subject, message, lang };
}

export default {
  // Incoming mail to kontakt@fromnothing.pl. One address failing to accept
  // the forward (e.g. not yet verified) must not stop the others; only if
  // every single one fails do we tell Email Routing the message bounced.
  async email(message, env, ctx) {
    const addresses = recipients(env);
    let delivered = 0;
    let lastError;

    for (const addr of addresses) {
      try {
        await message.forward(addr);
        delivered++;
      } catch (err) {
        lastError = err;
        console.error("mailer: forward failed", addr, err);
      }
    }

    if (delivered === 0) {
      if (typeof message.setReject === "function") {
        message.setReject("delivery failed");
      } else if (lastError) {
        throw lastError;
      }
    }
  },

  // Lead notification, called by contact.js via the MAILER service binding.
  async fetch(request, env, ctx) {
    if (request.method !== "POST") {
      return jsonResponse({ ok: false, error: "method_not_allowed" }, 405);
    }

    // Reached only via a Pages service binding in normal operation, but a
    // standalone Worker also gets a public workers.dev URL unless disabled —
    // this guard is only active once SHARED_SECRET is configured (see
    // wrangler.toml), so it's safe to deploy before the secret exists.
    if (env.SHARED_SECRET) {
      const key = request.headers.get("x-mailer-key");
      if (key !== env.SHARED_SECRET) {
        return jsonResponse({ ok: false, error: "forbidden" }, 403);
      }
    }

    const declaredLength = Number(request.headers.get("Content-Length") || 0);
    if (declaredLength > MAX_BODY_BYTES) {
      return jsonResponse({ ok: false, error: "invalid_body" }, 400);
    }

    const bodyText = await request.text();
    if (bodyText.length > MAX_BODY_BYTES) {
      return jsonResponse({ ok: false, error: "invalid_body" }, 400);
    }

    let lead;
    try {
      lead = parseLead(JSON.parse(bodyText));
    } catch {
      return jsonResponse({ ok: false, error: "invalid_body" }, 400);
    }

    const from = `From Nothing <${env.FROM_ADDR}>`;
    const replyTo = EMAIL_RE.test(lead.email) ? lead.email : null;
    const subject = notificationSubject(lead);
    const bodyPlain = notificationBody(lead);

    // Sending five e-mails takes longer than the caller is willing to wait
    // (contact.js aborts after 5s, which used to cancel this whole request
    // mid-send). Respond immediately and let the sends finish in the
    // background — waitUntil keeps the worker alive after the response.
    const addresses = recipients(env);
    ctx.waitUntil(
      Promise.allSettled(
        addresses.map(async (to) => {
          const raw = buildRawEmail({ from, to, replyTo, subject, bodyText: bodyPlain });
          await env.NOTIFY.send(new EmailMessage(env.FROM_ADDR, to, raw));
        })
      ).then((results) => {
        results.forEach((r, i) => {
          if (r.status === "rejected") {
            console.error("mailer: send failed", addresses[i], r.reason);
          }
        });
        const sent = results.filter((r) => r.status === "fulfilled").length;
        console.log(`mailer: lead #${lead.id ?? "?"} — sent ${sent}/${addresses.length}`);
      })
    );

    return jsonResponse({ ok: true, queued: addresses.length }, 200);
  },
};
