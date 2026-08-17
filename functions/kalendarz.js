// GET /kalendarz — internal band calendar tool (Polish only, not indexed).
//
// Password-gated via functions/_calendar/auth.js checkAuth() / the fn_cal
// cookie (see functions/api/calendar/login.js for how that cookie is
// issued). Unauthenticated visitors get a bare login form with zero
// calendar data in the markup; authenticated visitors get the full
// mobile-first app: a 12-month grid (current month first) plus an
// "add entry" form and an entries list, both wired to the phase-2 CRUD API
// (GET/POST /api/calendar/entries, DELETE /api/calendar/entries/:id).
//
// Everything — CSS and JS — is inlined as template literals: this repo ships
// zero npm deps and no bundler, so there is nowhere else for it to live.
// Member photos are referenced from /assets/img/... (public, static assets;
// fine to link even from the otherwise-private app page).
//
// The month grid *structure* (headers, day numbers, offsets) is rendered
// server-side here because it never depends on entry data. Entry markers
// (member thumbnails on absence days, the red concert block) are painted in
// client JS after GET /api/calendar/entries resolves — that keeps this
// function D1-free and cache-free (no per-request DB round trip just to
// paint an empty page frame).

import { checkAuth } from "./_calendar/auth.js";

// Each member gets a signature ring color, used consistently everywhere
// their avatar appears (member picker, calendar day marks, entries list).
// Colors chosen for ≥3:1 contrast against the --bg cream paper. This array
// is the single source of truth: STYLE's --m-<slug> custom properties, the
// server-rendered member picker, and the client-side MEMBER_MAP (used to
// paint calendar marks) are all derived from it — see memberColorVarsCSS()
// and memberMapJSON() below.
const MEMBERS = [
  { slug: "mery", name: "Mery", photo: "/assets/img/member-mery-thumbnail.webp", color: "#c8322c" },
  { slug: "janusz", name: "Janusz", photo: "/assets/img/member-janusz-thumbnail.webp", color: "#2456a8" },
  { slug: "patryk", name: "Patryk", photo: "/assets/img/member-patryk2-thumbnail.webp", color: "#1f7a4d" },
  { slug: "wojtek", name: "Wojtek", photo: "/assets/img/member-wojtek-thumbnail.webp", color: "#c7791f" },
  { slug: "damian", name: "Damian", photo: "/assets/img/member-damian-thumbnail.webp", color: "#6b3fa0" },
];

// `--m-mery`, `--m-janusz`, … — one CSS custom property per member, emitted
// into :root so any rule on the page can reference a member's color by name
// if needed. The actual per-element coloring (picker button, day mark,
// entries-list avatar) instead sets a local `--member-color` custom
// property inline (see memberButtonsHTML() and the client script), which is
// simpler to keep in sync than a giant per-slug CSS selector list — but
// these named vars stay too, since they're part of the contract.
function memberColorVarsCSS() {
  return MEMBERS.map((m) => `  --m-${m.slug}: ${m.color};`).join("\n");
}

const MONTH_NAMES = [
  "Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec",
  "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień",
];

// Shared brutalist-poster look, mirroring assets/css/style.css's font stack
// and color values — but inverted to a cream/off-white background (this is
// an internal tool, not the dark public site) with the same scarlet accent
// and heavy uppercase display type.
const STYLE = `
:root {
  --bg: #f2ede0;
  --bg-elev: #e8e0cc;
  --ink: #17140f;
  --ink-dim: #55503f;
  --ink-faint: #8b8570;
  --line: #cfc5a6;
  --line-strong: #a89c74;
  --accent: #c8322c;
  --accent-hot: #e84038;
  --focus: #ffcf33;
  --ff-display: "Anton", "Arial Narrow", sans-serif;
  --ff-mono: "Space Mono", ui-monospace, "SF Mono", monospace;
${memberColorVarsCSS()}
}
* { margin: 0; padding: 0; box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; }
body {
  background: var(--bg);
  color: var(--ink);
  font-family: var(--ff-mono);
  font-size: 0.9375rem;
  line-height: 1.5;
  min-height: 100vh;
}
h1, h2, h3 { font-family: var(--ff-display); text-transform: uppercase; letter-spacing: 0.02em; }
a { color: inherit; }
button { font: inherit; color: inherit; cursor: pointer; background: none; border: 0; }
input, select { font: inherit; color: inherit; }
img { display: block; max-width: 100%; }
:focus-visible { outline: 3px solid var(--focus); outline-offset: 2px; }
.visually-hidden {
  position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
  overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0;
}
/* Belt-and-braces: an author rule as plain as \`fieldset { display: flex }\`
   wins over the UA stylesheet's \`[hidden] { display: none }\` regardless of
   selector specificity, because author-normal rules always outrank
   user-agent-normal rules in the cascade's origin tier. That silently
   un-hides any [hidden] element this page also happens to style with
   display — exactly the bug this line exists to slam shut. */
[hidden] { display: none !important; }
`;

