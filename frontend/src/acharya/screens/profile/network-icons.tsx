"use client";

/**
 * The small glyph set the two network tabs share — History and Requests show
 * the same organisations and the same link lifecycle, so an MSME must not be a
 * building on one tab and something else on the other.
 *
 * All 24-viewBox, drawn at 13-17px. Anything finer than a couple of strokes
 * turns to mud at that size, so these are deliberately plain.
 */

import type { CSSProperties, ReactNode } from "react";

function Glyph({ children, size = 13, width = 2 }: {
  children: ReactNode;
  size?: number;
  width?: number;
}) {
  return (
    <svg
      viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor"
      strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" aria-hidden
      style={{ display: "block" }}
    >
      {children}
    </svg>
  );
}

/** The organisation itself. */
export function OrgIcon({ size = 17 }: { size?: number }) {
  return (
    <Glyph size={size} width={1.8}>
      <path d="M4 20V8.5l8-4.5 8 4.5V20" />
      <path d="M3 20h18" />
      <path d="M10 20v-5h4v5" />
    </Glyph>
  );
}

/** Where it is. */
export function PinIcon({ size = 12 }: { size?: number }) {
  return (
    <Glyph size={size} width={2}>
      <path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z" />
      <circle cx="12" cy="10" r="2.5" />
    </Glyph>
  );
}

/** They invited you. */
export function InvitedIcon({ size = 13 }: { size?: number }) {
  return (
    <Glyph size={size}>
      <rect x="3" y="5.5" width="18" height="13" rx="2.5" />
      <path d="m4 7 8 6 8-6" />
    </Glyph>
  );
}

/** You asked them — an arrow leaving. */
export function RequestedIcon({ size = 13 }: { size?: number }) {
  return (
    <Glyph size={size}>
      <path d="M7 17 17 7" />
      <path d="M9.5 7H17v7.5" />
    </Glyph>
  );
}

/** Answered. */
export function RespondedIcon({ size = 13 }: { size?: number }) {
  return <Glyph size={size}><path d="m4.5 12.5 5 5 10-10" /></Glyph>;
}

/** Closed — struck through rather than crossed out: it ended, it did not fail. */
export function EndedIcon({ size = 13 }: { size?: number }) {
  return (
    <Glyph size={size}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M8.5 12h7" />
    </Glyph>
  );
}

/** Nothing waiting. */
export function EmptyInboxIcon({ size = 22 }: { size?: number }) {
  return (
    <Glyph size={size} width={1.7}>
      <path d="M3 13h5l1.5 2.5h5L16 13h5" />
      <path d="M5.5 5.5h13L21 13v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-5Z" />
    </Glyph>
  );
}

export function DeclineIcon({ size = 15 }: { size?: number }) {
  return <Glyph size={size} width={2.1}><path d="M7 7l10 10M17 7 7 17" /></Glyph>;
}

export function AcceptIcon({ size = 15 }: { size?: number }) {
  return <Glyph size={size} width={2.3}><path d="m5 12.5 5 5 9-10" /></Glyph>;
}

export function JoinIcon({ size = 15 }: { size?: number }) {
  return <Glyph size={size} width={2.1}><path d="M12 6v12M6 12h12" /></Glyph>;
}

/** The disc every MSME row leads with. */
export const orgGlyphStyle: CSSProperties = {
  flexShrink: 0,
  width: 34,
  height: 34,
  display: "grid",
  placeItems: "center",
  borderRadius: 10,
  background: "var(--green-wash)",
  color: "var(--green-deep)",
};
