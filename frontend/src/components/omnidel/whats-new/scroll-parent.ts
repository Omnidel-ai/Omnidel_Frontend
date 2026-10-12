// UNUSED — Page audit 2026-09-16: nothing in src/ imports this module.
// No importers.
// Deletion candidate. See docs/architecture/page-audit-2026-09-16.md.

/** Dashboard main column scrollport — marked in dashboard-shell.tsx. */
export function getDashboardScrollEl(): HTMLElement | null {
  if (typeof document === "undefined") return null;
  return document.querySelector<HTMLElement>("[data-dashboard-scroll]");
}
