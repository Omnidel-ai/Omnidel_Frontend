import { useEffect, useRef, useState } from "react";

export interface ScrollThumb {
  widthPct: number;
  leftPct: number;
  hasOverflow: boolean;
}

/**
 * Drives a drawn horizontal scroll rail for a scrollable viewport.
 *
 * Needed because iOS hides its overlay scrollbar once the scroll stops, so a
 * table wider than the screen gives no sign that there are more columns. The
 * rail is phone-only in CSS; on desktop the native bar is left alone.
 *
 * `deps` re-measures when the content changes (rows loaded, filter applied).
 */
export function useHScrollThumb(deps?: unknown): {
  viewportRef: React.RefObject<HTMLDivElement | null>;
  thumb: ScrollThumb;
} {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [thumb, setThumb] = useState<ScrollThumb>({
    widthPct: 100,
    leftPct: 0,
    hasOverflow: false,
  });

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    function measure() {
      const node = viewportRef.current;
      if (!node) return;
      const { scrollWidth, clientWidth, scrollLeft } = node;
      const hasOverflow = scrollWidth > clientWidth + 1;
      const widthPct = hasOverflow ? (clientWidth / scrollWidth) * 100 : 100;
      const leftPct = hasOverflow ? (scrollLeft / scrollWidth) * 100 : 0;
      setThumb({ widthPct, leftPct, hasOverflow });
    }

    measure();
    el.addEventListener("scroll", measure, { passive: true });
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    window.addEventListener("resize", measure);

    return () => {
      el.removeEventListener("scroll", measure);
      ro?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [deps]);

  return { viewportRef, thumb };
}
