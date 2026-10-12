/**
 * Decorative + glyph SVG for the Report tab.
 *
 * Everything here is presentation only (`aria-hidden`) — the card text carries
 * the meaning. Colours come from `currentColor` or palette tokens so a tile can
 * be re-toned by setting `color` on its wrapper, and nothing hard-codes hex.
 */

/** Soft crest that fills the bottom of a KPI tile. Sits behind value + label. */
export function TileWave({ tint }: { tint: string }) {
  return (
    <svg
      viewBox="0 0 120 40"
      preserveAspectRatio="none"
      aria-hidden
      style={{ position: "absolute", left: 0, right: 0, bottom: 0, width: "100%", height: 38 }}
    >
      <path
        d="M0 22c14-13 32-16 48-8s34 12 52 1c8-4 14-9 20-14v39H0z"
        fill={tint}
      />
    </svg>
  );
}

export function CheckCircleIcon({ size = 19 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M8.2 12.4l2.6 2.6 5-5.4" />
    </svg>
  );
}

export function StarIcon({ size = 19 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3.6l2.6 5.4 5.9.8-4.3 4.2 1 5.9-5.2-2.8-5.2 2.8 1-5.9L3.5 9.8l5.9-.8z" />
    </svg>
  );
}

export function BriefcaseIcon({ size = 19 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="7.5" width="18" height="12.5" rx="2.5" />
      <path d="M9 7.5V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1.5" />
      <path d="M3 12.5h18" />
    </svg>
  );
}

export function ClockIcon({ size = 17 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3.5 9.5A9 9 0 1 1 3 13" />
      <path d="M3 4.5v5h5" />
      <path d="M12 8v4.3l3 1.8" />
    </svg>
  );
}

export function EnvelopeIcon({ size = 19 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
      <path d="M3.2 6.5l8.8 6.3 8.8-6.3" />
    </svg>
  );
}

export function DocumentIcon({ size = 19 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M14 3.5H7a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8.5z" />
      <path d="M14 3.5v5h5" />
      <path d="M8.8 13h6.4M8.8 16.4h4.4" />
    </svg>
  );
}

export function ArrowRightIcon({ size = 18 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

/** Three sparkles for the top-right of the "complete your profile" nudge. */
export function Sparkles() {
  return (
    <svg
      viewBox="0 0 44 34"
      aria-hidden
      style={{ position: "absolute", top: 8, right: 62, width: 44, height: 34, opacity: 0.5, pointerEvents: "none" }}
    >
      <g fill="var(--ochre)">
        <path d="M14 2l1.6 4.4L20 8l-4.4 1.6L14 14l-1.6-4.4L8 8l4.4-1.6z" />
        <path d="M31 12l1.1 3 3 1.1-3 1.1-1.1 3-1.1-3-3-1.1 3-1.1z" opacity="0.75" />
        <path d="M22 23l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z" opacity="0.55" />
      </g>
    </svg>
  );
}

/**
 * Empty-task-history illustration: a checklist on a clipboard with a plant
 * beside it. Reads as "your record starts here", not as an error state.
 */
export function ChecklistArt({ width = 96 }: { width?: number }) {
  return (
    <svg
      viewBox="0 0 120 108"
      width={width}
      height={width * (108 / 120)}
      aria-hidden
      style={{ flexShrink: 0, alignSelf: "flex-start" }}
    >
      {/* ground shadow */}
      <ellipse cx="60" cy="101" rx="52" ry="5" fill="var(--ochre-wash)" opacity="0.4" />

      {/* clipboard body */}
      <rect
        x="10" y="14" width="64" height="83" rx="9"
        fill="var(--surface)" stroke="var(--rule)" strokeWidth="2"
      />
      {/* clip */}
      <rect x="30" y="7" width="24" height="13" rx="5" fill="var(--ochre-wash)" stroke="var(--rule)" strokeWidth="2" />

      {/* three check rows */}
      <g stroke="var(--rule)" strokeWidth="2" fill="none">
        <rect x="20" y="34" width="12" height="12" rx="3.5" />
        <rect x="20" y="54" width="12" height="12" rx="3.5" />
        <rect x="20" y="74" width="12" height="12" rx="3.5" />
      </g>
      <g stroke="var(--green)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <path d="M22.8 40.2l2.6 2.6 4.4-5" />
        <path d="M22.8 60.2l2.6 2.6 4.4-5" />
        <path d="M22.8 80.2l2.6 2.6 4.4-5" />
      </g>
      <g stroke="var(--rule)" strokeWidth="3" strokeLinecap="round">
        <path d="M39 40h25M39 60h25M39 80h18" />
      </g>

      {/* potted plant */}
      <path
        d="M82 78h30l-3.6 18a4 4 0 0 1-4 3.2h-14.8a4 4 0 0 1-4-3.2z"
        fill="var(--terra-wash)" stroke="var(--terra-soft)" strokeWidth="2"
      />
      <path d="M80.5 73.5h33a2.5 2.5 0 0 1 0 5h-33a2.5 2.5 0 0 1 0-5z" fill="var(--terra-soft)" />
      <g stroke="var(--green)" strokeWidth="2.2" fill="none" strokeLinecap="round">
        <path d="M97 73V50" />
        <path d="M97 60c-7 0-11-4-11-9 6-1 11 3 11 9z" fill="var(--green-soft)" />
        <path d="M97 66c7 0 12-4 12-10-7-1-12 3-12 10z" fill="var(--green-soft)" />
        <path d="M97 52c-4-3-4-8-1-11 4 2 5 7 1 11z" fill="var(--green-soft)" />
      </g>
    </svg>
  );
}
