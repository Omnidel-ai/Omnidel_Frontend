"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import { useTr } from "@/lib/client/language";

/** Three-dot Edit / Delete menu on a comment header (Normal + Simple task modals). */
export function CommentActionsMenu({
  showEdit,
  showDelete,
  onEdit,
  onDelete,
}: {
  showEdit: boolean;
  showDelete: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const tr = useTr();
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);

  const place = useCallback(() => {
    const b = btnRef.current;
    if (!b) return;
    const r = b.getBoundingClientRect();
    setPos({ top: r.bottom + 4, right: Math.max(8, window.innerWidth - r.right) });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  function choose(action: () => void) {
    setOpen(false);
    action();
  }

  if (!showEdit && !showDelete) return null;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        aria-label={tr("Comment actions")}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        style={kebabBtnStyle}
      >
        &#8942;
      </button>
      {open && pos && createPortal(
        <div
          ref={menuRef}
          role="menu"
          style={{ ...commentMenuPopoverStyle, top: pos.top, right: pos.right }}
        >
          {showEdit && (
            <button type="button" role="menuitem" style={commentMenuRowStyle} onClick={() => choose(onEdit)}>
              {tr("Edit")}
            </button>
          )}
          {showDelete && (
            <button
              type="button"
              role="menuitem"
              style={{ ...commentMenuRowStyle, color: "var(--crit)" }}
              onClick={() => choose(onDelete)}
            >
              {tr("Delete")}
            </button>
          )}
        </div>,
        document.body,
      )}
    </>
  );
}

const kebabBtnStyle: CSSProperties = {
  padding: "0 6px",
  fontSize: 16,
  lineHeight: 1,
  fontWeight: 700,
  background: "transparent",
  border: "none",
  borderRadius: "var(--r-sm)",
  cursor: "pointer",
  color: "var(--ink-soft)",
  fontFamily: "var(--sans)",
};

const commentMenuPopoverStyle: CSSProperties = {
  position: "fixed",
  minWidth: 140,
  background: "var(--surface)",
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "var(--rule)",
  borderRadius: "var(--r-sm)",
  boxShadow: "var(--shadow-md)",
  zIndex: 1300,
  padding: "4px 0",
};

const commentMenuRowStyle: CSSProperties = {
  display: "block",
  width: "100%",
  textAlign: "left",
  padding: "7px 12px",
  fontSize: 12,
  background: "transparent",
  borderWidth: 0,
  cursor: "pointer",
  fontFamily: "var(--sans)",
  color: "var(--ink-soft)",
};
