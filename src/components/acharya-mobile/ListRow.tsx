import type { ReactNode } from "react";
import { MobileIcon } from "./Icon";

export interface ListRowProps {
  title: ReactNode;
  /** A second line — tags, a count, a city. */
  subtitle?: ReactNode;
  /** Avatar, icon or symbol on the left. */
  leading?: ReactNode;
  /** A thin colour bar on the left — a project's or board's own colour. */
  accent?: string | null;
  /** Badges or a count on the right. */
  trailing?: ReactNode;
  /** Draw the "this goes somewhere" chevron. On by default when the row is tappable. */
  chevron?: boolean;
  href?: string;
  onSelect?: () => void;
  /** Stand alone as its own framed card instead of sitting in a `RowList`. */
  card?: boolean;
  ariaLabel?: string;
  /** For a row that opens content in place: says whether it is open (`aria-expanded`). */
  expanded?: boolean;
}

/**
 * A tappable row: something on the left, a name and a line under it, then a
 * chevron. Contractor uses it for project rows, team rows and Profile's
 * Settings link. Kaarigar uses it for org rows in Requests, the mentor list on
 * Home and the history timeline.
 */
export function ListRow({ title, subtitle, leading, accent, trailing, chevron, href, onSelect, card = false, ariaLabel, expanded }: ListRowProps) {
  const tappable = Boolean(href || onSelect);
  const showChevron = chevron ?? tappable;
  const className = `am-row${tappable ? " am-press" : ""}${card ? " am-row--card" : ""}`;
  const body = (
    <>
      {accent !== undefined && <span className="am-row__accent" style={{ background: accent || "var(--green)" }} aria-hidden />}
      {leading && <span className="am-row__lead">{leading}</span>}
      <span className="am-row__text">
        <span className="am-row__title">{title}</span>
        {subtitle && <span className="am-row__sub">{subtitle}</span>}
      </span>
      {(trailing || showChevron) && (
        <span className="am-row__trail">
          {trailing}
          {showChevron && <MobileIcon name="chevron-right" className="am-row__chevron" />}
        </span>
      )}
    </>
  );
  if (href) return <a className={className} href={href} onClick={onSelect} aria-label={ariaLabel}>{body}</a>;
  if (onSelect) return <button type="button" className={className} onClick={onSelect} aria-label={ariaLabel} aria-expanded={expanded}>{body}</button>;
  return <div className={className}>{body}</div>;
}

/** Rows separated by rules — not a stack of identical cards. Put it in a flush `Card`, or set `framed`. */
export function RowList({ children, framed = false, label }: { children: ReactNode; framed?: boolean; label?: string }) {
  const items = Array.isArray(children) ? children : [children];
  return (
    <ul className={`am-list${framed ? " am-list--framed" : ""}`} aria-label={label}>
      {items.filter(Boolean).map((child, i) => (
        <li key={i}>{child}</li>
      ))}
    </ul>
  );
}
