import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  /** Requires a typed reason before the confirm button unlocks. */
  requireText?: { label: string; placeholder?: string; minLength?: number };
  confirmLabel?: string;
  cancelLabel?: string;
  confirmTone?: "primary" | "danger";
  /** Parent-owned in-flight flag; the dialog also guards its own double-fire. */
  busy?: boolean;
  /**
   * Failure reason for the action just attempted, rendered inside the dialog.
   * A caller's page-level banner would be painted under the scrim, so the
   * reason has to land in the dialog the user is looking at.
   */
  error?: string | null;
  /** Third button, left of Cancel, so confirm keeps the rightmost slot. */
  altAction?: { label: string; onClick: () => void | Promise<void>; tone?: "primary" | "secondary" };
  onCancel: () => void;
  onConfirm: (text?: string) => void | Promise<void>;
}

/**
 * Yes/no interrupt — archive, delete, discard.
 *
 * Portalled above everything, focus-trapped, and it awaits `onConfirm` so a
 * slow action shows "Working…" instead of accepting a second click.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  requireText,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  confirmTone = "primary",
  busy = false,
  error,
  altAction,
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const cancelBtnRef = useRef<HTMLButtonElement>(null);
  const confirmBtnRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<Element | null>(null);

  useEffect(() => {
    if (open) {
      returnFocusRef.current = document.activeElement;
      // A destructive dialog focuses Cancel, so Enter never deletes anything.
      const target = confirmTone === "danger" ? cancelBtnRef.current : confirmBtnRef.current;
      target?.focus();
    } else {
      setText("");
      setSubmitting(false);
      if (returnFocusRef.current instanceof HTMLElement) returnFocusRef.current.focus();
      returnFocusRef.current = null;
    }
  }, [open, confirmTone]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy && !submitting) {
        onCancel();
        return;
      }
      if (e.key !== "Tab") return;
      const focusable = Array.from(
        document.querySelectorAll<HTMLElement>(
          "[data-confirm-dialog] button:not([disabled]), [data-confirm-dialog] textarea",
        ),
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, submitting, onCancel]);

  if (!open || typeof document === "undefined") return null;

  const isDisabled = busy || submitting;
  const textValid = !requireText || text.trim().length >= (requireText.minLength ?? 1);

  async function handleConfirm() {
    if (isDisabled || !textValid) return;
    setSubmitting(true);
    try {
      await onConfirm(requireText ? text.trim() : undefined);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAlt() {
    if (isDisabled || !altAction) return;
    setSubmitting(true);
    try {
      await altAction.onClick();
    } finally {
      setSubmitting(false);
    }
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      data-confirm-dialog=""
      onClick={isDisabled ? undefined : onCancel}
      style={{
        position: "fixed",
        inset: 0,
        background: "var(--overlay)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        // Above Modal (2400) — a confirm can interrupt an open modal.
        zIndex: 2500,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--surface)",
          border: "1px solid var(--rule)",
          borderRadius: "var(--r-md)",
          padding: 22,
          maxWidth: 480,
          width: "92%",
          boxShadow: "var(--shadow-md)",
        }}
      >
        <h3
          id="confirm-dialog-title"
          style={{
            fontFamily: "var(--serif)",
            fontSize: 20,
            fontWeight: 600,
            marginBottom: description || requireText ? 8 : 18,
          }}
        >
          {title}
        </h3>
        {description && (
          <p
            style={{
              fontSize: 13,
              color: "var(--ink-soft)",
              lineHeight: 1.5,
              marginBottom: requireText ? 14 : 18,
            }}
          >
            {description}
          </p>
        )}
        {requireText && (
          <div style={{ marginBottom: 18 }}>
            <label className="form-label">{requireText.label}</label>
            <textarea
              autoFocus
              className="form-textarea"
              rows={3}
              placeholder={requireText.placeholder}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </div>
        )}
        {error && (
          <div
            role="alert"
            style={{
              fontSize: 12,
              color: "var(--crit)",
              background: "var(--crit-wash)",
              border: "1px solid var(--crit)",
              borderRadius: "var(--r-sm)",
              padding: "8px 12px",
              marginBottom: 16,
              lineHeight: 1.5,
              overflowWrap: "anywhere",
            }}
          >
            {error}
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, flexWrap: "wrap" }}>
          {altAction && (
            <button
              type="button"
              className={altAction.tone === "secondary" ? "btn-ghost" : "btn-primary"}
              onClick={handleAlt}
              disabled={isDisabled}
            >
              {altAction.label}
            </button>
          )}
          <button
            type="button"
            ref={cancelBtnRef}
            className="btn-ghost"
            onClick={onCancel}
            disabled={isDisabled}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            ref={confirmBtnRef}
            className={confirmTone === "danger" ? "btn-danger" : "btn-primary"}
            onClick={handleConfirm}
            disabled={isDisabled || !textValid}
          >
            {isDisabled ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
