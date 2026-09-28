import { CLIENT_MAX_BYTES, FILE_MAX_BYTES, IMAGE_MAX_BYTES, PREFIXES, hasStore, json } from "./_lib/blob.js";

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
        { route: "/api/blob/view", method: "GET", does: "Read a private blob — the one way to show one" },
        { route: "/api/blob/public/<key>", method: "GET", does: "Read a public blob, cached and cross-origin" },
        { route: "/api/blob/list", method: "GET", does: "What is in a prefix" },
      ],
      prefixes: Object.fromEntries(
        Object.entries(PREFIXES).map(([prefix, rule]) => [prefix, rule.access]),
      ),
      limits: {
        imageBytes: IMAGE_MAX_BYTES,
        fileBytes: FILE_MAX_BYTES,
        clientDirectBytes: CLIENT_MAX_BYTES,
      },
    },
    200,
    { "Cache-Control": "no-store" },
  );
}
