import { list } from "@vercel/blob";
import { PREFIXES, guard, json, ruleFor } from "../_lib/blob.js";
import { typeForPath, kindOf } from "../_lib/media.js";

/**
 * GET /api/blob/list?prefix=omnimart/store/ — what is in a prefix.
 *
 * Not in the application, which reads its keys out of its own tables. This
 * workspace has no tables, so without this there is no way to see that an
 * upload landed. It answers with the same shape the upload handlers return, so
 * a gallery can render either.
 *
 * Behind the same guard as a write: a listing of a private prefix is a map of
 * what to ask for next.
 */
export default async function handler(request: Request): Promise<Response> {
  if (request.method !== "GET") return json({ error: "Method not allowed." }, 405);

  const denied = guard(request);
  if (denied) return denied;

  const params = new URL(request.url).searchParams;
  const prefix = params.get("prefix") ?? "";
  const rule = ruleFor(`${prefix}x`);
  if (!rule || !(prefix in PREFIXES)) {
    return json(
      { error: "Unknown prefix.", prefixes: Object.keys(PREFIXES) },
      400,
    );
  }

  const limit = Math.min(Number(params.get("limit") ?? 50) || 50, 200);

  try {
    const result = await list({ prefix, limit, mode: "expanded" });
    return json({
      prefix,
      access: rule.access,
      blobs: result.blobs.map((b) => ({
        pathname: b.pathname,
        url: b.url,
        size: b.size,
        uploadedAt: b.uploadedAt,
        kind: kindOf(typeForPath(b.pathname) ?? ""),
        // How the browser should read it back: a private key only opens
        // through the view proxy, a public one from its own URL.
        viewUrl:
          rule.access === "private"
            ? `/api/blob/view?pathname=${encodeURIComponent(b.pathname)}`
            : b.url,
      })),
      hasMore: result.hasMore,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: message }, 502);
  }
}
