import type { CSSProperties, ReactNode } from "react";

export type CardTone = "green" | "ochre" | "slate" | "terracotta" | "forest";

export interface CardProps {
  children: ReactNode;
  /**
   * A wash of a palette colour. Leave unset for the plain surface.
   * `forest` is the solid dark-green identity card (Kaarigar's IdentityCard).
   */
  tone?: CardTone;
  /** No padding — for a card whose header runs a rule edge to edge, or that holds a list. */
  flush?: boolean;
  as?: "section" | "div" | "article";
  className?: string;
  style?: CSSProperties;
  "aria-label"?: string;
}

/**
 * The framed surface. It is Contractor's `Panel` (with ochre, green and slate
 * tones) and Kaarigar's `DetailGroup` card (sage, ochre, terracotta and slate
 * washes), `.journey-overview` and the settings section cards. Both apps tint
 * the whole card with a wash rather than painting an accent edge, so that is
 * what `tone` does. Kaarigar's `sage` is `green`.
 */
export function Card({ children, tone, flush = false, as: Tag = "section", className, style, ...rest }: CardProps) {
  return (
    <Tag
      className={`am-card${flush ? " am-card--flush" : ""}${className ? ` ${className}` : ""}`}
      data-tone={tone}
      style={style}
      aria-label={rest["aria-label"]}
    >
      {children}
    </Tag>
  );
}

export interface SectionHeaderProps {
  title: ReactNode;
  icon?: ReactNode;
  /** Trailing content — a count, a sort toggle, a chevron. */
  right?: ReactNode;
  /**
   * `disc` — Kaarigar: icon in a green-wash disc, sentence-case heading.
   * `rule` — Contractor: mono uppercase label, then a rule edge to edge. Use inside a `flush` Card.
   */
  variant?: "disc" | "rule";
  /** Heading level for the title. */
  level?: 2 | 3;
}

/**
 * The header a card wears: Contractor's `SectionHead` and Kaarigar's
 * `SettingsHeading` / `DetailGroup` header. Both are a name, an icon and an
 * optional right slot. They differ only in how the icon and label are drawn.
 */
export function SectionHeader({ title, icon, right, variant = "disc", level = 2 }: SectionHeaderProps) {
  const H = level === 2 ? "h2" : "h3";
  return (
    <div className={`am-section-head am-section-head--${variant}`}>
      <H className="am-section-head__title">
        {icon && (variant === "disc" ? <span className="am-section-head__disc" aria-hidden>{icon}</span> : <span aria-hidden style={{ display: "inline-flex" }}>{icon}</span>)}
        {title}
      </H>
      {right !== undefined && right !== null && <span className="am-section-head__right">{right}</span>}
    </div>
  );
}
