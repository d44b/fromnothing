// GET /rider — the technical rider (PL). English edition lives at /rider-en.
// Replacing the object in the bucket publishes a new edition without a deploy.
import { serveObject } from "./_r2.js";

// Dated key: the name is what a promoter sees when they save the file, so it
// changes whenever the document does. Previous editions stay in the bucket.
const KEY = "fromnothing-rider-30-07-2026.pdf";

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
