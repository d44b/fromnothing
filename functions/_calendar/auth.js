// Shared password-auth helpers for the band calendar admin endpoints. The
// `_calendar` directory name starts with `_`, which keeps Cloudflare Pages
// Functions routing from treating this as a route.
//
// Session model: a single shared password (env.CALENDAR_PASSWORD) gates
// write/read access to calendar entries. On success we hand back a signed,
// stateless cookie `fn_cal=<expEpochSeconds>.<hexHmac>` — no server-side
// session store, no D1 round-trip needed to check a session. The HMAC key is
// env.CALENDAR_SESSION_SECRET; both env vars are required for auth to work
// at all (missing either one fails closed, never open).

const COOKIE_NAME = "fn_cal";
const SESSION_TTL_SECONDS = 90 * 24 * 60 * 60; // 90 days

const textEncoder = new TextEncoder();

function bufferToHex(buffer) {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function sha256Hex(input) {
  const digest = await crypto.subtle.digest("SHA-256", textEncoder.encode(input));
  return bufferToHex(digest);
}

async function hmacHex(secret, message) {
  const key = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, textEncoder.encode(message));
  return bufferToHex(signature);
}

// Constant-time comparison of two arbitrary strings: both sides are first
// hashed to fixed-length (64 hex char) SHA-256 digests, then compared with a
// byte-by-byte XOR loop that never short-circuits. Hashing first means the
// loop always walks the same number of characters regardless of the real
// input lengths, so neither the *length* nor the *content* of a secret can
// leak through response timing.
async function constantTimeEqualViaHash(a, b) {
  const [ha, hb] = await Promise.all([sha256Hex(String(a)), sha256Hex(String(b))]);
  let diff = 0;
  for (let i = 0; i < ha.length; i++) {
    diff |= ha.charCodeAt(i) ^ hb.charCodeAt(i);
  }
  return diff === 0;
}

function parseCookies(header) {
  const result = {};
  if (!header) return result;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key) result[key] = value;
  }
  return result;
}

// Constant-time comparison of `input` against env.CALENDAR_PASSWORD.
export async function verifyPassword(input, env) {
  if (!env || typeof env.CALENDAR_PASSWORD !== "string" || env.CALENDAR_PASSWORD === "") {
    return false;
  }
  if (typeof input !== "string" || input === "") return false;
  return constantTimeEqualViaHash(input, env.CALENDAR_PASSWORD);
}

// Builds the full Set-Cookie header value for a fresh 90-day session.
export async function issueSessionCookie(env) {
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const expStr = String(exp);
  const hmac = await hmacHex(env.CALENDAR_SESSION_SECRET, expStr);
  const token = `${expStr}.${hmac}`;
  return `${COOKIE_NAME}=${token}; Max-Age=${SESSION_TTL_SECONDS}; Path=/; HttpOnly; Secure; SameSite=Lax`;
}

// Parses the fn_cal cookie off `request`, verifies its HMAC (constant-time)
// and that it has not expired. Missing CALENDAR_SESSION_SECRET always fails
// closed, never open.
export async function checkAuth(request, env) {
  if (!env || typeof env.CALENDAR_SESSION_SECRET !== "string" || env.CALENDAR_SESSION_SECRET === "") {
    return false;
  }

  const cookies = parseCookies(request.headers.get("Cookie"));
  const token = cookies[COOKIE_NAME];
  if (!token) return false;

  const dotIndex = token.indexOf(".");
  if (dotIndex === -1) return false;
  const expStr = token.slice(0, dotIndex);
  const providedHmac = token.slice(dotIndex + 1);
  if (!/^\d+$/.test(expStr) || providedHmac === "") return false;

  const expectedHmac = await hmacHex(env.CALENDAR_SESSION_SECRET, expStr);
  const hmacMatches = await constantTimeEqualViaHash(providedHmac, expectedHmac);
  if (!hmacMatches) return false;

  const exp = Number(expStr);
  return exp > Math.floor(Date.now() / 1000);
}

// Set-Cookie value that clears the fn_cal cookie (logout).
export function expiredCookie() {
  return `${COOKIE_NAME}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax`;
}
