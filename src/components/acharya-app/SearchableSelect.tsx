"use client";

/**
 * Searchable select for long lists (trade / state / city).
 * Trigger chrome matches acharya auth/profile form fields; filter behaviour
 * follows OmniDel SearchableSelect (type-to-filter + starts-with sort).
 * Portal positioning from OmniDel CustomSelect (escape overflow shells).
 */
import { useState, useRef, useEffect, useLayoutEffect, useMemo } from "react";
import { createPortal } from "react-dom";

interface Option {
  value: string;
  label: string;
}

export default function SearchableSelect({
  value,
  onChange,
  options,
  placeholder,
  disabled,
  preferOpenUpward,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Option[];
  placeholder?: string;
  disabled?: boolean;
  preferOpenUpward?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlighted, setHighlighted] = useState(-1);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [popoverPos, setPopoverPos] = useState<{
    top: number; left: number; width: number; maxHeight: number;
  } | null>(null);

  const selected = options.find((o) => o.value === value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [...options].sort((a, b) => a.label.localeCompare(b.label));
    return options
      .filter((o) => o.label.toLowerCase().includes(q))
      .sort((a, b) => {
        const aStarts = a.label.toLowerCase().startsWith(q) ? 0 : 1;
        const bStarts = b.label.toLowerCase().startsWith(q) ? 0 : 1;
        if (aStarts !== bStarts) return aStarts - bStarts;
        return a.label.localeCompare(b.label);
      });
  }, [options, query]);

  useLayoutEffect(() => {
    if (!open || !ref.current) {
      setPopoverPos(null);
      return;
    }
    const gap = 4;
    const preferredMaxHeight = 300;
    const estimatedRowHeight = 48;
    const searchBoxHeight = 56;

    function updatePos() {
      if (!ref.current) return;
      const r = ref.current.getBoundingClientRect();
      const measuredHeight = popoverRef.current?.offsetHeight;
      const menuHeight = measuredHeight
        ?? Math.min(filtered.length * estimatedRowHeight + searchBoxHeight + 8, preferredMaxHeight);
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
  }, [open, filtered.length, preferOpenUpward]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const t = e.target as Node;
      if (ref.current && ref.current.contains(t)) return;
      if (popoverRef.current && popoverRef.current.contains(t)) return;
      setOpen(false);
      setQuery("");
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setHighlighted(-1);
    setQuery("");
    const t = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [open]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (disabled) return;
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((h) => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((h) => Math.max(h - 1, -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlighted >= 0 && highlighted < filtered.length) {
        onChange(filtered[highlighted].value);
        setOpen(false);
        setQuery("");
      }
    } else if (e.key === "Escape") {
      setOpen(false);
      setQuery("");
    }
  }

  return (
    <div ref={ref} className="picker-field" style={{ position: "relative", width: "100%" }}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          setOpen(!open);
        }}
        onKeyDown={handleKeyDown}
        title={selected?.label || placeholder}
        style={{
          // Match RegisterClient `inputStyle` + profile `formInputStyle` field chrome
          width: "100%",
          boxSizing: "border-box",
          minHeight: 48,
          padding: "14px 40px 14px 16px",
          fontSize: 16,
          fontFamily: "var(--sans)",
          background: "var(--surface)",
          color: selected ? "var(--ink)" : "var(--ink-faint)",
          border: "1px solid var(--rule)",
          borderRadius: "var(--r-md)",
          boxShadow: "var(--shadow-sm)",
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.6 : 1,
          textAlign: "left",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          position: "relative",
          outline: "none",
          minWidth: 0,
        }}
      >
        {selected?.label || placeholder || "Select..."}
        <svg
          width="10"
          height="6"
          viewBox="0 0 10 6"
          fill="none"
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
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
          onKeyDown={handleKeyDown}
        >
          <div
            style={{
              padding: "10px 12px",
              borderBottom: "1px solid var(--rule)",
              flexShrink: 0,
              background: "var(--surface)",
            }}
          >
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setHighlighted(-1);
              }}
              placeholder="Search..."
              style={{
                width: "100%",
                boxSizing: "border-box",
                minHeight: 44,
                padding: "10px 12px",
                fontSize: 16,
                fontFamily: "var(--sans)",
                background: "var(--page)",
                border: "1px solid var(--rule)",
                borderRadius: "var(--r-md)",
                color: "var(--ink)",
                outline: "none",
              }}
              onClick={(e) => e.stopPropagation()}
            />
          </div>

          <div style={{ overflowY: "auto", maxHeight: 240, padding: "4px 0", minHeight: 0 }}>
            {filtered.length === 0 ? (
              <div
                style={{
                  padding: "16px 14px",
                  fontSize: 15,
                  color: "var(--ink-mute)",
                  fontFamily: "var(--sans)",
                  textAlign: "center",
                }}
              >
                No matches
              </div>
            ) : (
              filtered.map((opt, i) => {
                const isSelected = opt.value === value;
                const isHighlighted = i === highlighted;
                return (
                  <div
                    key={opt.value}
                    onClick={() => {
                      onChange(opt.value);
                      setOpen(false);
                      setQuery("");
                    }}
                    onMouseEnter={() => setHighlighted(i)}
                    style={{
                      padding: "14px 16px",
                      fontSize: 16,
                      fontFamily: "var(--sans)",
                      cursor: "pointer",
                      background: isSelected
                        ? "var(--surface-sunk)"
                        : isHighlighted
                          ? "var(--page)"
                          : "transparent",
                      color: isSelected ? "var(--ink)" : "var(--ink-soft)",
                      fontWeight: isSelected ? 600 : 400,
                      transition: "background .1s",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {opt.label}
                  </div>
                );
              })
            )}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
