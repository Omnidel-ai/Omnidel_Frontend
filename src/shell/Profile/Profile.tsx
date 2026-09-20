import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import type { DemoUser } from "../../data/types";

export interface ProfileProps {
  user: DemoUser;
  /** Language switch. The caller stores the choice. */
  onLanguageChange?: (code: string) => void;
  onSignOut?: () => void;
  /** Shrink the trigger to the avatar alone (packed mobile topbar). */
  compact?: boolean;
}

/**
 * Topbar identity control: avatar + name, and a panel with role, phone, teams,
 * the language switch and sign out.
 *
 * The panel is portalled to `document.body` and positioned from the trigger's
 * rect. The topbar is a flex row with its own stacking context, so an
 * absolutely-positioned child gets clipped by it or lands under page content.
 */
export function Profile({ user, onLanguageChange, onSignOut, compact = false }: ProfileProps) {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

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
      if (document.getElementById("shell-profile-panel")?.contains(e.target as Node)) return;
      setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onDown);
    // Capture phase: scroll does not bubble, and any scrolling container must
    // reposition the panel.
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open, place]);

  const initials =
    user.name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("") || "?";

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Profile"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          minWidth: 0,
          padding: "4px 8px 4px 4px",
          borderRadius: 999,
          background: open ? "var(--surface)" : "transparent",
          border: `1px solid ${open ? "var(--rule-strong)" : "transparent"}`,
          cursor: "pointer",
          font: "inherit",
          maxWidth: "42vw",
        }}
      >
        <span style={avatarStyle}>{initials}</span>
        {!compact && (
          <span
            style={{
              fontSize: 13,
              color: "var(--ink)",
              fontWeight: 600,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              minWidth: 0,
            }}
          >
            {user.name}
          </span>
        )}
      </button>

      {open &&
        rect &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            id="shell-profile-panel"
            role="menu"
            style={{
              position: "fixed",
              top: Math.round(rect.bottom + 8),
              left: Math.round(Math.max(8, Math.min(rect.right - 260, window.innerWidth - 268))),
              width: 260,
              zIndex: 1000,
              background: "var(--surface)",
              border: "1px solid var(--rule-strong)",
              borderRadius: 14,
              boxShadow: "var(--shadow-md)",
              padding: 6,
              maxHeight: "min(70vh, 520px)",
              overflowY: "auto",
            }}
          >
            <div style={{ padding: "10px 12px 8px" }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>{user.name}</div>
              {user.role && (
                <div style={{ marginTop: 4 }}>
                  <span
                    style={{
                      display: "inline-block",
                      padding: "2px 8px",
                      borderRadius: 999,
                      background: "var(--green-wash)",
                      color: "var(--green-deep)",
                      fontSize: 11,
                      fontWeight: 600,
                      textTransform: "capitalize",
                    }}
                  >
                    {user.role.replace(/_/g, " ")}
                  </span>
                </div>
              )}
              {user.phone && (
                <div style={{ marginTop: 6, fontSize: 12, color: "var(--ink-mute)" }}>
                  {user.phone}
                </div>
              )}
            </div>

            <Divider />

            {user.teams.length > 0 && (
              <>
                <div style={sectionStyle}>Teams</div>
                <div style={{ padding: "0 12px 8px", display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {user.teams.map((t) => (
                    <span
                      key={t.id}
                      style={{
                        padding: "3px 9px",
                        borderRadius: 999,
                        background: "var(--page)",
                        border: "1px solid var(--rule)",
                        fontSize: 11,
                        color: "var(--ink)",
                      }}
                    >
                      {t.name}
                    </span>
                  ))}
                </div>
                <Divider />
              </>
            )}

            <div style={sectionStyle}>Language</div>
            {user.languages.map((l) => {
              const active = l.code === user.activeLanguage;
              return (
                <button
                  key={l.code}
                  type="button"
                  role="menuitemradio"
                  aria-checked={active}
                  className="nav-link"
                  onClick={() => {
                    onLanguageChange?.(l.code);
                    setOpen(false);
                  }}
                  style={{
                    ...rowStyle,
                    fontWeight: active ? 600 : 400,
                    color: active ? "var(--green-deep)" : "var(--ink)",
                  }}
                >
                  <span style={{ flex: 1 }}>{l.label}</span>
                  <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-mute)" }}>
                    {l.code}
                  </span>
                  {active && <Check />}
                </button>
              );
            })}

            <Divider />

            <button
              type="button"
              role="menuitem"
              className="nav-link"
              onClick={() => {
                onSignOut?.();
                setOpen(false);
              }}
              style={{ ...rowStyle, color: "var(--crit)" }}
            >
              Sign out
            </button>
          </div>,
          document.body,
        )}
    </>
  );
}

function Divider() {
  return <div style={{ height: 1, background: "var(--rule)", margin: "4px 0" }} />;
}

function Check() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--green-deep)"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

const avatarStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 28,
  height: 28,
  borderRadius: 999,
  flexShrink: 0,
  background: "var(--green-deep)",
  color: "#f4efdf",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.02em",
};

const rowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  width: "100%",
  padding: "8px 12px",
  background: "transparent",
  border: "none",
  font: "inherit",
  fontSize: 13,
  color: "var(--ink)",
  cursor: "pointer",
  textAlign: "left",
  borderRadius: 8,
};

const sectionStyle: CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--ink-mute)",
  padding: "10px 12px 4px",
};
