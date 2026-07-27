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
| `/oferta` | `fromnothing-oferta-26-06-2026.pdf` | Booking offer, served inline |
| `/rider` | `fromnothing-rider-tech.pdf` | Technical rider; placeholder for now |
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

The offer is generated from a Typst source that is not kept in this repository.
The published `fromnothing-oferta-26-06-2026.pdf` additionally carries a
`POSŁUCHAJ NAS` QR code on page 1 pointing at
`https://fromnothing.pl/posluchajnas`, applied as a vector overlay on top of the
Typst output. When the offer is regenerated, that overlay has to be reapplied —
or, better, the QR code should be moved into the Typst source itself.
