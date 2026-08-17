// FROM NOTHING — client script: i18n, reveal, form
(() => {
  const I18N = {
    pl: {
      "nav.tour": "Koncerty",
      "nav.lineup": "Skład",
      "nav.contact": "Kontakt",
      "hero.subtitle": "Linkin Park Tribute Band",
      "hero.cta.tour": "Koncerty",
      "hero.cta.book": "Booking",
      "hero.scroll": "Przewiń",
      "tour.title": "Koncerty",
      "tour.sub": "Terminy",
      "tour.upcoming": "Nadchodzące",
      "tour.upcoming.empty": "Obecnie brak ogłoszonych koncertów.",
      "tour.past": "Archiwalne",
      "tour.info": "Info",
      "tour.gallery": "Galeria →",
      "tour.thanks": "Tychy — było pięknie! Wymarzony debiut! Do zobaczenia wkrótce :)",
      "tour.tickets": "Bilety →",
      "tour.ticketsSoon": "Bilety: informacje wkrótce",
      "tour.more": "W sprawie koncertów i bookingu — skorzystaj z formularza.",
      "tour.more.cta": "Napisz do nas →",
      "months.01": "STY", "months.02": "LUT", "months.03": "MAR",
      "months.04": "KWI", "months.05": "MAJ", "months.06": "CZE",
      "months.07": "LIP", "months.08": "SIE", "months.09": "WRZ",
      "months.10": "PAŹ", "months.11": "LIS", "months.12": "GRU",
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
      "form.ok": "Wiadomość wysłana — odezwiemy się wkrótce!",
      "form.err": "Błąd. Spróbuj ponownie.",
      "form.captchaErr": "Weryfikacja captcha nie powiodła się. Spróbuj ponownie.",
      "footer.rights": "Wszelkie prawa zastrzeżone",
      "watch.title": "Posłuchaj nas — From Nothing",
      "watch.disclaimer": "Materiał live z próby zespołu. Prezentujemy fragmenty wykonań części setlisty; na próbie ćwiczymy program, a pełny performance pokazujemy na scenie. Kolejne nagrania sceniczne już wkrótce.",
      "watch.contact": "Kontakt",
      "watch.contact.subject": "Zapytanie o koncert — From Nothing",
      "watch.rider": "Rider techniczny",
      "a11y.newTab": "(otwiera się w nowej karcie)",
      "role.vox": "Wokal",
      "role.voxGuitar": "Wokal/Gitara",
      "role.guitar": "Gitara",
      "role.bass": "Bas",
      "role.drums": "Perkusja"
    },
    en: {
      "nav.tour": "Shows",
      "nav.lineup": "Lineup",
      "nav.contact": "Contact",
      "hero.subtitle": "Linkin Park Tribute Band",
      "hero.cta.tour": "Upcoming shows",
      "hero.cta.book": "Booking",
      "hero.scroll": "Scroll",
      "tour.title": "Shows",
      "tour.sub": "Show dates",
      "tour.upcoming": "Upcoming",
      "tour.upcoming.empty": "No upcoming shows have been announced.",
      "tour.past": "Archive",
      "tour.info": "Info",
      "tour.gallery": "Gallery →",
      "tour.thanks": "Tychy — it was beautiful! A dream debut! See you soon :)",
      "tour.tickets": "Tickets →",
      "tour.ticketsSoon": "Tickets: information coming soon",
      "tour.more": "For shows and booking — use the form.",
      "tour.more.cta": "Get in touch →",
      "months.01": "JAN", "months.02": "FEB", "months.03": "MAR",
      "months.04": "APR", "months.05": "MAY", "months.06": "JUN",
      "months.07": "JUL", "months.08": "AUG", "months.09": "SEP",
      "months.10": "OCT", "months.11": "NOV", "months.12": "DEC",
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
      "form.ok": "Message sent — we'll get back to you soon!",
      "form.err": "Error. Please try again.",
      "form.captchaErr": "Captcha verification failed. Please try again.",
      "footer.rights": "All rights reserved",
      "watch.title": "Listen to us — From Nothing",
      "watch.disclaimer": "A working recording from rehearsal — not a concert recording. These are excerpts from part of our setlist; at rehearsal we run through the programme, the full performance happens on stage. We are working on the quality of our promotional material.",
      "watch.contact": "Contact",
      "watch.contact.subject": "Booking enquiry — From Nothing",
      "watch.rider": "Technical rider",
      "a11y.newTab": "(opens in a new tab)",
      "role.vox": "Vocals",
      "role.voxGuitar": "Vocals/Guitar",
      "role.guitar": "Guitar",
      "role.bass": "Bass",
      "role.drums": "Drums"
    }
  };

  const STORAGE_KEY = "fn:lang";
  const supported = ["pl", "en"];
  const ORIGIN = "https://fromnothing.pl";

  // Which document is being rendered — set via `data-page` on <html>.
  // Metadata and canonical URLs are per page, not global.
  const PAGE = document.documentElement.dataset.page || "home";
  const PAGE_PATHS = {
    home: "/",
    posluchajnas: "/posluchajnas"
  };

  const META = {
    home: {
      pl: {
        title: "From Nothing — Linkin Park Tribute Band",
        description: "From Nothing - Linkin Park Tribute Band. Sprawdź gdzie gramy, poznaj skład i skontaktuj się w sprawie koncertów.",
        socialDescription: "Oficjalna strona polskiego tribute bandu Linkin Park: koncerty, skład i booking.",
        locale: "pl_PL"
      },
      en: {
        title: "From Nothing — Linkin Park Tribute Band",
        description: "Official website of From Nothing, a Polish Linkin Park tribute band. See shows, meet the lineup, and get in touch about booking.",
        socialDescription: "Official website of the Polish Linkin Park tribute band: shows, lineup, and booking.",
        locale: "en_US"
      }
    },
    posluchajnas: {
      pl: {
        title: "Posłuchaj nas — From Nothing | Linkin Park Tribute Band",
        description: "Zobacz i posłuchaj From Nothing — kompilacja nagrań z próby. Linkin Park tribute band. Kontakt w sprawie koncertów i rider techniczny.",
        socialDescription: "Kompilacja nagrań z próby From Nothing — polskiego tribute bandu Linkin Park.",
        locale: "pl_PL"
      },
      en: {
        title: "Listen to us — From Nothing | Linkin Park Tribute Band",
        description: "Watch and listen to From Nothing — a compilation from rehearsal. Linkin Park tribute band. Booking contact and technical rider.",
        socialDescription: "A compilation recorded at a From Nothing rehearsal — the Polish Linkin Park tribute band.",
        locale: "en_US"
      }
    }
  };

  function pageMeta(lang) {
    return (META[PAGE] || META.home)[lang];
  }

  function canonicalUrl(lang) {
    const path = PAGE_PATHS[PAGE] || "/";
    return `${ORIGIN}${path}${lang === "en" ? "?lang=en" : ""}`;
  }

  function detectLang() {
    const queryLang = new URLSearchParams(window.location.search).get("lang");
    if (queryLang && supported.includes(queryLang)) return queryLang;
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && supported.includes(saved)) return saved;
    return "pl";
  }

  function setMetaContent(selector, value) {
    const element = document.querySelector(selector);
    if (element) element.setAttribute("content", value);
  }

  function updateLanguageMetadata(lang) {
    const meta = pageMeta(lang);
    const url = canonicalUrl(lang);
    document.title = meta.title;
    document.querySelector('link[rel="canonical"]')?.setAttribute("href", url);
    setMetaContent('meta[name="description"]', meta.description);
    setMetaContent('meta[property="og:title"]', meta.title);
    setMetaContent('meta[property="og:description"]', meta.socialDescription);
    setMetaContent('meta[property="og:url"]', url);
    setMetaContent('meta[property="og:locale"]', meta.locale);
    setMetaContent('meta[name="twitter:title"]', meta.title);
    setMetaContent('meta[name="twitter:description"]', meta.socialDescription);
  }

  function languageUrl(lang) {
    const url = new URL(window.location.href);
    if (lang === "en") url.searchParams.set("lang", "en");
    else url.searchParams.delete("lang");
    return `${url.pathname}${url.search}${url.hash}`;
  }

  function applyLang(lang, { updateUrl = false, replaceUrl = false } = {}) {
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
    // Booking link: keep the prefilled subject in the active language. The
    // address itself stays in the markup so there is one source of truth.
    const contact = document.getElementById("watchContact");
    const subject = dict["watch.contact.subject"];
    if (contact && contact.dataset.email && subject) {
      contact.setAttribute(
        "href",
        `mailto:${contact.dataset.email}?subject=${encodeURIComponent(subject)}`
      );
    }
    document.querySelectorAll(".lang-btn").forEach((btn) => {
      const active = btn.dataset.lang === lang;
      btn.classList.toggle("is-active", active);
      if (active) btn.setAttribute("aria-current", "page");
      else btn.removeAttribute("aria-current");
    });
    updateLanguageMetadata(lang);
    localStorage.setItem(STORAGE_KEY, lang);

    if (updateUrl) {
      const method = replaceUrl ? "replaceState" : "pushState";
      window.history[method]({ lang }, "", languageUrl(lang));
    }
  }

  function initLang() {
    const initialLang = detectLang();
    const queryLang = new URLSearchParams(window.location.search).get("lang");

    if (initialLang === "en" && queryLang !== "en") {
      window.location.replace(languageUrl("en"));
      return;
    }

    const urlNeedsSync = initialLang === "pl" && queryLang !== null;
    applyLang(initialLang, { updateUrl: urlNeedsSync, replaceUrl: true });

    document.querySelectorAll(".lang-btn").forEach((btn) => {
      btn.addEventListener("click", (event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        if (btn.dataset.lang === document.documentElement.lang) return;
        applyLang(btn.dataset.lang, { updateUrl: true });
      });
    });

    window.addEventListener("popstate", () => {
      const queryLang = new URLSearchParams(window.location.search).get("lang");
      applyLang(queryLang === "en" ? "en" : "pl");
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

  // Turnstile: fetched only once the contact section is actually relevant —
  // it intersects the viewport, or the visitor tabs/clicks into the form
  // before that (e.g. via a direct #contact link) — rather than on every
  // page load. The script tag ships with `data-src`, not `src`, so nothing
  // is fetched until this promotes it; once it executes, Turnstile's
  // implicit rendering scans the DOM for `.cf-turnstile` and renders the
  // widget itself, inserting a hidden `cf-turnstile-response` input that
  // travels with the rest of the form fields.
  function initTurnstileLazyLoad() {
    const section = document.getElementById("contact");
    const script = document.getElementById("turnstileScript");
    if (!section || !script) return;

    let loaded = false;
    const load = () => {
      if (loaded) return;
      loaded = true;
      script.src = script.dataset.src;
    };

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            load();
            io.disconnect();
          }
        });
      },
      { rootMargin: "200px 0px" }
    );
    io.observe(section);
    // Fallback for a visitor who focuses into the form before the section
    // is reported as intersecting.
    section.addEventListener("focusin", load, { once: true });
  }

  // Contact form: posts JSON straight to the /api/contact Pages Function.
  // The honeypot (`website`) and Turnstile token (`cf-turnstile-response`)
  // are both just fields inside the form, so FormData picks them up like
  // name/email/subject/message — no special-casing needed here.
  function initForm() {
    const form = document.getElementById("contactForm");
    if (!form) return;
    const status = document.getElementById("formStatus");
    const submitButton = form.querySelector('button[type="submit"]');

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
      const payload = {
        name: data.get("name") || "",
        email: data.get("email") || "",
        subject: data.get("subject") || "",
        message: data.get("message") || "",
        lang,
        website: data.get("website") || "",
        "cf-turnstile-response": data.get("cf-turnstile-response") || "",
      };

      status.textContent = dict["form.sending"];
      status.className = "form__status";
      if (submitButton) submitButton.disabled = true;

      fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
        .then((res) => {
          if (res.status === 200) {
            status.textContent = dict["form.ok"];
            status.className = "form__status is-ok";
            form.reset();
            window.turnstile?.reset();
          } else if (res.status === 403) {
            status.textContent = dict["form.captchaErr"];
            status.className = "form__status is-err";
            window.turnstile?.reset();
          } else {
            status.textContent = dict["form.err"];
            status.className = "form__status is-err";
          }
        })
        .catch(() => {
          status.textContent = dict["form.err"];
          status.className = "form__status is-err";
        })
        .finally(() => {
          if (submitButton) submitButton.disabled = false;
        });
    });
  }

  // Hero background parallax — translate the photo slower than scroll
  function initParallax() {
    const hero = document.querySelector(".hero");
    if (!hero) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let ticking = false;
    const update = () => {
      const y = window.scrollY || window.pageYOffset || 0;
      // only run while the hero is roughly in view
      if (y < window.innerHeight * 1.3) {
        hero.style.setProperty("--hero-parallax", (y * 0.35).toFixed(1) + "px");
      }
      ticking = false;
    };
    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    update();
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
    initTurnstileLazyLoad();
    initNavToggle();
    initParallax();
  });
})();
