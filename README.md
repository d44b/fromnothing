# FROM NOTHING — fromnothing.pl

Official website of From Nothing, a Polish Linkin Park tribute band.

Production: https://fromnothing.pl/

## Local preview

Serve the repository with any static HTTP server, for example:

```bash
npx serve .
```

Open the URL displayed by the server.

Note that a plain static server does not run the Pages Functions in
`functions/`, so `/oferta`, `/rider` and `/media/*` will 404. To exercise those
locally, use `npx wrangler pages dev .` instead.

## Deployment

Deployment to Cloudflare Pages is handled automatically by
`.github/workflows/deploy.yml` after changes are pushed to `main`.

Wrangler excludes `functions/`, `.wrangler/` and the `_headers` / `_redirects` /
`_routes.json` family from the static asset upload, so the whole repository can
be deployed as-is.

## Media delivery

Large media and PDFs are **not** kept in this repository — Cloudflare Pages
rejects files over 25 MiB, and the video is 386 MiB. They live in the R2 bucket
`fromnothing-media` and are streamed back by Pages Functions, so visitors are
never redirected off `fromnothing.pl`.

| Route | R2 object key | Notes |
| --- | --- | --- |
| `/oferta` | `fromnothing-oferta-29-07-2026.pdf` | Booking offer (PL), served inline |
| `/offer` | `fromnothing-booking-offer-29-07-2026.pdf` | Booking offer (EN); its QR points to `/listen` |
| `/rider` | `fromnothing-rider-30-07-2026.pdf` | Technical rider (PL) |
| `/rider-en` | `fromnothing-tech-rider-30-07-2026.pdf` | Technical rider (EN) |
| `/media/live-2026-kompilacja.mp4` | `fromnothing-live-2026-kompilacja.mp4` | Rehearsal compilation, HTTP Range supported |

`functions/_r2.js` holds the shared delivery logic (conditional requests, range
requests, cache headers). `functions/media/[[path]].js` only serves keys on an
explicit allowlist, so the URL path can never be used to address the bucket.

### The bucket binding is stored in Cloudflare, not in this repo

The bucket is exposed to the Functions as the binding `MEDIA`, configured on the
Pages project itself (Workers & Pages → fromnothing → Settings → Bindings) for
both the production and preview environments. It is deliberately not declared in
a `wrangler.toml`: Pages would upload that file as a public static asset.

If the Pages project is ever recreated, re-add the binding or `/oferta`,
`/rider` and `/media/*` will return 500. To restore it from the CLI:

```bash
wrangler r2 bucket create fromnothing-media   # only if the bucket is gone too
curl -X PATCH \
  "https://api.cloudflare.com/client/v4/accounts/$CF_ACCOUNT_ID/pages/projects/fromnothing" \
  -H "Authorization: Bearer $CF_API_TOKEN" -H "Content-Type: application/json" \
  -d '{"deployment_configs":{
        "production":{"r2_buckets":{"MEDIA":{"name":"fromnothing-media"}}},
        "preview":{"r2_buckets":{"MEDIA":{"name":"fromnothing-media"}}}}}'
```

### Replacing a document

Both PDFs are cached for 10 minutes and revalidated by ETag, so replacing the
object publishes the new file without a deploy:

```bash
wrangler r2 object put fromnothing-media/fromnothing-rider-tech.pdf \
  --file ./rider.pdf --content-type application/pdf --remote
```

Be careful with the matching `wrangler r2 object get`: it writes into the current
directory, and the repository root *is* the deploy directory, so a file fetched
there would be published as a static asset. Pass `--file` with a path outside the
repository.

### Uploading files larger than 300 MiB

`wrangler r2 object put` refuses anything over 300 MiB. Larger files need a
multipart upload, which is available through the R2 *binding* (via a Worker) or
through the S3-compatible API with an R2 access key pair.

## Offer PDF

Since the 29-07-2026 edition the offer is a four-page "book" (cover / content /
gallery / back cover) generated from an HTML source rendered with headless
Chrome (`--print-to-pdf`). The source — `oferta.html` (PL), `oferta-en.html`
(EN), images and locally-hosted woff2 fonts — lives outside this repository in
`~/Downloads/fromnothing-oferta-ksiazka-src/`. The QR codes inside point at
`/posluchajnas` and `fromnothing.pl` (PL edition) and `/listen` and
`fromnothing.pl` (EN edition). The earlier two-page edition came from a Typst
source that was never recovered; the HTML source replaces it 1:1.

