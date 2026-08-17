# Working policy

- Do not use test-driven development in this repository unless the user explicitly requests it.
- Do not create test files, temporary validation scripts, or add testing dependencies solely to verify a change. Use existing checks and read-only, offline commands when appropriate.
- Do not start a local server, use browser automation, access or scrape the production website, or make network requests unless the user explicitly requests or approves it.
- The user performs visual, browser, PageSpeed, and deployed-site verification. Clearly report which of these checks were not run.
- Still inspect changed files and run proportionate offline validation that does not create project files, install dependencies, or modify external state.

# Rules for site updates

## Project purpose and scope

This repository contains the static official website of From Nothing, a Linkin Park tribute band. The site is a compact, fast, accessible, bilingual band showcase focused on concerts, lineup, official profiles, and booking.

- Keep the stack dependency-free: plain HTML, CSS, and JavaScript with no build step.
- Keep changes focused on the requested outcome.
- If a visual identity change appears necessary, explain the reason and ask the user before making it.

## Content integrity

- Never invent or infer facts, copy, event details, dates, venues, addresses, member information, roles, social links, contact details, affiliations, testimonials, or claims.
- When required factual information is missing, ask the user or leave the existing content unchanged.
- Never imply that From Nothing is Linkin Park or is officially affiliated with, endorsed by, or representing Linkin Park.
- Keep names, capitalization, dates, addresses, and URLs consistent everywhere they appear.
- Do not add placeholder content to the production page unless explicitly requested.
- User-facing copy must be natural, concise, and free of keyword stuffing.

## Sources of truth and synchronization

When one fact changes, inspect and update every representation of that fact. At minimum, use this synchronization matrix:

| Changed information | Places to inspect and synchronize |
| --- | --- |
| Concert or tour entry | Visible HTML, PL/EN translations, `<time datetime>`, JSON-LD `MusicEvent`, links, and `sitemap.xml` |
| Band member or role | Visible HTML, portrait and alt text, PL/EN translations, JSON-LD `member`, and `llms.txt` |
| Official social profile | Navbar, contact section, JSON-LD `sameAs`, and `llms.txt` |
| Contact or booking details | Visible HTML, form behavior, JSON-LD, and `llms.txt` |
| Site or band name and description | `<title>`, meta description, Open Graph, Twitter metadata, H1, JSON-LD, and `llms.txt` |
| Language behavior or language-specific content | HTML defaults, JavaScript translations, document language, metadata, canonical, hreflang, JSON-LD language data, `sitemap.xml`, and `llms.txt` |
| Asset path or image | HTML/CSS references, alt text, metadata, JSON-LD, and the filesystem |

This table is a minimum checklist, not an exhaustive list. Search the repository for the old value before completing a change.

## Tour and event rules

- Every new or changed upcoming tour entry must be reflected in JSON-LD.
- Past concerts may remain in the visible archive, but they must be removed from JSON-LD, including references from parent entities such as `MusicGroup`.
- Use ISO dates in `datetime`, JSON-LD, and sitemap fields where applicable.
- Visible status and structured status must agree. Past, cancelled, postponed, rescheduled, and upcoming events must not contradict one another.
- Do not add ticket availability, prices, event status, venue data, or organizer information unless explicitly provided or already present in a trusted project source.
- External event and gallery links must point to the event they describe.

## Updates feed rules

The homepage updates feed is the `#updates` section headed `Co nowego` in Polish and `What's new` in English. It contains short, social-style posts embedded directly in the page without a CMS, social embed, external SDK, or tracking script.

- Keep posts in reverse chronological order, with the newest post first.
- Keep no more than two posts in the homepage feed. Before adding a third post, remove the oldest post from `index.html` and remove its post-specific translation keys from both language dictionaries; do not merely hide old posts with CSS or JavaScript.
- Use the existing semantic structure.
- Give every post a publication date supplied or confirmed by the user. Use an ISO `YYYY-MM-DD` value in `<time datetime>` and display it as `DD.MM.YYYY`.
- Use the first sentence as the `h3` when it works as a concise heading; otherwise ask for a heading or make only a non-factual editorial condensation of the supplied copy.
- Preserve the band's informal voice and emoji. Correct clear spelling, punctuation, and grammar errors, but do not silently alter facts, claims, names, dates, or meaning.
- Keep the Polish fallback content in `index.html` and add semantically equivalent Polish and English values to the `I18N` dictionaries in `assets/js/app.js`. Use paired `updates.postN.*` keys for each post.
- Do not add `BlogPosting` or `SocialMediaPosting` JSON-LD for homepage updates; they are short secondary items without dedicated URLs.
- Optional related links belong below the post in `.update__references`. Use the shared visible label `ZOBACZ NA` / `VIEW ON`, followed by compact `.update__reference` links for destinations such as Facebook, an event page, or a gallery.
- A related social link must point to the exact post, not merely the band's profile. An event or gallery link must point to the exact event or gallery it describes.
- External links opened in a new tab must include `target="_blank"`, `rel="noopener"`, and the localized new-tab notice.
- Keep the feed compact and reuse its existing typography, spacing, hover, focus, and responsive patterns. Check long headings, English copy, link wrapping, and the mobile single-column layout.
- Update the homepage language variants' `sitemap.xml` `<lastmod>` when the feed changes.

## Language and internationalization

