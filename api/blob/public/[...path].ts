import { hasStore, json, publicCors, ruleFor } from "../../_lib/blob.js";
import { serveBlob } from "../../_lib/serve.js";

/**
 * GET /api/blob/public/<key> — a storefront or brand file, for anyone.
 *
 * The public counterpart to `view`. Same work, three differences, and each one
 * is why both exist rather than one with a flag:
 *
 *   - it serves only prefixes declared public, so a private key cannot be read
 *     through it no matter how the URL is spelled;
 *   - it caches hard and shares — public bytes are the same for everyone, and
 *     a day in the CDN is the difference between a fast catalogue and a
 *     function call per thumbnail;
 *   - it answers cross-origin, and exposes the range headers a player off this
 *     origin needs in order to seek rather than swallow the whole file.
 *
 * The key comes from the URL path rather than a query parameter, so the file
 * keeps a plain, cacheable address.
 */
export default async function handler(request: Request): Promise<Response> {
  const cors = publicCors();

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }
  if (request.method !== "GET" && request.method !== "HEAD") {
    return json({ error: "Method not allowed." }, 405, cors);
  }
  if (!hasStore()) {
    return json({ error: "No Blob store configured.", demo: true }, 501, cors);
  }

  const url = new URL(request.url);
  const key = decodeURIComponent(url.pathname.replace(/^\/api\/blob\/public\/?/, ""));
  if (!key) return json({ error: "Missing path." }, 400, cors);

  const rule = ruleFor(key);
  if (!rule || rule.access !== "public") {
    // Same answer for "no such prefix" and "that one is private": a 403 here
    // would tell a caller which private keys exist.
    return json({ error: "Not found." }, 404, cors);
  }

  return serveBlob({
    pathname: key,
    access: "public",
    request,
    headers: cors,
    cacheControl: "public, max-age=86400, stale-while-revalidate=604800",
    forceDownload: url.searchParams.get("download") === "1",
  });
}
