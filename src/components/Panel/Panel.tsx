import type { ReactNode } from "react";

export interface PanelProps {
  title: string;
  /** Small tinted glyph tile before the title. */
  icon?: ReactNode;
  /** Controls on the right of the header — a toggle, a count, an expander. */
  actions?: ReactNode;
  /** Mono uppercase line under the title. */
  subtitle?: string;
  children: ReactNode;
  /** Removes the body padding, for a panel whose body is a table. */
  flush?: boolean;
  /** Extra class on the card — a grid span, say. */
  className?: string;
}

/**
 * A titled card.
 *
 * The unit the application's overview screens are built from: an icon, a serif
 * title, controls on the right, and a body that is either content or an empty
 * line. Used by Home, by the dashboard, and by anything else that needs a
 * panel — which is why it lives here rather than in one of them.
 */
export function Panel({
  title,
  icon,
  actions,
  subtitle,
  children,
  flush = false,
  className,
}: PanelProps) {
  return (
    <section className={["panel", className].filter(Boolean).join(" ")}>
      <header className="panel__head">
        {icon && <span className="panel__icon">{icon}</span>}
        <span style={{ minWidth: 0 }}>
          <h3 className="panel__title">{title}</h3>
          {subtitle && <span className="panel__subtitle">{subtitle}</span>}
        </span>
        {actions && <span className="panel__actions">{actions}</span>}
      </header>
      <div className={flush ? "panel__body panel__body--flush" : "panel__body"}>{children}</div>
    </section>
  );
}

export interface StatTileProps {
  label: string;
  value: string;
  icon?: ReactNode;
  /** Muted line under the row. */
  hint?: string;
}

/**
 * A headline count with its glyph — the row along the top of Home.
 *
 * The number sits beside the label rather than above it, as the application
 * has it: at this size the pair reads as one phrase, "0 total tasks".
 */
export function StatTile({ label, value, icon, hint }: StatTileProps) {
  return (
    <div className="stat-tile">
      <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
        {icon && <span className="stat-tile__icon">{icon}</span>}
        <span className="stat-tile__value">{value}</span>
        <span className="stat-tile__label">{label}</span>
      </div>
      {hint && <span className="stat-tile__hint">{hint}</span>}
    </div>
  );
}

/** Count chip used in a panel's header. */
export function PanelCount({ n }: { n: number }) {
  return <span className="panel__count">{n}</span>;
}

/**
 * The ⤢ beside a panel's count.
 *
 * Widens the panel to the full row rather than opening a separate screen —
 * the reason to expand a five-row list is to see more of it, and that is the
 * cheapest way to give it.
 */
export function PanelExpand({ expanded, onToggle }: { expanded: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      className="panel__expand"
      aria-pressed={expanded}
      aria-label={expanded ? "Collapse panel" : "Expand panel"}
      onClick={onToggle}
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {expanded ? (
          <>
            <path d="M9 3v6H3M21 15h-6v6" />
            <path d="M3 9l6-6M21 15l-6 6" />
          </>
        ) : (
          <>
            <path d="M15 3h6v6M9 21H3v-6" />
            <path d="M21 3l-7 7M3 21l7-7" />
          </>
        )}
      </svg>
    </button>
  );
}
