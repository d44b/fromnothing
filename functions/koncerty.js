// GET /koncerty — internal band admin tool for the concert list + shared
// presspack files (Phase 3 of specs/koncerty-presspack/roadmap.md).
//
// Password-gated via functions/_calendar/auth.js checkAuth() / the fn_cal
// cookie — the exact same shared password and session cookie as /kalendarz,
// no second login. Unauthenticated visitors get a bare login form with zero
// concert data in the markup; authenticated visitors get the full app: an
// add/edit concert form, a two-group concert list (Nadchodzące / Archiwalne)
// wired to the Phase-1 CRUD API (GET/POST /api/concerts, PUT/DELETE
// /api/concerts/:id, POST/DELETE /api/concerts/:id/presspack-link), and a
// shared presspack files manager wired to the Phase-3 files API (GET/POST
// /api/presspack/files, DELETE /api/presspack/files/:name).
//
// Everything — CSS and JS — is inlined as template literals: this repo ships
// zero npm deps and no bundler, so there is nowhere else for it to live.
// Structure and cream/brutalist look deliberately mirror functions/kalendarz.js
// (this page has no shared module to import that look from, so the constants
// below are a sibling copy, not a re-export).
//
// The concert list and files list are both loaded client-side after auth —
// this function itself never touches D1 or R2, keeping server-rendered
// markup identical for every authenticated visitor regardless of data.

import { checkAuth } from "./_calendar/auth.js";

// Same brutalist-poster base as functions/kalendarz.js's STYLE: cream/off-
// white background, scarlet accent, heavy uppercase display type. No member
// ring-color custom properties here — /koncerty has no per-person data.
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
input, select, textarea { font: inherit; color: inherit; }
img { display: block; max-width: 100%; }
:focus-visible { outline: 3px solid var(--focus); outline-offset: 2px; }
.visually-hidden {
  position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
  overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0;
}
/* See functions/kalendarz.js's STYLE for the reasoning behind this rule:
   an author \`display\` rule beats the UA [hidden] rule in the cascade
   regardless of specificity, so this line has to exist to keep [hidden]
   elements actually hidden. */
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

.form-card { border: 1px solid var(--line-strong); background: var(--bg-elev); }
.form-card__heading {
  font-size: 1rem;
  padding: 0.9rem 1.1rem;
  border-bottom: 2px solid var(--ink);
}
.concert-form { padding: 1.1rem; display: flex; flex-direction: column; gap: 0.85rem; }

.field { display: flex; flex-direction: column; gap: 0.35rem; }
.field label {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--ink-dim);
}
.field input[type="text"],
.field input[type="date"],
.field textarea {
  border: 1px solid var(--line-strong);
  background: var(--bg);
  padding: 0.6rem;
  min-height: 44px;
  font-size: 1rem;
  font-family: inherit;
}
.field textarea { min-height: 4.5rem; resize: vertical; }
.field--checkbox { flex-direction: row; align-items: center; }
.checkbox-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8125rem;
  text-transform: none;
  letter-spacing: normal;
  color: var(--ink);
}
.checkbox-label input[type="checkbox"] { width: 20px; height: 20px; }

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
.cancel-btn {
  border: 1px solid var(--ink);
  padding: 0.7rem;
  min-height: 44px;
  text-transform: uppercase;
  font-size: 0.8rem;
  letter-spacing: 0.04em;
  background: var(--bg);
}
.cancel-btn:hover { background: var(--ink); color: var(--bg); }
.form-msg { color: var(--accent); font-size: 0.8125rem; min-height: 1.2em; }

.note {
  font-size: 0.75rem;
  color: var(--ink-dim);
  border-left: 3px solid var(--accent);
  padding: 0.55rem 0.8rem;
  background: var(--bg);
  margin: 0 1.1rem 1.1rem;
}

