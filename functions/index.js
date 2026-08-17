// GET / — homepage, patched with live concert data from D1.
//
// index.html ships four marker-delimited regions (see the comments in that
// file) that this function rewrites on every cache-miss request:
//   <!-- CONCERTS:UPCOMING --> … <!-- /CONCERTS:UPCOMING -->  the upcoming
//     <li class="tour__row"> rows in the "Nadchodzące" list
//   <!-- CONCERTS:PAST --> … <!-- /CONCERTS:PAST -->          the past rows
//     in the "Archiwalne" list
//   <!-- LD:CONCERTS --> … <!-- /LD:CONCERTS -->               the whole
//     <script type="application/ld+json"> tag
//   <!-- CONCERTS:TICKER --> … <!-- /CONCERTS:TICKER -->       the marquee
//     spans inside `.ticker__track` below the hero
//
// Data comes straight from the `concerts` table (published=1 only). Upcoming
// = date >= today (UTC), ascending; past = date < today, descending. Past
// concerts are never written into JSON-LD (see AGENTS.md) — only upcoming
// ones get MusicEvent nodes, referenced from the MusicGroup's `event` array.
//
// This function fails OPEN: any problem at all — missing env.DB, a D1 query
// throwing, a marker not found in the fetched static HTML, the JSON-LD block
// failing to JSON.parse — falls back to returning the untouched static asset
// response, so the current static concerts list keeps working as a true
// fallback rather than ever serving a broken page. Only GET is handled here;
// HEAD and anything else pass straight through to the static asset.
//
// The patched response is cached in `caches.default` for 300s
// (Cache-Control: public, max-age=300), keyed by the full request (so `/`
// and `/?lang=en` — which renders `thanks_en` instead of `thanks_pl` in the
// past rows — cache separately). `?lang=en` only changes that one field:
// month labels and ticket/gallery labels stay Polish text with the same
// data-i18n attributes as the static markup, so assets/js/app.js keeps
// translating them client-side exactly like it does for the static rows.

