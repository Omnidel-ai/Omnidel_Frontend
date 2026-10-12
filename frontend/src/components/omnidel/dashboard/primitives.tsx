"use client";

import Link from "next/link";
import { useTr } from "@/lib/client/language";

/**
 * Shared admin-dashboard building blocks.
 *
 * These lived inside admin/dashboard/page.tsx while that file was a single
 * 730-line screen, and `SectionHeader` plus a near-copy of `StatCard` called
 * `Stat` were duplicated again in dashboard/users/[userId]/page.tsx. Now that
 * the dashboard is five tab files and a drill-down page, they are shared.
 *
 * Appearance is unchanged from the originals — this was a move, not a redesign.
 */

/** Filled hero tile. Reserved for the handful of numbers that lead a screen. */
export function SummaryCard({
  label, value, bg, sub, href,
}: {
  label: string; value: number | string; bg: string; sub?: string;
  /** When set the tile links to the rows behind the number. */
  href?: string;
}) {
  const tr = useTr();
  const inner = (
    <>
      <div style={{
        fontFamily: "var(--mono)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase",
        color: "var(--surface)", opacity: 0.75, marginBottom: 8,
        display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8,
      }}>
        <span>{tr(label)}</span>
        {href && <span aria-hidden style={{ fontSize: 11, opacity: 0.85 }}>→</span>}
      </div>
      <div style={{ fontFamily: "var(--serif)", fontSize: 34, fontWeight: 400, color: "var(--surface)", lineHeight: 1.1 }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--surface)", opacity: 0.6, marginTop: 6 }}>
          {sub}
        </div>
      )}
    </>
  );

  const style: React.CSSProperties = {
    background: bg, borderRadius: "var(--r-md)", padding: "var(--card-pad)", minWidth: 0,
    display: "block", textDecoration: "none", color: "inherit",
  };

  if (href) {
    return (
      <Link href={href} style={style} className="dash-hero-card-link">
        {inner}
      </Link>
    );
  }
  return <div style={style}>{inner}</div>;
}

/**
 * Section heading. `sub` should name the time window every time — an unlabelled
 * number next to a labelled one is how a dashboard misleads.
 */
export function SectionHeader({ label, sub }: { label: string; sub?: string }) {
  const tr = useTr();
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 10 }}>
      <h3 style={{ fontFamily: "var(--serif)", fontSize: 16, fontWeight: 500 }}>{tr(label)}</h3>
      {sub && <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-mute)", letterSpacing: "0.08em", textTransform: "uppercase" }}>{tr(sub)}</span>}
    </div>
  );
}

