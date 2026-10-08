import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { DemoUrgentTask } from "../../data/types";

export interface UrgentBellProps {
  items: DemoUrgentTask[];
  /** A row was picked. In the app this deep-links into the board's task modal. */
  onOpen?: (task: DemoUrgentTask) => void;
}

/**
 * Topbar warning triangle listing every open urgent task.
 *
 * The app's `urgent-bell.tsx` polls the tasks endpoint; here the list is the
 * caller's, so the same component renders demo rows today and API rows later.
 * Sits to the left of the notification bell, as it does in the app.
 */
export function UrgentBell({ items, onOpen }: UrgentBellProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const total = items.length;

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
        aria-label={total > 0 ? `Urgent tasks, ${total}` : "Urgent tasks"}
        aria-expanded={open}
        title="Urgent tasks"
        style={{ ...triggerStyle, color: total > 0 ? "var(--crit)" : "var(--ink-soft)" }}
      >
        <svg
          width="17"
          height="17"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
        {total > 0 && <span style={badgeStyle}>{total > 9 ? "9+" : total}</span>}
      </button>

      {open && (
        <div style={panelStyle} role="dialog" aria-label="Urgent tasks">
          <div style={panelHeadStyle}>
            <span style={eyebrowStyle}>Urgent tasks</span>
            {total > 0 && (
              <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--crit)", fontWeight: 700 }}>
                {total}
              </span>
            )}
          </div>
          <div className="themed-scroll-y" style={{ maxHeight: 380, overflowY: "auto" }}>
            {total === 0 ? (
              <div style={{ padding: 24, fontSize: 13, color: "var(--ink-mute)", textAlign: "center" }}>
                No urgent tasks right now.
              </div>
            ) : (
              items.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className="nav-link"
                  onClick={() => {
                    setOpen(false);
                    onOpen?.(t);
                  }}
                  style={rowStyle}
                >
                  <span aria-hidden="true" style={dotStyle} />
                  <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 6 }}>
                    <span style={titleStyle} title={t.title}>
                      {t.title}
                    </span>
                    <span style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "space-between" }}>
                      <span style={{ display: "flex", gap: 6, minWidth: 0, flexWrap: "wrap" }}>
                        {t.assignee && <span style={pillStyle}>@ {t.assignee}</span>}
                        {t.project && <span style={pillStyle}>P: {t.project}</span>}
                      </span>
                      {t.due && (
                        <span
                          style={{
                            flexShrink: 0,
                            fontFamily: "var(--mono)",
                            fontSize: 10,
                            color: t.overdue ? "var(--crit)" : "var(--ink-faint)",
                          }}
                        >
                          {t.due}
                        </span>
                      )}
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

const eyebrowStyle: CSSProperties = {
  fontFamily: "var(--mono)",
  fontSize: 10,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: "var(--ink-mute)",
};

const rowStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: 9,
  width: "100%",
  textAlign: "left",
  padding: "12px",
  border: "none",
  borderTop: "1px solid var(--rule)",
  background: "transparent",
  cursor: "pointer",
  borderRadius: 0,
};

const dotStyle: CSSProperties = {
  width: 7,
  height: 7,
  borderRadius: "50%",
  background: "var(--crit)",
  flexShrink: 0,
  marginTop: 5,
};

const titleStyle: CSSProperties = {
  display: "-webkit-box",
  WebkitLineClamp: 2,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
  fontSize: 13,
  fontWeight: 600,
  color: "var(--ink)",
  lineHeight: 1.35,
};

const pillStyle: CSSProperties = {
  display: "inline-block",
  maxWidth: 140,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  fontFamily: "var(--mono)",
  fontSize: 11,
  lineHeight: 1.4,
  color: "var(--ink-mute)",
  background: "var(--surface-sunk)",
  border: "1px solid var(--rule)",
  borderRadius: "var(--r-sm)",
  padding: "1px 6px",
};
