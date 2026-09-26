import { useState, type ReactNode } from "react";

export interface DisclosureProps {
  title: string;
  /** Muted count or hint beside the title, e.g. "(0)". */
  meta?: ReactNode;
  /** Buttons on the right of the heading row. */
  actions?: ReactNode;
  /** Open on first render. */
  defaultOpen?: boolean;
  children: ReactNode;
  /** Rule under the section, for a stack of them. */
  divided?: boolean;
}

/**
 * A titled section that folds away.
 *
 * The serif heading with a chevron, used down the long forms — Description,
 * Task Details, Subtasks, Files. The heading is the control, so the whole row
 * is clickable, and the chevron rotates rather than swapping glyph.
 *
 * Content stays mounted when closed: a half-filled form inside a collapsed
 * section must not lose its draft.
 */
export function Disclosure({
  title,
  meta,
  actions,
  defaultOpen = true,
  children,
  divided = false,
}: DisclosureProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section
      style={{
        paddingBottom: divided ? 18 : 0,
        borderBottom: divided ? "1px solid var(--rule)" : undefined,
      }}
    >
      <header style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: open ? 12 : 0 }}>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            background: "transparent",
            border: "none",
            padding: 0,
            cursor: "pointer",
            fontFamily: "var(--serif)",
            fontSize: 19,
            fontWeight: 500,
            color: "var(--ink)",
          }}
        >
          {title}
          {meta != null && (
            <span style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--ink-mute)" }}>
              {meta}
            </span>
          )}
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--ink-mute)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            style={{ transform: open ? "rotate(0)" : "rotate(-90deg)", transition: "transform 160ms ease" }}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
        {actions && <span style={{ marginLeft: "auto", display: "inline-flex", gap: 8 }}>{actions}</span>}
      </header>
      <div hidden={!open}>{children}</div>
    </section>
  );
}
