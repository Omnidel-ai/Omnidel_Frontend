"use client";

import { useHScrollThumb } from "@/lib/client/use-h-scroll-thumb";

/**
 * Card-framed data table that scrolls left/right on phones.
 *
 * Drop-in for `<div className="table-wrap">`: pass the `.table-header` and
 * `.table-row` children exactly as before. Desktop renders identically — the
 * viewport is a plain flex column and the rail is display:none. On phones the
 * rows hold `minWidth` and the viewport scrolls, with a drawn rail pinned
 * inside the bottom of the card (the native bar is an overlay that fades out,
 * so it can't advertise the hidden columns while sitting still).
 */
export function TableScroll({
  children,
  minWidth = 640,
}: {
  children: React.ReactNode;
  /** Phone-only floor for the row grid, in px — set it past the point where
   *  the page's columns stop being readable. */
  minWidth?: number;
}) {
  const { viewportRef, thumb } = useHScrollThumb(children);

  return (
    <div className="table-wrap" style={{ "--table-min-w": `${minWidth}px` } as React.CSSProperties}>
      <div ref={viewportRef} className="table-scroll-viewport">
        {children}
      </div>
      <div className="table-scroll-rail" aria-hidden="true">
        <div
          className="table-scroll-thumb"
          style={{
            width: `${thumb.widthPct}%`,
            left: `${thumb.leftPct}%`,
            opacity: thumb.hasOverflow ? 1 : 0.45,
          }}
        />
      </div>
    </div>
  );
}
