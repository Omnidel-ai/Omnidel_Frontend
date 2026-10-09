import type { CSSProperties, ReactNode } from "react";

/** The tones the app's `.tag` pill is painted in. */
export type BadgeTone = "neutral" | "green" | "terra" | "ochre" | "ok" | "amber" | "crit";

const TONES: Record<BadgeTone, { background: string; color: string }> = {
  neutral: { background: "var(--surface-sunk)", color: "var(--ink-soft)" },
  green: { background: "var(--green-wash)", color: "var(--green-deep)" },
  terra: { background: "var(--terra-wash)", color: "var(--terracotta)" },
  ochre: { background: "var(--ochre-wash)", color: "var(--ochre)" },
  ok: { background: "var(--ok-wash)", color: "var(--ok)" },
  amber: { background: "var(--amber-wash)", color: "var(--amber)" },
  crit: { background: "var(--crit-wash)", color: "var(--crit)" },
};

export interface BadgeProps {
  children: ReactNode;
  tone?: BadgeTone;
  /** Small leading dot — for status colours that are data, not a tone. */
  dot?: string;
  style?: CSSProperties;
  title?: string;
}

/**
 * Uppercase mono pill — status, category, type.
 *
 * The tone is a visual choice, never a domain one: a caller maps its own
 * statuses to a tone, so the badge knows nothing about leads, tasks or orders.
 */
export function Badge({ children, tone = "neutral", dot, style, title }: BadgeProps) {
  const c = TONES[tone] ?? TONES.neutral;
  return (
    <span
      className="tag"
      title={title}
      style={{
        background: c.background,
        color: c.color,
        ...(dot ? { display: "inline-flex", alignItems: "center", gap: 6 } : null),
        ...style,
      }}
    >
      {dot && (
        <span
          aria-hidden="true"
          style={{ width: 7, height: 7, borderRadius: "50%", background: dot, flexShrink: 0 }}
        />
      )}
      {children}
    </span>
  );
}
