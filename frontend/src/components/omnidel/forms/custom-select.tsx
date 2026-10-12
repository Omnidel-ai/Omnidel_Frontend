"use client";

import { useState, useRef, useEffect, useLayoutEffect, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { useTr } from "@/lib/client/language";

interface Option {
  value: string;
  label: string;
  /** Optional priority/status-style color for a small leading dot. */
  color?: string;
  /** When true, option is muted and not selectable. */
  disabled?: boolean;
}

export function CustomSelect({ value, onChange, options, placeholder, disabled, minWidth, preferOpenUpward, compact, style, className, icon, dropdownMinWidth, allowDeselect, fillHeight, splitLabel }: {
  value: string;
  onChange: (v: string) => void;
  options: Option[];
  placeholder?: string;
  disabled?: boolean;
  minWidth?: number;
  preferOpenUpward?: boolean;
  // Slim trigger that matches the height of adjacent 12px buttons (e.g. the
  // Prev/Next controls in Pagination). Default sizing is unchanged.
  compact?: boolean;
  /** Merged onto the trigger button (overrides defaults like background/border). */
  style?: CSSProperties;
  className?: string;
  /** When set, the trigger renders this icon INSTEAD of the selected label —
   *  a compact icon-button that still opens the same dropdown. The trigger
   *  sizes to its content instead of stretching to 100%. Existing (no-icon)
   *  callers are unaffected. */
  icon?: React.ReactNode;
  /** Floor for the portal dropdown width. Useful in icon mode where the trigger
   *  is too narrow for the option labels. Defaults to the trigger width. */
  dropdownMinWidth?: number;
  /** When true, clicking the already-selected option clears the value (onChange("")). */
  allowDeselect?: boolean;
  /** Stretch the trigger to the full height of a flex/grid parent cell. */
  fillHeight?: boolean;
  /** When selected: keep placeholder as a left label, show the value on the right. */
  splitLabel?: boolean;
}) {
  const tr = useTr();
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const ref = useRef<HTMLDivElement>(null);
  // Popover position is computed from the trigger's bounding rect so we can
  // render the dropdown via portal at <body> with position:fixed. This is the
  // ONLY way the dropdown can escape parent containers that have
  // overflow:auto / hidden (e.g. the scrollable Members modal list) — absolute
  // positioning would get clipped by those ancestors.
  const popoverRef = useRef<HTMLDivElement>(null);
  const [popoverPos, setPopoverPos] = useState<{
    top: number; left: number; width: number; maxHeight: number;
  } | null>(null);

  const selected = options.find(o => o.value === value);

  useLayoutEffect(() => {
    if (!open || !ref.current) {
      setPopoverPos(null);
      return;
    }
    const gap = 4;
    const preferredMaxHeight = 240;
    const estimatedRowHeight = 33;

    function updatePos() {
      if (!ref.current) return;
      const r = ref.current.getBoundingClientRect();
      const measuredHeight = popoverRef.current?.offsetHeight;
      const menuHeight = measuredHeight ?? Math.min(options.length * estimatedRowHeight + 8, preferredMaxHeight);
      const spaceBelow = window.innerHeight - r.bottom - gap;
      const spaceAbove = r.top - gap;
      const openUpward = preferOpenUpward || (menuHeight > spaceBelow && spaceAbove > spaceBelow);
      const availableSpace = (openUpward ? spaceAbove : spaceBelow) - 8;
      const maxHeight = Math.min(preferredMaxHeight, Math.max(availableSpace, 80));
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
        setHighlighted(options.findIndex(o => o.value === value));
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
        const next = options[highlighted].value;
        onChange(allowDeselect && next === value ? "" : next);
        setOpen(false);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div
      ref={ref}
      className="picker-field"
      style={{
        ...(minWidth ? { minWidth } : null),
        ...(fillHeight ? { height: "100%" } : null),
      }}
    >
      <button
        type="button"
        disabled={disabled}
        className={className}
        onClick={() => {
          if (disabled) return;
          setOpen(!open);
          setHighlighted(options.findIndex(o => o.value === value));
        }}
        onKeyDown={handleKeyDown}
        title={
          splitLabel && selected && placeholder
            ? `${placeholder}: ${tr(selected.label)}`
            : (selected?.label || placeholder)
        }
        style={{
          width: icon ? "auto" : "100%",
          padding: icon
            ? (compact ? "6px 22px 6px 8px" : "9px 24px 9px 10px")
            : (compact ? "6px 28px 6px 10px" : "10px 32px 10px 12px"),
          fontSize: compact ? 12 : 13,
          fontFamily: "var(--sans)",
          background: "var(--page)",
          color: selected ? "var(--ink-soft)" : "var(--ink-mute)",
          border: "1px solid var(--rule-strong)",
          borderRadius: "var(--r-sm)",
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.6 : 1,
          textAlign: "left",
          position: "relative",
          outline: "none",
          minWidth: 0,
          overflow: "hidden",
          boxSizing: "border-box",
          ...((fillHeight || (splitLabel && selected))
            ? { height: fillHeight ? "100%" : undefined, display: "flex", alignItems: "center" }
            : null),
          ...style,
        }}
      >
        {icon ? (
          <span aria-hidden="true" style={{ display: "inline-flex", alignItems: "center" }}>{icon}</span>
        ) : splitLabel && selected && placeholder ? (
          <span
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
              width: "100%",
              minWidth: 0,
              paddingRight: 14,
            }}
          >
            <span style={{
              color: "var(--ink-mute)",
              fontWeight: 500,
              flexShrink: 0,
              whiteSpace: "nowrap",
            }}>
              {placeholder}
            </span>
            <span
              className="picker-truncate"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "flex-end",
                gap: 6,
                minWidth: 0,
                color: "var(--ink-soft)",
                fontWeight: 600,
                textAlign: "right",
              }}
            >
              {selected.color && (
                <span
                  aria-hidden="true"
                  style={{
                    width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
                    background: selected.color,
                  }}
                />
              )}
              <span className="picker-truncate">{tr(selected.label)}</span>
            </span>
          </span>
        ) : (
          <span
            className="picker-truncate"
            style={{ display: "inline-flex", alignItems: "center", gap: 8, minWidth: 0 }}
          >
            {selected?.color && (
              <span
                aria-hidden="true"
                style={{
                  width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
                  background: selected.color,
                }}
              />
            )}
            {/* tr() here too. The dropdown LIST translated its options and the
                labelled variant above translated the trigger, but this — the
                plain closed trigger, which is what almost every select on the
                app actually renders — showed the raw English. "Active",
                "Live", "All types", "Last 7 days" and every sort order read in
                English on an otherwise translated page, and opening the same
                select showed the very same option in Bengali. */}
            <span className="picker-truncate">
              {(selected?.label ? tr(selected.label) : "") || placeholder || tr("Select...")}
            </span>
          </span>
        )}
        <svg
          width="10" height="6" viewBox="0 0 10 6" fill="none"
          style={{ position: "absolute", right: icon ? 8 : 10, top: "50%", transform: "translateY(-50%)" }}
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
            width: Math.max(popoverPos.width, dropdownMinWidth ?? 0),
            boxSizing: "border-box",
            background: "var(--surface)",
            border: "1px solid var(--rule)",
            borderRadius: "var(--r-sm)",
            boxShadow: "var(--shadow-md)",
            // Above DatePicker popover (2500) when Recurring is nested under due date.
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
                  onChange(allowDeselect && isSelected ? "" : opt.value);
                  setOpen(false);
                }}
                onMouseEnter={() => {
                  if (!isDisabled) setHighlighted(i);
                }}
                title={isDisabled ? `${tr(opt.label)} (${tr("unavailable")})` : tr(opt.label)}
                aria-disabled={isDisabled}
                className="picker-option picker-truncate"
                style={{
                  padding: "7px 12px",
                  fontSize: 13,
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
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                {opt.color && (
                  <span
                    aria-hidden="true"
                    style={{
                      width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
                      background: opt.color,
                      opacity: isDisabled ? 0.5 : 1,
                    }}
                  />
                )}
                <span className="picker-truncate">{tr(opt.label)}</span>
              </div>
            );
          })}
        </div>,
        document.body
      )}
    </div>
  );
}
