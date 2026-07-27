// GET /rider — the technical rider. Currently a placeholder document marked
// "w przygotowaniu"; swapping the object in R2 publishes the real rider with
// no code change and no deploy.
import { serveObject } from "./_r2.js";

const KEY = "fromnothing-rider-tech.pdf";

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
