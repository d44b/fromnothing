// One-way best-effort sync helpers: D1 calendar_entries -> the band's Google
// Calendar. Everything here is called from functions/api/calendar/entries.js,
// functions/api/calendar/entries/[id].js and functions/api/calendar/resync.js
// inside try/catch — a Google outage or misconfiguration must never change
// what those endpoints answer callers (same pattern as the Trello step in
// functions/api/contact.js). The `_calendar` directory name starts with `_`,
// which keeps Cloudflare Pages Functions routing from treating this as a
// route.
//
// Config lives in env (Pages secrets in prod; --binding flags in the local
// harness, see specs/kalendarz/verify/google-sync.sh):
//   GOOGLE_SA_EMAIL         service account email (JWT `iss`)
//   GOOGLE_SA_KEY_PEM_B64   base64 of the SA's PKCS8 private key PEM (base64
//                           so the secret itself never contains newlines)
//   GOOGLE_CALENDAR_ID      target calendar id
//   GOOGLE_TOKEN_URL        default https://oauth2.googleapis.com/token
//   GOOGLE_CAL_API_BASE     default https://www.googleapis.com/calendar/v3
// The last two are overridable so the local harness can point them at a
// mock server instead of real Google endpoints.
//
// If any of the first three is missing, isConfigured() is false and every
// call site skips sync entirely — local dev without Google secrets keeps
// working exactly as before this phase.

const DEFAULT_TOKEN_URL = "https://oauth2.googleapis.com/token";
const DEFAULT_CAL_API_BASE = "https://www.googleapis.com/calendar/v3";
const DAY_MS = 24 * 60 * 60 * 1000;

const MEMBER_NAMES = {
  mery: "Mery",
  janusz: "Janusz",
  patryk: "Patryk",
  wojtek: "Wojtek",
  damian: "Damian",
};

export function isConfigured(env) {
  return Boolean(
    env &&
      typeof env.GOOGLE_SA_EMAIL === "string" &&
      env.GOOGLE_SA_EMAIL !== "" &&
      typeof env.GOOGLE_SA_KEY_PEM_B64 === "string" &&
      env.GOOGLE_SA_KEY_PEM_B64 !== "" &&
      typeof env.GOOGLE_CALENDAR_ID === "string" &&
      env.GOOGLE_CALENDAR_ID !== ""
  );
}

function tokenUrl(env) {
  return (env && env.GOOGLE_TOKEN_URL) || DEFAULT_TOKEN_URL;
}

function calApiBase(env) {
  return (env && env.GOOGLE_CAL_API_BASE) || DEFAULT_CAL_API_BASE;
}

// --- base64url helpers (JWT uses base64url, not plain base64) --------------

function base64UrlFromBytes(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlFromString(str) {
  return base64UrlFromBytes(new TextEncoder().encode(str));
}

// env.GOOGLE_SA_KEY_PEM_B64 is base64(PEM text). Decode that, strip the
// BEGIN/END header/footer lines and any whitespace, then base64-decode the
// remaining body into raw PKCS8 DER bytes for crypto.subtle.importKey.
function decodePkcs8DerFromPemB64(pemB64) {
  const pem = atob(pemB64);
  const body = pem
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "" && !line.startsWith("-----"))
    .join("");
  const binary = atob(body);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function importSigningKey(pemB64) {
  const der = decodePkcs8DerFromPemB64(pemB64);
  return crypto.subtle.importKey(
    "pkcs8",
    der,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
}

async function buildSignedJwt(env) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claims = {
    iss: env.GOOGLE_SA_EMAIL,
    scope: "https://www.googleapis.com/auth/calendar.events",
    aud: tokenUrl(env),
    iat: now,
    exp: now + 3600,
  };

  const encodedHeader = base64UrlFromString(JSON.stringify(header));
  const encodedClaims = base64UrlFromString(JSON.stringify(claims));
  const signingInput = `${encodedHeader}.${encodedClaims}`;

  const key = await importSigningKey(env.GOOGLE_SA_KEY_PEM_B64);
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(signingInput)
  );
  const encodedSignature = base64UrlFromBytes(new Uint8Array(signature));

  return `${signingInput}.${encodedSignature}`;
}

// Exchanges a freshly-signed JWT assertion for a Google OAuth access token.
// Throws on any non-200 response.
export async function getAccessToken(env) {
  const jwt = await buildSignedJwt(env);

  const res = await fetch(tokenUrl(env), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body:
      "grant_type=" +
      encodeURIComponent("urn:ietf:params:oauth:grant-type:jwt-bearer") +
      "&assertion=" +
      encodeURIComponent(jwt),
  });

  if (res.status !== 200) {
    const text = await res.text().catch(() => "");
    throw new Error(`google token exchange failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  if (!data || typeof data.access_token !== "string") {
    throw new Error("google token exchange: missing access_token in response");
  }
  return data.access_token;
}

// Builds the calendar event summary text for a D1 calendar_entries row.
export function eventSummaryFor(entry) {
  if (entry.type === "concert") {
    return `KONCERT: ${entry.title}`;
  }

  const name = MEMBER_NAMES[entry.member] || entry.member;
  if (entry.status === "tentative") {
    return Number(entry.blocks) === 1
      ? `OUT (wstępnie): ${name}`
      : `OUT (wstępnie, nie blokuje koncertu): ${name}`;
  }
  return `OUT: ${name}`;
}

// All-day Google Calendar events use an EXCLUSIVE end.date, so a single-day
// entry (date_from === date_to) needs end.date = date_to + 1 day.
function addOneDay(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const ms = Date.UTC(y, m - 1, d) + DAY_MS;
  const dt = new Date(ms);
  const yyyy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// Creates an all-day event in GOOGLE_CALENDAR_ID for `entry`. Returns the
// created event's id. Throws on failure.
export async function insertEventForEntry(entry, env) {
  const url = `${calApiBase(env)}/calendars/${encodeURIComponent(env.GOOGLE_CALENDAR_ID)}/events`;

  const accessToken = await getAccessToken(env);
  const body = {
    summary: eventSummaryFor(entry),
    start: { date: entry.date_from },
    end: { date: addOneDay(entry.date_to) },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`google events insert failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  if (!data || typeof data.id !== "string") {
    throw new Error("google events insert: missing id in response");
  }
  return data.id;
}

// Deletes `eventId` from GOOGLE_CALENDAR_ID. 2xx and 404/410 (already gone)
// both count as success. Throws otherwise.
export async function deleteEvent(eventId, env) {
  const url = `${calApiBase(env)}/calendars/${encodeURIComponent(env.GOOGLE_CALENDAR_ID)}/events/${encodeURIComponent(eventId)}`;

  const accessToken = await getAccessToken(env);
  const res = await fetch(url, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (res.ok || res.status === 404 || res.status === 410) return;

  const text = await res.text().catch(() => "");
  throw new Error(`google events delete failed: ${res.status} ${text}`);
}
