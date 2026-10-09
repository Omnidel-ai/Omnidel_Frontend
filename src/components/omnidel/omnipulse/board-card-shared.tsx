"use client";

import type { CSSProperties } from "react";
import { useTr } from "@/lib/client/language";

// ============================================================================
// Shared presentational bits for the OmniPulse boards landing card grids.
// Extracted out of boards/page.tsx (a server component) so the two client
// grid components (teams-grid, projects-grid) can render identical cards while
// owning their own search + action menus. Pure presentation — no data fetch,
// no server-only imports.
// ============================================================================

export interface BoardTaskCounts {
  cards: number;
  total: number;
  done: number;
  doing: number;
  todo: number;
}

export function dotColorVar(color: string | null | undefined): string {
  if (!color) return "var(--ink-mute)";
  if (/^#[0-9a-fA-F]{3,8}$/.test(color)) return color;
  return "var(--ink-mute)";
}

// Small inline people glyph for the "N members" meta (no emoji per UI rules).
export function PeopleIcon() {
  return (
    <svg
      width="13" height="13" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      style={{ display: "block", flexShrink: 0 }}
      aria-hidden="true"
    >
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

// One-line "N projects · (people) N members" meta.
export function CardCountsMeta({ projects, members }: { projects: number; members: number }) {
  const tr = useTr();
  return (
    <div style={metaRowStyle}>
      <span>{projects} {tr(projects === 1 ? "project" : "projects")}</span>
      <span style={{ opacity: 0.5 }}>·</span>
      <span style={memberChipStyle}>
        <PeopleIcon />
        {members} {tr(members === 1 ? "member" : "members")}
      </span>
    </div>
  );
}

// Per-board task progress footer: a thin done/doing/todo bar + a counts line.
export function BoardTaskStatus({ counts }: { counts?: BoardTaskCounts }) {
  const tr = useTr();
  const c = counts ?? { cards: 0, total: 0, done: 0, doing: 0, todo: 0 };
  const cardsLabel = `${c.cards} card${c.cards === 1 ? "" : "s"}`;
  if (c.total === 0) {
    return (
      <div style={taskStatusEmptyStyle}>
        {cardsLabel} {tr("· No tasks yet")}
      </div>
    );
  }
  const pct = (n: number) => `${(n / c.total) * 100}%`;
  return (
    <div style={taskStatusWrapStyle}>
      <div style={taskBarTrackStyle} aria-hidden="true">
        {c.done > 0 && <span style={{ width: pct(c.done), background: "var(--green-deep)" }} />}
        {c.doing > 0 && <span style={{ width: pct(c.doing), background: "var(--ochre)" }} />}
        {c.todo > 0 && <span style={{ width: pct(c.todo), background: "var(--rule)" }} />}
      </div>
      {/* Line 1 — cards · tasks summary */}
      <div style={taskStatusLine1Style}>
        <span>{cardsLabel}</span>
        <span style={{ opacity: 0.5 }}>·</span>
        <span>{c.total} task{c.total === 1 ? "" : "s"}</span>
      </div>
      {/* Line 2 — status breakdown (planned / doing / done) */}
      <div style={taskStatusCountsStyle}>
        <span style={taskDotStyle}>
          <i style={{ ...statusDotStyle, background: "var(--green-deep)" }} />
          {c.done} done
        </span>
        <span style={taskDotStyle}>
          <i style={{ ...statusDotStyle, background: "var(--ochre)" }} />
          {c.doing} doing
        </span>
        <span style={taskDotStyle}>
          <i style={{ ...statusDotStyle, background: "var(--ink-mute)" }} />
          {c.todo} planned
        </span>
      </div>
    </div>
  );
}

// ── Search box (debounced) ───────────────────────────────────────────────
// Reuses TableControls' search-input visual pattern but is local so the grids
// can own debounced client-side filtering without a server round-trip.
export function GridSearchBox({ value, onChange, placeholder }: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div style={{ position: "relative", maxWidth: 280, width: "100%" }}>
      <svg
        width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--ink-mute)"
        strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
        style={{ position: "absolute", left: 10, top: 10 }}
      >
        <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
      </svg>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || "Search..."}
        style={{
          width: "100%", padding: "8px 12px 8px 32px", fontSize: 13,
          background: "var(--surface)", border: "1px solid var(--rule)",
          borderRadius: "var(--r-sm)", color: "var(--ink)",
          outline: "none", fontFamily: "var(--sans)", boxSizing: "border-box",
        }}
      />
    </div>
  );
}

export function NoMatchState({ children }: { children: React.ReactNode }) {
  return (
    <div style={emptyStateStyle}>
      <div style={{ fontSize: 14, color: "var(--ink-soft)" }}>{children}</div>
    </div>
  );
}

// ── Style constants (shared verbatim with the former page.tsx) ─────────────

const taskStatusWrapStyle: CSSProperties = { marginTop: "auto", paddingTop: 10 };

