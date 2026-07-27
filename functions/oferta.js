// GET /oferta — the current booking offer, streamed from R2 by the origin.
// The visitor stays on fromnothing.pl; there is no redirect and no bucket URL.
// Replacing the object in the bucket publishes a new offer without a deploy.
import { serveObject } from "./_r2.js";

// Dated key: the name is what a promoter sees when they save the file, so it
// changes whenever the document does. Previous editions stay in the bucket.
const KEY = "fromnothing-oferta-27-07-2026.pdf";

export function onRequest({ request, env }) {
  return serveObject({
    request,
    bucket: env.MEDIA,
    key: KEY,
    contentType: "application/pdf",
    filename: KEY,
    // Short, so a replaced offer goes live quickly; the ETag still lets
    // browsers revalidate without re-downloading 7 MB.
    maxAge: 600,
  });
}
