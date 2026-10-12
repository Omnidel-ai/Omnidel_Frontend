"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useTr } from "@/lib/client/language";

interface Option {
  value: string;
  label: string;
}

export function SearchableSelect({ value, onChange, options, placeholder }: {
  value: string;
  onChange: (v: string) => void;
  options: Option[];
  placeholder?: string;
}) {
  const tr = useTr();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlighted, setHighlighted] = useState(-1);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = options.find(o => o.value === value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [...options].sort((a, b) => a.label.localeCompare(b.label));
    return options
      .filter(o => o.label.toLowerCase().includes(q))
      .sort((a, b) => {
        const aStarts = a.label.toLowerCase().startsWith(q) ? 0 : 1;
        const bStarts = b.label.toLowerCase().startsWith(q) ? 0 : 1;
        if (aStarts !== bStarts) return aStarts - bStarts;
        return a.label.localeCompare(b.label);
      });
  }, [options, query]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  useEffect(() => {
    if (open) {
      setHighlighted(-1);
      setQuery("");
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted(h => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted(h => Math.max(h - 1, -1));
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
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => { setOpen(!open); }}
        onKeyDown={handleKeyDown}
        style={{
          width: "100%",
          padding: "10px 32px 10px 12px",
          fontSize: 13,
          fontFamily: "var(--sans)",
          background: "var(--page)",
          color: selected ? "var(--ink-soft)" : "var(--ink-mute)",
          border: "1px solid var(--rule-strong)",
          borderRadius: "var(--r-sm)",
          cursor: "pointer",
          textAlign: "left",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          position: "relative",
          outline: "none",
        }}
      >
        {/* Same asymmetry CustomSelect had — translate the trigger, not just
            the popover. A miss falls through, so a person's name (what most of
            these options are) renders unchanged. */}
        {(selected?.label ? tr(selected.label) : "") || placeholder || tr("Select...")}
        <svg
          width="10" height="6" viewBox="0 0 10 6" fill="none"
          style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)" }}
        >
          <path d="M1 1l4 4 4-4" stroke="var(--ink-mute)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div
          className="custom-select-dropdown"
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            minWidth: "100%",
            background: "var(--surface)",
            border: "1px solid var(--rule)",
            borderRadius: "var(--r-sm)",
            boxShadow: "var(--shadow-md)",
            zIndex: 100,
            maxHeight: 280,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
          onKeyDown={handleKeyDown}
        >
          {/* Search input */}
          <div style={{ padding: "6px 8px", borderBottom: "1px solid var(--rule)", flexShrink: 0 }}>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => { setQuery(e.target.value); setHighlighted(-1); }}
              placeholder={tr("Search...")}
              style={{
                width: "100%",
                padding: "6px 8px",
                fontSize: 13,
                fontFamily: "var(--sans)",
                background: "var(--page)",
                border: "1px solid var(--rule-strong)",
                borderRadius: "var(--r-sm)",
                color: "var(--ink)",
                outline: "none",
              }}
              onClick={e => e.stopPropagation()}
            />
          </div>

          {/* Options list */}
          <div style={{ overflowY: "auto", maxHeight: 220, padding: "4px 0" }}>
            {filtered.length === 0 ? (
              <div style={{
                padding: "10px 12px",
                fontSize: 13,
                color: "var(--ink-mute)",
                fontFamily: "var(--sans)",
                textAlign: "center",
              }}>
                {tr("No matches")}
              </div>
            ) : (
              filtered.map((opt, i) => {
                const isSelected = opt.value === value;
                const isHighlighted = i === highlighted;
                return (
                  <div
                    key={opt.value}
                    onClick={() => { onChange(opt.value); setOpen(false); setQuery(""); }}
                    onMouseEnter={() => setHighlighted(i)}
                    style={{
                      padding: "7px 12px",
                      fontSize: 13,
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
                    {tr(opt.label)}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
