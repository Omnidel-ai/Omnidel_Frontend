/**
 * What kind of thing is behind a link — isomorphic, no fetching.
 *
 * The learn screens send every tapped link to `/api/work/read`, which extracts
 * article text. That route rejects anything that isn't HTML (`non_html`), so a
 * PDF resource opened as an unreadable error instead of as a document. Deciding
 * from the URL first lets a PDF go straight to the browser's own viewer.
 */

/** Content type for a file URL, from its extension. Null when unknown. */
export function contentTypeFromUrl(url: string | null | undefined): string | null {
  const ext = fileExtension(url);
  if (!ext) return null;
  switch (ext) {
    case "pdf":
      return "application/pdf";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "gif":
      return "image/gif";
    case "svg":
      return "image/svg+xml";
    case "txt":
      return "text/plain";
    case "csv":
      return "text/csv";
    default:
      return null;
  }
}

/**
 * PDF by extension. Query/hash are stripped first — proxied and signed URLs
 * (`/api/work/uploads/view?url=…file.pdf`, `…file.pdf?token=…`) are the common
 * shapes here, so a naive `endsWith(".pdf")` would miss most of them.
 */
export function isPdfUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  if (fileExtension(url) === "pdf") return true;
  // Proxy links carry the real target in `?url=`.
  const inner = innerUrlParam(url);
  return inner ? fileExtension(inner) === "pdf" : false;
}

/** Lowercased extension of the URL's path, or null. */
export function fileExtension(url: string | null | undefined): string | null {
  if (!url) return null;
  const path = url.trim().split("#")[0].split("?")[0];
  const name = path.split("/").pop() || "";
  const dot = name.lastIndexOf(".");
  if (dot <= 0 || dot === name.length - 1) return null;
  return name.slice(dot + 1).toLowerCase();
}

function innerUrlParam(url: string): string | null {
  const match = /[?&]url=([^&]+)/.exec(url);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}
