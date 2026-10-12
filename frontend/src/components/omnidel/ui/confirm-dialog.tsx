"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTr } from "@/lib/client/language";

interface RequireText {
  label: string;
  placeholder?: string;
  minLength?: number;
}

interface Props {
  open: boolean;
  title: string;
  description?: string;
  requireText?: RequireText;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmTone?: "primary" | "danger";
  busy?: boolean;
  /**
   * Failure reason for the action just attempted, rendered inside the dialog.
   *
   * The dialog portals to body at zIndex 2500, so a caller's page-level error
   * banner is painted *under* the scrim and never reaches the user when the
   * action fails with the dialog still open (e.g. archiving the default
   * language or the Default Team — both rejected 400 by the backend). Pass the
   * caller's error state here so the reason lands in front of the user, in the
   * dialog they are looking at.
   */
  error?: string | null;
  /**
   * Optional third button, rendered to the LEFT of the cancel button so the
   * confirm action keeps the rightmost slot it has always had (no muscle-memory
   * trap on a destructive dialog).
   *
   * Added for the task modal's "Discard unsaved changes?" sheet, which needs to
   * offer Save alongside Keep editing / Discard — the dialog interrupts a close,
   * and "save it then" is a legitimate third answer, not a variant of the other
   * two. Shares the busy/submitting guard with the confirm button.
   */
  altAction?: {
    label: string;
    onClick: () => void | Promise<void>;
    tone?: "primary" | "secondary";
  };
  onCancel: () => void;
  onConfirm: (text?: string) => void | Promise<void>;
}

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
}: Props) {
  const tr = useTr();
  const [text, setText] = useState("");
  // Internal submitting guard — prevents double-fire independent of parent busy prop.
  const [submitting, setSubmitting] = useState(false);
  // Portal target — avoid clipping by parent overflow / lower stacking contexts
  // (e.g. task modal + label popover at zIndex 1000–1100).
  const [mounted, setMounted] = useState(false);

  const cancelBtnRef = useRef<HTMLButtonElement>(null);
  const confirmBtnRef = useRef<HTMLButtonElement>(null);
  // Track element focused before dialog opened so we can restore it on close.
  const returnFocusRef = useRef<Element | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Reset transient state and focus when open changes.
  useEffect(() => {
    if (open) {
      returnFocusRef.current = document.activeElement;
      // Focus the confirm button by default (or cancel when tone is danger,
      // to avoid accidental destructive confirmation).
      const target = confirmTone === "danger" ? cancelBtnRef.current : confirmBtnRef.current;
      target?.focus();
    } else {
      setText("");
      setSubmitting(false);
      // Restore focus to the element that triggered the dialog.
      if (returnFocusRef.current instanceof HTMLElement) {
        returnFocusRef.current.focus();
      }
      returnFocusRef.current = null;
    }
  }, [open, confirmTone]);

  // Keyboard: Escape closes (when not submitting); Tab is trapped inside the dialog.
  useEffect(() => {
    if (!open) return;

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy && !submitting) {
        onCancel();
        return;
      }

      if (e.key === "Tab") {
        // Trap focus to the two buttons (and the textarea if present).
        const focusable = Array.from<HTMLElement>(
          document.querySelectorAll(
            "[data-confirm-dialog] button:not([disabled]), [data-confirm-dialog] textarea",
          ),
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, submitting, onCancel]);

  if (!open || !mounted) return null;

  const isDisabled = busy || submitting;
  const minLen = requireText?.minLength ?? 0;
  const textValid = !requireText || text.trim().length >= minLen;
  const dangerBg = "var(--crit)";

  async function handleConfirm() {
    if (isDisabled || !textValid) return;
    setSubmitting(true);
    try {
      await onConfirm(requireText ? text.trim() : undefined);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAltAction() {
    if (isDisabled || !altAction) return;
    setSubmitting(true);
    try {
      await altAction.onClick();
    } finally {
      setSubmitting(false);
    }
  }

  // Portal to body so parent overflow / stacking (task modal z=1000, popovers
  // z=1100) never clip or bury the confirm sheet. Sit above CustomSelect (2000).
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
        background: "rgba(35, 29, 20, 0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
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
            <label
              style={{
                display: "block",
                fontFamily: "var(--mono)",
                fontSize: 10,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "var(--ink-mute)",
                marginBottom: 6,
              }}
            >
              {requireText.label}
            </label>
            <textarea
              autoFocus
              className="form-input"
              rows={3}
              placeholder={requireText.placeholder}
              value={text}
              onChange={(e) => setText(e.target.value)}
              style={{ width: "100%", fontSize: 13 }}
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
              // Reasons can now name the blocking rows (see pricing reference
              // guards), and a long slug-like name must wrap, not overflow.
              overflowWrap: "anywhere",
            }}
          >
            {error}
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, flexWrap: "wrap" }}>
          {altAction && (
            <button
              onClick={handleAltAction}
              disabled={isDisabled}
              style={{
                padding: "8px 16px",
                background: altAction.tone === "secondary" ? "transparent" : "var(--green-deep)",
                color: altAction.tone === "secondary" ? "var(--ink-soft)" : "#f4efdf",
                border: altAction.tone === "secondary" ? "1px solid var(--rule)" : "none",
                borderRadius: "var(--r-sm)",
                cursor: isDisabled ? "default" : "pointer",
                fontSize: 13,
                fontFamily: "var(--sans)",
                fontWeight: 500,
                opacity: isDisabled ? 0.5 : 1,
              }}
            >
              {altAction.label}
            </button>
          )}
          <button
            ref={cancelBtnRef}
            onClick={onCancel}
            disabled={isDisabled}
            style={{
              padding: "8px 14px",
              background: "transparent",
              border: "1px solid var(--rule)",
              borderRadius: "var(--r-sm)",
              cursor: isDisabled ? "default" : "pointer",
              fontSize: 13,
              fontFamily: "var(--sans)",
              color: "var(--ink-soft)",
              opacity: isDisabled ? 0.5 : 1,
            }}
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmBtnRef}
            onClick={handleConfirm}
            disabled={isDisabled || !textValid}
            style={{
              padding: "8px 16px",
              background: confirmTone === "danger" ? dangerBg : "var(--green-deep)",
              color: "#f4efdf",
              border: "none",
              borderRadius: "var(--r-sm)",
              cursor: isDisabled || !textValid ? "default" : "pointer",
              fontSize: 13,
              fontFamily: "var(--sans)",
              fontWeight: 500,
              opacity: isDisabled || !textValid ? 0.5 : 1,
            }}
          >
            {isDisabled ? tr("Working…") : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
