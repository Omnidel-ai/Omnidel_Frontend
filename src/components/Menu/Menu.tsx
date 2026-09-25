import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";

export interface MenuItem {
  label: string;
  onClick: () => void;
  /** Muted, non-interactive. */
  disabled?: boolean;
  /** Destructive items read in crit. */
  tone?: "default" | "danger";
  /** Small leading glyph. */
  icon?: ReactNode;
  /** Draws a rule above this item. */
  separated?: boolean;
}

export interface MenuProps {
  items: MenuItem[];
  /** Accessible name for the trigger. */
  label?: string;
  /** Replaces the ⋯ trigger. */
  trigger?: ReactNode;
  /** Which edge of the trigger the panel aligns to. */
  align?: "left" | "right";
  size?: "sm" | "md";
}

/**
 * The ⋯ menu — a row's, a card's or a list's actions.
 *
 * The application has five hand-rolled copies of this machinery (the profile
 * menu, the card menu, the board menu, two in the task modal); this is the one
 * component. The panel is portalled to `document.body` and positioned from the
 * trigger's rect, because every place it is used sits inside something with
 * `overflow: hidden` — a card, a table cell, a scrolling list.
 *
 * States: closed · open · hover · disabled item · danger item.
 */
export function Menu({ items, label = "More actions", trigger, align = "right", size = "md" }: MenuProps) {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const place = useCallback(() => {
    const el = triggerRef.current;
    if (el) setRect(el.getBoundingClientRect());
  }, []);

  useEffect(() => {
    if (!open) return;
    place();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onDown = (e: MouseEvent) => {
      if (triggerRef.current?.contains(e.target as Node)) return;
      if (panelRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onDown);
    // Capture: a scroll inside any container must reposition, and scroll does
    // not bubble.
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open, place]);

  const WIDTH = 200;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: size === "sm" ? 20 : 24,
          height: size === "sm" ? 20 : 24,
          padding: 0,
          background: open ? "var(--surface-sunk)" : "transparent",
          border: "none",
          borderRadius: "var(--r-sm)",
          color: "var(--ink-mute)",
          cursor: "pointer",
          lineHeight: 1,
          fontSize: size === "sm" ? 14 : 16,
          flexShrink: 0,
        }}
      >
        {trigger ?? "⋯"}
      </button>

      {open &&
        rect &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={panelRef}
            role="menu"
            style={{
              position: "fixed",
              top: Math.round(rect.bottom + 4),
              left: Math.round(
                align === "right"
                  ? Math.max(8, Math.min(rect.right - WIDTH, window.innerWidth - WIDTH - 8))
                  : Math.max(8, Math.min(rect.left, window.innerWidth - WIDTH - 8)),
              ),
              width: WIDTH,
              zIndex: 2700,
              background: "var(--surface)",
              border: "1px solid var(--rule-strong)",
              borderRadius: "var(--r-md)",
              boxShadow: "var(--shadow-md)",
              padding: 4,
            }}
          >
            {items.map((item) => (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                className="nav-link"
                disabled={item.disabled}
                onClick={(e) => {
                  e.stopPropagation();
                  if (item.disabled) return;
                  item.onClick();
                  setOpen(false);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 9,
                  width: "100%",
                  padding: "7px 10px",
                  background: "transparent",
                  border: "none",
                  borderTop: item.separated ? "1px solid var(--rule)" : undefined,
                  marginTop: item.separated ? 4 : 0,
                  paddingTop: item.separated ? 11 : 7,
                  font: "inherit",
                  fontSize: 13,
                  textAlign: "left",
                  borderRadius: "var(--r-sm)",
                  cursor: item.disabled ? "not-allowed" : "pointer",
                  color: item.disabled
                    ? "var(--ink-faint)"
                    : item.tone === "danger"
                      ? "var(--crit)"
                      : "var(--ink)",
                  opacity: item.disabled ? 0.6 : 1,
                }}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}

export interface PinButtonProps {
  pinned: boolean;
  onToggle: (next: boolean) => void;
  /** What is being pinned, for the accessible name. */
  label?: string;
  size?: "sm" | "md";
}

/**
 * Pin toggle — the companion to {@link Menu} in a card's top-right cluster.
 *
 * Filled and green when pinned, outline and muted when not, so the state is
 * shape as well as colour.
 */
export function PinButton({ pinned, onToggle, label = "item", size = "md" }: PinButtonProps) {
  const px = size === "sm" ? 20 : 24;
  return (
    <button
      type="button"
      aria-pressed={pinned}
      aria-label={pinned ? `Unpin ${label}` : `Pin ${label}`}
      title={pinned ? "Unpin" : "Pin"}
      onClick={(e) => {
        e.stopPropagation();
        onToggle(!pinned);
      }}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: px,
        height: px,
        padding: 0,
        background: "transparent",
        border: "none",
        borderRadius: "var(--r-sm)",
        color: pinned ? "var(--green-deep)" : "var(--ink-mute)",
        cursor: "pointer",
        flexShrink: 0,
      }}
    >
      <svg
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill={pinned ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M9 3h6l-1 6 4 3v2H6v-2l4-3z" />
        <path d="M12 14v7" />
      </svg>
    </button>
  );
}

/** Six-dot drag affordance. Presentational: it does not implement dragging. */
export function DragHandle({ label = "Drag to reorder" }: { label?: string }) {
  return (
    <span
      aria-label={label}
      title={label}
      style={{
        display: "inline-flex",
        color: "var(--ink-faint)",
        cursor: "grab",
        flexShrink: 0,
      }}
    >
      <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor" aria-hidden="true">
        <circle cx="2.5" cy="3" r="1.2" />
        <circle cx="7.5" cy="3" r="1.2" />
        <circle cx="2.5" cy="7" r="1.2" />
        <circle cx="7.5" cy="7" r="1.2" />
        <circle cx="2.5" cy="11" r="1.2" />
        <circle cx="7.5" cy="11" r="1.2" />
      </svg>
    </span>
  );
}

export const menuTriggerStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};
