// GET /media/<name> — large media streamed from R2 by the origin.
//
// Only the keys listed in PUBLIC are reachable: the bucket also holds documents
// served by their own routes, and the path segment must never be used to
// address the bucket directly.
//
// Range requests are honoured, so the video player can seek without pulling
// the whole file.
import { serveObject } from "../_r2.js";

const PUBLIC = {
  "live-2026-kompilacja.mp4": {
    key: "fromnothing-live-2026-kompilacja.mp4",
    contentType: "video/mp4",
  },
};

export function onRequest({ request, env, params }) {
  const segments = Array.isArray(params.path) ? params.path : [params.path];
  const name = segments.join("/");
  const entry = Object.prototype.hasOwnProperty.call(PUBLIC, name)
    ? PUBLIC[name]
    : undefined;

  if (!entry) {
    return new Response("Not found", {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    });
  }

  return serveObject({
    request,
    bucket: env.MEDIA,
    key: entry.key,
    contentType: entry.contentType,
    filename: name,
    // A fixed compilation — safe to cache hard. Purge the cache if replaced.
    maxAge: 604800,
  });
}
