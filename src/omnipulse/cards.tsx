import type { CSSProperties, ReactNode } from "react";

/**
 * The card vocabulary OmniPulse is built from.
 *
 * Teams and Projects are card grids in the application, not tables, so the
 * pieces live here the way `columns.tsx` holds the table's cell renderers:
 * one small set, shared by both screens, knowing nothing about what a team or
 * a project is.
 */

export const gridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(min(260px, 100%), 1fr))",
  gap: 14,
  alignItems: "stretch",
};

export function CardGrid({ children }: { children: ReactNode }) {
  return <div style={gridStyle}>{children}</div>;
}

export interface CardProps {
  onClick?: () => void;
  /** Top-right cluster — a menu, a pin, a toggle. */
  actions?: ReactNode;
  /** Dims the card and mutes its border, for an archived record. */
  muted?: boolean;
  /** Left edge accent. */
  accent?: string;
  /** Tinted card — the application marks system-made records this way. */
  accentCard?: boolean;
  children: ReactNode;
  title?: string;
}

export function Card({ onClick, actions, muted, accent, accentCard, children, title }: CardProps) {
  return (
    <div style={{ position: "relative", height: "100%", minWidth: 0 }}>
      <button
        type="button"
        onClick={onClick}
        title={title}
        className="opx-card"
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          padding: 16,
          textAlign: "left",
          font: "inherit",
          background: accentCard ? "var(--green-wash)" : "var(--surface)",
          border: `1px solid ${accentCard ? "var(--green-soft)" : "var(--rule)"}`,
          borderLeft: accent ? `4px solid ${accent}` : undefined,
          borderRadius: "var(--r-md)",
          boxShadow: "var(--shadow-sm)",
          color: "var(--ink)",
          minHeight: 110,
          height: "100%",
          position: "relative",
          minWidth: 0,
          overflow: "hidden",
          opacity: muted ? 0.6 : 1,
          cursor: onClick ? "pointer" : "default",
        }}
      >
        {children}
      </button>
      {actions && (
        <div
          style={{
            position: "absolute",
            top: 8,
            right: 8,
            zIndex: 2,
            display: "inline-flex",
            alignItems: "center",
            gap: 2,
          }}
        >
          {actions}
        </div>
      )}
    </div>
  );
}

/** Square glyph tile at the head of a card. */
export function CardIcon({ children, tone = "green" }: { children: ReactNode; tone?: "green" | "ochre" }) {
  return (
    <span
      aria-hidden="true"
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 32,
        height: 32,
        borderRadius: "var(--r-sm)",
        background: tone === "green" ? "var(--green-wash)" : "var(--ochre-wash)",
        color: tone === "green" ? "var(--green-deep)" : "var(--ochre)",
        flexShrink: 0,
      }}
    >
      {children}
    </span>
  );
}

export function CardTitle({ children, pad = true }: { children: ReactNode; pad?: boolean }) {
  return (
    <span
      style={{
        fontFamily: "var(--serif)",
        fontSize: 17,
        marginBottom: 4,
        // Room for the top-right action cluster, so a long name never runs
        // under the menu.
        paddingRight: pad ? 56 : 0,
        minWidth: 0,
        maxWidth: "100%",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        display: "block",
      }}
    >
      {children}
    </span>
  );
}

export function CardMeta({ children }: { children: ReactNode }) {
  return (
    <span
      style={{
        fontFamily: "var(--mono)",
        fontSize: 11,
        color: "var(--ink-mute)",
        display: "flex",
        flexWrap: "wrap",
        gap: 10,
        marginTop: 2,
      }}
    >
      {children}
    </span>
  );
}

export function CardDesc({ children }: { children: ReactNode }) {
  return (
    <span
      style={{
        fontSize: 12.5,
        color: "var(--ink-mute)",
        lineHeight: 1.5,
        marginTop: 8,
        display: "-webkit-box",
        WebkitLineClamp: 2,
        WebkitBoxOrient: "vertical",
        overflow: "hidden",
      }}
    >
      {children}
    </span>
  );
}

/** Uppercase mono pill toggle — "With projects", "Archived". */
export function QuickToggle({
  label,
  active,
  onClick,
  title,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={title}
      style={{
        padding: "6px 14px",
        fontFamily: "var(--mono)",
        fontSize: 11,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        borderRadius: "var(--r-sm)",
        border: "1px solid var(--rule-strong)",
        cursor: "pointer",
        whiteSpace: "nowrap",
        background: active ? "var(--green-deep)" : "transparent",
        color: active ? "#f4efdf" : "var(--ink-soft)",
      }}
    >
      {label}
    </button>
  );
}

