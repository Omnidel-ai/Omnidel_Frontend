import type { ReactElement } from "react";

/**
 * Line icons for the nav, keyed by the `icon` string in demo.json.
 *
 * Kept as inline SVG paths rather than an icon package: the shell needs a
 * dozen glyphs, all 1.5px stroke on `currentColor`, and a dependency for that
 * would be the heaviest thing in this workspace.
 */
const PATHS: Record<string, ReactElement> = {
  home: <path d="M3 10.5 12 3l9 7.5V21H3z" />,
  grid: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </>
  ),
  pulse: <path d="M3 12h4l3-7 4 14 3-7h4" />,
  cart: (
    <>
      <circle cx="9" cy="20" r="1.4" />
      <circle cx="18" cy="20" r="1.4" />
      <path d="M2 3h3l2.4 12h11L21 7H6" />
    </>
  ),
  admin: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" />
    </>
  ),
  book: (
    <>
      <path d="M4 4h7a3 3 0 0 1 3 3v13a2.5 2.5 0 0 0-2.5-2.5H4z" />
      <path d="M20 4h-3a3 3 0 0 0-3 3v13a2.5 2.5 0 0 1 2.5-2.5H20z" />
    </>
  ),
  coin: (
    <>
      <ellipse cx="12" cy="6.5" rx="8" ry="3.5" />
      <path d="M4 6.5v11c0 1.9 3.6 3.5 8 3.5s8-1.6 8-3.5v-11" />
      <path d="M4 12c0 1.9 3.6 3.5 8 3.5s8-1.6 8-3.5" />
    </>
  ),
  bell: (
    <>
      <path d="M18 8a6 6 0 1 0-12 0c0 7-3 8-3 8h18s-3-1-3-8" />
      <path d="M10.3 21a2 2 0 0 0 3.4 0" />
    </>
  ),
  sparkle: <path d="M12 3l1.9 5.6L19.5 10l-5.6 1.9L12 17.5 10.1 11.9 4.5 10l5.6-1.4z" />,
  "chevron-left": <polyline points="15 18 9 12 15 6" />,
  megaphone: (
    <>
      <path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1z" />
      <path d="M15 9a4 4 0 0 1 0 6" />
    </>
  ),
  dot: <circle cx="12" cy="12" r="4" />,
};

export function NavIcon({ name, size = 16 }: { name?: string; size?: number }) {
  const path = name ? PATHS[name] : undefined;
  // A missing key still reserves its slot, so labels stay aligned in a column
  // where only some items carry an icon.
  if (!path) {
    return (
      <span
        aria-hidden="true"
        style={{ width: size, height: size, display: "inline-block", flexShrink: 0 }}
      />
    );
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      {path}
    </svg>
  );
}
