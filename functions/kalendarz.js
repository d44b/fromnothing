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

const MEMBERS = [
  { slug: "mery", name: "Mery", photo: "/assets/img/member-mery-thumbnail.webp" },
  { slug: "janusz", name: "Janusz", photo: "/assets/img/member-janusz-thumbnail.webp" },
  { slug: "patryk", name: "Patryk", photo: "/assets/img/member-patryk2-thumbnail.webp" },
  { slug: "wojtek", name: "Wojtek", photo: "/assets/img/member-wojtek-thumbnail.webp" },
  { slug: "damian", name: "Damian", photo: "/assets/img/member-damian-thumbnail.webp" },
];

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
  padding: 0.75rem 1rem;
  background: var(--bg);
  border-bottom: 2px solid var(--ink);
}
.app-header__title {
  font-size: 1.125rem;
  color: var(--accent);
}
.app-header__title span { color: var(--ink); }
.logout-btn {
  border: 1px solid var(--ink);
  padding: 0.5rem 0.75rem;
  min-height: 40px;
  text-transform: uppercase;
  font-size: 0.75rem;
  letter-spacing: 0.06em;
}
.logout-btn:hover { background: var(--ink); color: var(--bg); }

main { padding: 1rem; max-width: 40rem; margin: 0 auto; }

.add-entry { margin-bottom: 2rem; border: 1px solid var(--line-strong); background: var(--bg-elev); }
.add-entry__heading {
  font-size: 1rem;
  padding: 0.9rem 1rem;
  border-bottom: 2px solid var(--ink);
}
.entry-form { padding: 1rem; display: flex; flex-direction: column; gap: 1.1rem; }

.type-toggle { display: flex; gap: 0.5rem; }
.type-toggle button {
  flex: 1;
  border: 1px solid var(--ink);
  padding: 0.65rem 0.5rem;
  min-height: 44px;
  text-transform: uppercase;
  font-size: 0.8125rem;
  letter-spacing: 0.04em;
  background: var(--bg);
}
.type-toggle button[aria-pressed="true"] { background: var(--ink); color: var(--bg); }

fieldset { border: 0; display: flex; flex-direction: column; gap: 0.9rem; }
legend {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--ink-dim);
  padding: 0;
  margin-bottom: 0.4rem;
}

.member-picker { display: flex; flex-wrap: wrap; gap: 0.6rem; }
.member-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.3rem;
  width: 4.25rem;
  padding: 0.4rem 0.2rem;
  border: 2px solid transparent;
}
.member-btn img {
  width: 48px; height: 48px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid var(--line-strong);
}
.member-btn__label { font-size: 0.6875rem; text-transform: uppercase; letter-spacing: 0.02em; }
.member-btn[aria-pressed="true"] { border-color: var(--accent); }
.member-btn[aria-pressed="true"] img { border-color: var(--accent); box-shadow: 0 0 0 2px var(--accent); }

.radio-row { display: flex; flex-direction: column; gap: 0.5rem; }
.radio-row label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-height: 40px;
  padding: 0.25rem 0;
}
.radio-row input { width: 20px; height: 20px; accent-color: var(--accent); }
.note {
  font-size: 0.75rem;
  color: var(--ink-dim);
  border-left: 3px solid var(--accent);
  padding: 0.5rem 0.75rem;
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
  padding: 0.8rem;
  min-height: 44px;
}
.submit-btn:hover { background: var(--accent-hot); }
.form-msg { color: var(--accent); font-size: 0.8125rem; min-height: 1.2em; }

.calendar { display: flex; flex-direction: column; gap: 1.5rem; margin-bottom: 2rem; }
.month { border: 1px solid var(--line-strong); }
.month__name {
  font-size: 1rem;
  padding: 0.6rem 0.75rem;
  background: var(--ink);
  color: var(--bg);
}
.month__dow {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  font-size: 0.6875rem;
  text-transform: uppercase;
  color: var(--ink-dim);
  border-bottom: 1px solid var(--line);
}
.month__dow span { text-align: center; padding: 0.35rem 0; }
.month__grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
}
.day {
  min-height: 3.4rem;
  border-right: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
  padding: 0.2rem;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}
