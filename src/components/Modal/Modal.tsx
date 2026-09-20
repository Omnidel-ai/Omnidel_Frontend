import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

export interface ModalProps {
  open: boolean;
  /** Called on Escape, scrim click and the × button. */
  onClose: () => void;
  title?: ReactNode;
  /** Muted line under the title. */
  description?: ReactNode;
  children?: ReactNode;
  /** Buttons row, right-aligned at the bottom of the card. */
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
  /** Hide the × in the corner (a modal that must be answered by its buttons). */
  hideClose?: boolean;
  /** Ignore Escape and scrim clicks — for a save that is already in flight. */
  dismissible?: boolean;
}

const SIZE_CLASS = { sm: "modal-card--sm", md: "", lg: "modal-card--lg" } as const;

/**
 * Scrim + card, portalled to <body>.
 *
 * Restores focus to whatever opened it, traps Tab inside the card, and locks
 * the page behind it from scrolling. Content is entirely the caller's.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  hideClose = false,
  dismissible = true,
}: ModalProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<Element | null>(null);

  useEffect(() => {
    if (!open) return;
    returnFocusRef.current = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Focus the first control in the card so the keyboard lands inside it.
    const first = cardRef.current?.querySelector<HTMLElement>(
      "button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex='-1'])",
    );
    first?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && dismissible) {
        onClose();
        return;
      }
      if (e.key !== "Tab" || !cardRef.current) return;
      const focusable = Array.from(
        cardRef.current.querySelectorAll<HTMLElement>(
          "button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href], [tabindex]:not([tabindex='-1'])",
        ),
      );
      if (focusable.length === 0) return;
      const firstEl = focusable[0];
      const lastEl = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    }

    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      if (returnFocusRef.current instanceof HTMLElement) returnFocusRef.current.focus();
      returnFocusRef.current = null;
    };
  }, [open, onClose, dismissible]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="modal-overlay"
      onClick={dismissible ? onClose : undefined}
      // z-index lives on .modal-overlay in global.css.
    >
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === "string" ? title : undefined}
        className={["modal-card", SIZE_CLASS[size]].filter(Boolean).join(" ")}
        onClick={(e) => e.stopPropagation()}
      >
        {(title || !hideClose) && (
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            {title && <h3 style={{ marginBottom: description ? 6 : 12 }}>{title}</h3>}
            {!hideClose && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--ink-mute)",
                  fontSize: 18,
                  lineHeight: 1,
                  cursor: "pointer",
                  padding: 0,
                  marginLeft: "auto",
                }}
              >
                ×
              </button>
            )}
          </div>
        )}
        {description && <p style={{ marginBottom: 16 }}>{description}</p>}
        {children}
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
