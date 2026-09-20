import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

export interface SelectOption {
  value: string;
  label: string;
  /** Small leading dot — priority / status colour. */
  color?: string;
  /** Muted and not selectable. */
  disabled?: boolean;
}

export interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  /** Slim trigger that lines up with 12px buttons (pagination rows). */
  compact?: boolean;
  /** Open upward when there is more room above the trigger. */
  preferOpenUpward?: boolean;
  /** Clicking the selected option clears the value (fires onChange("")). */
  allowDeselect?: boolean;
  /** Renders an icon trigger instead of the label — same dropdown. */
  icon?: ReactNode;
  /** Floor for the dropdown width; defaults to the trigger width. */
  dropdownMinWidth?: number;
  /** Merged onto the trigger button. */
  style?: CSSProperties;
  className?: string;
  "aria-label"?: string;
}

interface PopoverPos {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
}

const GAP = 4;
const MAX_DROPDOWN_H = 260;

/**
 * The app's select: a styled trigger plus a dropdown portalled to <body>.
 *
 * The portal is the point — an absolutely positioned list is clipped by any
 * ancestor with `overflow: auto/hidden` (a scrollable modal, a table viewport),
 * and every select in the app sits inside one of those sooner or later.
 *
 * States: closed · open · selected · placeholder · disabled control ·
 * disabled option · keyboard highlight.
 */
export function CustomSelect({
  value,
  onChange,
  options,
  placeholder,
  disabled = false,
  compact = false,
  preferOpenUpward = false,
  allowDeselect = false,
  icon,
  dropdownMinWidth,
  style,
  className,
  "aria-label": ariaLabel,
}: CustomSelectProps) {
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const [pos, setPos] = useState<PopoverPos | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);

  const place = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const below = window.innerHeight - r.bottom - 8;
    const above = r.top - 8;
    const openUp = preferOpenUpward ? above > 120 : below < 160 && above > below;
    const maxHeight = Math.min(MAX_DROPDOWN_H, Math.max(120, openUp ? above : below));
    setPos({
      top: openUp ? r.top - GAP - maxHeight : r.bottom + GAP,
      left: r.left,
      width: r.width,
      maxHeight,
    });
  }, [preferOpenUpward]);

  useLayoutEffect(() => {
    if (!open) return;
    place();
  }, [open, place]);

  // Reposition rather than drift: a scroll or resize while open would leave a
  // fixed-position dropdown behind its trigger.
  useEffect(() => {
    if (!open) return;
    const onMove = () => place();
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    return () => {
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
    };
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      if (wrapRef.current?.contains(t) || popoverRef.current?.contains(t)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  function commit(opt: SelectOption) {
    if (opt.disabled) return;
    onChange(allowDeselect && opt.value === value ? "" : opt.value);
    setOpen(false);
    triggerRef.current?.focus();
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (disabled) return;
    if (e.key === "Escape") {
      setOpen(false);
      return;
    }
    if (!open && (e.key === "Enter" || e.key === " " || e.key === "ArrowDown")) {
      e.preventDefault();
      setOpen(true);
      setHighlighted(options.findIndex((o) => o.value === value));
      return;
    }
    if (!open) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const dir = e.key === "ArrowDown" ? 1 : -1;
      let next = highlighted;
      for (let i = 0; i < options.length; i++) {
        next = (next + dir + options.length) % options.length;
        if (!options[next].disabled) break;
      }
      setHighlighted(next);
      return;
    }
    if (e.key === "Enter" && highlighted >= 0) {
      e.preventDefault();
      commit(options[highlighted]);
    }
  }

  const label = selected?.label ?? placeholder ?? "Select…";

  return (
    <div className="picker-field" ref={wrapRef}>
      <button
        type="button"
        ref={triggerRef}
        disabled={disabled}
        className={className}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        title={selected?.label ?? placeholder}
        onClick={() => {
          if (disabled) return;
          setOpen((o) => !o);
          setHighlighted(options.findIndex((o) => o.value === value));
        }}
        onKeyDown={handleKeyDown}
        style={{
          width: icon ? "auto" : "100%",
          padding: icon
            ? compact
              ? "6px 22px 6px 8px"
              : "9px 24px 9px 10px"
            : compact
              ? "6px 28px 6px 10px"
              : "10px 32px 10px 12px",
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
          ...style,
        }}
      >
        {icon ? (
          <span aria-hidden="true" style={{ display: "inline-flex", alignItems: "center" }}>
            {icon}
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
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  flexShrink: 0,
                  background: selected.color,
                }}
              />
            )}
            <span className="picker-truncate">{label}</span>
          </span>
        )}
        <svg
          width="10"
          height="6"
          viewBox="0 0 10 6"
          fill="none"
          aria-hidden="true"
          style={{
            position: "absolute",
            right: icon ? 8 : 10,
            top: "50%",
            transform: "translateY(-50%)",
          }}
        >
          <path
            d="M1 1l4 4 4-4"
            stroke="var(--ink-mute)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open &&
        pos &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={popoverRef}
            role="listbox"
            className="custom-select-dropdown"
            onKeyDown={handleKeyDown}
            style={{
              position: "fixed",
              top: pos.top,
              left: pos.left,
              width: Math.max(pos.width, dropdownMinWidth ?? 0),
              background: "var(--surface)",
              border: "1px solid var(--rule)",
              borderRadius: "var(--r-sm)",
              boxShadow: "var(--shadow-md)",
              // Matches --z-select in global.css; a portalled node is outside
              // the stylesheet's reach for this one property.
              zIndex: 2600,
              maxHeight: pos.maxHeight,
              overflowY: "auto",
              overflowX: "hidden",
              padding: "4px 0",
            }}
          >
            {options.length === 0 && (
              <div style={{ padding: "10px 12px", fontSize: 12, color: "var(--ink-mute)" }}>
                No options
              </div>
            )}
            {options.map((opt, i) => {
              const isSelected = opt.value === value;
              const isHighlighted = i === highlighted;
              return (
                <div
                  key={opt.value}
                  role="option"
                  aria-selected={isSelected}
                  aria-disabled={opt.disabled || undefined}
                  title={opt.label}
                  className="picker-option picker-truncate"
                  onClick={() => commit(opt)}
                  onMouseEnter={() => {
                    if (!opt.disabled) setHighlighted(i);
                  }}
                  style={{
                    padding: "7px 12px",
                    fontSize: 13,
                    fontFamily: "var(--sans)",
                    cursor: opt.disabled ? "not-allowed" : "pointer",
                    background: opt.disabled
                      ? "transparent"
                      : isSelected
                        ? "var(--surface-sunk)"
                        : isHighlighted
                          ? "var(--page)"
                          : "transparent",
                    color: opt.disabled
                      ? "var(--ink-mute)"
                      : isSelected
                        ? "var(--ink)"
                        : "var(--ink-soft)",
                    fontWeight: isSelected && !opt.disabled ? 600 : 400,
                    opacity: opt.disabled ? 0.45 : 1,
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
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        flexShrink: 0,
                        background: opt.color,
                      }}
                    />
                  )}
                  <span className="picker-truncate">{opt.label}</span>
                </div>
              );
            })}
          </div>,
          document.body,
        )}
    </div>
  );
}
