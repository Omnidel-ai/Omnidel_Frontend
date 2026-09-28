import { get } from "@vercel/blob";
import { contentTypeFor, hasStore, json, publicCors, ruleFor } from "../../_lib/blob.js";

/**
 * GET /api/blob/public/<key> — a storefront image, for anyone.
 *
 * The public counterpart to `view`. Same fetch, three differences, and each
 * one is the reason both handlers exist rather than one with a flag:
 *
 *   - it serves only prefixes declared public, so a private key cannot be read
 *     through it no matter how the URL is spelled;
 *   - it caches hard and shares — a storefront image is the same bytes for
 *     everyone, and a day in a CDN is the difference between a fast catalogue
 *     and a function call per thumbnail;
 *   - it answers cross-origin, because a storefront is embedded elsewhere.
 *
 * The key comes from the URL path rather than a query parameter so the image
 * keeps a plain, cacheable address.
 */
export default async function handler(request: Request): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: publicCors() });
  }
  if (request.method !== "GET") {
    return json({ error: "Method not allowed." }, 405, publicCors());
  }
  if (!hasStore()) {
    return json({ error: "No Blob store configured.", demo: true }, 501, publicCors());
  }

  const { pathname: route } = new URL(request.url);
  const key = decodeURIComponent(route.replace(/^\/api\/blob\/public\/?/, ""));
  if (!key) return json({ error: "Missing path." }, 400, publicCors());

  const rule = ruleFor(key);
  if (!rule || rule.access !== "public") {
    // Same answer for "no such prefix" and "that one is private": a 403 here
    // would tell a caller which private keys exist.
    return json({ error: "Not found." }, 404, publicCors());
  }

  const result = await get(key, { access: "public" }).catch(() => null);
  if (!result || result.statusCode !== 200 || !result.stream) {
    return json({ error: "Not found." }, 404, publicCors());
  }

  const derived = contentTypeFor(key);
  const isImage = derived !== null && derived.startsWith("image/") && derived !== "image/svg+xml";
  const headers: Record<string, string> = {
    ...publicCors(),
    "Content-Type": isImage ? derived : "application/octet-stream",
    "Content-Disposition": isImage ? "inline" : "attachment",
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
  };
  if (result.blob.size) headers["Content-Length"] = String(result.blob.size);

  return new Response(result.stream, { status: 200, headers });
}