- The Polish version uses `https://fromnothing.pl/`.
- The English version uses `https://fromnothing.pl/?lang=en`.
- Persist an explicit language choice in `localStorage` under the `fn:lang` key.
- A stored English choice may redirect `https://fromnothing.pl/` to `https://fromnothing.pl/?lang=en`, but the Polish root document must never expose the English canonical URL before that navigation.
- Treat the URL as the source of truth for the currently rendered language and its metadata.
- Every new or changed user-facing string must have complete Polish and English values unless the user explicitly requests otherwise.
- Translation keys must exist in both language dictionaries and must remain semantically equivalent.
- Language switching must keep `document.documentElement.lang`, visible content, active controls, URL, canonical URL, Open Graph data, and Twitter metadata consistent.
- Keep reciprocal `hreflang` entries for `pl`, `en`, and `x-default` in the HTML and sitemap.
- Both language variants must remain represented in JSON-LD, `sitemap.xml`, and `llms.txt`.
- Check layouts with the generally longer English copy. Do not solve overflow by silently removing meaning.

## SEO, structured data, and LLM discoverability

- Keep exactly one meaningful H1 and a logical heading hierarchy.
- Keep important identifying information in semantic HTML text, not only in images, CSS backgrounds, JSON-LD, or `llms.txt`.
- Keep `<title>` and meta descriptions accurate, specific, readable, and consistent with visible content.
- Preserve valid canonical, Open Graph, Twitter Card, and hreflang metadata.
- Use absolute production URLs in canonical, hreflang, Open Graph images, JSON-LD, sitemap, and other machine-readable public references.
- JSON-LD must describe only facts also supported by visible content or trusted project data. It must never be used to add hidden claims.
- Keep JSON-LD entity IDs stable when the represented entity has not changed.
- Keep `robots.txt` crawlable and keep its sitemap reference valid.
- Update `sitemap.xml` `<lastmod>` whenever the site is modified.
- Update `llms.txt` whenever the band's identity, members, language variants, official profiles, contact details, or primary public URLs change.
- Do not add `meta keywords`, doorway copy, repetitive search phrases, or content written primarily for crawlers.

## Semantic HTML and accessibility

- Prefer native semantic HTML over custom elements and ARIA workarounds.
- Preserve a logical document structure with landmarks, headings, lists, links, buttons, labels, and time elements used for their intended purpose.
- Every meaningful image needs concise, contextual alt text. Decorative images must use `alt=""` and must not repeat nearby text.
- Every form control must have an associated label. Required state, validation, errors, and success messages must be understandable without relying on color alone.
- All interactions must work with a keyboard. Focus order must follow the visual and reading order.
- Keep focus indicators clearly visible. Do not remove outlines without an equally visible replacement.
- ARIA attributes must match actual state and behavior. Do not add redundant or invalid ARIA.
- Preserve reduced-motion behavior and avoid interactions that depend only on hover.
- Maintain readable contrast, scalable text, and usable touch targets.
- Changing language must also update the document language exposed to assistive technology.

## Responsive design and visual consistency

- Verify changed UI at mobile, tablet, and desktop widths, including the breakpoint boundaries affected by the change.
- Prevent unintended horizontal scrolling, clipped content, overlap, and controls that leave the viewport.
- Preserve the existing typography, spacing system, colors, visual hierarchy, and brutalist concert-poster character unless a visual change has been approved by the user.
- Reuse existing CSS variables, components, and responsive patterns before introducing new ones.
- Avoid fragile selectors tied to incidental DOM position when a meaningful class can express the intent.
- Test with both language variants and realistic content lengths.

## Performance

- Keep the page lightweight.
- Do not add heavy animations, continuous CPU/GPU work, unnecessary observers, or large third-party scripts.
- Respect `prefers-reduced-motion` for non-essential motion.
- Lazy-load non-critical images below the initial viewport. Do not lazy-load the primary above-the-fold image when it would delay rendering.
- Provide intrinsic image dimensions or an equivalent stable aspect ratio to avoid layout shifts.
- Optimize new raster assets to an appropriate format, quality, and display size before adding them.
- Avoid duplicate assets and remove obsolete assets when their removal is a justified part of the task.
- Keep JavaScript deferred or otherwise non-render-blocking unless there is a documented reason not to.

## Assets and links

- Before changing or adding an asset path, verify that the target file exists with exact case-sensitive spelling.
- After replacing or removing an asset, search for stale references throughout the repository.
- Use descriptive link text. Do not use ambiguous labels such as "click here" when context can be stated directly.
- External links opened with `target="_blank"` must include `rel="noopener"`.
- Do not leave production links pointing to `#`, example domains, placeholders, or known dead destinations.
- Preserve stable public URLs unless the user explicitly requests a URL change.

## Security and privacy

- Never place secrets, credentials, API keys, private tokens, or private personal data in the repository or client-side code.
- Treat URL parameters, form values, and external data as untrusted. Do not inject them into HTML with `innerHTML`.
- Do not add analytics, advertising, tracking pixels, cookies, fingerprinting, or consent-requiring storage without explicit user approval.
- Keep external resources on HTTPS.

## Required verification

Run proportionate offline checks for the areas changed. Do not create test artifacts or start servers solely for verification.

- Parse JSON-LD when structured data or facts represented by it change.
- Validate `sitemap.xml` when URLs, languages, public content, or sitemap data change.
- Search the affected files for stale values, paths, and obsolete references.
- Confirm local assets exist when asset references change.
- Check translation-key parity when user-facing copy or language behavior changes.
- Leave visual, responsive, browser, PageSpeed, and production-site verification to the user unless explicitly requested.

Never claim that an unperformed check passed. State clearly which checks were run and which remain for the user.

## Repository operations

- Never create commits, amend commits, push branches, create pull requests, tag releases, or deploy the site. The user owns all repository history and deployment operations.
- File deletion is allowed when it is justified by the requested change. Verify references first and report what was removed.
- Do not perform destructive Git operations.
- Do not revert, overwrite, or reformat unrelated user changes.
- Do not modify `AGENTS.md` incidentally. Update it only when the user requests a policy change or when a changed architecture makes an existing rule factually incorrect, and ask before the latter.