.files-section { border: 1px solid var(--line-strong); background: var(--bg-elev); padding: 1.1rem; }
.files-section__heading {
  font-size: 1rem;
  margin-bottom: 0.9rem;
  padding-bottom: 0.6rem;
  border-bottom: 2px solid var(--ink);
}
.files-upload { display: flex; flex-wrap: wrap; gap: 0.6rem; align-items: center; margin-bottom: 0.6rem; }
.files-upload input[type="file"] { flex: 1; min-width: 0; font-size: 0.8125rem; }
.files-upload button {
  border: 1px solid var(--ink);
  padding: 0.6rem 0.9rem;
  min-height: 44px;
  text-transform: uppercase;
  font-size: 0.75rem;
  letter-spacing: 0.04em;
  background: var(--bg);
}
.files-upload button:hover { background: var(--ink); color: var(--bg); }
.files-list { list-style: none; display: flex; flex-direction: column; gap: 0.5rem; }
.file-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  border: 1px solid var(--line-strong);
  background: var(--bg);
  padding: 0.5rem 0.6rem;
}
.file-row__name { flex: 1; min-width: 0; overflow-wrap: anywhere; font-size: 0.8125rem; }
.file-row__size { flex-shrink: 0; font-size: 0.75rem; color: var(--ink-dim); }
.file-row button {
  flex-shrink: 0;
  border: 1px solid var(--ink);
  padding: 0.4rem 0.7rem;
  min-height: 36px;
  text-transform: uppercase;
  font-size: 0.7rem;
  letter-spacing: 0.03em;
  background: var(--bg);
}
.file-row button:hover { background: var(--ink); color: var(--bg); }
.files-empty, .concerts-empty { color: var(--ink-dim); font-size: 0.875rem; }

