import { hasStore, json, pathnameOf, ruleFor } from "../_lib/blob.js";
import { serveBlob } from "../_lib/serve.js";

/**
 * GET /api/blob/view?pathname=… (or ?url=…) — read a private blob.
 *
 * A private blob's own URL needs an Authorization header, and there is no way
 * to put one on `<img src>`, `<video src>` or a download link. So the browser
 * points here, the function holds the token, and the bytes come back with the
 * headers the element needs. This is what makes a private portrait, a private
 * recording or a private PDF displayable at all.
 *
 * `?download=1` forces the save dialog for a file the browser would otherwise
 * render — the one thing a caller gets to decide about how this responds.
 *
 * The cache is `private`, so a shared cache never holds one viewer's file.
 */
export default async function handler(request: Request): Promise<Response> {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return json({ error: "Method not allowed." }, 405);
  }
  if (!hasStore()) {
    return json({ error: "No Blob store configured.", demo: true }, 501);
  }

  const params = new URL(request.url).searchParams;
  const pathname = params.get("pathname") ?? pathnameOf(params.get("url"));
  if (!pathname) return json({ error: "A pathname or url is required." }, 400);

  const rule = ruleFor(pathname);
  if (!rule) return json({ error: "Not found." }, 404);
  if (rule.access !== "private") {
    // A public key has a URL that works on its own, and sending it through
    // here would only make it uncacheable.
    return json({ error: "That path is public — read it from its own URL." }, 400);
  }

  return serveBlob({
    pathname,
    access: "private",
    request,
    cacheControl: "private, max-age=60, must-revalidate",
    forceDownload: params.get("download") === "1",
  });
}
