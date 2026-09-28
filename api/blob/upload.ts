import { del, put } from "@vercel/blob";
import { bareType, checkType, guard, json, pathnameOf, ruleFor } from "../_lib/blob.js";

/**
 * POST /api/blob/upload — multipart upload through this function.
 * DELETE /api/blob/upload — remove one blob by URL or pathname.
 *
 * The small-file door. `upload-token` is the right way in for anything of
 * size; this exists because a browser talking straight to Vercel Blob needs
 * CORS to work, which it does not on every localhost setup — the application
 * keeps the same fallback for exactly that reason.
 *
 * Everything above roughly 4 MB is refused here with a message pointing at the
 * other route, because Vercel rejects the request body before this code runs
 * and the caller would otherwise see an opaque platform error.
 *
 * The form carries `file` and `pathname`. The pathname goes through the same
 * prefix rules the token route uses, so both doors have one lock.
 */
export default async function handler(request: Request): Promise<Response> {
  if (request.method === "DELETE") return remove(request);
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);

  const denied = guard(request);
  if (denied) return denied;

  const form = await request.formData().catch(() => null);
  if (!form) return json({ error: "Expected multipart/form-data." }, 400);

  const file = form.get("file");
  if (!(file instanceof File)) return json({ error: "No file provided." }, 400);

  const pathname = String(form.get("pathname") ?? "");
  const rule = ruleFor(pathname);
  if (!rule) {
    return json(
      { error: "Path is not one this workspace writes to.", prefixes: prefixHint(), },
      400,
    );
  }

  const contentType = bareType(file.type);
  const check = checkType(rule, contentType, file.size, "fn");
  if (!check.ok) {
    return json({ error: check.error, hint: check.hint, accepts: rule.types }, check.status);
  }

  try {
    const blob = await put(pathname, file, {
      access: rule.access,
      contentType,
      // A record's own file overwrites itself — the key carries the record's
      // slug, so a random suffix would orphan the old one. Public files get a
      // suffix because they are catalogued by URL and may be replaced while an
      // old URL is still in someone's cache.
      addRandomSuffix: rule.access === "public",
      allowOverwrite: rule.access === "private",
    });
    return json({
      url: blob.url,
      pathname: blob.pathname,
      access: rule.access,
      kind: check.kind,
      name: file.name,
      size: file.size,
      type: contentType,
    });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 502);
  }
}

/**
 * Delete, by URL or by pathname.
 *
 * The URL has to be checked, not trusted: `del()` takes any URL, so without
 * the prefix check a caller could hand it a key belonging to something else
 * that shares the store. The application guards its delete the same way.
 */
async function remove(request: Request): Promise<Response> {
  const denied = guard(request);
  if (denied) return denied;

  const body = (await request.json().catch(() => ({}))) as { url?: string; pathname?: string };
  const target = body.pathname ?? pathnameOf(body.url);
  if (!target) return json({ error: "A url or pathname is required." }, 400);
  if (!ruleFor(target)) return json({ error: "Path is not one this workspace owns." }, 403);

  try {
    await del(body.url ?? target);
  } catch {
    // Already gone, or from a store that no longer exists. Either way the
    // caller's intent — "this should not be there" — now holds.
  }
  return json({ ok: true, pathname: target });
}

function prefixHint(): string[] {
  return ["omnivarsity/", "omnimart/", "omnipulse/", "omnistudio/"];
}