const LOGIN_STYLE = `
.login-body {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
}
.login {
  width: 100%;
  max-width: 22rem;
}
.login__title {
  font-size: 1.5rem;
  margin-bottom: 2rem;
  text-align: center;
  color: var(--accent);
}
.login__title span { color: var(--ink); display: block; font-size: 1rem; margin-top: 0.25rem; }
.login__form {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  background: var(--bg-elev);
  border: 1px solid var(--line-strong);
  padding: 1.5rem;
}
.login__form label {
  text-transform: uppercase;
  font-size: 0.75rem;
  letter-spacing: 0.08em;
  color: var(--ink-dim);
}
.login__form input[type="password"] {
  border: 1px solid var(--line-strong);
  background: var(--bg);
  padding: 0.75rem;
  min-height: 44px;
  font-size: 1rem;
}
.login__form button {
  margin-top: 0.5rem;
  background: var(--accent);
  color: var(--bg);
  font-family: var(--ff-display);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 0.75rem;
  min-height: 44px;
  text-align: center;
}
.login__form button:hover { background: var(--accent-hot); }
.login__msg { color: var(--accent); font-size: 0.8125rem; min-height: 1.2em; }
`;

const APP_STYLE = `
.app-header {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.75rem 1.25rem;
  background: var(--bg);
  border-bottom: 3px solid var(--ink);
}
.app-header__kicker {
  display: block;
  font-size: 0.6875rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--ink-dim);
  margin-bottom: 0.15rem;
}
.app-header__title {
  font-size: clamp(1.25rem, 2.4vw, 1.75rem);
  line-height: 1;
  color: var(--accent);
}
.header-actions { flex-shrink: 0; display: flex; align-items: center; gap: 0.6rem; }
.nav-link {
  display: inline-flex;
  align-items: center;
  border: 1px solid var(--ink);
  padding: 0.5rem 0.85rem;
  min-height: 44px;
  text-transform: uppercase;
  font-size: 0.75rem;
  letter-spacing: 0.06em;
  background: var(--bg);
  text-decoration: none;
}
.nav-link:hover { background: var(--ink); color: var(--bg); }
.logout-btn {
  flex-shrink: 0;
  border: 1px solid var(--ink);
  padding: 0.5rem 0.85rem;
  min-height: 44px;
  text-transform: uppercase;
  font-size: 0.75rem;
  letter-spacing: 0.06em;
  background: var(--bg);
}
.logout-btn:hover { background: var(--ink); color: var(--bg); }

.layout {
  max-width: 1600px;
  margin: 0 auto;
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 2rem;
}
@media (min-width: 1100px) {
  .layout {
    display: grid;
    grid-template-columns: minmax(380px, 420px) minmax(0, 1fr);
    align-items: start;
    gap: 2rem;
    padding: 1.75rem 2rem 3rem;
  }
  .sidebar {
    position: sticky;
    top: 5.25rem;
    display: flex;
    flex-direction: column;
    gap: 1.75rem;
    max-height: calc(100vh - 6.5rem);
    overflow-y: auto;
  }
}

.add-entry { border: 1px solid var(--line-strong); background: var(--bg-elev); }
.add-entry__heading {
  font-size: 1rem;
  padding: 0.9rem 1.1rem;
  border-bottom: 2px solid var(--ink);
}
.entry-form { padding: 1.1rem; display: flex; flex-direction: column; gap: 1.15rem; }

.type-toggle { display: flex; border: 2px solid var(--ink); }
.type-toggle button {
  flex: 1;
  padding: 0.6rem 0.5rem;
  min-height: 44px;
  text-transform: uppercase;
  font-weight: 700;
  font-size: 0.8rem;
  letter-spacing: 0.04em;
  background: var(--bg);
}
.type-toggle button + button { border-left: 2px solid var(--ink); }
.type-toggle button[aria-pressed="true"] { background: var(--ink); color: var(--bg); }

fieldset { border: 0; display: flex; flex-direction: column; gap: 0.85rem; padding: 0; margin: 0; }
legend {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--ink-dim);
  padding: 0;
  margin-bottom: 0.2rem;
}

.member-picker { display: flex; flex-wrap: wrap; gap: 0.5rem; }
.member-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.3rem;
  width: 3.6rem;
  padding: 0.3rem 0.1rem;
  border: 0;
}
.member-btn img {
  width: 48px; height: 48px;
  border-radius: 50%;
  object-fit: cover;
  /* Unselected: thin, muted ring in the member's own hue (not a flat gray) —
     mixed toward the paper color rather than desaturated to neutral. */
  border: 2px solid color-mix(in srgb, var(--member-color, var(--line-strong)) 45%, var(--bg) 55%);
  filter: saturate(0.55) opacity(0.75);
}
.member-btn__label {
  font-size: 0.625rem;
  text-transform: uppercase;
  letter-spacing: 0.02em;
  color: var(--ink-dim);
  text-align: center;
}
.member-btn[aria-pressed="true"] img {
  border: 3px solid var(--member-color, var(--accent));
  box-shadow: 0 0 0 2px var(--bg), 0 0 0 5px var(--member-color, var(--accent));
  filter: none;
}
.member-btn[aria-pressed="true"] .member-btn__label { color: var(--member-color, var(--accent)); font-weight: 700; }

.calendar-legend { display: flex; flex-wrap: wrap; gap: 0.5rem 1rem; margin-bottom: 1rem; }
.legend-item {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.6875rem;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--ink-dim);
}
.legend-dot {
  width: 11px; height: 11px;
  border-radius: 50%;
  flex-shrink: 0;
  background: var(--member-color, var(--line-strong));
  border: 1px solid var(--ink);
}

.pill-row { display: flex; flex-wrap: wrap; gap: 0.5rem; }
.pill { position: relative; display: inline-flex; }
.pill input {
  position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
  overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0;
}
.pill span {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  padding: 0.5rem 0.9rem;
  border: 1px solid var(--ink);
  text-transform: uppercase;
  font-size: 0.75rem;
  letter-spacing: 0.03em;
}
.pill input:checked + span { background: var(--ink); color: var(--bg); }
.pill input:focus-visible + span { outline: 3px solid var(--focus); outline-offset: 2px; }

.note {
  font-size: 0.75rem;
  color: var(--ink-dim);
  border-left: 3px solid var(--accent);
  padding: 0.55rem 0.8rem;
  background: var(--bg);
}

.field { display: flex; flex-direction: column; gap: 0.35rem; }
.field label {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--ink-dim);
}
.field input[type="text"],
.field input[type="date"] {
  border: 1px solid var(--line-strong);
  background: var(--bg);
  padding: 0.6rem;
  min-height: 44px;
  font-size: 1rem;
}
.date-fields { display: flex; gap: 0.75rem; }
.date-fields .field { flex: 1; }

.submit-btn {
  background: var(--accent);
  color: var(--bg);
  font-family: var(--ff-display);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  font-size: 1.05rem;
  padding: 0.9rem;
  min-height: 48px;
  border: 2px solid var(--accent);
}
.submit-btn:hover { background: var(--accent-hot); border-color: var(--accent-hot); }
.form-msg { color: var(--accent); font-size: 0.8125rem; min-height: 1.2em; }

.entries-section { border: 1px solid var(--line-strong); background: var(--bg-elev); padding: 1.1rem; }
.entries-heading {
  font-size: 1rem;
  margin-bottom: 0.9rem;
  padding-bottom: 0.6rem;
  border-bottom: 2px solid var(--ink);
}
.entries-month-group + .entries-month-group { margin-top: 1.25rem; }
.entries-month-label {
  font-family: var(--ff-mono);
  font-weight: 700;
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--ink-dim);
  margin-bottom: 0.5rem;
}
.entries-sublist { list-style: none; display: flex; flex-direction: column; gap: 0.5rem; }
.entry-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  border: 1px solid var(--line-strong);
  background: var(--bg);
  padding: 0.5rem 0.6rem;
}
.entry-row__marker {
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.8rem;
  border: 2px solid var(--member-color, var(--line-strong));
}
.entry-row__marker--avatar img { width: 100%; height: 100%; object-fit: cover; display: block; }
.entry-row__marker--concert { background: var(--accent); color: var(--bg); border-radius: 3px; border-color: var(--accent); font-weight: 700; }
.entry-row__info { display: flex; flex-direction: column; gap: 0.15rem; min-width: 0; flex: 1; }
.entry-row__range { font-size: 0.75rem; color: var(--ink-dim); }
.entry-row__desc { font-size: 0.8125rem; overflow-wrap: anywhere; }
.badge {
  display: inline-block;
  margin-left: 0.4rem;
  padding: 0.1rem 0.4rem;
  font-size: 0.625rem;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  vertical-align: middle;
}
.badge--out { background: var(--accent); color: var(--bg); font-weight: 700; }
.badge--tentative { border: 1px solid var(--accent); color: var(--accent); }
.badge--tentative-nonblocking {
  border: 1px dashed var(--accent);
  color: var(--ink-dim);
  background-image: repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(200, 50, 44, 0.14) 3px, rgba(200, 50, 44, 0.14) 5px);
}
.entry-row__delete {
  flex-shrink: 0;
  border: 0;
  background: none;
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--ink-dim);
  font-size: 1.35rem;
  line-height: 1;
}
.entry-row__delete:hover, .entry-row__delete:focus-visible { color: var(--accent); }
.entries-empty { color: var(--ink-dim); font-size: 0.875rem; }

.calendar { display: flex; flex-direction: column; gap: 1.5rem; min-width: 0; }
@media (min-width: 1100px) {
  .calendar { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); align-content: start; gap: 1.5rem; }
}
@media (min-width: 1500px) {
  .calendar { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}
.month { border: 1px solid var(--line-strong); padding: 0.9rem 0.9rem 0; background: var(--bg); min-width: 0; }
.month__head { display: flex; align-items: baseline; justify-content: space-between; gap: 0.5rem; }
.month__name {
  font-size: clamp(1.3rem, 2.6vw, 1.85rem);
  line-height: 1;
}
.month__year { font-size: 0.8rem; color: var(--ink-dim); letter-spacing: 0.04em; }
.month__rule { margin: 0.55rem 0 0.7rem; border: 0; border-top: 1px solid var(--line); }
.month__dow {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  font-size: 0.6875rem;
  text-transform: uppercase;
  color: var(--ink-dim);
  padding-bottom: 0.3rem;
}
.month__dow span { text-align: center; padding: 0.2rem 0; }
.month__dow span:nth-child(6), .month__dow span:nth-child(7) { color: var(--ink); font-weight: 700; }
.month__grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 1px;
  margin: 0 -0.9rem;
  padding: 0 0.9rem 0.9rem;
}
.day {
  position: relative;
  aspect-ratio: 1;
  background: var(--bg-elev);
  padding: 0.2rem;
  display: flex;
  flex-direction: column;
}
.day--pad { background: transparent; visibility: hidden; }
.day__num { font-size: 0.7rem; line-height: 1; color: var(--ink-dim); }
.day__marks { display: flex; flex-wrap: wrap; gap: 2px; margin-top: auto; }
.day--concert { background: var(--accent); }
.day--concert .day__num { color: var(--bg); font-weight: 700; }
.day--today { outline: 2px solid var(--accent); outline-offset: -2px; }

.mark {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 13px; height: 13px;
  border-radius: 50%;
  overflow: hidden;
  border: 1.5px solid var(--member-color, var(--line-strong));
  background: var(--bg);
}
.mark img { width: 100%; height: 100%; object-fit: cover; display: block; }
/* Tentative: dash the member-colored ring rather than swapping its color —
   the hue still says *who*, the dash says *not confirmed*. */
.mark--tentative { border-style: dashed; }
.mark--nonblocking { opacity: 0.6; }
.mark--more {
  font-size: 0.55rem;
  font-weight: 700;
  background: var(--ink);
  color: var(--bg);
  border-color: var(--ink);
}
`;

