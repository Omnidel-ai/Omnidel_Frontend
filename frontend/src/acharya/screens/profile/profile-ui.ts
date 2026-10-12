import { DEFAULT_DATE_LOCALE } from "@/acharya/lib/i18n/registry";
import type { CSSProperties } from "react";

// Shared style constants + formatting helpers for the /profile tab surface.
// Everything token-based (globals.css); no hex except the cream-on-green rule.

export function initialsFor(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? `${parts[0][0]}${parts[1][0]}` : (parts[0]?.slice(0, 2) || "K");
  return letters.toUpperCase();
}

export function formatScore(score: number | string | null | undefined) {
  const value = typeof score === "string" ? Number(score) : score;
  if (typeof value !== "number" || Number.isNaN(value)) return "-";
  // Canonical store is 0–1 (e.g. 0.88). Legacy rows may already be 0–10.
  const outOfTen = value > 1 ? value : value * 10;
  const rounded = Math.round(outOfTen * 10) / 10;
  return `${rounded.toFixed(1)}/10`;
}

export function formatDate(
  value: string | null | undefined,
  /**
   * `year: false` drops the year — for a list where every date shares one and
   * printing it on each is repetition, not information. Through Intl rather
   * than by trimming the formatted string, which would not survive hi/bn.
   */
  opts?: { locale?: string; empty?: string; year?: boolean },
) {
  const empty = opts?.empty ?? "—";
  if (!value) return empty;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return empty;
  const parts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
  if (opts?.year !== false) parts.year = "numeric";
  return date.toLocaleDateString(opts?.locale ?? DEFAULT_DATE_LOCALE, parts);
}

/** The year a stored date falls in, or null when it is missing or unparseable. */
export function yearOf(value: string | null | undefined): number | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.getFullYear();
}

export function statusBadgeStyle(status: string): CSSProperties {
  const base: CSSProperties = {
    flexShrink: 0,
    borderRadius: "var(--r-sm)",
    borderWidth: 1,
    borderStyle: "solid",
    fontFamily: "var(--mono)",
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: "0.08em",
    padding: "5px 8px",
    textTransform: "uppercase",
  };
  if (status === "active") {
    return { ...base, borderColor: "var(--ok-wash)", background: "var(--ok-wash)", color: "var(--ok)" };
  }
  if (status === "invited" || status === "requested") {
    return { ...base, borderColor: "var(--ochre-wash)", background: "var(--ochre-wash)", color: "var(--ochre)" };
  }
  return { ...base, borderColor: "var(--rule)", background: "var(--surface-sunk)", color: "var(--ink-mute)" };
}

// Every panel on /profile shares the soft radius — the Report tab's tinted
// cards sit behind sibling tabs, so a 4px panel next door would read as a
// different app. `panelStyle` is profile-only; nothing else picks this up.
export const panelStyle: CSSProperties = {
  padding: 14,
  borderRadius: "var(--r-xl)",
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "var(--rule)",
  background: "var(--surface)",
  marginBottom: 12,
};

export const eyebrowStyle: CSSProperties = {
  fontFamily: "var(--mono)",
  fontSize: 10,
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  color: "var(--ink-mute)",
  margin: 0,
};

export const panelHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 12,
  marginBottom: 12,
};

export const panelTitleStyle: CSSProperties = {
  fontSize: 16,
  fontWeight: 750,
  color: "var(--ink)",
  margin: "2px 0 0",
};

export const emptyTextStyle: CSSProperties = {
  color: "var(--ink-mute)",
  fontSize: 13,
  margin: "8px 0 0",
};

export const bodyTextStyle: CSSProperties = {
  color: "var(--ink-soft)",
  fontSize: 14,
  lineHeight: 1.55,
  margin: "8px 0 0",
};

export const errorTextStyle: CSSProperties = {
  color: "var(--crit)",
  fontSize: 13,
  margin: 0,
};

export const loadingRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  fontSize: 13,
  color: "var(--ink-soft)",
};

export const spinnerStyle: CSSProperties = {
  width: 18,
  height: 18,
  borderRadius: "50%",
  borderWidth: 2,
  borderStyle: "solid",
  borderColor: "var(--green)",
  borderTopColor: "transparent",
  animation: "spin 0.7s linear infinite",
};

export const listStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 9,
  marginTop: 10,
};

export const listRowStyle: CSSProperties = {
  borderTopWidth: 1,
  borderTopStyle: "solid",
  borderTopColor: "var(--rule)",
  paddingTop: 9,
};

