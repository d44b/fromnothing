// GET /offer — the English booking offer, streamed from R2 by the origin.
// Mirrors /oferta; the QR codes inside point to the English routes (/listen).
import { serveObject } from "./_r2.js";

// Dated key: the name is what a promoter sees when they save the file, so it
// changes whenever the document does. Previous editions stay in the bucket.
const KEY = "fromnothing-booking-offer-29-07-2026.pdf";

export function onRequest({ request, env }) {
  return serveObject({
    request,
    bucket: env.MEDIA,
    key: KEY,
    contentType: "application/pdf",
    filename: KEY,
    // Short, so a replaced offer goes live quickly; the ETag still lets
    // browsers revalidate without re-downloading the file.
    maxAge: 600,
  });
}