function pad2(n) {
  return String(n).padStart(2, "0");
}

// Server-rendered grid skeleton for one month: weekday header row (Monday
// first) + day cells carrying data-date so client JS can drop entry marks
// into `.day__marks` after the entries fetch resolves. y/m/name are always
// derived from Date arithmetic below, never from request input.
function renderMonth(y, m, name) {
  const firstDow = new Date(Date.UTC(y, m, 1)).getUTCDay(); // 0=Sun..6=Sat
  const leading = (firstDow + 6) % 7; // Monday-first offset
  const daysInMonth = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const monthStr = pad2(m + 1);

  let cells = "";
  for (let i = 0; i < leading; i++) {
    cells += '<div class="day day--pad" aria-hidden="true"></div>';
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${y}-${monthStr}-${pad2(d)}`;
    cells +=
      `<div class="day" data-date="${dateStr}">` +
      `<span class="day__num">${d}</span>` +
      `<div class="day__marks"></div>` +
      `</div>`;
  }
  const trailing = (7 - ((leading + daysInMonth) % 7)) % 7;
  for (let i = 0; i < trailing; i++) {
    cells += '<div class="day day--pad" aria-hidden="true"></div>';
  }

  return (
    `<section class="month" aria-label="${name} ${y}">` +
    `<div class="month__head"><h2 class="month__name">${name}</h2><span class="month__year">${y}</span></div>` +
    `<hr class="month__rule">` +
    `<div class="month__dow"><span>P</span><span>W</span><span>Ś</span><span>C</span><span>P</span><span>S</span><span>N</span></div>` +
    `<div class="month__grid">${cells}</div>` +
    `</section>`
  );
}

// 12 months starting with the current one (server clock, UTC — matches the
// UTC-string-comparison convention used throughout functions/_calendar).
function buildMonthsHTML() {
  const now = new Date();
  const baseY = now.getUTCFullYear();
  const baseM = now.getUTCMonth();
  let out = "";
  for (let i = 0; i < 12; i++) {
    const total = baseM + i;
    const y = baseY + Math.floor(total / 12);
    const m = ((total % 12) + 12) % 12;
    out += renderMonth(y, m, MONTH_NAMES[m]);
  }
  return out;
}

function memberButtonsHTML() {
  return MEMBERS.map(
    (mem) =>
      `<button type="button" class="member-btn" data-member="${mem.slug}" aria-pressed="false" aria-label="${mem.name}" style="--member-color:${mem.color}">` +
      `<img src="${mem.photo}" alt="${mem.name}" width="48" height="48" loading="lazy">` +
      `<span class="member-btn__label">${mem.name}</span>` +
      `</button>`
  ).join("");
}

// Small legend row (dot + mono name per member) so the day-cell mark colors
// are decodable at a glance — placed above the month grid.
function legendHTML() {
  return MEMBERS.map(
    (mem) =>
      `<span class="legend-item" style="--member-color:${mem.color}">` +
      `<span class="legend-dot" aria-hidden="true"></span>${mem.name}` +
      `</span>`
  ).join("");
}

// Client-side map of slug -> {name, photo, color}, embedded as a JSON
// literal so the app's JS can label/color absence marks and entries without
// a second request. MEMBERS is fixed, trusted, server-defined data — safe
// to serialize as-is.
function memberMapJSON() {
  const map = {};
  for (const mem of MEMBERS) map[mem.slug] = { name: mem.name, photo: mem.photo, color: mem.color };
  return JSON.stringify(map);
}

function htmlHead(title, styleBlock) {
  return (
    `<!doctype html>` +
    `<html lang="pl">` +
    `<head>` +
    `<meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width, initial-scale=1">` +
    `<meta name="robots" content="noindex, nofollow">` +
    `<title>${title}</title>` +
    `<link rel="preconnect" href="https://fonts.googleapis.com">` +
    `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>` +
    `<link href="https://fonts.googleapis.com/css2?family=Anton&family=Space+Mono:ital,wght@0,400;0,700;1,400&display=swap" rel="stylesheet">` +
    `<style>${STYLE}${styleBlock}</style>` +
    `</head>`
  );
}

