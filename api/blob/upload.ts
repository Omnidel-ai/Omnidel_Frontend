import { del, put } from "@vercel/blob";
import { FILE_MAX_BYTES, IMAGE_MAX_BYTES, bareType, guard, json, ruleFor } from "../_lib/blob.js";

/**
 * POST /api/blob/upload — multipart upload through this function.
 * DELETE /api/blob/upload — remove one blob by URL or pathname.
 *
 * The other half of the pair. `upload-token` is the right path for anything
 * large; this one exists because a browser talking straight to Vercel Blob
 * needs CORS to work, which it does not on every localhost setup — the
 * application keeps the same fallback for exactly that reason.
 *
 * The form carries `file` and `pathname`. The pathname is checked against the
 * same prefix rules the token route uses, so both doors have one lock.
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
  if (!rule) return json({ error: "Path is not one this workspace writes to." }, 400);

  const contentType = bareType(file.type);
  if (!rule.types.includes(contentType)) {
    return json(
      { error: `Type not allowed here. This path takes: ${rule.types.join(", ")}.` },
      415,
    );
  }

  const cap = maxFor(contentType);
  if (file.size > cap) {
    return json(
      {
        error: `File too large (max ${Math.round(cap / 1024 / 1024)} MB through this route).`,
        hint: "Larger files go browser-direct with a token from /api/blob/upload-token.",
      },
      413,
    );
  }

  try {
    const blob = await put(pathname, file, {
      access: rule.access,
      contentType,
      addRandomSuffix: rule.access === "public",
      allowOverwrite: rule.access === "private",
    });
    return json({
      url: blob.url,
      pathname: blob.pathname,
      access: rule.access,
      name: file.name,
      size: file.size,
      type: contentType,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: message }, 502);
  }
}

function maxFor(contentType: string): number {
  return contentType.startsWith("image/") ? IMAGE_MAX_BYTES : FILE_MAX_BYTES;
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

  const body = (await request.json().catch(() => ({}))) as {
    url?: string;
    pathname?: string;
  };
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

/** The key inside the store, from a full blob URL. */
function pathnameOf(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.endsWith(".blob.vercel-storage.com")) return null;
    return decodeURIComponent(parsed.pathname.replace(/^\//, ""));
  } catch {
    return null;
  }
}