/** The workhorse metric tile. Becomes a link when `href` is set. */
export function StatCard({
  label, value, bg, accent, abbr, note, href, linkLabel, onClick, active,
}: {
  label: string;
  value: number | string;
  bg: string;
  accent: string;
  /** Shown under the full name, never instead of it. */
  abbr?: string;
  note?: string;
  /** When set, the whole card links to a drill-down. */
  href?: string;
  /** Overrides the "View names" affordance text for non-people drill-downs. */
  linkLabel?: string;
  /**
   * When set (and `href` is not), the card becomes a toggle button instead of
   * a link — for a drill-down that opens IN PLACE (a filtered list on the same
   * page) rather than navigating away, e.g. Chat Sentiment's Positive/Neutral/
   * Negative/Needs Review cards each opening their own conversation list.
   * `href` wins if both are somehow given.
   */
  onClick?: () => void;
  /** Highlights the card (thicker accent border) while its drill-down is open. */
  active?: boolean;
}) {
  const tr = useTr();
  const inner = (
    <>
      <div style={{ fontFamily: "var(--mono)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: accent, marginBottom: abbr ? 2 : 6, lineHeight: 1.35 }}>
        {label}
      </div>
      {abbr && (
        <div style={{ fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.08em", color: "var(--ink-mute)", marginBottom: 5 }}>
          {abbr}
        </div>
      )}
      <div style={{ fontFamily: "var(--serif)", fontSize: 28, fontWeight: 400, color: accent, lineHeight: 1.15 }}>{value}</div>
      {note && (
        <div style={{ fontSize: 10, color: "var(--ink-mute)", marginTop: 6, lineHeight: 1.4 }}>{note}</div>
      )}
      {href && (
        <div style={{ fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--ink-mute)", marginTop: 6 }}>
          {linkLabel || tr("View names")}
        </div>
      )}
      {!href && onClick && (
        <div style={{ fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--ink-mute)", marginTop: 6 }}>
          {active ? tr("Hide conversations") : tr("View conversations")}
        </div>
      )}
    </>
  );

  const style: React.CSSProperties = {
    background: bg,
    border: active ? `2px solid ${accent}` : "1px solid var(--rule)",
    borderRadius: "var(--r-md)",
    padding: "var(--card-pad)",
    textDecoration: "none",
    color: "inherit",
    display: "block",
    cursor: href || onClick ? "pointer" : "default",
    transition: href || onClick ? "border-color .15s, box-shadow .15s" : undefined,
  };

  if (href) {
    return (
      <Link href={href} style={style} className="dash-stat-card-link">
        {inner}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-pressed={active}
        style={{ ...style, width: "100%", textAlign: "left", font: "inherit" }}
        className="dash-stat-card-link"
      >
        {inner}
      </button>
    );
  }

  return <div style={style}>{inner}</div>;
}

/**
 * "View all →" for a panel that shows only part of its data.
 *
 * Lives in `ChartFrame`'s `right` slot, which had no callers before this. Pair it
 * with a `sub` that states the cap ("top 8"): a truncated list that does not admit
 * it is the most common way a dashboard lies, because the reader has no way to
 * tell a short list from a capped one.
 */
export function ViewAllLink({ href, label = "View all" }: { href: string; label?: string }) {
  return (
    <Link
      href={href}
      className="dash-view-all"
      style={{
        fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.06em", textTransform: "uppercase",
        color: "var(--green-deep)", textDecoration: "none", whiteSpace: "nowrap", flexShrink: 0,
      }}
    >
      {label} →
    </Link>
  );
}

/** Label + value with no card chrome, for use inside a card's body. */
export function MiniStat({
  label, value, color,
}: {
  label: string; value: number | string; color: string;
}) {
  return (
    <div>
      <div style={{ fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--ink-mute)", marginBottom: 2 }}>{label}</div>
      <div style={{ fontFamily: "var(--serif)", fontSize: 20, fontWeight: 400, color }}>{value}</div>
    </div>
  );
}

export const cardStyle: React.CSSProperties = {
  background: "var(--surface)", border: "1px solid var(--rule)", borderRadius: "var(--r-md)",
};

export const cardHeaderStyle: React.CSSProperties = {
  padding: "10px 16px", fontFamily: "var(--mono)", fontSize: 10, letterSpacing: "0.1em",
  textTransform: "uppercase", color: "var(--ink-mute)", borderBottom: "1px solid var(--rule)", fontWeight: 600,
};

export function rowStyle(divider: boolean): React.CSSProperties {
  return {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "8px 16px", gap: 12,
    borderBottom: divider ? "1px solid var(--rule)" : "none",
  };
}

/**
 * Skeleton rows for a loading panel. Product rule: hold the layout while data
 * arrives rather than dropping a spinner over content that is about to shift.
 */
export function PanelSkeleton({ rows = 3, height = 64 }: { rows?: number; height?: number }) {
  return (
    <div aria-hidden style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          style={{
            height,
            background: "var(--surface-sunk)",
            border: "1px solid var(--rule)",
            borderRadius: "var(--r-md)",
            opacity: 1 - i * 0.18,
          }}
        />
      ))}
    </div>
  );
}
