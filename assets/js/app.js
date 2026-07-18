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
      "tour.sub": "Terminy",
      "tour.upcoming": "Nadchodzące",
      "tour.upcoming.empty": "Obecnie brak ogłoszonych koncertów.",
      "tour.past": "Archiwalne",
      "tour.info": "Info",
      "tour.gallery": "Galeria →",
      "tour.thanks": "Tychy — było pięknie! Wymarzony debiut! Do zobaczenia wkrótce :)",
      "tour.row1.event": "Serca na Kołach",
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
      "form.ok": "Wiadomość przygotowana — dokończ w swoim kliencie poczty.",
      "form.err": "Błąd. Spróbuj ponownie.",
      "footer.rights": "Wszelkie prawa zastrzeżone",
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
      "hero.cta.tour": "See shows →",
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
      "tour.row1.event": "Serca na Kołach",
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
      "form.ok": "Message prepared — finish in your mail client.",
      "form.err": "Error. Please try again.",
      "footer.rights": "All rights reserved",
      "role.vox": "Vocals",
      "role.voxGuitar": "Vocals/Guitar",
      "role.guitar": "Guitar",
      "role.bass": "Bass",
      "role.drums": "Drums"
    }
  };

  const STORAGE_KEY = "fn:lang";
  const supported = ["pl", "en"];
  const LANG_URLS = {
    pl: "https://fromnothing.pl/",
    en: "https://fromnothing.pl/?lang=en"
  };
  const META = {
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
  };

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
    const meta = META[lang];
    document.title = meta.title;
    document.querySelector('link[rel="canonical"]')?.setAttribute("href", LANG_URLS[lang]);
    setMetaContent('meta[name="description"]', meta.description);
    setMetaContent('meta[property="og:description"]', meta.socialDescription);
    setMetaContent('meta[property="og:url"]', LANG_URLS[lang]);
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
    initNavToggle();
    initParallax();
  });
})();
