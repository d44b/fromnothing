// GET/HEAD /presspack/<token> — public, unguessable per-concert download
// link (Phase 4 of specs/koncerty-presspack/roadmap.md). Streams a ZIP built
// on the fly: a generated FROM-NOTHING-INFO.txt (bilingual, built only from
// this concert's D1 row plus fixed band facts already public on the site)
// followed by every shared asset stored in R2 under the `presspack/` prefix
// (managed from /koncerty via functions/api/presspack/files.js).
//
// No auth here on purpose — the token itself (32 random hex chars, from
// crypto.getRandomValues in functions/api/concerts/[id]/presspack-link.js)
// is the secret. We still refuse to even touch D1 for anything that isn't
// shaped like a token, and never distinguish "malformed" from "well-formed
// but unknown" in the response — both are a plain 404.

import { buildZip } from "../_presspack/zip.js";

const TOKEN_RE = /^[0-9a-f]{32}$/;

const BAND_LINE = "From Nothing — Linkin Park Tribute Band";
const BOOKING_EMAIL = "kontakt@fromnothing.pl";
const SITE_URL = "https://fromnothing.pl/";
const RIDER_URL_PL = "https://fromnothing.pl/rider";
const RIDER_URL_EN = "https://fromnothing.pl/rider-en";
const OFFER_URL_PL = "https://fromnothing.pl/oferta";
const OFFER_URL_EN = "https://fromnothing.pl/offer";

const PRESSPACK_PREFIX = "presspack/";

function notFound() {
  return new Response("Not found", {
    status: 404,
    headers: { "Cache-Control": "no-store" },
  });
}

function methodNotAllowed() {
  return new Response("Method not allowed", {
    status: 405,
    headers: { Allow: "GET, HEAD", "Cache-Control": "no-store" },
  });
}

function serverError() {
  return new Response("Server is not configured.", {
    status: 500,
    headers: { "Cache-Control": "no-store" },
  });
}

// city, lowercased, diacritics stripped, non-alphanumeric runs -> "-",
// trimmed of leading/trailing "-". `ł`/`Ł` don't decompose under NFD, so
// they're mapped by hand first. Mirrors the slug logic in functions/index.js
// (kept as a local copy — that file's slugify() covers venue+city for JSON-LD
// event ids, a different shape, so sharing it isn't worth an import here).
function citySlug(city) {
  return String(city)
    .replace(/ł/g, "l")
    .replace(/Ł/g, "L")
    .normalize("NFD")
    .replace(new RegExp("[\\u0300-\\u036f]", "g"), "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Address built only from the concert's own fields, empty parts skipped.
function formatAddress(concert) {
  const parts = [];
  if (concert.address_street) parts.push(concert.address_street);
  const postalLocality = [concert.address_postal, concert.address_locality]
    .filter((p) => p != null && String(p).trim() !== "")
    .join(" ");
  if (postalLocality) parts.push(postalLocality);
  if (concert.address_country) parts.push(concert.address_country);
  return parts.join(", ");
}

// Bilingual plain-text info file: a PL section then an EN section, built
// ONLY from the concert's D1 fields plus the fixed band/site facts declared
// above — no invented copy.
function buildInfoText(concert) {
  const address = formatAddress(concert);
  const rule = "=".repeat(BAND_LINE.length);

  const lines = [];
  lines.push(BAND_LINE);
  lines.push(rule);
  lines.push("");

  lines.push("-- PL " + "-".repeat(60));
  lines.push("");
  lines.push(BAND_LINE);
  lines.push("");
  lines.push(`Koncert: ${concert.venue_name}, ${concert.city}`);
  lines.push(`Data: ${concert.date}`);
  if (address) lines.push(`Adres: ${address}`);
  if (concert.venue_url) lines.push(`Strona miejsca: ${concert.venue_url}`);
  lines.push("");
  lines.push(`Kontakt / rezerwacje: ${BOOKING_EMAIL}`);
  lines.push(`Strona zespołu: ${SITE_URL}`);
  lines.push(`Rider techniczny: ${RIDER_URL_PL}`);
  lines.push(`Oferta: ${OFFER_URL_PL}`);
  lines.push("");

  lines.push("-- EN " + "-".repeat(60));
  lines.push("");
  lines.push(BAND_LINE);
  lines.push("");
  lines.push(`Show: ${concert.venue_name}, ${concert.city}`);
  lines.push(`Date: ${concert.date}`);
  if (address) lines.push(`Address: ${address}`);
  if (concert.venue_url) lines.push(`Venue website: ${concert.venue_url}`);
  lines.push("");
  lines.push(`Booking contact: ${BOOKING_EMAIL}`);
  lines.push(`Website: ${SITE_URL}`);
  lines.push(`Technical rider: ${RIDER_URL_EN}`);
  lines.push(`Offer: ${OFFER_URL_EN}`);
  lines.push("");

  return lines.join("\n");
}

// Every object under presspack/ in R2, paginated with cursor until done —
// same approach as functions/api/presspack/files.js's GET handler. Each one
// is read fully into memory (bucket.get -> arrayBuffer -> Uint8Array) since
// buildZip() needs the whole entry up front to compute its CRC-32 and size.
async function loadPresspackEntries(bucket) {
  const keys = [];
  let cursor;
  do {
    const listing = await bucket.list({ prefix: PRESSPACK_PREFIX, cursor });
    for (const obj of listing.objects) keys.push(obj.key);
    cursor = listing.truncated ? listing.cursor : undefined;
  } while (cursor);

  const entries = [];
  for (const key of keys) {
    const object = await bucket.get(key);
    if (!object) continue; // deleted between list() and get() — skip it
    const buffer = await object.arrayBuffer();
    entries.push({ name: key.slice(PRESSPACK_PREFIX.length), data: new Uint8Array(buffer) });
  }
  return entries;
}

export async function onRequest({ request, params, env }) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return methodNotAllowed();
  }

  const token = params && params.token;
  if (typeof token !== "string" || !TOKEN_RE.test(token)) {
    return notFound();
  }

  if (!env.DB || !env.MEDIA) {
    console.error("presspack/[token]: DB or MEDIA binding missing");
    return serverError();
  }

  let concert;
  try {
    concert = await env.DB.prepare(`SELECT * FROM concerts WHERE presspack_token = ?`)
      .bind(token)
      .first();
  } catch (err) {
    console.error("presspack/[token]: D1 query failed", err);
    return serverError();
  }
  if (!concert) return notFound();

  const infoEntry = {
    name: "FROM-NOTHING-INFO.txt",
    data: new TextEncoder().encode(buildInfoText(concert)),
  };

  let assetEntries;
  try {
    assetEntries = await loadPresspackEntries(env.MEDIA);
  } catch (err) {
    console.error("presspack/[token]: R2 list/get failed", err);
    return serverError();
  }

  const zipBytes = buildZip([infoEntry, ...assetEntries]);

  const slug = citySlug(concert.city);
  const filename = `FromNothing-presspack-${concert.date}-${slug}.zip`;

  const headers = {
    "Content-Type": "application/zip",
    "Content-Disposition": `attachment; filename="${filename}"`,
    "X-Robots-Tag": "noindex",
    "Cache-Control": "no-store",
    "Content-Length": String(zipBytes.length),
  };

  if (request.method === "HEAD") {
    return new Response(null, { status: 200, headers });
  }
  return new Response(zipBytes, { status: 200, headers });
}