.concerts-column { display: flex; flex-direction: column; gap: 1.75rem; min-width: 0; }
.concerts-section { border: 1px solid var(--line-strong); background: var(--bg-elev); padding: 1.1rem; }
.concerts-heading {
  font-size: 1rem;
  margin-bottom: 0.9rem;
  padding-bottom: 0.6rem;
  border-bottom: 2px solid var(--ink);
}
.concert-list { list-style: none; display: flex; flex-direction: column; gap: 0.75rem; }
.concert-row {
  border: 1px solid var(--line-strong);
  background: var(--bg);
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}
.concert-row__head { display: flex; flex-wrap: wrap; align-items: center; gap: 0.6rem; }
.concert-row__date { font-family: var(--ff-display); font-size: 1.05rem; }
.concert-row__place { font-size: 0.875rem; color: var(--ink-dim); flex: 1; min-width: 0; overflow-wrap: anywhere; }
.badge {
  display: inline-block;
  padding: 0.15rem 0.45rem;
  font-size: 0.625rem;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  font-weight: 700;
}
.badge--hidden { background: var(--accent); color: var(--bg); }
.concert-row__actions { display: flex; flex-wrap: wrap; gap: 0.5rem; }
.concert-row__actions button {
  border: 1px solid var(--ink);
  padding: 0.5rem 0.75rem;
  min-height: 40px;
  text-transform: uppercase;
  font-size: 0.7rem;
  letter-spacing: 0.03em;
  background: var(--bg);
}
.concert-row__actions button:hover { background: var(--ink); color: var(--bg); }
.presspack-block { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; border-top: 1px solid var(--line); padding-top: 0.6rem; }
.presspack-block button {
  border: 1px solid var(--line-strong);
  padding: 0.45rem 0.7rem;
  min-height: 40px;
  text-transform: uppercase;
  font-size: 0.7rem;
  letter-spacing: 0.03em;
  background: var(--bg);
}
.presspack-block button:hover { background: var(--ink); color: var(--bg); border-color: var(--ink); }
.presspack-url {
  flex: 1;
  min-width: 12rem;
  border: 1px solid var(--line-strong);
  background: var(--bg-elev);
  padding: 0.5rem;
  font-size: 0.8125rem;
  font-family: var(--ff-mono);
}
`;

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
  // Deliberately zero concert data: no venues, no dates, no presspack
  // tokens, no file names. Just a password form — same shape as
  // functions/kalendarz.js's loginPage().
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
    htmlHead("Koncerty — logowanie", LOGIN_STYLE) +
    `<body class="login-body">` +
    `<main class="login">` +
    `<h1 class="login__title">FROM NOTHING<span>Koncerty</span></h1>` +
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
  function qs(sel, root) { return (root || document).querySelector(sel); }

  var state = { concerts: [] };
  var editingId = null;

  var form = document.getElementById("concert-form");
  var formHeading = document.getElementById("form-heading");
  var submitBtn = document.getElementById("submit-btn");
  var cancelBtn = document.getElementById("cancel-btn");
  var formMsg = document.getElementById("form-msg");
  var logoutBtn = document.getElementById("logout-btn");

  var fields = {
    date: document.getElementById("f-date"),
    city: document.getElementById("f-city"),
    venue_name: document.getElementById("f-venue_name"),
    venue_url: document.getElementById("f-venue_url"),
    address_street: document.getElementById("f-address_street"),
    address_postal: document.getElementById("f-address_postal"),
    address_locality: document.getElementById("f-address_locality"),
    address_country: document.getElementById("f-address_country"),
    published: document.getElementById("f-published"),
    ticket_url: document.getElementById("f-ticket_url"),
    gallery_url: document.getElementById("f-gallery_url"),
    thanks_pl: document.getElementById("f-thanks_pl"),
    thanks_en: document.getElementById("f-thanks_en")
  };

  function todayISO() {
    var now = new Date();
    return now.getUTCFullYear() + "-" +
      String(now.getUTCMonth() + 1).padStart(2, "0") + "-" +
      String(now.getUTCDate()).padStart(2, "0");
  }

  function resetForm() {
    form.reset();
    fields.published.checked = true;
    editingId = null;
    formHeading.textContent = "Dodaj koncert";
    submitBtn.textContent = "Dodaj koncert";
    cancelBtn.hidden = true;
    formMsg.textContent = "";
  }

  function fillFormForEdit(concert) {
    editingId = concert.id;
    fields.date.value = concert.date || "";
    fields.city.value = concert.city || "";
    fields.venue_name.value = concert.venue_name || "";
    fields.venue_url.value = concert.venue_url || "";
    fields.address_street.value = concert.address_street || "";
    fields.address_postal.value = concert.address_postal || "";
    fields.address_locality.value = concert.address_locality || "";
    fields.address_country.value = concert.address_country || "";
    fields.published.checked = Number(concert.published) === 1;
    fields.ticket_url.value = concert.ticket_url || "";
    fields.gallery_url.value = concert.gallery_url || "";
    fields.thanks_pl.value = concert.thanks_pl || "";
    fields.thanks_en.value = concert.thanks_en || "";
    formHeading.textContent = "Edytuj koncert";
    submitBtn.textContent = "Zapisz zmiany";
    cancelBtn.hidden = false;
    formMsg.textContent = "";
    window.scrollTo(0, 0);
  }

  function buildPayload() {
    return {
      date: fields.date.value,
      city: fields.city.value,
      venue_name: fields.venue_name.value,
      venue_url: fields.venue_url.value,
      address_street: fields.address_street.value,
      address_postal: fields.address_postal.value,
      address_locality: fields.address_locality.value,
      address_country: fields.address_country.value,
      published: fields.published.checked ? 1 : 0,
      ticket_url: fields.ticket_url.value,
      gallery_url: fields.gallery_url.value,
      thanks_pl: fields.thanks_pl.value,
      thanks_en: fields.thanks_en.value
    };
  }

  form.addEventListener("submit", function (evt) {
    evt.preventDefault();
    formMsg.textContent = "";
    var payload = buildPayload();
    var url = editingId ? ("/api/concerts/" + editingId) : "/api/concerts";
    var method = editingId ? "PUT" : "POST";

    fetch(url, {
      method: method,
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }).then(function (res) {
      if (res.status === 401) { location.reload(); return null; }
      if (res.status === 201 || res.status === 200) {
        resetForm();
        loadConcerts();
        return null;
      }
      if (res.status === 400) {
        return res.json().then(function (data) {
          var field = (data && data.field) || "";
          formMsg.textContent = "Sprawdź pola formularza." + (field ? " (" + field + ")" : "");
        });
      }
      formMsg.textContent = "Wystąpił błąd. Spróbuj ponownie.";
      return null;
    }).catch(function () {
      formMsg.textContent = "Wystąpił błąd. Spróbuj ponownie.";
    });
  });

  cancelBtn.addEventListener("click", resetForm);

  function toggleConcert(concert) {
    var payload = {
      date: concert.date,
      city: concert.city,
      venue_name: concert.venue_name,
      venue_url: concert.venue_url,
      address_street: concert.address_street,
      address_postal: concert.address_postal,
      address_locality: concert.address_locality,
      address_country: concert.address_country,
      published: Number(concert.published) === 1 ? 0 : 1,
      ticket_url: concert.ticket_url,
      gallery_url: concert.gallery_url,
      thanks_pl: concert.thanks_pl,
      thanks_en: concert.thanks_en
    };
    fetch("/api/concerts/" + concert.id, {
      method: "PUT",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }).then(function (res) {
      if (res.status === 401) { location.reload(); return; }
      loadConcerts();
    }).catch(function (err) { console.error("nie udało się przełączyć widoczności", err); });
  }

  function deleteConcert(concert) {
    if (!confirm("Na pewno usunąć ten koncert?")) return;
    fetch("/api/concerts/" + concert.id, { method: "DELETE", credentials: "same-origin" })
      .then(function (res) {
        if (res.status === 401) { location.reload(); return; }
        loadConcerts();
      })
      .catch(function (err) { console.error("nie udało się usunąć koncertu", err); });
  }

  function generatePresspackLink(concert) {
    if (concert.presspack_token && !confirm("Wygenerować nowy link? Poprzedni przestanie działać.")) return;
    fetch("/api/concerts/" + concert.id + "/presspack-link", { method: "POST", credentials: "same-origin" })
      .then(function (res) {
        if (res.status === 401) { location.reload(); return; }
        loadConcerts();
      })
      .catch(function (err) { console.error("nie udało się wygenerować linku", err); });
  }

  function revokePresspackLink(concert) {
    if (!confirm("Na pewno usunąć link do presspacka?")) return;
    fetch("/api/concerts/" + concert.id + "/presspack-link", { method: "DELETE", credentials: "same-origin" })
      .then(function (res) {
        if (res.status === 401) { location.reload(); return; }
        loadConcerts();
      })
      .catch(function (err) { console.error("nie udało się usunąć linku", err); });
  }

  function fallbackCopy(input) {
    input.select();
    try { document.execCommand("copy"); } catch (err) { /* ignore — nothing more we can do */ }
  }

  function copyToClipboard(input) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(input.value).catch(function () { fallbackCopy(input); });
    } else {
      fallbackCopy(input);
    }
  }

  function buildPresspackBlock(concert) {
    var wrap = document.createElement("div");
    wrap.className = "presspack-block";
    if (concert.presspack_token) {
      var url = location.origin + "/presspack/" + concert.presspack_token;
      var input = document.createElement("input");
      input.type = "text";
      input.readOnly = true;
      input.value = url;
      input.className = "presspack-url";
      input.setAttribute("aria-label", "Link do presspacka");
      wrap.appendChild(input);

      var copyBtn = document.createElement("button");
      copyBtn.type = "button";
      copyBtn.textContent = "Kopiuj";
      copyBtn.addEventListener("click", function () { copyToClipboard(input); });
      wrap.appendChild(copyBtn);

      var rotateBtn = document.createElement("button");
      rotateBtn.type = "button";
      rotateBtn.textContent = "Rotuj link";
      rotateBtn.addEventListener("click", function () { generatePresspackLink(concert); });
      wrap.appendChild(rotateBtn);

      var revokeBtn = document.createElement("button");
      revokeBtn.type = "button";
      revokeBtn.textContent = "Usuń link";
      revokeBtn.addEventListener("click", function () { revokePresspackLink(concert); });
      wrap.appendChild(revokeBtn);
    } else {
      var genBtn = document.createElement("button");
      genBtn.type = "button";
      genBtn.textContent = "Generuj link";
      genBtn.addEventListener("click", function () { generatePresspackLink(concert); });
      wrap.appendChild(genBtn);
    }
    return wrap;
  }

  function buildConcertRow(concert) {
    var row = document.createElement("li");
    row.className = "concert-row";

    var head = document.createElement("div");
    head.className = "concert-row__head";

    var dateEl = document.createElement("span");
    dateEl.className = "concert-row__date";
    dateEl.textContent = concert.date;
    head.appendChild(dateEl);

    var placeEl = document.createElement("span");
    placeEl.className = "concert-row__place";
    placeEl.textContent = concert.venue_name + " — " + concert.city;
    head.appendChild(placeEl);

    if (Number(concert.published) === 0) {
      var badge = document.createElement("span");
      badge.className = "badge badge--hidden";
      badge.textContent = "UKRYTY";
      head.appendChild(badge);
    }
    row.appendChild(head);

    var actions = document.createElement("div");
    actions.className = "concert-row__actions";

    var editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.textContent = "Edytuj";
    editBtn.addEventListener("click", function () { fillFormForEdit(concert); });
    actions.appendChild(editBtn);

    var toggleBtn = document.createElement("button");
    toggleBtn.type = "button";
    toggleBtn.textContent = Number(concert.published) === 1 ? "Ukryj" : "Pokaż";
    toggleBtn.addEventListener("click", function () { toggleConcert(concert); });
    actions.appendChild(toggleBtn);

    var delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.textContent = "Usuń";
    delBtn.addEventListener("click", function () { deleteConcert(concert); });
    actions.appendChild(delBtn);

    row.appendChild(actions);
    row.appendChild(buildPresspackBlock(concert));

    return row;
  }

  function renderGroup(listEl, concerts, emptyText) {
    while (listEl.firstChild) listEl.removeChild(listEl.firstChild);
    if (!concerts.length) {
      var empty = document.createElement("p");
      empty.className = "concerts-empty";
      empty.textContent = emptyText;
      listEl.appendChild(empty);
      return;
    }
    var ul = document.createElement("ul");
    ul.className = "concert-list";
    concerts.forEach(function (c) { ul.appendChild(buildConcertRow(c)); });
    listEl.appendChild(ul);
  }

  function render() {
    var today = todayISO();
    var upcoming = state.concerts.filter(function (c) { return c.date >= today; })
      .sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
    var past = state.concerts.filter(function (c) { return c.date < today; })
      .sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; });
    renderGroup(document.getElementById("upcoming-list"), upcoming, "Brak nadchodzących koncertów.");
    renderGroup(document.getElementById("past-list"), past, "Brak archiwalnych koncertów.");
  }

  function loadConcerts() {
    return fetch("/api/concerts", { credentials: "same-origin" })
      .then(function (res) {
        if (res.status === 401) { location.reload(); return null; }
        if (!res.ok) throw new Error("http_" + res.status);
        return res.json();
      })
      .then(function (data) {
        if (!data) return;
        state.concerts = (data && data.concerts) || [];
        render();
      })
      .catch(function (err) { console.error("nie udało się pobrać koncertów", err); });
  }

  // --- Presspack files (shared, R2) ------------------------------------------
  function formatSize(bytes) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  }

  var fileInput = document.getElementById("file-input");
  var uploadBtn = document.getElementById("upload-btn");
  var filesMsg = document.getElementById("files-msg");
  var filesList = document.getElementById("files-list");

  function renderFiles(files) {
    while (filesList.firstChild) filesList.removeChild(filesList.firstChild);
    if (!files.length) {
      var empty = document.createElement("li");
      empty.className = "files-empty";
      empty.textContent = "Brak plików.";
      filesList.appendChild(empty);
      return;
    }
    files.forEach(function (f) {
      var li = document.createElement("li");
      li.className = "file-row";

      var name = document.createElement("span");
      name.className = "file-row__name";
      name.textContent = f.name;
      li.appendChild(name);

      var size = document.createElement("span");
      size.className = "file-row__size";
      size.textContent = formatSize(f.size);
      li.appendChild(size);

      var delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.textContent = "Usuń";
      delBtn.addEventListener("click", function () { deleteFile(f.name); });
      li.appendChild(delBtn);

      filesList.appendChild(li);
    });
  }

  function loadFiles() {
    return fetch("/api/presspack/files", { credentials: "same-origin" })
      .then(function (res) {
        if (res.status === 401) { location.reload(); return null; }
        if (!res.ok) throw new Error("http_" + res.status);
        return res.json();
      })
      .then(function (data) {
        if (!data) return;
        renderFiles((data && data.files) || []);
      })
      .catch(function (err) { console.error("nie udało się pobrać plików", err); });
  }

  function deleteFile(name) {
    if (!confirm('Na pewno usunąć plik "' + name + '"?')) return;
    fetch("/api/presspack/files/" + encodeURIComponent(name), { method: "DELETE", credentials: "same-origin" })
      .then(function (res) {
        if (res.status === 401) { location.reload(); return; }
        loadFiles();
      })
      .catch(function (err) { console.error("nie udało się usunąć pliku", err); });
  }

  uploadBtn.addEventListener("click", function () {
    filesMsg.textContent = "";
    var file = fileInput.files && fileInput.files[0];
    if (!file) {
      filesMsg.textContent = "Wybierz plik.";
      return;
    }
    var formData = new FormData();
    formData.append("file", file);
    fetch("/api/presspack/files", {
      method: "POST",
      credentials: "same-origin",
      body: formData
    }).then(function (res) {
      if (res.status === 401) { location.reload(); return; }
      if (res.status === 200 || res.status === 201) {
        fileInput.value = "";
        loadFiles();
        return;
      }
      if (res.status === 400) {
        filesMsg.textContent = "Nieprawidłowa nazwa pliku.";
        return;
      }
      filesMsg.textContent = "Wystąpił błąd. Spróbuj ponownie.";
    }).catch(function () {
      filesMsg.textContent = "Wystąpił błąd. Spróbuj ponownie.";
    });
  });

  logoutBtn.addEventListener("click", function () {
    fetch("/api/calendar/login", { method: "DELETE", credentials: "same-origin" })
      .then(function () { location.reload(); })
      .catch(function () { location.reload(); });
  });

  resetForm();
  loadConcerts();
  loadFiles();
})();
`;

  return (
    htmlHead("Koncerty — From Nothing", APP_STYLE) +
    `<body>` +
    `<header class="app-header">` +
    `<div><span class="app-header__kicker">From Nothing</span><h1 class="app-header__title">Koncerty</h1></div>` +
    `<div class="header-actions">` +
    `<a href="/kalendarz" class="nav-link">Kalendarz</a>` +
    `<button type="button" id="logout-btn" class="logout-btn">Wyloguj</button>` +
    `</div>` +
    `</header>` +
    `<main class="layout">` +
    `<aside class="sidebar">` +
    `<section class="form-card">` +
    `<h2 class="form-card__heading" id="form-heading">Dodaj koncert</h2>` +
    `<form id="concert-form" class="concert-form" novalidate>` +

    `<div class="field"><label for="f-date">Data</label><input type="date" id="f-date" name="date" required></div>` +
    `<div class="field"><label for="f-city">Miasto</label><input type="text" id="f-city" name="city" maxlength="200" required></div>` +
    `<div class="field"><label for="f-venue_name">Nazwa miejsca</label><input type="text" id="f-venue_name" name="venue_name" maxlength="200" required></div>` +
    `<div class="field"><label for="f-venue_url">Strona miejsca (URL)</label><input type="text" id="f-venue_url" name="venue_url" maxlength="500" placeholder="https://"></div>` +
    `<div class="field"><label for="f-address_street">Ulica</label><input type="text" id="f-address_street" name="address_street" maxlength="200"></div>` +
    `<div class="field"><label for="f-address_postal">Kod pocztowy</label><input type="text" id="f-address_postal" name="address_postal" maxlength="200"></div>` +
    `<div class="field"><label for="f-address_locality">Miejscowość</label><input type="text" id="f-address_locality" name="address_locality" maxlength="200"></div>` +
    `<div class="field"><label for="f-address_country">Kraj (kod)</label><input type="text" id="f-address_country" name="address_country" maxlength="2" placeholder="PL"></div>` +
    `<div class="field field--checkbox"><label class="checkbox-label"><input type="checkbox" id="f-published" name="published" checked> Widoczny na stronie głównej</label></div>` +
    `<div class="field"><label for="f-ticket_url">Link do biletów</label><input type="text" id="f-ticket_url" name="ticket_url" maxlength="500" placeholder="https://"></div>` +
    `<div class="field"><label for="f-gallery_url">Link do galerii</label><input type="text" id="f-gallery_url" name="gallery_url" maxlength="500" placeholder="https://"></div>` +
    `<div class="field"><label for="f-thanks_pl">Podziękowania (PL)</label><textarea id="f-thanks_pl" name="thanks_pl" maxlength="500" rows="3"></textarea></div>` +
    `<div class="field"><label for="f-thanks_en">Podziękowania (EN)</label><textarea id="f-thanks_en" name="thanks_en" maxlength="500" rows="3"></textarea></div>` +

    `<button type="submit" class="submit-btn" id="submit-btn">Dodaj koncert</button>` +
    `<button type="button" class="cancel-btn" id="cancel-btn" hidden>Anuluj</button>` +
    `<p id="form-msg" class="form-msg" role="alert" aria-live="polite"></p>` +
    `</form>` +
    `<p class="note">Zmiany pojawią się na stronie głównej w ciągu ok. 5 minut (cache).</p>` +
    `</section>` +

    `<section class="files-section">` +
    `<h2 class="files-section__heading">Pliki presspacka</h2>` +
    `<div class="files-upload">` +
    `<input type="file" id="file-input">` +
    `<button type="button" id="upload-btn">Wyślij</button>` +
    `</div>` +
    `<p id="files-msg" class="form-msg" role="alert" aria-live="polite"></p>` +
    `<ul id="files-list" class="files-list"></ul>` +
    `</section>` +
    `</aside>` +

    `<div class="concerts-column">` +
    `<section class="concerts-section">` +
    `<h2 class="concerts-heading">Nadchodzące</h2>` +
    `<div id="upcoming-list" class="concert-group"></div>` +
    `</section>` +
    `<section class="concerts-section">` +
    `<h2 class="concerts-heading">Archiwalne</h2>` +
    `<div id="past-list" class="concert-group"></div>` +
    `</section>` +
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
