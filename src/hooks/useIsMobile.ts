import { useEffect, useState } from "react";

/** Phone breakpoint — matches the `max-width: 767px` blocks in global.css. */
export const MOBILE_QUERY = "(max-width: 767px)";

/**
 * True on phone-width viewports.
 *
 * Starts false and flips after mount, so a server-rendered or first-paint
 * layout is always the desktop one — the same contract the app's hook has.
 */
export function useIsMobile(query: string = MOBILE_QUERY): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia(query);
    const update = () => setIsMobile(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, [query]);

  return isMobile;
}