/**
 * Segmented view switch — Card / Table / Calendar.
 *
 * Matches the application's control exactly: 12px mono, uppercase, a hairline
 * between joined segments, and the active one filled in the deep green.
 */
export function ViewToggle({
  value,
  onChange,
  options = ["Card", "Table"],
  label = "View mode",
}: {
  value: string;
  onChange: (v: string) => void;
  options?: string[];
  label?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={label}
      style={{ display: "inline-flex", borderRadius: "var(--r-sm)", overflow: "hidden", flexShrink: 0 }}
    >
      {options.map((o, i) => {
        const active = o === value;
        const first = i === 0;
        const last = i === options.length - 1;
        return (
          <button
            key={o}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o)}
            style={{
              padding: "6px 14px",
              fontFamily: "var(--mono)",
              fontSize: 12,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              whiteSpace: "nowrap",
              cursor: "pointer",
              background: active ? "var(--green-deep)" : "var(--surface)",
              color: active ? "var(--surface)" : "var(--ink-soft)",
              borderWidth: 1,
              borderStyle: "solid",
              borderColor: active ? "var(--green-deep)" : "var(--rule)",
              borderLeftWidth: first ? 1 : 0,
              borderTopLeftRadius: first ? "var(--r-sm)" : 0,
              borderBottomLeftRadius: first ? "var(--r-sm)" : 0,
              borderTopRightRadius: last ? "var(--r-sm)" : 0,
              borderBottomRightRadius: last ? "var(--r-sm)" : 0,
            }}
          >
            {o}
          </button>
        );
      })}
    </div>
  );
}

/** Done / doing / to-do as one thin bar plus counts. */
export function TaskProgress({
  done,
  doing,
  todo,
  compact = false,
}: {
  done: number;
  doing: number;
  todo: number;
  compact?: boolean;
}) {
  const total = done + doing + todo || 1;
  const seg = (n: number, color: string, label: string) =>
    n > 0 ? (
      <span
        key={label}
        title={`${label}: ${n}`}
        style={{ width: `${(n / total) * 100}%`, background: color, borderRadius: 2 }}
      />
    ) : null;

  return (
    <span style={{ display: "block", minWidth: 0, marginTop: compact ? 0 : 10 }}>
      <span style={{ display: "flex", gap: 2, height: 6 }}>
        {seg(done, "var(--ok)", "Done")}
        {seg(doing, "var(--amber)", "In progress")}
        {seg(todo, "var(--rule-strong)", "To do")}
      </span>
      <span
        style={{
          display: "flex",
          gap: 10,
          marginTop: 6,
          fontFamily: "var(--mono)",
          fontSize: 10,
          color: "var(--ink-mute)",
        }}
      >
        <span>{done} done</span>
        <span>{doing} doing</span>
        <span>{todo} to do</span>
      </span>
    </span>
  );
}

/** Circle of initials — one per assignee, overlapping. */
export function Avatars({ names, size = 22 }: { names: string[]; size?: number }) {
  if (names.length === 0) return null;
  return (
    <span style={{ display: "inline-flex", alignItems: "center" }}>
      {names.slice(0, 3).map((n, i) => (
        <span
          key={n}
          title={n}
          style={{
            width: size,
            height: size,
            borderRadius: "50%",
            background: "var(--green-deep)",
            color: "#f4efdf",
            fontSize: size / 2.4,
            fontWeight: 700,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            marginLeft: i === 0 ? 0 : -6,
            border: "1.5px solid var(--surface)",
            flexShrink: 0,
          }}
        >
          {initials(n)}
        </span>
      ))}
      {names.length > 3 && (
        <span
          style={{
            fontFamily: "var(--mono)",
            fontSize: 10,
            color: "var(--ink-mute)",
            marginLeft: 4,
          }}
        >
          +{names.length - 3}
        </span>
      )}
    </span>
  );
}

export function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

/** Two-person glyph used in a card's meta line. */
export function PeopleGlyph() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="3.2" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    </svg>
  );
}

export function TeamGlyph() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

export function BoardGlyph() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M8 4v16M16 4v10" />
    </svg>
  );
}
