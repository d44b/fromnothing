// FROM NOTHING — client script: i18n, reveal, form
(() => {
  const I18N = {
    pl: {
      "nav.tour": "Koncerty",
      "nav.lineup": "Skład",
      "nav.contact": "Kontakt",
      "hero.subtitle": "Linkin Park Tribute Band",
      "hero.cta.tour": "Zobacz koncerty →",
      "hero.cta.book": "Booking",
      "hero.scroll": "Przewiń",
      "tour.title": "Koncerty",
      "tour.sub": "Nadchodzące koncerty",
      "tour.empty1": "Aktualnie nie mamy zaplanowanych koncertów.",
      "tour.empty2": "Chcecie nas zaprosić na event? Skorzystajcie z formularza poniżej.",
      "tour.empty.cta": "Napisz do nas →",
      "lineup.title": "Skład",
      "lineup.sub": "Lineup",
      "contact.title": "Kontakt",
      "contact.sub": "Booking",
      "contact.bookingLabel": "Kontakt",
      "form.name": "Imię",
      "form.email": "E-mail",
      "form.subject": "Temat",
      "form.message": "Wiadomość",
      "form.send": "Wyślij",
      "form.sending": "Wysyłanie…",
      "form.ok": "Wiadomość przygotowana — dokończ w swoim kliencie poczty.",
      "form.err": "Błąd. Spróbuj ponownie.",
      "footer.rights": "Wszelkie prawa zastrzeżone",
      "role.vox": "Wokal",
      "role.voxRapGuitar": "Wokal / Rap / Gitara",
      "role.guitar": "Gitara",
      "role.bass": "Bas",
      "role.drums": "Perkusja"
    },
    en: {
      "nav.tour": "Shows",
      "nav.lineup": "Lineup",
      "nav.contact": "Contact",
      "hero.subtitle": "Linkin Park Tribute Band",
      "hero.cta.tour": "See shows →",
      "hero.cta.book": "Booking",
      "hero.scroll": "Scroll",
      "tour.title": "Shows",
      "tour.sub": "Upcoming shows",
      "tour.empty1": "No shows on the calendar right now.",
      "tour.empty2": "Want us at your event? Use the form below.",
      "tour.empty.cta": "Get in touch →",
      "lineup.title": "Lineup",
      "lineup.sub": "The band",
      "contact.title": "Contact",
      "contact.sub": "Booking",
      "contact.bookingLabel": "Contact",
      "form.name": "Name",
      "form.email": "E-mail",
      "form.subject": "Subject",
      "form.message": "Message",
      "form.send": "Send",
      "form.sending": "Sending…",
      "form.ok": "Message prepared — finish in your mail client.",
      "form.err": "Error. Please try again.",
      "footer.rights": "All rights reserved",
      "role.vox": "Vocals",
      "role.voxRapGuitar": "Vocals / Rap / Guitar",
      "role.guitar": "Guitar",
      "role.bass": "Bass",
      "role.drums": "Drums"
    }
  };

  const STORAGE_KEY = "fn:lang";
  const supported = ["pl", "en"];

  function detectLang() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && supported.includes(saved)) return saved;
    const nav = (navigator.language || "en").slice(0, 2).toLowerCase();
    return supported.includes(nav) ? nav : "pl";
  }

  function applyLang(lang) {
    const dict = I18N[lang];
    document.documentElement.lang = lang;
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      if (dict[key] !== undefined) el.textContent = dict[key];
    });
    document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
      const key = el.getAttribute("data-i18n-placeholder");
      if (dict[key] !== undefined) el.setAttribute("placeholder", dict[key]);
    });
    document.querySelectorAll(".lang-btn").forEach((btn) => {
      const active = btn.dataset.lang === lang;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-pressed", String(active));
    });
    localStorage.setItem(STORAGE_KEY, lang);
  }

  function initLang() {
    applyLang(detectLang());
    document.querySelectorAll(".lang-btn").forEach((btn) => {
      btn.addEventListener("click", () => applyLang(btn.dataset.lang));
    });
  }

  // Reveal on scroll
  function initReveal() {
    const targets = document.querySelectorAll(
      ".section__head, .empty-state, .contact__block, .contact__form, .footer__wordmark"
    );
    targets.forEach((el) => el.classList.add("reveal"));

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry, i) => {
          if (entry.isIntersecting) {
            const el = entry.target;
            const delay = Math.min(i * 60, 400);
            setTimeout(() => el.classList.add("is-in"), delay);
            io.unobserve(el);
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -5% 0px" }
    );
    targets.forEach((el) => io.observe(el));
  }

  function initYear() {
    const el = document.getElementById("year");
    if (el) el.textContent = new Date().getFullYear();
  }

  // Contact form: mailto fallback until a real backend is wired up.
  // The `booking` email is loaded from the #bookingEmail anchor's href if set.
  function initForm() {
    const form = document.getElementById("contactForm");
    if (!form) return;
    const status = document.getElementById("formStatus");

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const lang = document.documentElement.lang || "pl";
      const dict = I18N[lang];
      form.classList.add("was-submitted");

      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }

      const data = new FormData(form);
      const bookingAnchor = document.getElementById("bookingEmail");
      const href = bookingAnchor ? bookingAnchor.getAttribute("href") : "";
      if (!href || href === "#" || !href.startsWith("mailto:")) {
        status.textContent = dict["form.err"];
        status.className = "form__status is-err";
        return;
      }
      const to = href.replace(/^mailto:/, "");
      const body = `${data.get("message")}\n\n— ${data.get("name")} <${data.get("email")}>`;
      const subject = data.get("subject") || "Kontakt / Contact — fromnothing.pl";
      const mailto = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

      status.textContent = dict["form.sending"];
      status.className = "form__status";
      window.location.href = mailto;
      setTimeout(() => {
        status.textContent = dict["form.ok"];
        status.className = "form__status is-ok";
        form.reset();
      }, 600);
    });
  }

  function initNavToggle() {
    const toggle = document.getElementById("navToggle");
    const links = document.getElementById("navLinks");
    if (!toggle || !links) return;
    const close = () => {
      toggle.classList.remove("is-open");
      links.classList.remove("is-open");
      toggle.setAttribute("aria-expanded", "false");
      document.body.style.overflow = "";
    };
    const open = () => {
      toggle.classList.add("is-open");
      links.classList.add("is-open");
      toggle.setAttribute("aria-expanded", "true");
      document.body.style.overflow = "hidden";
    };
    toggle.addEventListener("click", () => {
      toggle.classList.contains("is-open") ? close() : open();
    });
    links.querySelectorAll("a").forEach((a) => a.addEventListener("click", close));
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") close();
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    initLang();
    initReveal();
    initYear();
    initForm();
    initNavToggle();
  });
})();
