import { useEffect, useId, useRef, type ReactNode } from "react";

export interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  /** Pinned under the scrolling body — the sheet's actions. */
  footer?: ReactNode;
  /** Label for the tap-outside scrim, read by screen readers ("Close"). */
  closeLabel?: string;
  /** Block closing (scrim, Escape) while a save is in flight. */
  busy?: boolean;
}

/**
 * A panel that rises from the bottom over a scrim.
 *
 * Kaarigar uses sheets for photo actions, help, the update capture and asking
 * for more time. Contractor puts New task, Edit task and the photo viewer in
 * dialogs. On a phone in one hand both are the same thing done in two shapes,
 * and the sheet is the one the thumb reaches, so this is the version kept.
 * Escape and the scrim close it, the page stops scrolling underneath, focus
 * moves into the sheet, Tab and Shift+Tab stay inside it, and focus goes back
 * to where it was afterwards.
 */
export function BottomSheet({ open, onClose, title, children, footer, closeLabel = "Close", busy = false }: BottomSheetProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape" && !busy) {
        onClose();
        return;
      }
      // aria-modal promises the page behind is out of reach, so Tab must wrap
      // inside the panel — including from the panel itself, where focus starts.
      const panel = panelRef.current;
      if (e.key !== "Tab" || !panel) return;
      const focusable = Array.from(
        panel.querySelectorAll<HTMLElement>(
          "button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href], [tabindex]:not([tabindex='-1'])",
        ),
        // Roving radio groups and tablists park their other options at
        // tabindex -1; Tab never lands on those, so they can't be an end.
      ).filter((el) => el.tabIndex >= 0 && el.getClientRects().length > 0);
      if (focusable.length === 0) {
        e.preventDefault();
        panel.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;
      // On the panel itself (where focus starts) or somewhere it shouldn't be:
      // step into the sheet from the matching end.
      if (!active || active === panel || !panel.contains(active)) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      } else if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, [open, busy, onClose]);

  if (!open) return null;
  return (
    <div className="am-sheet" role="dialog" aria-modal="true" aria-labelledby={title ? titleId : undefined} aria-label={title ? undefined : closeLabel}>
      <button type="button" className="am-sheet__scrim" aria-label={closeLabel} onClick={() => !busy && onClose()} tabIndex={-1} />
      <div className="am-sheet__panel" ref={panelRef} tabIndex={-1}>
        <div className="am-sheet__handle" aria-hidden />
        {title && <h2 id={titleId} className="am-sheet__title">{title}</h2>}
        <div className="am-sheet__body">{children}</div>
        {footer && <div className="am-sheet__footer">{footer}</div>}
      </div>
    </div>
  );
}