export const listTitleStyle: CSSProperties = {
  color: "var(--ink)",
  fontSize: 14,
  fontWeight: 750,
  margin: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

export const listMetaStyle: CSSProperties = {
  color: "var(--ink-mute)",
  fontSize: 12,
  margin: "3px 0 0",
  lineHeight: 1.35,
};

export const summaryStyle: CSSProperties = {
  color: "var(--ink-soft)",
  fontSize: 13,
  margin: "5px 0 0",
  lineHeight: 1.45,
};

export const detailRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 12,
  borderTopWidth: 1,
  borderTopStyle: "solid",
  borderTopColor: "var(--rule)",
  padding: "10px 0 0",
  marginTop: 10,
};

export const detailLabelStyle: CSSProperties = {
  fontFamily: "var(--mono)",
  fontSize: 10,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: "var(--ink-mute)",
  flexShrink: 0,
};

export const detailValueStyle: CSSProperties = {
  fontSize: 13,
  color: "var(--ink-soft)",
  textAlign: "right",
  overflowWrap: "anywhere",
};

export const identityCardStyle: CSSProperties = {
  display: "flex",
  gap: 12,
  alignItems: "center",
  padding: 14,
  borderRadius: "var(--r-xl)",
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "var(--rule)",
  background: "var(--ochre-wash)",
  boxShadow: "var(--shadow-md)",
  marginBottom: 12,
};

export const avatarStyle: CSSProperties = {
  width: 60,
  height: 60,
  borderRadius: "50%",
  backgroundColor: "var(--green-deep)",
  color: "#f4efdf",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontFamily: "var(--serif)",
  fontSize: 22,
  fontStyle: "italic",
  flexShrink: 0,
};

export const nameStyle: CSSProperties = {
  fontFamily: "var(--serif)",
  fontStyle: "italic",
  fontSize: 20,
  fontWeight: 500,
  color: "var(--ink)",
  margin: 0,
  lineHeight: 1.2,
};

export const metaStyle: CSSProperties = {
  fontSize: 13,
  color: "var(--ink-soft)",
  margin: "2px 0 0",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

// ID and role share one row on the identity card. The ID never truncates — an
// ellipsised slug ("ID · shi…") identifies nobody, so a long one wraps instead.
export const profileIdStyle: CSSProperties = {
  fontFamily: "var(--mono)",
  color: "var(--ink-mute)",
  fontSize: 11,
  margin: 0,
  fontWeight: 700,
  minWidth: 0,
  overflowWrap: "anywhere",
};

export const profileRoleStyle: CSSProperties = {
  fontFamily: "var(--mono)",
  color: "var(--green-deep)",
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  flexShrink: 0,
  whiteSpace: "nowrap",
};

export const pillRowStyle: CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  marginTop: 7,
};

export const rolePillStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: 26,
  padding: "0 9px",
  borderRadius: "var(--r-sm)",
  background: "var(--surface)",
  color: "var(--green-deep)",
  fontFamily: "var(--mono)",
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

export const adminPillStyle: CSSProperties = {
  ...rolePillStyle,
  background: "var(--crit-wash)",
  color: "var(--crit)",
};

export const statsGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: 10,
  marginBottom: 12,
};

/* ── Report-tab tones ──────────────────────────────────────────────────────
 * The three KPIs and the two nudge cards below them each carry one hue, so a
 * karigar can tell them apart at a glance without reading the labels. Slate is
 * the only cool hue in the palette and belongs to "jobs done" — the one metric
 * that comes from the MSME side rather than from work with an Acharya.
 * ────────────────────────────────────────────────────────────────────────── */
export type ReportTone = "green" | "ochre" | "slate";

const TONES: Record<ReportTone, { ink: string; wash: string }> = {
  green: { ink: "var(--green)", wash: "var(--green-wash)" },
  ochre: { ink: "var(--ochre)", wash: "var(--ochre-wash)" },
  slate: { ink: "var(--slate)", wash: "var(--slate-wash)" },
};

export function toneInk(tone: ReportTone) {
  return TONES[tone].ink;
}

/** Tile / card fill — the tone's wash thinned into the surface so text stays AA. */
function toneFill(tone: ReportTone, pct: number) {
  return `color-mix(in srgb, ${TONES[tone].wash} ${pct}%, var(--surface))`;
}

