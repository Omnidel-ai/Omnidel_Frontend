"use client";

// UNUSED — Page audit 2026-09-16: nothing in src/ imports this module.
// No importers.
// Deletion candidate. See docs/architecture/page-audit-2026-09-16.md.

import { useHScrollThumb } from "@/lib/client/use-h-scroll-thumb";

/** Horizontal chip/filter row with a persistent scroll rail on mobile. */
export function MobileFilterScroll({ children }: { children: React.ReactNode }) {
  const { viewportRef, thumb } = useHScrollThumb(children);

  return (
    <div className="mobile-h-scroll-shell">
      <div ref={viewportRef} className="mobile-h-scroll-viewport" style={{ display: "flex", gap: 8 }}>
        {children}
      </div>
      <div className="mobile-h-scroll-rail" aria-hidden="true">
        <div
          className="mobile-h-scroll-thumb"
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
