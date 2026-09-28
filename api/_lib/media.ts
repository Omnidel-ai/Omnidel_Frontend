/**
 * What may be stored, what it is, and how much of it.
 *
 * Every handler needs the same three answers about a file — is this type
 * allowed here, how large may it be, and how should it be served — and each
 * answer follows from one thing: its **kind**. An image and a video are both
 * "media" and are treated differently at every step, so the kind is what the
 * rules are written against, not the content type.
 *
 * The lists are the application's, gathered from the routes that own each kind:
 * acharya avatars (images), the acharya knowledge base (documents), project
 * references (both), and the pipeline attachments (nearly everything).
 */

export type Kind = "image" | "video" | "audio" | "document" | "data";

/** Content type → kind. Anything absent is not storable through these routes. */
export const TYPE_KIND: Record<string, Kind> = {
  // Images — the app's avatar and storefront set, plus SVG, which is allowed
  // in but never served inline. See `disposition()`.
  "image/jpeg": "image",
  "image/png": "image",
  "image/webp": "image",
  "image/gif": "image",
  "image/avif": "image",
  "image/svg+xml": "image",

  // Video. Everything here is streamable, which is why `view` answers Range.
  "video/mp4": "video",
  "video/webm": "video",
  "video/quicktime": "video",
  "video/x-matroska": "video",

  // Audio — the set the app's speech routes produce and accept.
  "audio/mpeg": "audio",
  "audio/mp4": "audio",
  "audio/wav": "audio",
  "audio/x-wav": "audio",
  "audio/webm": "audio",
  "audio/ogg": "audio",
  "audio/flac": "audio",

  // Documents — what the knowledge base ingests, plus the Office set.
  "application/pdf": "document",
  "application/msword": "document",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "document",
  "application/vnd.ms-excel": "document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "document",
  "application/vnd.ms-powerpoint": "document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "document",
  "application/rtf": "document",

  // Data — text a person or a parser reads.
  "text/plain": "data",
  "text/markdown": "data",
  "text/x-markdown": "data",
  "text/csv": "data",
  "application/json": "data",
};

export const ALL_TYPES = Object.keys(TYPE_KIND);

export function typesOfKind(kinds: readonly Kind[]): string[] {
  return ALL_TYPES.filter((t) => kinds.includes(TYPE_KIND[t]!));
}

export function kindOf(contentType: string): Kind | null {
  return TYPE_KIND[contentType] ?? null;
}

/**
 * How large, per kind, by route.
 *
 * `fn` is what may pass through a function body and is well under Vercel's
 * ~4.5 MB request limit; `client` is what may go browser-direct, where the
 * bytes never touch a function at all. A video has no business in a function
 * body at any size, which is why its `fn` cap is small enough to fail early
 * with a message that says where to go instead.
 */
export const LIMITS: Record<Kind, { fn: number; client: number }> = {
  image: { fn: 4 * 1024 * 1024, client: 25 * 1024 * 1024 },
  document: { fn: 4 * 1024 * 1024, client: 50 * 1024 * 1024 },
  data: { fn: 4 * 1024 * 1024, client: 25 * 1024 * 1024 },
  audio: { fn: 4 * 1024 * 1024, client: 200 * 1024 * 1024 },
  video: { fn: 4 * 1024 * 1024, client: 1024 * 1024 * 1024 },
};

/** Extension → content type, for serving a blob we only know the key of. */
export const EXT_TYPE: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  avif: "image/avif",
  svg: "image/svg+xml",
  mp4: "video/mp4",
  m4v: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  mkv: "video/x-matroska",
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  wav: "audio/wav",
  ogg: "audio/ogg",
  oga: "audio/ogg",
  flac: "audio/flac",
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  rtf: "application/rtf",
  txt: "text/plain",
  md: "text/markdown",
  csv: "text/csv",
  json: "application/json",
};

export function typeForPath(pathname: string): string | null {
  const ext = pathname.split(".").pop()?.toLowerCase();
  return ext ? (EXT_TYPE[ext] ?? null) : null;
}

/**
 * Inline or download, and why.
 *
 * A browser renders what it is given, and rendering is the risky half. The
 * rule: things a `<img>`, `<video>` or `<audio>` element consumes are served
 * inline, because that is the only way they work at all. Everything else
 * downloads.
 *
 * Two exceptions carry the reasoning:
 *
 *   - **SVG never renders inline.** It is a document that can carry script,
 *     and this origin also serves the workspace — an inline SVG would run
 *     there. The application makes the same call.
 *   - **PDF renders inline but sandboxed**, because previewing a PDF without
 *     downloading it is most of the point of attaching one, and the browser's
 *     viewer is the thing being trusted, not the file.
 */
export function disposition(contentType: string): "inline" | "attachment" {
  if (contentType === "image/svg+xml") return "attachment";
  const kind = kindOf(contentType);
  if (kind === "image" || kind === "video" || kind === "audio") return "inline";
  if (contentType === "application/pdf") return "inline";
  return "attachment";
}

/** Extra headers for the types that need holding down when served inline. */
export function hardeningFor(contentType: string): Record<string, string> {
  if (contentType === "application/pdf") {
    // Neuters scripting and navigation inside the viewer without stopping it
    // from painting the document.
    return { "Content-Security-Policy": "sandbox; default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'" };
  }
  if (contentType === "image/svg+xml") {
    return {
      "Content-Security-Policy":
        "default-src 'none'; script-src 'none'; object-src 'none'; connect-src 'none'; img-src 'self'; style-src 'unsafe-inline'",
    };
  }
  return {};
}

/** Whether a kind is worth answering byte ranges for. */
export function seekable(kind: Kind | null): boolean {
  return kind === "video" || kind === "audio";
}
