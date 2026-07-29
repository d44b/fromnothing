// GET /listen — the English alias printed in the booking offer's QR code.
// The video page already ships its own i18n keyed off ?lang=en, so this stays
// a redirect instead of a duplicated page. 302, not 301: if /listen ever
// becomes a standalone English page, caches must not pin the old target.
export function onRequest({ request }) {
  const url = new URL(request.url);
  url.pathname = "/posluchajnas";
  url.search = "?lang=en";
  return Response.redirect(url.toString(), 302);
}
