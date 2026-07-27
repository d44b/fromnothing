// Shared R2 delivery helper for the Pages Functions in this directory.
// Files under functions/ that begin with an underscore are not routed.
//
// The bucket is attached to the Pages project as the `MEDIA` binding
// (see README, "Media delivery"). Objects are streamed back from the origin —
// visitors never see an R2 URL and never get redirected off fromnothing.pl.

const RANGE_RE = /^bytes=(\d*)-(\d*)$/;

/**
 * Translate a Range header into an R2 range option.
 * Returns `null` for absent/unsatisfiable-but-ignorable headers, and
 * `"invalid"` when the client asked for something outside the object.
 */
function parseRange(header, size) {
  if (!header) return null;
  const match = RANGE_RE.exec(header.trim());
  if (!match) return null; // multi-range and unknown units: serve the whole body

  const [, rawStart, rawEnd] = match;
  if (rawStart === "" && rawEnd === "") return null;

  if (rawStart === "") {
    // bytes=-N — the trailing N bytes
    const suffix = Number(rawEnd);
    if (!suffix) return "invalid";
    const length = Math.min(suffix, size);
    return { offset: size - length, length };
  }

  const start = Number(rawStart);
  if (start >= size) return "invalid";
  const end = rawEnd === "" ? size - 1 : Math.min(Number(rawEnd), size - 1);
  if (end < start) return "invalid";
  return { offset: start, length: end - start + 1 };
}

/**
 * Serve a single R2 object.
 *
 * @param {object} options
 * @param {Request} options.request
 * @param {R2Bucket} options.bucket
 * @param {string}   options.key         object key in the bucket
 * @param {string}   options.contentType
 * @param {string}   options.filename    name shown by the browser / on save
 * @param {number}   options.maxAge      edge + browser cache lifetime, seconds
 */
export async function serveObject({
  request,
  bucket,
  key,
  contentType,
  filename,
  maxAge,
}) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method not allowed", {
      status: 405,
      headers: { Allow: "GET, HEAD", "Cache-Control": "no-store" },
    });
  }

  if (!bucket) {
    // The binding is missing — a project misconfiguration, not a client error.
    return new Response("Media storage is not configured.", {
      status: 500,
      headers: { "Cache-Control": "no-store" },
    });
  }

  const head = await bucket.head(key);
  if (!head) {
    return new Response("Not found", {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    });
  }

  const headers = new Headers();
  headers.set("Content-Type", contentType);
  headers.set("Content-Disposition", `inline; filename="${filename}"`);
  headers.set("Cache-Control", `public, max-age=${maxAge}`);
  headers.set("Accept-Ranges", "bytes");
  headers.set("ETag", head.httpEtag);
  headers.set("Last-Modified", head.uploaded.toUTCString());
  headers.set("X-Content-Type-Options", "nosniff");

  // Conditional request — let the browser reuse what it already has.
  const ifNoneMatch = request.headers.get("If-None-Match");
  if (ifNoneMatch && ifNoneMatch.includes(head.httpEtag.replace(/^W\//, ""))) {
    return new Response(null, { status: 304, headers });
  }

  const range = parseRange(request.headers.get("Range"), head.size);
  if (range === "invalid") {
    headers.set("Content-Range", `bytes */${head.size}`);
    return new Response(null, { status: 416, headers });
  }

  if (request.method === "HEAD") {
    headers.set("Content-Length", String(head.size));
    return new Response(null, { status: 200, headers });
  }

  const object = await bucket.get(key, range ? { range } : undefined);
  if (!object) {
    return new Response("Not found", {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    });
  }

  if (range) {
    const end = range.offset + range.length - 1;
    headers.set("Content-Range", `bytes ${range.offset}-${end}/${head.size}`);
    headers.set("Content-Length", String(range.length));
    return new Response(object.body, { status: 206, headers });
  }

  headers.set("Content-Length", String(head.size));
  return new Response(object.body, { status: 200, headers });
}
