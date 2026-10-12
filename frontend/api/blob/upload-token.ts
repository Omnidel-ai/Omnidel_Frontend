import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { LIMITS, guard, json, ruleFor } from "../_lib/blob.js";
import { kindOf } from "../_lib/media.js";

/**
 * POST /api/blob/upload-token — a token for a browser-direct upload.
 *
 * The browser sends the bytes to Vercel Blob itself and this function only
 * says yes: which pathname, which content types, how large, which store. It is
 * the only way past the ~4.5 MB function body limit, which makes it the only
 * way to store a video, a long recording or a large PDF at all — and it is
 * what the application does for acharya portraits and project references.
 *
 * The pathname decides everything. `ruleFor` maps a prefix to a store and the
 * kinds it takes, so a caller cannot ask for a token that writes outside the
 * prefixes this workspace owns, cannot ask for a public token on a private
 * prefix, and cannot put a video where only documents belong.
 *
 * The size ceiling is per kind and is the **client** ceiling, which is far
 * larger than the function one: a gigabyte of video is fine when the bytes
 * never touch a function.
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
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const rule = ruleFor(pathname);
        if (!rule) {
          throw new Error(`Path is not one this workspace writes to: ${pathname}`);
        }

        // The client says which kind it is about to send so the ceiling can be
        // that kind's rather than the largest the prefix allows. It is a hint,
        // not a trust boundary: Blob enforces `allowedContentTypes` on the
        // bytes themselves, and a lie only buys a smaller limit.
        const declared = typeof clientPayload === "string" ? kindOf(clientPayload) : null;
        const kinds = declared && rule.kinds.includes(declared) ? [declared] : rule.kinds;
        const ceiling = Math.max(...kinds.map((k) => LIMITS[k].client));

        return {
          allowedContentTypes: rule.types,
          maximumSizeInBytes: ceiling,
          addRandomSuffix: rule.access === "public",
          allowOverwrite: rule.access === "private",
        };
      },
      onUploadCompleted: async () => {
        // The app writes its row here, and notes the callback does not fire on
        // localhost, so its client confirms too. There is no row to write in
        // this workspace — the client keeps the URL it got back.
      },
    });
    return json(result);
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 400);
  }
}
