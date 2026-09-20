import type { ReactNode } from "react";
import type { DemoStatusItem } from "../../data/types";

const TONE_COLOR: Record<DemoStatusItem["tone"], string> = {
  ok: "var(--ok)",
  warn: "var(--amber)",
  crit: "var(--crit)",
  neutral: "var(--ink-mute)",
};

export interface StatusBarProps {
  items: DemoStatusItem[];
  /** Right-hand slot — a timestamp, a build hash, a "what is this" link. */
  trailing?: ReactNode;
  /** Sticks to the bottom of the shell's content column. */
  position?: "bottom" | "top";
}

/**
 * Thin strip of ambient state: environment, data source, queues, build.
 *
 * Each item is a label, a value and a tone — the bar computes nothing and polls
 * nothing. On a phone it scrolls sideways rather than wrapping into two rows,
 * because it must never take height from the content above it.
 */
export function StatusBar({ items, trailing, position = "bottom" }: StatusBarProps) {
  return (
    <footer
      className="shell-statusbar themed-scroll-x"
      style={{
        borderTop: position === "bottom" ? "1px solid var(--rule)" : undefined,
        borderBottom: position === "top" ? "1px solid var(--rule)" : undefined,
      }}
    >
      {items.map((item) => (
        <span key={item.key} className="shell-statusbar__item" title={item.detail}>
          <span
            aria-hidden="true"
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: TONE_COLOR[item.tone],
              flexShrink: 0,
            }}
          />
          <span className="shell-statusbar__label">{item.label}</span>
          <span style={{ color: "var(--ink-soft)", whiteSpace: "nowrap" }}>{item.value}</span>
        </span>
      ))}
      {trailing && <span className="shell-statusbar__trailing">{trailing}</span>}
    </footer>
  );
}