.day--pad { background: var(--bg-elev); }
.day__num { font-size: 0.75rem; color: var(--ink-dim); }
.day__marks { display: flex; flex-wrap: wrap; gap: 2px; flex: 1; align-content: flex-start; }

.mark { position: relative; display: inline-block; width: 18px; height: 18px; }
.mark--absence img {
  width: 100%; height: 100%;
  border-radius: 50%;
  object-fit: cover;
  display: block;
  border: 1px solid var(--line-strong);
}
.mark--tentative img { border-style: dashed; border-color: var(--accent); opacity: 0.75; }
.mark--nonblocking::after {
  content: "";
  position: absolute; inset: 0;
  border-radius: 50%;
  background-image: repeating-linear-gradient(45deg, rgba(23, 20, 15, 0.4) 0 2px, transparent 2px 4px);
  pointer-events: none;
}
.mark--concert {
  width: 100%;
  min-height: 14px;
  background: var(--accent);
  border-radius: 2px;
}

.entries-heading { font-size: 1rem; margin-bottom: 0.75rem; }
.entries-list { list-style: none; display: flex; flex-direction: column; gap: 0.5rem; }
.entry-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  border: 1px solid var(--line-strong);
  background: var(--bg-elev);
  padding: 0.6rem 0.75rem;
}
.entry-row__info { display: flex; flex-direction: column; gap: 0.15rem; min-width: 0; }
.entry-row__range { font-size: 0.75rem; color: var(--ink-dim); }
.entry-row__desc { font-size: 0.875rem; overflow-wrap: anywhere; }
.entry-row__delete {
  flex-shrink: 0;
  border: 1px solid var(--accent);
  color: var(--accent);
  padding: 0.5rem 0.65rem;
  min-height: 40px;
  min-width: 40px;
  text-transform: uppercase;
  font-size: 0.75rem;
}
.entry-row__delete:hover { background: var(--accent); color: var(--bg); }
.entries-empty { color: var(--ink-dim); font-size: 0.875rem; }
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
    `<h2 class="month__name">${name} ${y}</h2>` +
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
      `<button type="button" class="member-btn" data-member="${mem.slug}" aria-pressed="false" aria-label="${mem.name}">` +
      `<img src="${mem.photo}" alt="${mem.name}" width="48" height="48" loading="lazy">` +
      `<span class="member-btn__label">${mem.name}</span>` +
      `</button>`
  ).join("");
}