function loginPage() {
  // Deliberately zero calendar data: no member names/slugs/photos, no
  // entries, no month grid. Just a password form.
  const script = `
(function () {
  var form = document.getElementById("login-form");
  var msg = document.getElementById("login-msg");
  var pass = document.getElementById("password");
  form.addEventListener("submit", function (evt) {
    evt.preventDefault();
    msg.textContent = "";
    fetch("/api/calendar/login", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: pass.value })
    }).then(function (res) {
      if (res.status === 200) {
        location.reload();
        return;
      }
      if (res.status === 401) {
        msg.textContent = "Nieprawidłowe hasło";
        return;
      }
      msg.textContent = "Wystąpił błąd. Spróbuj ponownie.";
    }).catch(function () {
      msg.textContent = "Wystąpił błąd. Spróbuj ponownie.";
    });
  });
})();
`;

  return (
    htmlHead("Kalendarz — logowanie", LOGIN_STYLE) +
    `<body class="login-body">` +
    `<main class="login">` +
    `<h1 class="login__title">FROM NOTHING<span>Kalendarz</span></h1>` +
    `<form id="login-form" class="login__form" novalidate>` +
    `<label for="password">Hasło</label>` +
    `<input type="password" id="password" name="password" autocomplete="current-password" required>` +
    `<button type="submit">Wejdź</button>` +
    `<p id="login-msg" class="login__msg" role="alert" aria-live="polite"></p>` +
    `</form>` +
    `</main>` +
    `<script>${script}</script>` +
    `</body></html>`
  );
}

