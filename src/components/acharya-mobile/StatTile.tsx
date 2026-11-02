import type { ReactNode } from "react";

export type StatTone = "green" | "ochre" | "slate";

export interface StatTileProps {
  tone: StatTone;
  icon: ReactNode;
  /** A count, a score, "—" while it loads, or a short text value. */
  value: string;
  label: string;
  /**
   * `stack` — Kaarigar (`ReportTab`, PR #207): centred disc, big number, plain label.
   * `row`   — Contractor (`ui/stat-tile`): icon left, mono number and label right, a wave underneath.
   */
  layout?: "stack" | "row";
  /** Makes the tile a button. Kaarigar's status counts open the matching lane. */
  onClick?: () => void;
  href?: string;
}

/**
 * One number with its name. Both apps put three of these in a row on Home and
 * on Profile, in the same green / ochre / slate order, so `StatRow` is
 * included too.
 */
export function StatTile({ tone, icon, value, label, layout = "stack", onClick, href }: StatTileProps) {
  const className = `am-stat am-stat--${layout}${onClick || href ? " am-press" : ""}`;
  const body = (
    <>
      {layout === "row" && <Wave />}
      <span className="am-stat__icon" aria-hidden>{icon}</span>
      <span className="am-stat__text">
        <p className="am-stat__value">{value}</p>
        <p className="am-stat__label">{label}</p>
      </span>
    </>
  );
  if (href) return <a className={className} data-tone={tone} href={href} onClick={onClick}>{body}</a>;
  if (onClick) return <button type="button" className={className} data-tone={tone} onClick={onClick}>{body}</button>;
  return <div className={className} data-tone={tone}>{body}</div>;
}

export function StatRow({ children, label }: { children: ReactNode; label?: string }) {
  return <section className="am-stat-row" aria-label={label}>{children}</section>;
}

function Wave() {
  return (
    <svg viewBox="0 0 120 40" preserveAspectRatio="none" aria-hidden className="am-stat__wave">
      <path d="M0 22c14-13 32-16 48-8s34 12 52 1c8-4 14-9 20-14v39H0z" fill="color-mix(in srgb, var(--am-ink) 13%, transparent)" />
    </svg>
  );
}
