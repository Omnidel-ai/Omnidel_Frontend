"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useLang, useStrings, useTr } from "@/lib/client/language";
import { UI_LANGS, LANG_LABEL, type Lang } from "@/lib/i18n/lang";

export type ProfileTeam = { id: string; name: string };

/**
 * Profile menu in the topbar — identity, teams and the language switch.
 *
 * The panel is PORTALLED to document.body rather than rendered in place. The
 * topbar is a flex row with overflow constraints and a z-index of 10; an
 * absolutely-positioned child gets clipped by it and can land under page
 * content. Position comes from getBoundingClientRect on the trigger, recomputed
 * on scroll and resize.
 *
 * This is the fifth copy of that machinery in the codebase (account-health,
 * subtask-template-menu, two in task-modal). Extracting a shared
 * dropdown-menu.tsx is the right follow-up, but it touches components other
 * modules render, so it does not belong in a language change.
 */
export function ProfileMenu({
  userName,
  role,
  phone,
  teams,
}: {
  userName: string;
  role: string;
  phone?: string;
  teams: ProfileTeam[];
}) {
  const tr = useTr();
  const router = useRouter();
  const s = useStrings();
  const lang = useLang();
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [saving, setSaving] = useState<Lang | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const place = useCallback(() => {
    const el = triggerRef.current;
    if (el) setRect(el.getBoundingClientRect());
  }, []);

  useEffect(() => {
    if (!open) return;
    place();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    const onDown = (e: MouseEvent) => {
      if (triggerRef.current?.contains(e.target as Node)) return;
      const panel = document.getElementById("profile-menu-panel");
      if (panel?.contains(e.target as Node)) return;
      setOpen(false);
    };
    // Capture phase: a scroll inside any container must reposition, and scroll
    // does not bubble.
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onDown);
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open, place]);

  const initials = userName
    .split(/\s+/).filter(Boolean).slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "").join("") || "?";

  async function setLanguage(next: Lang) {
    if (next === lang) { setOpen(false); return; }
    setSaving(next);
    try {
      const res = await fetch("/api/me/language", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lang: next }),
      });
      if (res.ok) {
        setOpen(false);
        // The layout resolves preferred_lang server-side, so refresh() repaints
        // the whole shell in the new language — no reload, no re-login.
        router.refresh();
      }
    } catch {
      /* leave it; the row stays selectable */
    } finally {
      setSaving(null);
    }
  }

  async function signOut() {
    await fetch("/api/auth/phone/logout", { method: "POST" });
    window.location.href = "/login";
  }

  const ROW: React.CSSProperties = {
    display: "flex", alignItems: "center", gap: 10, width: "100%",
    padding: "8px 12px", background: "transparent", border: "none",
    font: "inherit", fontSize: 13, color: "var(--ink)", cursor: "pointer",
    textAlign: "left", borderRadius: 8,
  };
  const SECTION: React.CSSProperties = {
    fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
    color: "var(--ink-mute)", padding: "10px 12px 4px",
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={s.ui.profile}
        style={{
          display: "inline-flex", alignItems: "center", gap: 8, minWidth: 0,
          padding: "4px 8px 4px 4px", borderRadius: 999,
          background: open ? "var(--surface-2, var(--surface))" : "transparent",
          border: "1px solid " + (open ? "var(--rule-strong)" : "transparent"),
          cursor: "pointer", font: "inherit", maxWidth: "42vw",
        }}
      >
        <span style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          width: 28, height: 28, borderRadius: 999, flexShrink: 0,
          background: "var(--green-deep)", color: "#f4efdf",
          fontSize: 11, fontWeight: 700, letterSpacing: "0.02em",
        }}>{initials}</span>
        <span style={{
          fontSize: 13, color: "var(--ink)", fontWeight: 600,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0,
        }}>{userName}</span>
      </button>

      {open && rect && typeof document !== "undefined" && createPortal(
        <div
          id="profile-menu-panel"
          role="menu"
          style={{
            position: "fixed",
            // Right-aligned to the trigger, clamped so it never leaves the viewport
            // on a narrow screen.
            top: Math.round(rect.bottom + 8),
            left: Math.round(Math.max(8, Math.min(rect.right - 260, window.innerWidth - 268))),
            width: 260, zIndex: 1000,
            background: "var(--surface)", border: "1px solid var(--rule-strong)",
            borderRadius: 14, boxShadow: "var(--shadow-md, 0 8px 28px rgba(0,0,0,0.14))",
            padding: 6, maxHeight: "min(70vh, 520px)", overflowY: "auto",
          }}
        >
          <div style={{ padding: "10px 12px 8px" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>{userName}</div>
            {role && (
              <div style={{ marginTop: 4 }}>
                <span style={{
                  display: "inline-block", padding: "2px 8px", borderRadius: 999,
                  background: "var(--green-wash, var(--surface))", color: "var(--green-deep)",
                  fontSize: 11, fontWeight: 600, textTransform: "capitalize",
                }}>{role.replace(/_/g, " ")}</span>
              </div>
            )}
            {phone && (
              <div style={{ marginTop: 6, fontSize: 12, color: "var(--ink-mute)" }}>{phone}</div>
            )}
          </div>

          <div style={{ height: 1, background: "var(--rule)", margin: "4px 0" }} />

          {teams.length > 0 && (
            <>
              <div style={SECTION}>{s.nav["Teams"] || tr("Teams")}</div>
              <div style={{ padding: "0 12px 8px", display: "flex", flexWrap: "wrap", gap: 6 }}>
                {teams.map((t) => (
                  <span key={t.id} style={{
                    padding: "3px 9px", borderRadius: 999, background: "var(--surface-2, var(--page))",
                    border: "1px solid var(--rule)", fontSize: 11, color: "var(--ink)",
                  }}>{t.name}</span>
                ))}
              </div>
              <div style={{ height: 1, background: "var(--rule)", margin: "4px 0" }} />
            </>
          )}

          <div style={SECTION}>{s.ui.language}</div>
          {UI_LANGS.map((code) => {
            const active = code === lang;
            return (
              <button
                key={code}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                disabled={saving !== null}
                onClick={() => { void setLanguage(code); }}
                style={{ ...ROW, fontWeight: active ? 700 : 500, opacity: saving && saving !== code ? 0.5 : 1 }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "var(--surface-2, var(--page))"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
              >
                <span style={{ width: 16, flexShrink: 0, color: "var(--green-deep)" }}>
                  {active ? "✓" : ""}
                </span>
                {/* Each language in its OWN script: someone who cannot read the
                    other two must still be able to find theirs. */}
                <span>{LANG_LABEL[code]}</span>
              </button>
            );
          })}

          <div style={{ height: 1, background: "var(--rule)", margin: "4px 0" }} />

          <button
            type="button"
            role="menuitem"
            onClick={() => { void signOut(); }}
            style={{ ...ROW, color: "var(--crit)", fontWeight: 600 }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--crit-wash, var(--page))"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
          >
            <span style={{ width: 16, flexShrink: 0 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
            </span>
            {s.ui.signOut}
          </button>
        </div>,
        document.body,
      )}
    </>
  );
}
