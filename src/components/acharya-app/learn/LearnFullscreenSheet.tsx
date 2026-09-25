"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ghostIconButtonStyle } from "@/components/ghost-icon-button";

interface Props {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  /** Player modal stacks above pick-list (default 60). */
  zIndex?: number;
}

export function LearnFullscreenSheet({
  open,
  title,
  subtitle,
  onClose,
  children,
  zIndex = 60,
}: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    closeRef.current?.focus();

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 flex flex-col pt-safe pb-safe"
      style={{ zIndex }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="learn-sheet-title"
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        style={scrim}
      />
      <div style={panel} className="slide-up">
        <header style={header}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 id="learn-sheet-title" style={titleStyle}>
              {title}
            </h2>
            {subtitle ? (
              <p style={subtitleStyle}>{subtitle}</p>
            ) : null}
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close panel"
            className="press"
            style={closeBtn}
          >
            ×
          </button>
        </header>
        <div className="hide-scrollbar" style={body}>{children}</div>
      </div>
    </div>,
    document.body,
  );
}

const scrim: CSSProperties = {
  position: "absolute",
  inset: 0,
  background: "color-mix(in srgb, var(--ink) 45%, transparent)",
  border: "none",
  cursor: "pointer",
};

const panel: CSSProperties = {
  position: "relative",
  display: "flex",
  flexDirection: "column",
  flex: 1,
  minHeight: 0,
  marginTop: "auto",
  maxHeight: "92dvh",
  background: "var(--page)",
  borderTopLeftRadius: "var(--r-lg, 16px)",
  borderTopRightRadius: "var(--r-lg, 16px)",
  boxShadow: "0 -8px 40px color-mix(in srgb, var(--ink) 18%, transparent)",
  overflow: "hidden",
};

const header: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: 12,
  padding: "14px 16px 12px",
  borderBottom: "1px solid var(--rule)",
  flexShrink: 0,
};

const titleStyle: CSSProperties = {
  fontFamily: "var(--serif)",
  fontSize: 18,
  fontWeight: 600,
  fontStyle: "italic",
  color: "var(--ink)",
  margin: 0,
  lineHeight: 1.25,
};

const subtitleStyle: CSSProperties = {
  fontSize: 12,
  color: "var(--ink-mute)",
  margin: "4px 0 0",
  lineHeight: 1.4,
};

const closeBtn: CSSProperties = {
  ...ghostIconButtonStyle,
  color: "var(--ink)",
  fontSize: 22,
  lineHeight: 1,
};

const body: CSSProperties = {
  flex: 1,
  overflowY: "auto",
  padding: "16px",
  WebkitOverflowScrolling: "touch",
};