function appPage() {
  const script = `
(function () {
  var MEMBER_MAP = ${memberMapJSON()};
  var MONTH_NAMES = ${JSON.stringify(MONTH_NAMES)};

  function qs(sel, root) { return (root || document).querySelector(sel); }
  function qsa(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  var state = { entries: [] };

  // Absence marks stack up to 3 avatar dots per day, then collapse into a
  // "+n" counter — keeps busy days from blowing out the square cell.
  function addAbsenceMark(marksEl, entry) {
    var mem = MEMBER_MAP[entry.member];
    if (!mem) return;
    var shown = marksEl.querySelectorAll(".mark--absence").length;
    var total = Number(marksEl.getAttribute("data-count") || "0") + 1;
    marksEl.setAttribute("data-count", String(total));

    var titleParts = [mem.name];
    var extraClass = "";
    if (entry.status === "tentative") {
      extraClass += " mark--tentative";
      titleParts.push("wstępnie");
      if (Number(entry.blocks) === 0) {
        extraClass += " mark--nonblocking";
        titleParts.push("nie blokuje terminu — koncert ma priorytet");
      } else {
        titleParts.push("blokuje termin");
      }
    } else {
      titleParts.push("na pewno out");
    }
    var title = titleParts.join(" — ");

    var moreEl = marksEl.querySelector(".mark--more");
    if (shown >= 3) {
      if (!moreEl) {
        moreEl = document.createElement("span");
        moreEl.className = "mark mark--more";
        marksEl.appendChild(moreEl);
      }
      moreEl.textContent = "+" + (total - 3);
      moreEl.title = (total - 3) + " więcej";
      return;
    }

    var wrap = document.createElement("span");
    wrap.className = "mark mark--absence" + extraClass;
    if (mem.color) wrap.style.setProperty("--member-color", mem.color);
    var img = document.createElement("img");
    img.src = mem.photo;
    img.alt = mem.name;
    wrap.appendChild(img);
    wrap.title = title;
    if (moreEl) marksEl.insertBefore(wrap, moreEl);
    else marksEl.appendChild(wrap);
  }

  function clearMarks() {
    qsa(".day").forEach(function (dayEl) {
      dayEl.classList.remove("day--concert");
      dayEl.removeAttribute("title");
      var marksEl = dayEl.querySelector(".day__marks");
      if (!marksEl) return;
      while (marksEl.firstChild) marksEl.removeChild(marksEl.firstChild);
      marksEl.removeAttribute("data-count");
    });
  }

  function markToday() {
    var now = new Date();
    var iso = now.getUTCFullYear() + "-" +
      String(now.getUTCMonth() + 1).padStart(2, "0") + "-" +
      String(now.getUTCDate()).padStart(2, "0");
    var el = qs('.day[data-date="' + iso + '"]');
    if (el) el.classList.add("day--today");
  }

  function applyEntryToDays(entry) {
    var from = entry.date_from, to = entry.date_to;
    qsa(".day[data-date]").forEach(function (dayEl) {
      var d = dayEl.getAttribute("data-date");
      if (d < from || d > to) return;
      if (entry.type === "concert") {
        dayEl.classList.add("day--concert");
        dayEl.title = "Koncert: " + (entry.title || "(bez tytułu)");
        return;
      }
      var marksEl = dayEl.querySelector(".day__marks");
      if (!marksEl) return;
      addAbsenceMark(marksEl, entry);
    });
  }

  function buildEntryRow(entry) {
    var li = document.createElement("li");
    li.className = "entry-row";

    var marker = document.createElement("span");
    marker.className = "entry-row__marker";
    if (entry.type === "concert") {
      marker.className += " entry-row__marker--concert";
      marker.textContent = "★";
    } else {
      var mem = MEMBER_MAP[entry.member];
      marker.className += " entry-row__marker--avatar";
      if (mem) {
        if (mem.color) marker.style.setProperty("--member-color", mem.color);
        var img = document.createElement("img");
        img.src = mem.photo;
        img.alt = mem.name;
        marker.appendChild(img);
      }
    }
    li.appendChild(marker);

    var info = document.createElement("div");
    info.className = "entry-row__info";

    var range = document.createElement("span");
    range.className = "entry-row__range";
    range.textContent = entry.date_from === entry.date_to
      ? entry.date_from
      : (entry.date_from + " – " + entry.date_to);
    info.appendChild(range);

    var desc = document.createElement("span");
    desc.className = "entry-row__desc";
    if (entry.type === "concert") {
      desc.appendChild(document.createTextNode("Koncert: " + (entry.title || "(bez tytułu)")));
    } else {
      var m = MEMBER_MAP[entry.member];
      var memName = m ? m.name : entry.member;
      desc.appendChild(document.createTextNode(memName + " "));
      var badge = document.createElement("span");
      if (entry.status === "tentative") {
        if (Number(entry.blocks) === 0) {
          badge.className = "badge badge--tentative-nonblocking";
          badge.textContent = "WSTĘPNIE · NIE BLOKUJE";
        } else {
          badge.className = "badge badge--tentative";
          badge.textContent = "WSTĘPNIE";
        }
      } else {
        badge.className = "badge badge--out";
        badge.textContent = "OUT";
      }
      desc.appendChild(badge);
    }
    info.appendChild(desc);
    li.appendChild(info);

    var delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className = "entry-row__delete";
    delBtn.textContent = "×";
    delBtn.setAttribute("aria-label", "Usuń wpis");
    delBtn.addEventListener("click", function () { deleteEntry(entry.id); });
    li.appendChild(delBtn);

    return li;
  }

  function renderEntriesList(entries) {
    var list = document.getElementById("entries-list");
    while (list.firstChild) list.removeChild(list.firstChild);
    if (!entries.length) {
      var empty = document.createElement("p");
      empty.className = "entries-empty";
      empty.textContent = "Brak wpisów.";
      list.appendChild(empty);
      return;
    }

    var groupOrder = [];
    var groups = {};
    entries.forEach(function (entry) {
      var key = entry.date_from.slice(0, 7); // YYYY-MM
      if (!groups[key]) {
        groups[key] = [];
        groupOrder.push(key);
      }
      groups[key].push(entry);
    });

    groupOrder.forEach(function (key) {
      var year = key.slice(0, 4);
      var monthIdx = Number(key.slice(5, 7)) - 1;
      var group = document.createElement("div");
      group.className = "entries-month-group";

      var label = document.createElement("h3");
      label.className = "entries-month-label";
      label.textContent = (MONTH_NAMES[monthIdx] || key) + " " + year;
      group.appendChild(label);

      var sub = document.createElement("ul");
      sub.className = "entries-sublist";
      groups[key].forEach(function (entry) {
        sub.appendChild(buildEntryRow(entry));
      });
      group.appendChild(sub);

      list.appendChild(group);
    });
  }

  function render() {
    clearMarks();
    state.entries.forEach(applyEntryToDays);
    markToday();
    var sorted = state.entries.slice().sort(function (a, b) {
      if (a.date_from < b.date_from) return -1;
      if (a.date_from > b.date_from) return 1;
      return 0;
    });
    renderEntriesList(sorted);
  }

  function loadEntries() {
    return fetch("/api/calendar/entries", { credentials: "same-origin" })
      .then(function (res) {
        if (res.status === 401) {
          location.reload();
          return null;
        }
        if (!res.ok) throw new Error("http_" + res.status);
        return res.json();
      })
      .then(function (data) {
        if (!data) return;
        state.entries = (data && data.entries) || [];
        render();
      })
      .catch(function (err) {
        console.error("nie udało się pobrać wpisów", err);
      });
  }

  function deleteEntry(id) {
    if (!confirm("Na pewno usunąć ten wpis?")) return;
    fetch("/api/calendar/entries/" + id, { method: "DELETE", credentials: "same-origin" })
      .then(function (res) {
        if (res.status === 401) { location.reload(); return; }
        if (!res.ok && res.status !== 404) throw new Error("http_" + res.status);
        return loadEntries();
      })
      .catch(function (err) {
        console.error("nie udało się usunąć wpisu", err);
      });
  }

  // --- Add-entry form -------------------------------------------------------
  var form = document.getElementById("entry-form");
  var typeAbsenceBtn = document.getElementById("type-absence-btn");
  var typeConcertBtn = document.getElementById("type-concert-btn");
  var absenceFields = document.getElementById("absence-fields");
  var concertFields = document.getElementById("concert-fields");
  var concertTitleInput = document.getElementById("concert-title");
  var memberButtons = qsa(".member-btn");
  var statusRadios = qsa('input[name="status"]');
  var blocksRadios = qsa('input[name="blocks"]');
  var blocksGroup = document.getElementById("blocks-group");
  var blocksNote = document.getElementById("blocks-note");
  var dateFrom = document.getElementById("date-from");
  var dateTo = document.getElementById("date-to");
  var formMsg = document.getElementById("form-msg");
  var logoutBtn = document.getElementById("logout-btn");
  var currentType = "absence";
  var currentMember = null;

  // Switching type must not leave stale, irrelevant state lying around: a
  // concert entry never carries a member/status, an absence entry never
  // carries a title. The submit handler already only reads the fields for
  // the active branch, but we also clear the inactive side's inputs here so
  // the *visible* form never shows a lingering value from the other mode.
  function setType(t) {
    currentType = t;
    typeAbsenceBtn.setAttribute("aria-pressed", String(t === "absence"));
    typeConcertBtn.setAttribute("aria-pressed", String(t === "concert"));
    absenceFields.hidden = t !== "absence";
    concertFields.hidden = t !== "concert";
    if (t === "concert") {
      currentMember = null;
      memberButtons.forEach(function (b) { b.setAttribute("aria-pressed", "false"); });
    } else {
      concertTitleInput.value = "";
    }
  }
  typeAbsenceBtn.addEventListener("click", function () { setType("absence"); });
  typeConcertBtn.addEventListener("click", function () { setType("concert"); });

  memberButtons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      currentMember = btn.getAttribute("data-member");
      memberButtons.forEach(function (b) {
        b.setAttribute("aria-pressed", String(b === btn));
      });
    });
  });

  function updateBlocksNote() {
    var checked = qs('input[name="blocks"]:checked');
    blocksNote.hidden = !checked || checked.value !== "0";
  }

  function updateBlocksVisibility() {
    var checked = qs('input[name="status"]:checked');
    var isTentative = !!checked && checked.value === "tentative";
    blocksGroup.hidden = !isTentative;
    updateBlocksNote();
  }
  statusRadios.forEach(function (r) {
    r.addEventListener("change", updateBlocksVisibility);
  });
  blocksRadios.forEach(function (r) {
    r.addEventListener("change", updateBlocksNote);
  });

  dateFrom.addEventListener("change", function () {
    if (!dateTo.value || dateTo.value < dateFrom.value) {
      dateTo.value = dateFrom.value;
    }
  });

  function resetForm() {
    form.reset();
    currentMember = null;
    memberButtons.forEach(function (b) { b.setAttribute("aria-pressed", "false"); });
    setType("absence");
    updateBlocksVisibility();
    formMsg.textContent = "";
  }

  form.addEventListener("submit", function (evt) {
    evt.preventDefault();
    formMsg.textContent = "";
    var payload;

    if (currentType === "absence") {
      if (!currentMember) {
        formMsg.textContent = "Wybierz osobę.";
        return;
      }
      var statusChecked = qs('input[name="status"]:checked');
      var status = statusChecked ? statusChecked.value : "out";
      payload = {
        type: "absence",
        member: currentMember,
        status: status,
        date_from: dateFrom.value,
        date_to: dateTo.value
      };
      if (status === "tentative") {
        var blocksChecked = qs('input[name="blocks"]:checked');
        if (!blocksChecked) {
          formMsg.textContent = "Sprawdź pola formularza.";
          return;
        }
        payload.blocks = Number(blocksChecked.value);
      }
    } else {
      var titleVal = document.getElementById("concert-title").value.trim();
      payload = {
        type: "concert",
        title: titleVal,
        date_from: dateFrom.value,
        date_to: dateTo.value
      };
    }

    fetch("/api/calendar/entries", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }).then(function (res) {
      if (res.status === 401) { location.reload(); return; }
      if (res.status === 201) {
        resetForm();
        loadEntries();
        return;
      }
      if (res.status === 400) {
        formMsg.textContent = "Sprawdź pola formularza.";
        return;
      }
      formMsg.textContent = "Wystąpił błąd. Spróbuj ponownie.";
    }).catch(function () {
      formMsg.textContent = "Wystąpił błąd. Spróbuj ponownie.";
    });
  });

  logoutBtn.addEventListener("click", function () {
    fetch("/api/calendar/login", { method: "DELETE", credentials: "same-origin" })
      .then(function () { location.reload(); })
      .catch(function () { location.reload(); });
  });

  updateBlocksVisibility();
  setType("absence");
  markToday();
  loadEntries();
})();
`;

  return (
    htmlHead("Kalendarz — From Nothing", APP_STYLE) +
    `<body>` +
    `<header class="app-header">` +
    `<div><span class="app-header__kicker">From Nothing</span><h1 class="app-header__title">Kalendarz</h1></div>` +
    `<div class="header-actions">` +
    `<a href="/koncerty" class="nav-link">Koncerty</a>` +
    `<button type="button" id="logout-btn" class="logout-btn">Wyloguj</button>` +
    `</div>` +
    `</header>` +
    `<main class="layout">` +
    `<aside class="sidebar">` +
    `<section class="add-entry">` +
    `<h2 class="add-entry__heading">Dodaj wpis</h2>` +
    `<form id="entry-form" class="entry-form" novalidate>` +
    `<div class="type-toggle" role="group" aria-label="Rodzaj wpisu">` +
    `<button type="button" id="type-absence-btn" aria-pressed="true">Nieobecność</button>` +
    `<button type="button" id="type-concert-btn" aria-pressed="false">Koncert</button>` +
    `</div>` +

    `<div id="absence-fields">` +
    `<fieldset>` +
    `<legend>Kto</legend>` +
    `<div class="member-picker">${memberButtonsHTML()}</div>` +
    `</fieldset>` +

    `<fieldset>` +
    `<legend>Status</legend>` +
    `<div class="pill-row" role="radiogroup" aria-label="Status">` +
    `<label class="pill"><input type="radio" name="status" value="out" checked><span>Na pewno out</span></label>` +
    `<label class="pill"><input type="radio" name="status" value="tentative"><span>Wstępnie</span></label>` +
    `</div>` +
    `</fieldset>` +

    `<div id="blocks-group" hidden>` +
    `<fieldset>` +
    `<legend>Czy blokuje koncert?</legend>` +
    `<div class="pill-row" role="radiogroup" aria-label="Czy blokuje koncert?">` +
    `<label class="pill"><input type="radio" name="blocks" value="1"><span>Tak</span></label>` +
    `<label class="pill"><input type="radio" name="blocks" value="0"><span>Nie</span></label>` +
    `</div>` +
    `<p class="note" id="blocks-note" hidden>Jeśli nie blokuje — termin pozostaje dostępny dla klientów i koncert ma priorytet nad wstępnymi planami.</p>` +
    `</fieldset>` +
    `</div>` +
    `</div>` +

    `<fieldset id="concert-fields" hidden>` +
    `<legend>Koncert</legend>` +
    `<div class="field">` +
    `<label for="concert-title">Tytuł / miejsce</label>` +
    `<input type="text" id="concert-title" name="concert-title" maxlength="200">` +
    `</div>` +
    `</fieldset>` +

    `<div class="date-fields">` +
    `<div class="field"><label for="date-from">Od</label><input type="date" id="date-from" name="date-from" required></div>` +
    `<div class="field"><label for="date-to">Do</label><input type="date" id="date-to" name="date-to" required></div>` +
    `</div>` +

    `<button type="submit" class="submit-btn">Zapisz</button>` +
    `<p id="form-msg" class="form-msg" role="alert" aria-live="polite"></p>` +
    `</form>` +
    `</section>` +

    `<section class="entries-section">` +
    `<h2 class="entries-heading">Wpisy</h2>` +
    `<div id="entries-list"></div>` +
    `</section>` +
    `</aside>` +

    `<div class="calendar-column">` +
    `<div class="calendar-legend">${legendHTML()}</div>` +
    `<div class="calendar" id="calendar">${buildMonthsHTML()}</div>` +
    `</div>` +
    `</main>` +
    `<script>${script}</script>` +
    `</body></html>`
  );
}

export async function onRequest({ request, env }) {
  if (request.method !== "GET") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: { Allow: "GET", "X-Robots-Tag": "noindex", "Cache-Control": "no-store" },
    });
  }

  const authed = await checkAuth(request, env);
  const html = authed ? appPage() : loginPage();

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "X-Robots-Tag": "noindex",
      "Cache-Control": "no-store",
    },
  });
}
