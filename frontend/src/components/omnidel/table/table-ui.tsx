"use client";

import type { CSSProperties, ReactNode } from "react";
import { useTr } from "@/lib/client/language";

/** Standard row action button — matches Pipeline / Operation Stages / Users. */
export const tableActBtnStyle: CSSProperties = {
  padding: "4px 8px",
  fontSize: 11,
  fontWeight: 500,
  background: "var(--surface-sunk)",
  border: "1px solid var(--rule-strong)",
  borderRadius: "var(--r-sm)",
  cursor: "pointer",
  color: "var(--ink)",
  fontFamily: "var(--sans)",
};

export const tableActBtnDangerStyle: CSSProperties = {
  ...tableActBtnStyle,
  color: "var(--crit)",
};

export const tableActBtnDisabledStyle: CSSProperties = {
  ...tableActBtnStyle,
  opacity: 0.45,
  cursor: "not-allowed",
  color: "var(--ink-mute)",
};

/**
 * Positive variant — Restore, in the admin masters' Archived view. Same shape as
 * the danger variant so an archived row's single button lines up with the
 * Edit / Archive pair it replaces.
 */
export const tableActBtnRestoreStyle: CSSProperties = {
  ...tableActBtnStyle,
  color: "var(--green-deep)",
};

/** Category / type / layout pill — same language as Pipeline Source/Cycle. */
export function CategoryPill({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: "neutral" | "green" | "terra" | "ochre" | "ok" | "crit";
}) {
  const tr = useTr();
  const colors: Record<string, { background: string; color: string }> = {
    neutral: { background: "var(--surface-sunk)", color: "var(--ink-soft)" },
    green: { background: "var(--green-wash)", color: "var(--green-deep)" },
    terra: { background: "var(--terra-wash)", color: "var(--terracotta)" },
    ochre: { background: "var(--ochre-wash)", color: "var(--ochre)" },
    ok: { background: "var(--ok-wash)", color: "var(--ok)" },
    crit: { background: "var(--crit-wash)", color: "var(--crit)" },
  };
  const c = colors[tone] || colors.neutral;
  // No textTransform override: `.tag` is uppercase, and the Pipeline Source /
  // Cycle / health tags this pill is meant to match use the bare class. A
  // `capitalize` override here made layout/type pills the odd ones out — a
  // sentence-case "Carousel" sitting beside an uppercase "PUBLISHED" status.
  return (
    <span className="tag" style={{ background: c.background, color: c.color }}>
      {tr(label)}
    </span>
  );
}

/** Turn `bank_transfer` / `office` into “Bank Transfer” / “Office”. */
export function humanizeSlug(value: string | null | undefined, fallback = "—"): string {
  if (!value || !value.trim()) return fallback;
  return value
    .trim()
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

const HINT_COLORS: Record<string, string> = {
  green: "var(--green-deep)",
  terracotta: "var(--terracotta)",
  terra: "var(--terracotta)",
  ochre: "var(--ochre)",
  ink: "var(--ink)",
  crit: "var(--crit)",
  mute: "var(--ink-mute)",
  ok: "var(--ok)",
  blue: "#3a7ab0",
  teal: "#3ab0a0",
};

/** Map Lead Source icon_hint words (green, ochre, …) to a CSS color. */
export function hintToCssColor(hint: string | null | undefined): string | null {
  if (!hint) return null;
  const key = hint.trim().toLowerCase();
  if (HINT_COLORS[key]) return HINT_COLORS[key];
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(key)) return key;
  return null;
}

export function HintSwatch({ hint }: { hint: string | null }) {
  const color = hintToCssColor(hint);
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <span
        aria-hidden
        style={{
          display: "inline-block",
          width: 14,
          height: 14,
          borderRadius: "50%",
          background: color || "var(--surface-sunk)",
          borderWidth: 1,
          borderStyle: "solid",
          borderColor: "var(--rule-strong)",
          flexShrink: 0,
        }}
      />
      <span style={{ fontSize: 12, color: "var(--ink-mute)" }}>{hint || "—"}</span>
    </span>
  );
}

export function ColorSwatchCell({ color }: { color: string | null }) {
  const tr = useTr();
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <span
        aria-hidden
        style={{
          display: "inline-block",
          width: 16,
          height: 16,
          borderRadius: "50%",
          background: color || "var(--surface-sunk)",
          borderWidth: 1,
          borderStyle: "solid",
          borderColor: "var(--rule-strong)",
          flexShrink: 0,
        }}
      />
      <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-mute)" }}>
        {color || tr("No color")}
      </span>
    </span>
  );
}

export function TableRowActions({
  children,
  nowrap = false,
}: {
  children: ReactNode;
  /** Ads browse rows: Activate / Submit / Delete must stay one line. */
  nowrap?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        gap: 6,
        justifyContent: "flex-end",
        alignItems: "center",
        flexWrap: nowrap ? "nowrap" : "wrap",
        whiteSpace: nowrap ? "nowrap" : undefined,
      }}
    >
      {children}
    </div>
  );
}
