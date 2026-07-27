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
      "watch.kicker": "WIDEO /",
      "watch.title": "Posłuchaj nas",
      "watch.sub": "Kompilacja z próby",
      "watch.unmute": "Włącz dźwięk",
      "watch.play": "Odtwórz",
      "watch.fallback": "Nie udało się odtworzyć wideo w przeglądarce.",
      "watch.fallback.link": "Otwórz plik wideo",
      "watch.contact": "Kontakt",
      "watch.contact.subject": "Zapytanie o koncert — From Nothing",
      "watch.rider": "Rider techniczny",
      "watch.rider.status": "w przygotowaniu",
      "watch.note": "W sprawie koncertów i bookingu — napisz na kontakt@fromnothing.pl. Rider techniczny przesyłamy od ręki.",
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
      "watch.kicker": "VIDEO /",
      "watch.title": "Listen to us",
      "watch.sub": "Compilation from rehearsal",
      "watch.unmute": "Turn on sound",
      "watch.play": "Play",
      "watch.fallback": "The video could not be played in your browser.",
      "watch.fallback.link": "Open the video file",
      "watch.contact": "Contact",
      "watch.contact.subject": "Booking enquiry — From Nothing",
      "watch.rider": "Technical rider",
      "watch.rider.status": "in preparation",
      "watch.note": "For shows and booking — write to kontakt@fromnothing.pl. We send the technical rider on request.",
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

  // /posluchajnas — the video starts on its own, but browsers only allow that
  // while muted, so the prompt over the picture turns the sound on. Falls back
  // to a plain play prompt whenever autoplay is refused or unwanted.
  function initWatch() {
    const video = document.getElementById("watchVideo");
    if (!video) return;

    const frame = video.closest(".watch__frame");
    const overlay = document.getElementById("watchOverlay");
    const label = document.getElementById("watchOverlayLabel");
    const fallback = document.getElementById("watchFallback");
    if (!frame || !overlay || !label) return;

    // Track whether the visitor chose a position, so unmuting does not yank
    // them back to the start of the take.
    let userSeeked = false;
    video.addEventListener("seeking", () => {
      if (!video.ended) userSeeked = true;
    });

    function showFallback() {
      overlay.hidden = true;
      if (fallback) fallback.hidden = false;
    }

    function prompt(key, state) {
      frame.dataset.state = state;
      // Keep data-i18n in step so a language switch relabels the button.
      label.dataset.i18n = key;
      const dict = I18N[document.documentElement.lang] || I18N.pl;
      if (dict[key] !== undefined) label.textContent = dict[key];
      overlay.hidden = false;
    }

    function sync() {
      if (video.error) return showFallback();
      if (video.paused) return prompt("watch.play", "paused");
      if (video.muted) return prompt("watch.unmute", "muted");
      frame.dataset.state = "playing";
      overlay.hidden = true;
    }

    overlay.addEventListener("click", () => {
      if (video.muted) {
        if (!userSeeked && video.currentTime > 0) video.currentTime = 0;
        video.muted = false;
      }
      const started = video.play();
      if (started && typeof started.catch === "function") {
        started.catch(() => sync());
      }
      sync();
    });

    ["play", "pause", "ended", "volumechange"].forEach((evt) =>
      video.addEventListener(evt, sync)
    );
    video.addEventListener("error", showFallback);
    video.querySelector("source")?.addEventListener("error", showFallback);

    // Do not pull a large file down uninvited on a metered connection, and
    // treat reduced-motion as a request not to start moving pictures.
    const connection = navigator.connection || navigator.webkitConnection;
    const metered =
      !!connection &&
      (connection.saveData === true ||
        /(^|-)2g$/.test(connection.effectiveType || ""));
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (metered || reducedMotion) {
      prompt("watch.play", "paused");
      return;
    }

    const attempt = video.play();
    if (attempt && typeof attempt.then === "function") {
      attempt.then(sync).catch(() => prompt("watch.play", "paused"));
    } else {
      sync();
    }
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
    initWatch();
  });
})();
