/**
 * How a stored file is served back — the server's half of the media rules.
 *
 * What may be stored, and how large, now lives in `shared/media.ts`, which the
 * browser imports too: the two sides must not disagree about which types are
 * allowed, and the surest way to stop them disagreeing is one table. This file
 * re-exports those facts so the handlers keep one import, and adds the part
 * only a server needs — whether a type is rendered inline or downloaded, and
 * what has to be held down when it is rendered.
 */

export type { Kind } from "../../shared/media.js";
export {
  TYPE_KIND,
  ALL_TYPES,
  EXT_TYPE,
  LIMITS,
  typesOfKind,
  typeForPath,
  kindOfType as kindOf,
} from "../../shared/media.js";

import { kindOfType as kindOf, type Kind } from "../../shared/media.js";

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
