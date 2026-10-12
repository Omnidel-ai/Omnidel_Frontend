import { useEffect, useState } from "react";
import { initials } from "../Avatar";

export interface PrivateImageProps {
  /**
   * What the record actually stores — a key, an id, a blob URL.
   *
   * Never used as a `src` directly: what a record holds and what a browser can
   * load are different things for a private file, and conflating them is how a
   * private image ends up rendered as a broken one.
   */
  fileId?: string | null;
  /**
   * Turns that into something loadable.
   *
   * A prop rather than an import: the same picture resolves through the view
   * proxy in the application, through a mock in the playground, and through a
   * signed URL if that is ever what the store hands out. The component should
   * not have to know which.
   */
  resolveUrl: (fileId: string) => string;
  /** For the initials when there is nothing, and for the alt text. */
  name?: string;
  size?: number;
  shape?: "square" | "circle";
  className?: string;
}

/**
 * A private image, rendered through whatever can address it.
 *
 * Three states, and the reason it is a component rather than an `<img>`:
 *
 *   - **loading** — the box holds its size and shimmers, so a row of portraits
 *     does not reflow as each one arrives;
 *   - **loaded** — the image, cropped to fill;
 *   - **nothing, or failed** — the initials. A private file whose session has
 *     lapsed fails exactly like a missing one, and neither is worth a
 *     broken-image glyph.
 */
export function PrivateImage({
  fileId,
  resolveUrl,
  name = "",
  size = 88,
  shape = "square",
  className,
}: PrivateImageProps) {
  const url = fileId ? resolveUrl(fileId) : "";
  const [state, setState] = useState<"idle" | "loading" | "ok" | "failed">(url ? "loading" : "idle");

  useEffect(() => {
    setState(url ? "loading" : "idle");
  }, [url]);

  const radius = shape === "circle" ? "50%" : "var(--r-md)";

  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        border: "1px solid var(--rule)",
        background: "var(--surface-sunk)",
        overflow: "hidden",
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        fontFamily: "var(--serif)",
        fontSize: Math.max(13, Math.round(size * 0.27)),
        fontWeight: 600,
        color: "var(--ink-mute)",
      }}
    >
      {state === "idle" || state === "failed" ? (
        <span aria-hidden={Boolean(name)}>{initials(name) || "?"}</span>
      ) : (
        <>
          {state === "loading" && (
            <span
              className="skeleton-bar"
              aria-hidden="true"
              style={{ position: "absolute", inset: 0, height: "auto", borderRadius: radius }}
            />
          )}
          <img
            src={url}
            alt={name ? `${name}'s picture` : ""}
            onLoad={() => setState("ok")}
            onError={() => setState("failed")}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              // Held back until it has decoded, so the skeleton is never seen
              // through a half-painted image.
              opacity: state === "ok" ? 1 : 0,
              transition: "opacity 140ms ease",
            }}
          />
        </>
      )}
    </div>
  );
}
