"use client";

/**
 * Non-search select — same closed-field chrome as SearchableSelect / form inputs.
 * Ported interaction from OmniDel custom-select (portal + keyboard).
 */
import { useState, useRef, useEffect, useLayoutEffect, type CSSProperties } from "react";
import { createPortal } from "react-dom";

interface Option {
  value: string;
  label: string;
  color?: string;
  disabled?: boolean;
}

const fieldTrigger: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  minHeight: 48,
  padding: "14px 40px 14px 16px",
  fontSize: 16,
  fontFamily: "var(--sans)",
  background: "var(--surface)",
  border: "1px solid var(--rule)",
  borderRadius: "var(--r-md)",
  boxShadow: "var(--shadow-sm)",
  textAlign: "left",
  position: "relative",
  outline: "none",
  minWidth: 0,
  overflow: "hidden",
};

export default function CustomSelect({
  value,
  onChange,
  options,
  placeholder,
  disabled,
  minWidth,
  preferOpenUpward,
  style,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Option[];
  placeholder?: string;
  disabled?: boolean;
  minWidth?: number;
  preferOpenUpward?: boolean;
  style?: CSSProperties;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const ref = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [popoverPos, setPopoverPos] = useState<{
    top: number; left: number; width: number; maxHeight: number;
  } | null>(null);

  const selected = options.find((o) => o.value === value);

  useLayoutEffect(() => {
    if (!open || !ref.current) {
      setPopoverPos(null);
      return;
    }
    const gap = 4;
    const preferredMaxHeight = 280;
    const estimatedRowHeight = 48;

    function updatePos() {
      if (!ref.current) return;
      const r = ref.current.getBoundingClientRect();
      const measuredHeight = popoverRef.current?.offsetHeight;
      const menuHeight = measuredHeight ?? Math.min(options.length * estimatedRowHeight + 8, preferredMaxHeight);
      const spaceBelow = window.innerHeight - r.bottom - gap;
      const spaceAbove = r.top - gap;
      const openUpward = preferOpenUpward || (menuHeight > spaceBelow && spaceAbove > spaceBelow);
      const availableSpace = (openUpward ? spaceAbove : spaceBelow) - 8;
      const maxHeight = Math.min(preferredMaxHeight, Math.max(availableSpace, 96));
      const top = openUpward
        ? r.top - Math.min(menuHeight, maxHeight) - gap
        : r.bottom + gap;
      setPopoverPos({ top, left: r.left, width: r.width, maxHeight });
    }
    updatePos();
    requestAnimationFrame(updatePos);
    window.addEventListener("scroll", updatePos, true);
    window.addEventListener("resize", updatePos);
    return () => {
      window.removeEventListener("scroll", updatePos, true);
      window.removeEventListener("resize", updatePos);
    };
  }, [open, options.length, preferOpenUpward]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const t = e.target as Node;
      if (ref.current && ref.current.contains(t)) return;
      if (popoverRef.current && popoverRef.current.contains(t)) return;
      setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (disabled) return;
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setOpen(true);
        setHighlighted(options.findIndex((o) => o.value === value));
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((h) => {
        let next = Math.min(h + 1, options.length - 1);
        while (next < options.length - 1 && options[next]?.disabled) next += 1;
        return options[next]?.disabled ? h : next;
      });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((h) => {
        let next = Math.max(h - 1, 0);
        while (next > 0 && options[next]?.disabled) next -= 1;
        return options[next]?.disabled ? h : next;
      });
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (highlighted >= 0 && highlighted < options.length && !options[highlighted].disabled) {
        onChange(options[highlighted].value);
        setOpen(false);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={ref} className="picker-field" style={minWidth ? { minWidth, width: "100%" } : { width: "100%" }}>
      <button
        type="button"
        disabled={disabled}
        className={className}
        onClick={() => {
          if (disabled) return;
          setOpen(!open);
          setHighlighted(options.findIndex((o) => o.value === value));
        }}
        onKeyDown={handleKeyDown}
        title={selected?.label || placeholder}
        style={{
          ...fieldTrigger,
          color: selected ? "var(--ink)" : "var(--ink-faint)",
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.6 : 1,
          ...style,
        }}
      >
        <span className="picker-truncate" style={{ display: "block" }}>
          {selected?.label || placeholder || "Select..."}
        </span>
        <svg
          width="10" height="6" viewBox="0 0 10 6" fill="none"
          style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)" }}
        >
          <path d="M1 1l4 4 4-4" stroke="var(--ink-mute)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && popoverPos && typeof document !== "undefined" && createPortal(
        <div
          ref={popoverRef}
          className="custom-select-dropdown"
          style={{
            position: "fixed",
            top: popoverPos.top,
            left: popoverPos.left,
            width: popoverPos.width,
            boxSizing: "border-box",
            background: "var(--surface)",
            border: "1px solid var(--rule)",
            borderRadius: "var(--r-md)",
            boxShadow: "var(--shadow-md)",
            zIndex: 2600,
            maxHeight: popoverPos.maxHeight,
            overflowY: "auto",
            overflowX: "hidden",
            padding: "4px 0",
          }}
          onKeyDown={handleKeyDown}
        >
          {options.map((opt, i) => {
            const isSelected = opt.value === value;
            const isHighlighted = i === highlighted;
            const isDisabled = !!opt.disabled;
            return (
              <div
                key={opt.value}
                onClick={() => {
                  if (isDisabled) return;
                  onChange(opt.value);
                  setOpen(false);
                }}
                onMouseEnter={() => {
                  if (!isDisabled) setHighlighted(i);
                }}
                title={isDisabled ? `${opt.label} (unavailable)` : opt.label}
                aria-disabled={isDisabled}
                className="picker-option picker-truncate"
                style={{
                  padding: "14px 16px",
                  fontSize: 16,
                  fontFamily: "var(--sans)",
                  cursor: isDisabled ? "not-allowed" : "pointer",
                  background: isDisabled
                    ? "transparent"
                    : isSelected
                      ? "var(--surface-sunk)"
                      : isHighlighted
                        ? "var(--page)"
                        : "transparent",
                  color: isDisabled
                    ? "var(--ink-mute)"
                    : isSelected
                      ? "var(--ink)"
                      : "var(--ink-soft)",
                  fontWeight: isSelected && !isDisabled ? 600 : 400,
                  opacity: isDisabled ? 0.45 : 1,
                  transition: "background .1s",
                }}
              >
                {opt.label}
              </div>
            );
          })}
        </div>,
        document.body,
      )}
    </div>
  );
}
