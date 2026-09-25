"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { useStrings } from "@/lib/i18n/useLang";
import { SETTINGS_PATH } from "@/lib/voice-nav-targets";
import {
  ghostIconButtonStyle,
  ghostIconButtonActiveStyle,
  softIconButtonStyle,
} from "@/components/ghost-icon-button";

/**
 * Person icon in the home header — dropdown with Profile / Settings.
 *
 * Profile lands on `/profile`, Settings on the top-level `/settings` — two
 * unrelated screens (Profile's About tab is identity + the edit form; Settings
 * is language, text size, account), so back from either goes to the acharya
 * home. `/profile?settings=1` and `/profile/settings`, the older deep links,
 * both redirect to `/settings`.
 *
 * Dismissal (outside pointer / Escape) mirrors the notice bell dropdown
 * (`NoticeBanner`, `variant="menu"`) so the two header menus behave alike.
 */
export default function ProfileMenu({
  style,
  tone = "ghost",
}: {
  style?: CSSProperties;
  /** `soft` = filled tan disc (home header). `ghost` = bare glyph elsewhere. */
  tone?: "ghost" | "soft";
}) {
  const s = useStrings();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent | TouchEvent) {
      const el = rootRef.current;
      if (!el) return;
      if (e.target instanceof Node && !el.contains(e.target)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} style={{ position: "relative", ...style }}>
      <button
        type="button"
        className="press"
        aria-label={s.profileAria}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={menuId}
        title={s.profileAria}
        onClick={() => setOpen((v) => !v)}
        style={{
          ...(tone === "soft" ? softIconButtonStyle : ghostIconButtonStyle),
          ...(open ? ghostIconButtonActiveStyle : null),
        }}
      >
        <PersonIcon />
      </button>

      {open ? (
        <div id={menuId} role="menu" aria-label={s.profileAria} style={dropdownStyle}>
          <Link
            href="/profile"
            role="menuitem"
            className="press"
            onClick={() => setOpen(false)}
            style={itemStyle}
          >
            <PersonIcon size={16} />
            <span>{s.profileAria}</span>
          </Link>
          <Link
            href={SETTINGS_PATH}
            role="menuitem"
            className="press"
            onClick={() => setOpen(false)}
            style={{ ...itemStyle, borderTop: "1px solid var(--rule)" }}
          >
            <GearIcon />
            <span>{s.settings}</span>
          </Link>
        </div>
      ) : null}
    </div>
  );
}

function PersonIcon({ size = 19 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 21a8 8 0 0 0-16 0" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

const dropdownStyle: CSSProperties = {
  position: "absolute",
  top: "calc(100% + 8px)",
  right: 0,
  width: "min(200px, calc(100vw - 24px))",
  overflow: "hidden",
  display: "flex",
  flexDirection: "column",
  background: "var(--page)",
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "var(--rule)",
  borderRadius: "var(--r-md)",
  boxShadow: "0 12px 28px rgba(0,0,0,0.12)",
  zIndex: 40,
};

const itemStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  minHeight: 44,
  padding: "0 14px",
  color: "var(--ink)",
  fontFamily: "var(--sans)",
  fontSize: 14,
  fontWeight: 600,
  textDecoration: "none",
  background: "var(--page)",
};
