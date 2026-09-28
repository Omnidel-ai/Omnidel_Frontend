import { get } from "@vercel/blob";
import { contentTypeFor, hasStore, json, ruleFor } from "../_lib/blob.js";

/**
 * GET /api/blob/view?pathname=… (or ?url=…) — read a private blob.
 *
 * A private blob's own URL needs an Authorization header, and there is no way
 * to put one on `<img src>`. So the browser points at this function, the
 * function holds the token, and the bytes come back with the headers an image
 * needs. This is what makes a private portrait displayable at all.
 *
 * Three things matter here beyond fetching:
 *
 *   - the content type comes from the key's extension, never from the stored
 *     value, and anything unrecognised is served as a download;
 *   - SVG is served as an attachment with a locked-down CSP, because an SVG is
 *     a document that can carry script and this origin also serves the app;
 *   - the cache is `private`, so a shared cache never holds one viewer's image.
 *
 * The application's proxy makes the same three choices for the same reasons.
 */
export default async function handler(request: Request): Promise<Response> {
  if (request.method !== "GET") return json({ error: "Method not allowed." }, 405);
  if (!hasStore()) {
    return json({ error: "No Blob store configured.", demo: true }, 501);
  }

  const params = new URL(request.url).searchParams;
  const pathname = params.get("pathname") ?? pathnameOf(params.get("url"));
  if (!pathname) return json({ error: "A pathname or url is required." }, 400);

  const rule = ruleFor(pathname);
  if (!rule) return json({ error: "Not found." }, 404);
  if (rule.access !== "private") {
    // A public key has a URL that works on its own; sending it through here
    // would only make it uncacheable.
    return json({ error: "That path is public — read it from its own URL." }, 400);
  }

  const result = await get(pathname, { access: "private" }).catch(() => null);
  if (!result) return json({ error: "Not found." }, 404);
  if (result.statusCode !== 200 || !result.stream) {
    return json({ error: "Blob fetch failed.", status: result.statusCode }, 502);
  }

  const derived = contentTypeFor(pathname);
  const isImage = derived !== null && derived.startsWith("image/");
  const isSvg = derived === "image/svg+xml";
  const headers: Record<string, string> = {
    "Content-Type": isImage && !isSvg ? derived : "application/octet-stream",
    "Content-Disposition": isImage && !isSvg ? "inline" : "attachment",
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "private, max-age=60, must-revalidate",
  };
  if (result.blob.size) headers["Content-Length"] = String(result.blob.size);
  if (isSvg) {
    headers["Content-Security-Policy"] =
      "default-src 'none'; script-src 'none'; object-src 'none'; connect-src 'none'; img-src 'self'; style-src 'unsafe-inline'";
  }

  return new Response(result.stream, { status: 200, headers });
}

function pathnameOf(url: string | null): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.endsWith(".blob.vercel-storage.com")) return null;
    return decodeURIComponent(parsed.pathname.replace(/^\//, ""));
  } catch {
    return null;
  }
}
