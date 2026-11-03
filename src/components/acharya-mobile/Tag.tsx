import type { CSSProperties, ReactNode } from "react";

export type TagTone = "neutral" | "outline" | "green" | "ok" | "ochre" | "crit" | "terracotta" | "slate" | "plum";

export interface TagProps {
  children: ReactNode;
  tone?: TagTone;
  size?: "xs" | "sm" | "md";
  icon?: ReactNode;
  title?: string;
  style?: CSSProperties;
}

/**
 * The mono pill, which is the tag language of both apps.
 *
 * Contractor: `Pill` (7 tones, 3 sizes, 3px corners), `PriorityPill`, the
 * list tag on `TaskRow`. Kaarigar: `HistoryTags` (date / score / verdict), the
 * chips on `task-card` (habit, score, reviewing, board, sessions) and the due
 * chip. The corner radius follows the look: round on Kaarigar, square on
 * Contractor. Map your own statuses to a tone at the call site; the tag knows no
 * domain.
 *
 * For a colour that is data rather than a tone (a list's own colour), pass it
 * through `style`: `{ "--am-tag-bg": …, "--am-tag-fg": …, "--am-tag-bd": … }`.
 */
export function Tag({ children, tone = "neutral", size = "sm", icon, title, style }: TagProps) {
  return (
    <span className={`am-tag${size === "sm" ? "" : ` am-tag--${size}`}`} data-tone={tone === "neutral" ? undefined : tone} title={title} style={style}>
      {icon}
      {children}
    </span>
  );
}

/** A tag painted from a data colour — Contractor's list tag, a board's own colour. */
export function colorTagStyle(color: string | null | undefined): CSSProperties {
  const c = color || "var(--rule-strong)";
  return {
    ["--am-tag-bg" as string]: `color-mix(in srgb, ${c} 16%, var(--surface))`,
    ["--am-tag-fg" as string]: `color-mix(in srgb, ${c} 70%, var(--ink))`,
    ["--am-tag-bd" as string]: `color-mix(in srgb, ${c} 34%, var(--surface))`,
  };
}