export function statTileStyleFor(tone: ReportTone): CSSProperties {
  return {
    position: "relative",
    overflow: "hidden",
    minHeight: 118,
    borderRadius: "var(--r-xl)",
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: `color-mix(in srgb, ${TONES[tone].wash} 75%, var(--rule))`,
    background: toneFill(tone, 34),
    padding: 12,
    display: "flex",
    flexDirection: "column",
  };
}

/** Round glyph chip at the top of a KPI tile / on a nudge card. */
export function toneBadgeStyle(tone: ReportTone, size = 36): CSSProperties {
  return {
    position: "relative",
    width: size,
    height: size,
    borderRadius: "50%",
    background: toneFill(tone, 88),
    color: TONES[tone].ink,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  };
}

/** Wave tint — faint enough that the value on top of it keeps full contrast. */
export function toneWaveTint(tone: ReportTone) {
  return `color-mix(in srgb, ${TONES[tone].ink} 13%, transparent)`;
}

export const statValueStyle: CSSProperties = {
  position: "relative",
  color: "var(--ink)",
  fontSize: 26,
  fontWeight: 800,
  letterSpacing: "-0.02em",
  margin: 0,
  lineHeight: 1.05,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

export const statLabelStyle: CSSProperties = {
  position: "relative",
  color: "var(--ink-mute)",
  fontFamily: "var(--mono)",
  fontSize: 10,
  margin: "5px 0 0",
  textTransform: "uppercase",
  fontWeight: 700,
  letterSpacing: "0.08em",
  lineHeight: 1.25,
};

/**
 * Nudge card ("complete your profile", "report sheet") — a soft tinted panel
 * with the tone as a solid bar down its left edge, so the two stack without
 * either looking like an error.
 */
export function accentCardStyle(tone: ReportTone): CSSProperties {
  return {
    position: "relative",
    overflow: "hidden",
    width: "100%",
    display: "flex",
    alignItems: "center",
    gap: 12,
    textAlign: "left",
    padding: "14px 14px 14px 13px",
    borderRadius: "var(--r-xl)",
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: `color-mix(in srgb, ${TONES[tone].wash} 75%, var(--rule))`,
    borderLeftWidth: 5,
    borderLeftColor: TONES[tone].ink,
    background: toneFill(tone, 30),
    color: "var(--ink)",
    marginBottom: 12,
  };
}

export const accentTitleStyle: CSSProperties = {
  display: "block",
  fontSize: 16,
  fontWeight: 750,
  color: "var(--ink)",
  lineHeight: 1.25,
};

export const accentBodyStyle: CSSProperties = {
  display: "block",
  fontSize: 13,
  color: "var(--ink-soft)",
  marginTop: 4,
  lineHeight: 1.4,
};

/** Dark-green square affordance on the right of a nudge card. */
export const accentActionStyle: CSSProperties = {
  width: 44,
  height: 44,
  borderRadius: "var(--r-xl)",
  background: "var(--green-deep)",
  color: "#f4efdf",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
};

export const btnPrimaryStyle: CSSProperties = {
  minHeight: 48,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  padding: "0 16px",
  borderRadius: "var(--r-md)",
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "var(--green-deep)",
  background: "var(--green-deep)",
  color: "#f4efdf",
  fontSize: 14,
  fontWeight: 750,
  cursor: "pointer",
};

export const btnSecondaryStyle: CSSProperties = {
  minHeight: 48,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  padding: "0 16px",
  borderRadius: "var(--r-md)",
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "var(--rule-strong)",
  background: "var(--surface)",
  color: "var(--ink)",
  fontSize: 14,
  fontWeight: 750,
  cursor: "pointer",
};

export const formLabelStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: "var(--ink-soft)",
};

export const formInputStyle: CSSProperties = {
  boxSizing: "border-box",
  width: "100%",
  minHeight: 48,
  padding: "14px 16px",
  borderRadius: "var(--r-md)",
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "var(--rule)",
  background: "var(--surface)",
  boxShadow: "var(--shadow-sm)",
  color: "var(--ink)",
  fontSize: 16,
  fontFamily: "var(--sans)",
};

export const logoutButtonStyle: CSSProperties = {
  width: "100%",
  minHeight: 48,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  borderRadius: "var(--r-md)",
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "var(--crit)",
  background: "var(--crit)",
  color: "var(--surface)",
  fontSize: 14,
  fontWeight: 750,
  cursor: "pointer",
  marginTop: 12,
};
