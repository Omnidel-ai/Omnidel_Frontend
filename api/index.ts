import { LIMITS, PREFIXES, hasStore, json } from "./_lib/blob.js";
import { ALL_TYPES, typesOfKind } from "./_lib/media.js";

/**
 * GET /api — what these functions are, and whether they can do anything.
 *
 * The browser asks this once on load. Without a Blob store the whole workspace
 * runs on demo data and the upload field says so up front, rather than letting
 * someone pick a file and fail at the end of it.
 */
export default async function handler(request: Request): Promise<Response> {
  if (request.method !== "GET") return json({ error: "Method not allowed." }, 405);

  const configured = hasStore();
  return json(
    {
      workspace: "@omnidel/shared-components",
      // The whole point of the flag: demo mode is the normal state here.
      demo: !configured,
      store: configured ? "configured" : "absent",
      writable: configured && Boolean(process.env.BLOB_UPLOAD_SECRET),
      functions: [
        { route: "/api/blob/upload-token", method: "POST", does: "Token for a browser-direct upload" },
        { route: "/api/blob/upload", method: "POST · DELETE", does: "Multipart upload through the function, and delete" },
        { route: "/api/blob/view", method: "GET", does: "Read a private blob — the one way to show one. Ranges, ETags, ?download=1" },
        { route: "/api/blob/public/<key>", method: "GET", does: "Read a public blob, cached, cross-origin, seekable" },
        { route: "/api/blob/list", method: "GET", does: "What is in a prefix" },
      ],
      prefixes: Object.fromEntries(
        Object.entries(PREFIXES).map(([prefix, rule]) => [
          prefix,
          { access: rule.access, kinds: rule.kinds },
        ]),
      ),
      // Per kind, and per route: what may pass through a function body, and
      // what may go browser-direct. The browser reads these to choose a route
      // and to refuse a file before uploading it rather than after.
      limits: LIMITS,
      types: Object.fromEntries(
        (["image", "video", "audio", "document", "data"] as const).map((k) => [k, typesOfKind([k])]),
      ),
      typeCount: ALL_TYPES.length,
    },
    200,
    { "Cache-Control": "no-store" },
  );
}
