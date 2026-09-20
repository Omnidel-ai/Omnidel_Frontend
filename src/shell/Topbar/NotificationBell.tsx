import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { DemoNotification } from "../../data/types";

const TONE_COLOR: Record<DemoNotification["tone"], string> = {
  info: "var(--ink-mute)",
  success: "var(--ok)",
  warn: "var(--amber)",
  crit: "var(--crit)",
};

export interface NotificationBellProps {
  items: DemoNotification[];
  /** Mark one read. The caller owns the list. */
  onRead?: (id: string) => void;
  onReadAll?: () => void;
}

/**
 * Topbar bell with an unread count and a panel of recent items.
 *
 * The panel is anchored to the trigger rather than portalled — it sits at the
 * right edge of the topbar, where nothing clips it. Read state belongs to the
 * caller, so the same component works against a store or a feed.
 */
export function NotificationBell({ items, onRead, onReadAll }: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const unread = items.filter((i) => i.unread).length;

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (wrapRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrapRef} style={{ position: "relative", flexShrink: 0 }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
        aria-expanded={open}
        style={triggerStyle}
      >
        <svg
          width="17"
          height="17"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M18 8a6 6 0 1 0-12 0c0 7-3 8-3 8h18s-3-1-3-8" />
          <path d="M10.3 21a2 2 0 0 0 3.4 0" />
        </svg>
        {unread > 0 && <span style={badgeStyle}>{unread}</span>}
      </button>

      {open && (
        <div style={panelStyle} role="dialog" aria-label="Notifications">
          <div style={panelHeadStyle}>
            <span
              style={{
                fontFamily: "var(--mono)",
                fontSize: 10,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "var(--ink-mute)",
              }}
            >
              Notifications
            </span>
            <button
              type="button"
              onClick={onReadAll}
              disabled={unread === 0}
              style={{
                background: "transparent",
                border: "none",
                padding: 0,
                fontFamily: "var(--mono)",
                fontSize: 10,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: unread > 0 ? "var(--green-deep)" : "var(--ink-mute)",
                cursor: unread > 0 ? "pointer" : "default",
                opacity: unread > 0 ? 1 : 0.5,
              }}
            >
              Mark all read
            </button>
          </div>

          <div style={{ maxHeight: 340, overflowY: "auto" }}>
            {items.length === 0 ? (
              <div style={{ padding: 24, fontSize: 13, color: "var(--ink-mute)", textAlign: "center" }}>
                Nothing new
              </div>
            ) : (
              items.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  className="nav-link"
                  onClick={() => onRead?.(n.id)}
                  style={{
                    display: "flex",
                    gap: 9,
                    width: "100%",
                    textAlign: "left",
                    padding: "10px 12px",
                    border: "none",
                    borderTop: "1px solid var(--rule)",
                    background: n.unread ? "var(--page)" : "transparent",
                    cursor: "pointer",
                    borderRadius: 0,
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: "50%",
                      marginTop: 5,
                      flexShrink: 0,
                      background: n.unread ? TONE_COLOR[n.tone] : "transparent",
                      border: n.unread ? "none" : "1px solid var(--rule-strong)",
                    }}
                  />
                  <span style={{ minWidth: 0, flex: 1 }}>
                    <span
                      style={{
                        display: "block",
                        fontSize: 13,
                        fontWeight: n.unread ? 600 : 400,
                        color: "var(--ink)",
                      }}
                    >
                      {n.title}
                    </span>
                    <span
                      style={{
                        display: "block",
                        fontSize: 12,
                        color: "var(--ink-mute)",
                        lineHeight: 1.45,
                        marginTop: 2,
                      }}
                    >
                      {n.body}
                    </span>
                    <span
                      style={{
                        display: "block",
                        fontFamily: "var(--mono)",
                        fontSize: 10,
                        color: "var(--ink-faint)",
                        marginTop: 4,
                      }}
                    >
                      {n.at}
                    </span>
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const triggerStyle: CSSProperties = {
  position: "relative",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 34,
  height: 34,
  borderRadius: "var(--r-sm)",
  background: "transparent",
  border: "1px solid var(--rule)",
  color: "var(--ink)",
  cursor: "pointer",
  padding: 0,
};

const badgeStyle: CSSProperties = {
  position: "absolute",
  top: -6,
  right: -6,
  minWidth: 17,
  height: 17,
  padding: "0 4px",
  borderRadius: 999,
  background: "var(--crit)",
  color: "#f4efdf",
  fontFamily: "var(--mono)",
  fontSize: 10,
  fontWeight: 700,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};

const panelStyle: CSSProperties = {
  position: "absolute",
  top: "calc(100% + 8px)",
  right: 0,
  width: "min(340px, calc(100vw - 32px))",
  zIndex: 1000,
  background: "var(--surface)",
  border: "1px solid var(--rule-strong)",
  borderRadius: "var(--r-md)",
  boxShadow: "var(--shadow-md)",
  overflow: "hidden",
};

const panelHeadStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "10px 12px",
  background: "var(--surface-sunk)",
};