// Client-side map of slug -> {name, photo}, embedded as a JSON literal so
// the app's JS can label absence marks/entries without a second request.
// MEMBERS is fixed, trusted, server-defined data — safe to serialize as-is.
function memberMapJSON() {
  const map = {};
  for (const mem of MEMBERS) map[mem.slug] = { name: mem.name, photo: mem.photo };
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

  function qs(sel, root) { return (root || document).querySelector(sel); }
  function qsa(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  var state = { entries: [] };

  function addAbsenceMark(container, entry) {
    var mem = MEMBER_MAP[entry.member];
    if (!mem) return;
    var wrap = document.createElement("span");
    wrap.className = "mark mark--absence";
    var img = document.createElement("img");
    img.src = mem.photo;
    img.alt = mem.name;
    wrap.appendChild(img);

    var titleParts = [mem.name];
    if (entry.status === "tentative") {
      wrap.className += " mark--tentative";
      titleParts.push("wstępnie");
      if (Number(entry.blocks) === 0) {
        wrap.className += " mark--nonblocking";
        titleParts.push("nie blokuje terminu — koncert ma priorytet");
      } else {
        titleParts.push("blokuje termin");
      }
    } else {
      titleParts.push("na pewno out");
    }
    wrap.title = titleParts.join(" — ");
    container.appendChild(wrap);
  }

  function addConcertMark(container, entry) {
    var el = document.createElement("span");
    el.className = "mark mark--concert";
    el.title = "Koncert: " + (entry.title || "(bez tytułu)");
    container.appendChild(el);
  }

  function clearMarks() {
    qsa(".day__marks").forEach(function (el) {
      while (el.firstChild) el.removeChild(el.firstChild);
    });
  }

  function applyEntryToDays(entry) {
    var from = entry.date_from, to = entry.date_to;
    qsa(".day[data-date]").forEach(function (dayEl) {
      var d = dayEl.getAttribute("data-date");
      if (d < from || d > to) return;
      var marksEl = dayEl.querySelector(".day__marks");
      if (!marksEl) return;
      if (entry.type === "concert") addConcertMark(marksEl, entry);
      else addAbsenceMark(marksEl, entry);
    });
  }

  function renderEntriesList(entries) {
    var list = document.getElementById("entries-list");
    while (list.firstChild) list.removeChild(list.firstChild);
    if (!entries.length) {
      var empty = document.createElement("li");
      empty.className = "entries-empty";
      empty.textContent = "Brak wpisów.";
      list.appendChild(empty);
      return;
    }
    entries.forEach(function (entry) {
      var li = document.createElement("li");
      li.className = "entry-row";

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
        desc.textContent = "Koncert: " + (entry.title || "(bez tytułu)");
      } else {
        var mem = MEMBER_MAP[entry.member];
        var memName = mem ? mem.name : entry.member;
        var statusText = entry.status === "tentative"
          ? (Number(entry.blocks) === 0 ? "wstępnie, nie blokuje" : "wstępnie, blokuje")
          : "na pewno out";
        desc.textContent = memName + " — " + statusText;
      }
      info.appendChild(desc);
      li.appendChild(info);

      var delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.className = "entry-row__delete";
      delBtn.textContent = "Usuń";
      delBtn.setAttribute("aria-label", "Usuń wpis");
      delBtn.addEventListener("click", function () { deleteEntry(entry.id); });
      li.appendChild(delBtn);

      list.appendChild(li);
    });
  }

  function render() {
    clearMarks();
    state.entries.forEach(applyEntryToDays);
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
  var memberButtons = qsa(".member-btn");
  var statusRadios = qsa('input[name="status"]');
  var blocksGroup = document.getElementById("blocks-group");
  var dateFrom = document.getElementById("date-from");
  var dateTo = document.getElementById("date-to");
  var formMsg = document.getElementById("form-msg");
  var logoutBtn = document.getElementById("logout-btn");
  var currentType = "absence";
  var currentMember = null;

  function setType(t) {
    currentType = t;
    typeAbsenceBtn.setAttribute("aria-pressed", String(t === "absence"));
    typeConcertBtn.setAttribute("aria-pressed", String(t === "concert"));
    absenceFields.hidden = t !== "absence";
    concertFields.hidden = t !== "concert";
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

  function updateBlocksVisibility() {
    var checked = qs('input[name="status"]:checked');
    var isTentative = !!checked && checked.value === "tentative";
    blocksGroup.hidden = !isTentative;
  }
  statusRadios.forEach(function (r) {
    r.addEventListener("change", updateBlocksVisibility);
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
  loadEntries();
})();
`;

  return (
    htmlHead("Kalendarz — From Nothing", APP_STYLE) +
    `<body>` +
    `<header class="app-header">` +
    `<h1 class="app-header__title">FROM NOTHING <span>Kalendarz</span></h1>` +
    `<button type="button" id="logout-btn" class="logout-btn">Wyloguj</button>` +
    `</header>` +
    `<main>` +
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
    `<div class="radio-row">` +
    `<label><input type="radio" name="status" value="out" checked> Na pewno out</label>` +
    `<label><input type="radio" name="status" value="tentative"> Wstępnie</label>` +
    `</div>` +
    `</fieldset>` +

    `<div id="blocks-group" hidden>` +
    `<fieldset>` +
    `<legend>Czy blokuje koncert?</legend>` +
    `<div class="radio-row">` +
    `<label><input type="radio" name="blocks" value="1"> Tak</label>` +
    `<label><input type="radio" name="blocks" value="0"> Nie</label>` +
    `</div>` +
    `<p class="note">Jeśli nie blokuje — termin pozostaje dostępny dla klientów i koncert ma priorytet nad wstępnymi planami.</p>` +
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

    `<div class="calendar" id="calendar">${buildMonthsHTML()}</div>` +

    `<section>` +
    `<h2 class="entries-heading">Wpisy</h2>` +
    `<ul id="entries-list" class="entries-list"></ul>` +
    `</section>` +
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
