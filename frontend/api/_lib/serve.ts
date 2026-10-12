import { get } from "@vercel/blob";
import { json } from "./blob.js";
import { disposition, hardeningFor, kindOf, seekable, typeForPath } from "./media.js";

/**
 * Sending a stored file back to a browser.
 *
 * Both read routes — the private proxy and the public one — do the same work
 * and differ only in who may ask and how long the answer may be cached, so the
 * work lives here and each route supplies its own policy.
 *
 * What this handles that a plain `fetch`-and-return does not:
 *
 *   - **Byte ranges.** A `<video>` element opens a file by asking for the last
 *     few hundred bytes, then the first few, then seeks. Without `Range` it
 *     downloads the whole thing before it can play, and the scrub bar does
 *     nothing. This forwards the header and returns 206 with `Content-Range`.
 *   - **Conditional requests.** The blob's ETag goes out, `If-None-Match` comes
 *     back, and an unchanged file answers 304 with no body.
 *   - **Inline versus download**, decided by kind, with SVG and PDF held down.
 */
export interface ServeOptions {
  /** The key inside the store. */
  pathname: string;
  access: "public" | "private";
  /** What to put in Cache-Control. */
  cacheControl: string;
  /** Added to every response, including the errors. */
  headers?: Record<string, string>;
  /** `?download=1` — force the browser to save rather than render. */
  forceDownload?: boolean;
  /** The incoming request, for its Range and If-None-Match. */
  request: Request;
}

export async function serveBlob(options: ServeOptions): Promise<Response> {
  const { pathname, access, request } = options;
  const extra = options.headers ?? {};

  const range = request.headers.get("range");
  const ifNoneMatch = request.headers.get("if-none-match") ?? undefined;

  const result = await get(pathname, {
    access,
    ...(ifNoneMatch ? { ifNoneMatch } : {}),
    // A range is passed through to the store rather than being applied here:
    // slicing a stream in the function would mean paying for the whole file to
    // serve a few hundred bytes of it.
    ...(range ? { headers: { Range: range } } : {}),
  }).catch(() => null);

  if (!result) return json({ error: "Not found." }, 404, extra);

  // The typed union covers 200 and 304; a forwarded Range makes 206 reachable,
  // which is the whole reason for the header pass-through above.
  const status = result.statusCode as number;

  if (status === 304) {
    return new Response(null, {
      status: 304,
      headers: { ...extra, ETag: result.blob.etag, "Cache-Control": options.cacheControl },
    });
  }
  if (status !== 200 && status !== 206) {
    return json({ error: "Blob fetch failed.", status }, 502, extra);
  }
  if (!result.stream) return json({ error: "Not found." }, 404, extra);

  // The type comes from the key, never from what was stored under it: a file
  // uploaded with a lying Content-Type would otherwise be served back with it.
  const contentType = typeForPath(pathname) ?? "application/octet-stream";
  const kind = kindOf(contentType);
  const how = options.forceDownload ? "attachment" : disposition(contentType);

  const headers: Record<string, string> = {
    ...extra,
    "Content-Type": contentType,
    "Content-Disposition": how,
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": options.cacheControl,
    ETag: result.blob.etag,
    ...(how === "inline" ? hardeningFor(contentType) : {}),
  };

  // Only advertise seeking where it means something. A browser that sees
  // `Accept-Ranges` on a PDF will make range requests for it too, which is
  // fine, but the header is there for the players.
  if (seekable(kind) || status === 206) headers["Accept-Ranges"] = "bytes";

  const contentRange = result.headers.get("content-range");
  if (contentRange) headers["Content-Range"] = contentRange;
  const length = result.headers.get("content-length") ?? (result.blob.size ? String(result.blob.size) : null);
  if (length) headers["Content-Length"] = length;

  return new Response(result.stream, { status: status === 206 ? 206 : 200, headers });
}