Objects are keyed by date (`fromnothing-oferta-DD-MM-YYYY.pdf`, EN:
`fromnothing-booking-offer-DD-MM-YYYY.pdf`) because the key is the filename a
promoter sees on saving. `functions/oferta.js` and `functions/offer.js` hold the
keys of the current editions; earlier editions stay in the bucket and can be
removed with `wrangler r2 object delete`.

## Cache busting after a CSS or JS change

`assets/css/style.css` and `assets/js/app.js` have unversioned filenames, and
the `fromnothing.pl` zone caches them at the edge for four hours. A deploy alone
therefore does not reach visitors: `fromnothing.pages.dev` serves the new file
while `fromnothing.pl` keeps the old one until the cache expires.

Both documents reference these two files with a `?v=` token. **Bump that token in
`index.html` and `posluchajnas.html` whenever either file changes** — it makes the
URL new, so neither the edge nor the browser can serve a stale copy.

```bash
grep -n '?v=' index.html posluchajnas.html
```

The alternative is a dashboard purge (fromnothing.pl → Caching → Configuration →
Purge Everything). A `_headers` file with a shorter `Cache-Control` would only
help if the zone's Browser Cache TTL is set to "Respect Existing Headers";
otherwise the zone setting wins.

## Lead capture

The contact form (`#contactForm` in `index.html`) posts JSON to `/api/contact`
(`functions/api/contact.js`) instead of opening a mail client. On a valid
submission:

1. Cloudflare Turnstile (widget in the form, verified server-side) and a
   honeypot field (`website`) both have to pass before anything is written.
2. The lead is inserted into the D1 database **`fromnothing-leads`** — this is
   the source of truth for every lead, independent of Trello or e-mail.
3. A card is created on the "Nowy" list of the team's Trello board.
4. `fromnothing-mailer` (a separate Worker, source in `functions/_mailer/`,
   *not* deployed as part of the Pages project) sends a notification e-mail
   about the lead to the team. The same Worker's `email()` handler is the
   Email Routing destination for `kontakt@fromnothing.pl`, forwarding
   incoming mail to the same recipients.

A Trello or e-mail failure never blocks the lead write — D1 is authoritative,
the other two are best-effort notifications on top of it.

### Bindings and secrets (configured on Cloudflare, not in this repo)

The Pages project (`fromnothing`) needs, alongside the existing `MEDIA` R2
binding:

| Name | Kind | Purpose |
| --- | --- | --- |
| `DB` | D1 binding → `fromnothing-leads` | Lead storage |
| `TURNSTILE_SECRET` | Secret | Server-side Turnstile verification; captcha check is skipped entirely if unset |
| `TRELLO_KEY`, `TRELLO_TOKEN`, `TRELLO_LIST_ID` | Secrets | Card creation; skipped entirely if any is unset |
| `MAILER` | Service binding → `fromnothing-mailer` | Lead notification e-mails; skipped entirely if unset |
| `MAILER_KEY` | Secret | Sent as the `x-mailer-key` header on calls to `MAILER` |

`fromnothing-mailer` itself (deployed separately, see below) needs its own
`SHARED_SECRET` set to the same value as `MAILER_KEY` above, plus the vars and
`send_email` binding already declared in `functions/_mailer/wrangler.toml`
(`RECIPIENTS`, `FROM_ADDR`, binding `NOTIFY`). No secret values live in this
repository — only binding/secret *names*, matching the `MEDIA` binding
convention described earlier in this file.

### Deploying the mailer worker

`functions/_mailer/` is never uploaded as a Pages static asset or picked up as
a Pages Function (the leading underscore excludes it from routing, same as
`_r2.js`). It is deployed on its own:

```bash
wrangler deploy -c functions/_mailer/wrangler.toml
```

### Where lead data lives

Every submitted lead — including ones where Trello or the mailer failed — is a
row in the `leads` table of the `fromnothing-leads` D1 database (schema in
`specs/lead-capture/schema.sql`). Trello card id and mail-sent status are
recorded back onto that same row (`trello_card_id`, `mail_sent`) once those
best-effort steps succeed.
