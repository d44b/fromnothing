// GET /rider-en — the technical rider (EN). Mirrors /rider.
import { serveObject } from "./_r2.js";

const KEY = "fromnothing-tech-rider-30-07-2026.pdf";

export function onRequest({ request, env }) {
  return serveObject({
    request,
    bucket: env.MEDIA,
    key: KEY,
    contentType: "application/pdf",
    filename: KEY,
    maxAge: 600,
  });
}
