"use client";

/**
 * Mobile back control for OmniStudio routes — intentionally removed.
 *
 * On phones the native browser/OS back gesture already returns to the previous
 * screen, so an in-app "← Back" button was redundant. Kept as a no-op so
 * existing call sites (PageHeader) don't need to change; it renders nothing.
 */
export function OmnistudioMobilePageBack() {
  return null;
}
