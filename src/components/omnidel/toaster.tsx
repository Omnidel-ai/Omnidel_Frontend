"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTr } from "@/lib/client/language";

// Global top-right toast stack. Mount once (dashboard layout). Any client
// code — including src/lib/client/fetch-json.ts — surfaces a toast via
// `emitToast(message, tone)`, which dispatches a window CustomEvent this
// component listens for. No context, no prop drilling.
//
//   import { emitToast } from "@/components/omnidel/toaster";
//   emitToast("You don't have permission to do that");

export type ToastTone = "error" | "info" | "success";

type ToastDetail = { message: string; tone?: ToastTone };

export const TOAST_EVENT = "omnidel:toast";

/** Dispatch a toast from anywhere on the client. */
export function emitToast(message: string, tone: ToastTone = "error") {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<ToastDetail>(TOAST_EVENT, { detail: { message, tone } }));
}

type ToastItem = ToastDetail & { id: number };

const AUTO_DISMISS_MS = 5000;

const palette: Record<ToastTone, { bg: string; fg: string; bd: string }> = {
  error: { bg: "var(--crit-wash)", fg: "var(--crit)", bd: "var(--crit)" },
  info: { bg: "var(--surface)", fg: "var(--ink)", bd: "var(--rule-strong)" },
  success: { bg: "var(--ok-wash)", fg: "var(--ok)", bd: "var(--ok)" },
};

let nextId = 0;

export function Toaster() {
  const tr = useTr();
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  useEffect(() => {
    function onToast(e: Event) {
      const detail = (e as CustomEvent<ToastDetail>).detail;
      if (!detail?.message) return;
      const id = nextId++;
      setToasts((prev) => [...prev, { id, message: detail.message, tone: detail.tone ?? "error" }]);
      timers.current.set(id, setTimeout(() => dismiss(id), AUTO_DISMISS_MS));
    }
    window.addEventListener(TOAST_EVENT, onToast);
    return () => window.removeEventListener(TOAST_EVENT, onToast);
  }, [dismiss]);

  useEffect(() => {
    const timersMap = timers.current;
    return () => {
      timersMap.forEach(clearTimeout);
      timersMap.clear();
    };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      style={{
        position: "fixed",
        top: 20,
        right: 20,
        zIndex: 2000,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        maxWidth: 380,
      }}
    >
      {toasts.map((t) => {
        const c = palette[t.tone ?? "error"];
        return (
          <div
            key={t.id}
            role="status"
            onClick={() => dismiss(t.id)}
            className="omnidel-toast-item"
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
              padding: "12px 14px",
              background: c.bg,
              color: c.fg,
              border: `1px solid ${c.bd}`,
              borderRadius: "var(--r-md)",
              boxShadow: "var(--shadow-md)",
              fontSize: 13,
              fontFamily: "var(--sans)",
              lineHeight: 1.4,
              cursor: "pointer",
            }}
          >
            <span style={{ flex: 1 }}>{t.message}</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                dismiss(t.id);
              }}
              aria-label={tr("Dismiss")}
              style={{
                background: "transparent",
                border: "none",
                color: "inherit",
                cursor: "pointer",
                fontSize: 16,
                lineHeight: 1,
                padding: 0,
              }}
            >
              ×
            </button>
          </div>
        );
      })}
      <style>{`
        .omnidel-toast-item { animation: omnidel-toast-in 0.18s ease-out; }
        @keyframes omnidel-toast-in {
          from { opacity: 0; transform: translateY(-6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .omnidel-toast-item { animation: none; }
        }
      `}</style>
    </div>
  );
}
