import { useCallback, useEffect, useRef, useState } from "react";

export type ToastTone = "error" | "info" | "success";

export const TOAST_EVENT = "omnidel:toast";

interface ToastDetail {
  message: string;
  tone?: ToastTone;
}
type ToastItem = ToastDetail & { id: number };

/**
 * Raise a toast from anywhere on the client — no context, no prop drilling.
 *
 *   import { emitToast } from "@/components/Toast";
 *   emitToast("Saved", "success");
 */
export function emitToast(message: string, tone: ToastTone = "error") {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<ToastDetail>(TOAST_EVENT, { detail: { message, tone } }));
}

const AUTO_DISMISS_MS = 5000;

const PALETTE: Record<ToastTone, { bg: string; fg: string; bd: string }> = {
  error: { bg: "var(--crit-wash)", fg: "var(--crit)", bd: "var(--crit)" },
  info: { bg: "var(--surface)", fg: "var(--ink)", bd: "var(--rule-strong)" },
  success: { bg: "var(--ok-wash)", fg: "var(--ok)", bd: "var(--ok)" },
};

let nextId = 0;

export interface ToasterProps {
  /** How long a toast stays up, in ms. */
  autoDismissMs?: number;
}

/**
 * Top-right toast stack. Mount once, near the root of the app.
 *
 * Listens for a window CustomEvent rather than exposing a provider, so a
 * non-React module (a fetch wrapper, say) can raise a toast too.
 */
export function Toaster({ autoDismissMs = AUTO_DISMISS_MS }: ToasterProps = {}) {
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
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), autoDismissMs),
      );
    }
    window.addEventListener(TOAST_EVENT, onToast);
    return () => window.removeEventListener(TOAST_EVENT, onToast);
  }, [dismiss, autoDismissMs]);

  useEffect(() => {
    const map = timers.current;
    return () => {
      map.forEach(clearTimeout);
      map.clear();
    };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="toast-stack" aria-live="polite">
      {toasts.map((t) => {
        const c = PALETTE[t.tone ?? "error"];
        return (
          <div
            key={t.id}
            role="status"
            className="toast-item"
            onClick={() => dismiss(t.id)}
            style={{ background: c.bg, color: c.fg, border: `1px solid ${c.bd}` }}
          >
            <span style={{ flex: 1 }}>{t.message}</span>
            <button
              type="button"
              aria-label="Dismiss"
              onClick={(e) => {
                e.stopPropagation();
                dismiss(t.id);
              }}
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
    </div>
  );
}
