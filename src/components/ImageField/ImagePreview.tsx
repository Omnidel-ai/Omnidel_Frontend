import { useEffect, useState } from "react";
import { blobViewUrl } from "../../lib/blob";
import { initials } from "../Avatar";

export interface ImagePreviewProps {
  /** A blob URL, a stored key, or nothing. Private ones are proxied for you. */
  src?: string | null;
  /** Used for the initials when there is no image, and for the alt text. */
  name?: string;
  size?: number;
  /** Square with a small radius, or a circle. */
  shape?: "square" | "circle";
  className?: string;
}

/**
 * An image with somewhere to stand before and instead of itself.
 *
 * Three states, and the reason this is a component rather than an `<img>`:
 *
 *   - **loading** — the box holds its size and shimmers, so a row of portraits
 *     does not reflow as each one arrives;
 *   - **loaded** — the image, cropped to fill;
 *   - **nothing, or failed** — the person's initials. A private blob whose
 *     session has lapsed fails exactly like a missing one, and neither is worth
 *     a broken-image glyph.
 *
 * `src` may be a full URL or a stored key; private keys are routed through the
 * view function, because a private blob cannot be loaded any other way.
 */
export function ImagePreview({
  src,
  name = "",
  size = 88,
  shape = "square",
  className,
}: ImagePreviewProps) {
  const url = blobViewUrl(src);
  const [state, setState] = useState<"idle" | "loading" | "ok" | "failed">(
    url ? "loading" : "idle",
  );

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
              // Held back until it has actually decoded, so the skeleton is
              // never seen through a half-painted image.
              opacity: state === "ok" ? 1 : 0,
              transition: "opacity 140ms ease",
            }}
          />
        </>
      )}
    </div>
  );
}