const taskStatusEmptyStyle: CSSProperties = {
  marginTop: "auto", paddingTop: 10, fontFamily: "var(--mono)", fontSize: 11,
  color: "var(--ink-mute)", letterSpacing: "0.04em",
};

const taskBarTrackStyle: CSSProperties = {
  display: "flex", height: 5, borderRadius: 999, overflow: "hidden",
  background: "var(--surface-sunk)", marginBottom: 7,
};

const taskStatusLine1Style: CSSProperties = {
  display: "flex", alignItems: "center", gap: 6, marginBottom: 5,
  fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-soft)", letterSpacing: "0.02em",
};

const taskStatusCountsStyle: CSSProperties = {
  display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10,
  fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-mute)", letterSpacing: "0.02em",
};

const taskDotStyle: CSSProperties = { display: "inline-flex", alignItems: "center", gap: 4 };

const statusDotStyle: CSSProperties = {
  width: 7, height: 7, borderRadius: "50%", flexShrink: 0, display: "inline-block",
};

const metaRowStyle: CSSProperties = {
  fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-mute)", marginBottom: 8,
  letterSpacing: "0.04em", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap",
};

const memberChipStyle: CSSProperties = { display: "inline-flex", alignItems: "center", gap: 4 };

export const gridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(min(260px, 100%), 1fr))",
  gap: 14,
  alignItems: "stretch",
};

export const cardWrapStyle: CSSProperties = {
  position: "relative",
  height: "100%",
  // Let the grid track shrink below the title's intrinsic width — otherwise a
  // long run of characters (no spaces) forces the whole column wider than the
  // card and overlaps neighbours.
  minWidth: 0,
};

export const cardStyle: CSSProperties = {
  display: "flex", flexDirection: "column", padding: 16, background: "var(--surface)",
  borderWidth: 1, borderStyle: "solid", borderColor: "var(--rule)",
  borderRadius: "var(--r-md)", boxShadow: "var(--shadow-sm)", textDecoration: "none",
  color: "var(--ink)", minHeight: 110, height: "100%", boxSizing: "border-box", position: "relative",
  minWidth: 0,
  overflow: "hidden",
};

export const pinPosStyle: CSSProperties = { position: "absolute", top: 8, right: 8, zIndex: 2 };

// Top-right cluster on a card: action menu + pin, side by side.
export const cardActionsStyle: CSSProperties = {
  position: "absolute", top: 8, right: 8, zIndex: 2,
  display: "inline-flex", alignItems: "center", gap: 2,
};

export const teamIconStyle: CSSProperties = {
  display: "inline-flex", alignItems: "center", justifyContent: "center",
  width: 32, height: 32, borderRadius: "var(--r-sm)",
  background: "var(--green-wash)", color: "var(--green-deep)", marginBottom: 10,
};

export const cardTitleStyle: CSSProperties = {
  fontFamily: "var(--serif)",
  fontSize: 17,
  marginBottom: 4,
  paddingRight: 56,
  minWidth: 0,
  maxWidth: "100%",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

// Holds a card's status tag on its own line under the title. Never inline with
// the title: the tag would then sit at a different spot on every card depending
// on the title's length, and on short titles it reached the top-right menu +
// pin cluster, which is absolutely positioned over the card.
export const cardTagRowStyle: CSSProperties = {
  display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 8,
};

// Project lead pill — sits in cardTagRowStyle immediately right of the ACTIVE
// tag. Quiet by design: the status tag is the card's signal, the lead is
// context, so this borrows the wash + hairline treatment rather than a solid
// fill that would compete with it.
export function ProjectLeadTag({ name }: { name: string }) {
  const tr = useTr();
  return (
    <span
      title={`Project lead: ${name}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        maxWidth: "100%",
        minWidth: 0,
        background: "var(--surface-sunk)",
        color: "var(--ink-soft)",
        borderWidth: 1,
        borderStyle: "solid",
        borderColor: "var(--rule)",
        borderRadius: 999,
        padding: "2px 9px",
        fontFamily: "var(--mono)",
        fontSize: 10,
        letterSpacing: "0.06em",
      }}
    >
      <span style={{ color: "var(--ink-faint)", textTransform: "uppercase", flexShrink: 0 }}>{tr("Lead")}</span>
      <span
        style={{
          minWidth: 0,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {name}
      </span>
    </span>
  );
}

export const cardMetaStyle: CSSProperties = {
  fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-mute)", marginBottom: 8, letterSpacing: "0.06em",
};

export const cardDescStyle: CSSProperties = {
  fontSize: 12, color: "var(--ink-mute)",
  display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden",
};

export const emptyStateStyle: CSSProperties = {
  gridColumn: "1 / -1", padding: 32, textAlign: "center", background: "var(--surface-sunk)",
  borderRadius: "var(--r-md)", borderWidth: 1, borderStyle: "dashed", borderColor: "var(--rule)",
};

export const controlsRowStyle: CSSProperties = {
  display: "flex", justifyContent: "space-between", alignItems: "center",
  gap: 12, flexWrap: "wrap", marginBottom: 16,
};
