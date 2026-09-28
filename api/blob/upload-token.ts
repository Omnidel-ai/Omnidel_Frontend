import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { CLIENT_MAX_BYTES, guard, json, ruleFor } from "../_lib/blob.js";

/**
 * POST /api/blob/upload-token — a token for a browser-direct upload.
 *
 * The browser sends the bytes to Vercel Blob itself and this function only
 * says yes: which pathname, which content types, how large, which store. That
 * is the only way past the ~4.5 MB function body limit, and it is what the
 * application does for acharya portraits.
 *
 * The pathname decides everything. `ruleFor` maps a prefix to a store and a
 * list of types, so a caller cannot ask for a token that writes outside the
 * prefixes this workspace owns, and cannot ask for a public token on a private
 * prefix.
 */
export default async function handler(request: Request): Promise<Response> {
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);

  let body: HandleUploadBody;
  try {
    body = (await request.json()) as HandleUploadBody;
  } catch {
    return json({ error: "Invalid JSON body." }, 400);
  }

  // Two different callers reach this route. The browser asking for a token has
  // to pass the guard; the completion callback comes from Vercel after the
  // upload, carries no header of ours, and is verified by `handleUpload`
  // against the store's token instead.
  if (body.type !== "blob.upload-completed") {
    const denied = guard(request);
    if (denied) return denied;
  }

  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        const rule = ruleFor(pathname);
        if (!rule) {
          throw new Error(`Path is not one this workspace writes to: ${pathname}`);
        }
        return {
          allowedContentTypes: [...rule.types],
          maximumSizeInBytes: CLIENT_MAX_BYTES,
          // A portrait overwrites itself: the pathname carries the record's
          // slug, so a random suffix would leave the old one orphaned and the
          // record pointing at a key nothing cleans up.
          addRandomSuffix: rule.access === "private" ? false : true,
          allowOverwrite: rule.access === "private",
        };
      },
      onUploadCompleted: async () => {
        // The app writes the row here and notes that the callback does not
        // fire on localhost, so the client confirms too. There is no row to
        // write in this workspace — the client holds the URL it got back.
      },
    });
    return json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: message }, 400);
  }
}