const MONTH_ABBR = {
  "01": "STY", "02": "LUT", "03": "MAR", "04": "KWI", "05": "MAJ", "06": "CZE",
  "07": "LIP", "08": "SIE", "09": "WRZ", "10": "PAŹ", "11": "LIS", "12": "GRU",
};

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// venue+city, lowercased, diacritics stripped, non-alphanumeric runs -> "-".
// `ł`/`Ł` don't decompose under NFD, so they're mapped by hand first.
function slugify(text) {
  return String(text)
    .replace(/ł/g, "l")
    .replace(/Ł/g, "L")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function addressLine(concert) {
  const parts = [concert.address_street, concert.address_locality]
    .map((p) => (p == null ? "" : String(p).trim()))
    .filter((p) => p !== "");
  return parts.join(", ");
}

function venueHtml(concert) {
  const name = escapeHtml(concert.venue_name);
  if (concert.venue_url) {
    return (
      `<a href="${escapeHtml(concert.venue_url)}" target="_blank" rel="noopener" class="tour__event-link">\n` +
      `              <span>${name}</span>\n` +
      `              <span class="tour__event-arrow" aria-hidden="true">↗</span>\n` +
      `            </a>`
    );
  }
  return `<span class="tour__event-link"><span>${name}</span></span>`;
}

function renderUpcomingRow(concert) {
  const [y, m, d] = concert.date.split("-");
  const monthAbbr = MONTH_ABBR[m] || "";
  const addr = addressLine(concert);
  const addrHtml = addr
    ? `\n            <span class="tour__venue-addr">${escapeHtml(addr)}</span>`
    : "";
  const actionHtml = concert.ticket_url
    ? `<a href="${escapeHtml(concert.ticket_url)}" target="_blank" rel="noopener" class="tour__ticket" data-i18n="tour.tickets">Bilety →</a>`
    : `<span class="tour__ticket tour__ticket--status" data-i18n="tour.ticketsSoon">Bilety: informacje wkrótce</span>`;

  return `<li class="tour__row">
          <time class="tour__date" datetime="${escapeHtml(concert.date)}">
            <span class="tour__day">${d}</span>
            <span class="tour__month" data-i18n="months.${m}">${monthAbbr}</span>
            <span class="tour__year">${y}</span>
          </time>
          <div class="tour__city">${escapeHtml(concert.city)}</div>
          <div class="tour__venue">
            ${venueHtml(concert)}${addrHtml}
          </div>
          <div class="tour__action">
            ${actionHtml}
          </div>
        </li>`;
}

function renderPastRow(concert, lang) {
  const [y, m, d] = concert.date.split("-");
  const monthAbbr = MONTH_ABBR[m] || "";
  const addr = addressLine(concert);
  const addrHtml = addr
    ? `\n            <span class="tour__venue-addr">${escapeHtml(addr)}</span>`
    : "";
  const actionHtml = concert.gallery_url
    ? `<a href="${escapeHtml(concert.gallery_url)}" target="_blank" rel="noopener" class="tour__ticket" data-i18n="tour.gallery">Galeria →</a>`
    : "";
  const thanksText = lang === "en" ? concert.thanks_en : concert.thanks_pl;
  const hasThanks = thanksText != null && String(thanksText).trim() !== "";
  const thanksHtml = hasThanks
    ? `\n          <p class="tour__thanks">${escapeHtml(thanksText)}</p>`
    : "";

  return `<li class="tour__row tour__row--past">
          <time class="tour__date" datetime="${escapeHtml(concert.date)}">
            <span class="tour__day">${d}</span>
            <span class="tour__month" data-i18n="months.${m}">${monthAbbr}</span>
            <span class="tour__year">${y}</span>
          </time>
          <div class="tour__city">${escapeHtml(concert.city)}</div>
          <div class="tour__venue">
            ${venueHtml(concert)}${addrHtml}
          </div>
          <div class="tour__action">
            ${actionHtml}
          </div>${thanksHtml}
        </li>`;
}

const EMPTY_UPCOMING_HTML =
  '<li class="tour__row"><p class="tour__empty" data-i18n="tour.upcoming.empty">Obecnie brak ogłoszonych koncertów.</p></li>';

const TICKER_MAX_ITEMS = 5;

// Brand fallback used when there are no upcoming published concerts — same
// text as the original static ticker, one <span>+dot pair per item.
const TICKER_BRAND_ITEMS = ["FROM NOTHING", "LINKIN PARK", "TRIBUTE BAND"];

function tickerItemSpan(text) {
  return `<span>${text}</span><span class="ticker__dot">✺</span>`;
}

// Builds the marquee's inner spans: up to TICKER_MAX_ITEMS upcoming
// concerts as "DD.MM CITY — VENUE" (city upper-cased, both fields
// HTML-escaped), the whole sequence emitted twice so the CSS marquee loops
// seamlessly. Falls back to the brand sequence when there are no upcoming
// concerts.
function buildTickerHtml(upcoming) {
  const items = upcoming.slice(0, TICKER_MAX_ITEMS).map((concert) => {
    const [, m, d] = concert.date.split("-");
    const city = escapeHtml(String(concert.city).toUpperCase());
    const venue = escapeHtml(concert.venue_name);
    return tickerItemSpan(`${d}.${m} ${city} — ${venue}`);
  });

  const sequence = items.length
    ? items.join("\n      ")
    : TICKER_BRAND_ITEMS.map(tickerItemSpan).join("\n      ");

  return `${sequence}\n      ${sequence}`;
}

// Strips both markers and everything between them, replacing the whole span
// (markers included) with `replacement`. Returns null if either marker is
// missing so the caller can fail open to the static response.
function replaceMarkedRegion(html, startMarker, endMarker, replacement) {
  const startIdx = html.indexOf(startMarker);
  if (startIdx === -1) return null;
  const endIdx = html.indexOf(endMarker, startIdx + startMarker.length);
  if (endIdx === -1) return null;
  return html.slice(0, startIdx) + replacement + html.slice(endIdx + endMarker.length);
}

function buildMusicEventNode(concert) {
  const slug = slugify(`${concert.venue_name} ${concert.city}`);
  const id = `https://fromnothing.pl/#event-${concert.date}-${slug}`;

  const address = { "@type": "PostalAddress" };
  if (concert.address_street) address.streetAddress = concert.address_street;
  if (concert.address_postal) address.postalCode = concert.address_postal;
  if (concert.address_locality) address.addressLocality = concert.address_locality;
  address.addressCountry = concert.address_country || "PL";

  const location = { "@type": "Place", name: concert.venue_name };
  if (concert.venue_url) location.url = concert.venue_url;
  location.address = address;

  return {
    "@type": "MusicEvent",
    "@id": id,
    name: `From Nothing — ${concert.venue_name}`,
    startDate: concert.date,
    location,
    performer: { "@id": "https://fromnothing.pl/#band" },
  };
}

// Parses the JSON-LD inside the LD:CONCERTS-marked <script> tag, rebuilds
// the MusicGroup's `event` refs and the MusicEvent nodes from `upcoming`
// (dropping every previous MusicEvent node — past events never appear here),
// and re-serializes. Throws on any structural surprise; the caller catches
// and falls back to the static response.
function patchJsonLd(html, upcoming) {
  const startMarker = "<!-- LD:CONCERTS -->";
  const endMarker = "<!-- /LD:CONCERTS -->";
  const startIdx = html.indexOf(startMarker);
  if (startIdx === -1) throw new Error("LD:CONCERTS marker missing");
  const endIdx = html.indexOf(endMarker, startIdx + startMarker.length);
  if (endIdx === -1) throw new Error("/LD:CONCERTS marker missing");

  const region = html.slice(startIdx + startMarker.length, endIdx);
  const scriptMatch = region.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  if (!scriptMatch) throw new Error("ld+json script tag not found between markers");

  const data = JSON.parse(scriptMatch[1]);
  const graph = data["@graph"];
  if (!Array.isArray(graph)) throw new Error("@graph missing or not an array");

  const musicGroup = graph.find((node) => node && node["@type"] === "MusicGroup");
  if (!musicGroup) throw new Error("MusicGroup node missing from @graph");

  const eventNodes = upcoming.map(buildMusicEventNode);
  musicGroup.event = eventNodes.map((node) => ({ "@id": node["@id"] }));
  data["@graph"] = graph.filter((node) => !node || node["@type"] !== "MusicEvent").concat(eventNodes);

  // "<" can only ever occur inside a JSON string value here; escaping it as
  // < keeps the JSON valid while making it impossible for any D1-backed
  // string (e.g. a venue name) to prematurely close the <script> tag.
  const jsonStr = JSON.stringify(data, null, 2).replace(/</g, "\\u003c");
  const newScript = `<script type="application/ld+json">\n  ${jsonStr}\n  </script>`;

  return html.slice(0, startIdx) + newScript + html.slice(endIdx + endMarker.length);
}

function buildDynamicHtml(html, concerts, lang) {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD, UTC
  const upcoming = concerts.filter((c) => c.date >= today); // already ASC
  const past = concerts.filter((c) => c.date < today).slice().reverse(); // DESC

  const upcomingHtml = upcoming.length
    ? upcoming.map(renderUpcomingRow).join("\n        ")
    : EMPTY_UPCOMING_HTML;
  const pastHtml = past.map((c) => renderPastRow(c, lang)).join("\n        ");

  let out = replaceMarkedRegion(
    html,
    "<!-- CONCERTS:UPCOMING -->",
    "<!-- /CONCERTS:UPCOMING -->",
    `\n        ${upcomingHtml}\n      `
  );
  if (out === null) throw new Error("CONCERTS:UPCOMING markers missing from static HTML");

  out = replaceMarkedRegion(
    out,
    "<!-- CONCERTS:PAST -->",
    "<!-- /CONCERTS:PAST -->",
    `\n        ${pastHtml}\n      `
  );
  if (out === null) throw new Error("CONCERTS:PAST markers missing from static HTML");

  out = patchJsonLd(out, upcoming);

  out = replaceMarkedRegion(
    out,
    "<!-- CONCERTS:TICKER -->",
    "<!-- /CONCERTS:TICKER -->",
    `\n      ${buildTickerHtml(upcoming)}\n      `
  );
  if (out === null) throw new Error("CONCERTS:TICKER markers missing from static HTML");

  return out;
}

export async function onRequest(context) {
  const { request, env, waitUntil } = context;

  // Only GET is patched. HEAD and any other method pass straight through to
  // the static asset (Pages Functions only routes GET/HEAD to `/` anyway).
  if (request.method !== "GET") {
    return env.ASSETS.fetch(request);
  }

  // Fetch the asset with a bare request (no If-None-Match/If-Modified-Since):
  // the static file's validators only change on deploy, so a conditional 304
  // here would keep revalidating a browser's *stale dynamic* copy forever.
  // For the same reason the patched response below drops ETag/Last-Modified —
  // freshness of dynamic content is governed by max-age alone.
  const staticResponse = await env.ASSETS.fetch(new Request(request.url, { method: "GET" }));

  const cache = caches.default;
  try {
    const cached = await cache.match(request);
    if (cached) return cached;
  } catch (err) {
    console.error("index: cache lookup failed, continuing without it", err);
  }

  try {
    if (!env.DB) return staticResponse;

    const url = new URL(request.url);
    const lang = url.searchParams.get("lang") === "en" ? "en" : "pl";

    const result = await env.DB.prepare(
      `SELECT date, city, venue_name, venue_url, address_street, address_postal,
              address_locality, address_country, ticket_url, gallery_url,
              thanks_pl, thanks_en
       FROM concerts
       WHERE published = 1
       ORDER BY date ASC`
    ).all();
    const concerts = (result && result.results) || [];

    const staticHtml = await staticResponse.clone().text();
    const patchedHtml = buildDynamicHtml(staticHtml, concerts, lang);

    const headers = new Headers(staticResponse.headers);
    headers.set("Content-Type", "text/html; charset=utf-8");
    headers.set("Cache-Control", "public, max-age=300");
    headers.delete("Content-Length");
    headers.delete("ETag");
    headers.delete("Last-Modified");

    const response = new Response(patchedHtml, {
      status: staticResponse.status,
      statusText: staticResponse.statusText,
      headers,
    });

    if (typeof waitUntil === "function") {
      waitUntil(cache.put(request, response.clone()));
    }
    return response;
  } catch (err) {
    console.error("index: dynamic homepage render failed, serving static fallback", err);
    return staticResponse;
  }
}
