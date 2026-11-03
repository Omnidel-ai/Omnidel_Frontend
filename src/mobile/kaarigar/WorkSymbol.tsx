import type { ReactNode } from "react";

/**
 * One illustration per trade — ported unchanged from Kaarigar's
 * `components/WorkSymbol.tsx` (PR #207). Kaarigar-only, so it lives with the
 * screens rather than in the shared kit (report §5). It plugs into
 * `TaskCard leading`.
 *
 * The object is the KIND of work; the lane already says the state four other
 * ways. In the app a keyword classifier (`lib/task-category.ts`) picks the
 * category; the demo data names it directly.
 */
export type WorkCategory = "voice" | "planting" | "electrical" | "plumbing" | "labour" | "testing" | "ui" | "dev" | "general";

const TONE: Record<WorkCategory, string> = {
  voice: "var(--terracotta)",
  planting: "var(--green)",
  electrical: "var(--crit)",
  plumbing: "var(--slate)",
  labour: "var(--ochre)",
  testing: "var(--ochre)",
  ui: "var(--slate)",
  dev: "var(--green-deep)",
  general: "var(--ink-mute)",
};

const GLYPH: Record<WorkCategory, (tone: string) => ReactNode> = {
  voice: () => (
    <>
      <rect x="26" y="10" width="12" height="25" rx="6" fill="var(--surface)" />
      <path d="M19 29a13 13 0 0 0 26 0" />
      <path d="M32 42v9M25 51h14" />
      <path d="M30 17h4M30 23h4" opacity=".5" />
    </>
  ),
  planting: () => (
    <>
      <path d="M32 33c-1.5-8-7.5-11.5-14-11 .5 8 6 12 14 11Z" fill="var(--green-soft)" />
      <path d="M32 28c1.2-7 6.4-10.2 12.5-9.8C44 25 39 29 32 28Z" fill="var(--green-soft)" />
      <path d="M32 53V30" />
      <path d="M18 53h28" strokeWidth="3" />
    </>
  ),
  electrical: () => <path d="M36 9 18 37h12l-2 18 18-28H34l2-18Z" fill="var(--ochre-wash)" />,
  plumbing: () => (
    <>
      <path d="M20 16v18" strokeWidth="3" />
      <path d="M20 24h18v9" strokeWidth="3" />
      <path d="M29 24v-7M24 17h10" />
      <rect x="33" y="33" width="10" height="5" rx="2" fill="var(--surface)" />
      <path d="M38 43c-2.8 3.6-4.3 5.9-4.3 7.2a4.3 4.3 0 0 0 8.6 0c0-1.3-1.5-3.6-4.3-7.2Z" fill="var(--surface)" />
    </>
  ),
  labour: () => (
    <>
      <path d="M18 43a14 14 0 0 1 28 0Z" fill="var(--surface)" />
      <path d="M27 43a26 26 0 0 1 1.6-13.4h6.8A26 26 0 0 1 37 43Z" fill="var(--ochre-wash)" />
      <path d="M11 43h42" strokeWidth="3" />
    </>
  ),
  testing: (tone) => (
    <>
      <path d="M26 11v15L16 44a5 5 0 0 0 4.3 7.5h23.4A5 5 0 0 0 48 44L38 26V11" fill="var(--surface)" />
      <path d="M23 11h18" />
      <path d="M20.5 40h23" />
      <circle cx="27" cy="45" r="1.8" fill={tone} stroke="none" />
      <circle cx="35" cy="47" r="1.4" fill={tone} stroke="none" />
    </>
  ),
  ui: (tone) => (
    <>
      <rect x="12" y="15" width="40" height="34" rx="5" fill="var(--surface)" />
      <path d="M12 25h40" />
      <circle cx="19" cy="20" r="1.6" fill={tone} stroke="none" />
      <circle cx="25" cy="20" r="1.6" fill={tone} stroke="none" />
      <path d="M19 33h13M19 41h9" />
      <path d="m41 31 1.9 5.1L48 38l-5.1 1.9L41 45l-1.9-5.1L34 38l5.1-1.9z" fill="var(--green-soft)" />
    </>
  ),
  dev: () => (
    <>
      <rect x="10" y="16" width="44" height="32" rx="5" fill="var(--surface)" />
      <path d="m25 26-7 6 7 6M39 26l7 6-7 6" />
      <path d="M35 23 29 41" />
    </>
  ),
  general: () => (
    <>
      <rect x="16" y="14" width="33" height="39" rx="5" fill="var(--surface)" />
      <rect x="25" y="10" width="15" height="9" rx="3" fill="var(--green-soft)" />
      <path d="m22 29 2 2 4-5M33 29h9m-20 10 2 2 4-5M33 39h9" />
      <path d="M23 47h16" opacity=".4" />
    </>
  ),
};

export function WorkSymbol({ category = "general", size = 48 }: { category?: WorkCategory; size?: number }) {
  const tone = TONE[category] ?? TONE.general;
  return (
    <svg className="mb-symbol" width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <circle cx="32" cy="32" r="30" fill={tone} opacity=".07" />
      <g stroke={tone} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {(GLYPH[category] ?? GLYPH.general)(tone)}
      </g>
    </svg>
  );
}
