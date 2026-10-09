"use client";

import type React from "react";
import { useTr } from "@/lib/client/language";

// Lightweight top-right toast. Presentational only — the parent owns the
// message state + auto-dismiss timing. Render it once near a page's root:
//   <Toast message={toast} onClose={() => setToast(null)} />

export function Toast({ message, tone = "error", onClose }: {
  message: string | null;
  tone?: "error" | "info" | "success";
  onClose: () => void;
}) {
  const tr = useTr();
  if (!message) return null;
  const palette: Record<string, { bg: string; fg: string; bd: string }> = {
    error:   { bg: "var(--crit-wash)",  fg: "var(--crit)",       bd: "var(--crit)" },
    info:    { bg: "var(--surface)",    fg: "var(--ink)",        bd: "var(--rule-strong)" },
    success: { bg: "var(--ok-wash)",    fg: "var(--ok)",         bd: "var(--ok)" },
  };
  const c = palette[tone];
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "fixed", top: 20, right: 20, zIndex: 2000, maxWidth: 380,
        display: "flex", alignItems: "flex-start", gap: 10, padding: "12px 14px",
        background: c.bg, color: c.fg, border: `1px solid ${c.bd}`,
        borderRadius: "var(--r-md)", boxShadow: "var(--shadow-md)",
        fontSize: 13, fontFamily: "var(--sans)", lineHeight: 1.4,
      }}
    >
      <span style={{ flex: 1 }}>{message}</span>
      <button
        type="button"
        onClick={onClose}
        aria-label={tr("Dismiss")}
        style={{ background: "transparent", border: "none", color: "inherit", cursor: "pointer", fontSize: 16, lineHeight: 1, padding: 0 }}
      >
        ×
      </button>
    </div>
  );
}
