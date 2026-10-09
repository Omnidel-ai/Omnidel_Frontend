"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTr } from "@/lib/client/language";

export interface LeadOption {
  id: string;
  lead_no: string | null;
  title: string;
  stage?: string;
}

function leadLabel(l: { lead_no: string | null; title: string }): string {
  return l.lead_no ? `${l.lead_no} — ${l.title}` : l.title;
}

// Searchable lead picker. Unlike UserPicker (static list filtered in memory),
// this fetches server-side as you type (debounced) against /api/omnipulse/leads,
// because there can be many leads. Stores lead_id; shows "L-00001 — Title".
export function LeadPicker({
  value,
  onChange,
  placeholder,
  initialLabel,
}: {
  value: string | null;
  onChange: (leadId: string | null, lead: LeadOption | null) => void;
  placeholder?: string;
  initialLabel?: string | null;   // e.g. "L-00042 — Acme office" for an already-linked lead
}) {
  const tr = useTr();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [highlighted, setHighlighted] = useState(-1);
  const [results, setResults] = useState<LeadOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The label shown on the trigger once a lead is chosen (or passed in for an
  // existing link). Cleared when value is cleared.
  const [selectedLabel, setSelectedLabel] = useState<string | null>(initialLabel ?? null);

  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [popoverPos, setPopoverPos] = useState<{
    top?: number;
    bottom?: number;
    left: number;
    width: number;
    listMaxHeight: number;
  } | null>(null);

  useEffect(() => {
    if (!value) setSelectedLabel(null);
    else if (initialLabel) setSelectedLabel(initialLabel);
  }, [value, initialLabel]);

  useLayoutEffect(() => {
    if (!open || !ref.current) {
      setPopoverPos(null);
      return;
    }
    function updatePos() {
      if (!ref.current) return;
      const r = ref.current.getBoundingClientRect();
      const margin = 16;
      const spaceBelow = window.innerHeight - r.bottom;
      const spaceAbove = r.top;
      // Open upward when there isn't enough room below and there's more above.
      const openUp = spaceBelow < 280 && spaceAbove > spaceBelow;
      const shellBudget = (openUp ? spaceAbove : spaceBelow) - margin;
      // Search row + popover padding — reserve before sizing the scrollable list.
      const chrome = 62;
      const listMaxHeight = Math.max(160, Math.min(280, shellBudget - chrome));
      if (openUp) {
        setPopoverPos({ bottom: window.innerHeight - r.top + 4, left: r.left, width: r.width, listMaxHeight });
      } else {
        setPopoverPos({ top: r.bottom + 4, left: r.left, width: r.width, listMaxHeight });
      }
    }
    updatePos();
    window.addEventListener("scroll", updatePos, true);
    window.addEventListener("resize", updatePos);
    return () => {
      window.removeEventListener("scroll", updatePos, true);
      window.removeEventListener("resize", updatePos);
    };
  }, [open]);

  // Debounced server-side search. Fires on open (empty q → recent leads) and as
  // the query changes.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const handle = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const qs = new URLSearchParams({ per_page: "20" });
        if (search.trim()) qs.set("q", search.trim());
        const res = await fetch(`/api/omnipulse/leads?${qs.toString()}`, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!cancelled) setResults(Array.isArray(data?.items) ? data.items : []);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load leads");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 220);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [open, search]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const t = e.target as Node;
      if (ref.current && ref.current.contains(t)) return;
      if (popoverRef.current && popoverRef.current.contains(t)) return;
      setOpen(false);
      setSearch("");
      setHighlighted(-1);
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        setSearch("");
        setHighlighted(-1);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKey);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  function selectAt(index: number) {
    const opt = results[index];
    if (!opt) return;
    onChange(opt.id, opt);
    setSelectedLabel(leadLabel(opt));
    setOpen(false);
    setSearch("");
    setHighlighted(-1);
  }

  function clearSelection(e: React.MouseEvent) {
    e.stopPropagation();
    onChange(null, null);
    setSelectedLabel(null);
  }

  function handleListKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((h) => Math.min(h + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlighted >= 0 && highlighted < results.length) selectAt(highlighted);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      setSearch("");
      setHighlighted(-1);
    }
  }

  return (
    <div ref={ref} className="picker-field">
      <button
        type="button"
        onClick={() => { setOpen((o) => !o); setHighlighted(0); }}
        title={selectedLabel || undefined}
        style={{
          width: "100%",
          padding: "10px 56px 10px 12px",
          fontSize: 13,
          fontFamily: "var(--sans)",
          background: "var(--page)",
          color: selectedLabel ? "var(--ink-soft)" : "var(--ink-mute)",
          border: "1px solid var(--rule-strong)",
          borderRadius: "var(--r-sm)",
          cursor: "pointer",
          textAlign: "left",
          position: "relative",
          outline: "none",
          minWidth: 0,
          overflow: "hidden",
          boxSizing: "border-box",
        }}
      >
        <span className="picker-truncate">
          {selectedLabel || placeholder || tr("Search a lead…")}
        </span>
        {value && (
          <span
            onClick={clearSelection}
            title={tr("Clear")}
            style={{ position: "absolute", right: 28, top: "50%", transform: "translateY(-50%)", color: "var(--ink-mute)", fontSize: 14, lineHeight: 1, padding: "0 4px" }}
          >
            ×
          </span>
        )}
        <svg width="10" height="6" viewBox="0 0 10 6" fill="none" style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)" }}>
          <path d="M1 1l4 4 4-4" stroke="var(--ink-mute)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && popoverPos && typeof document !== "undefined" && createPortal(
        <div
          ref={popoverRef}
          style={{
            position: "fixed",
            boxSizing: "border-box",
            ...(popoverPos.top !== undefined ? { top: popoverPos.top } : { bottom: popoverPos.bottom }),
            left: popoverPos.left,
            width: popoverPos.width,
            maxWidth: `min(${popoverPos.width}px, calc(100vw - ${popoverPos.left}px - 16px))`,
            background: "var(--surface)",
            border: "1px solid var(--rule)",
            borderRadius: "var(--r-sm)",
            boxShadow: "var(--shadow-md)",
            zIndex: 2000,
            padding: "6px",
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setHighlighted(0); }}
            onKeyDown={handleListKeyDown}
            placeholder={tr("Search by lead no or title…")}
            style={{
              width: "100%",
              flexShrink: 0,
              padding: "8px 10px",
              fontSize: 13,
              fontFamily: "var(--sans)",
              background: "var(--page)",
              color: "var(--ink-soft)",
              border: "1px solid var(--rule)",
              borderRadius: "var(--r-sm)",
              outline: "none",
              boxSizing: "border-box",
            }}
          />
          <div
            className="themed-scroll-y picker-list-scroll"
            style={{
              maxHeight: popoverPos.listMaxHeight,
              overflowY: "auto",
              overflowX: "hidden",
            }}
            onKeyDown={handleListKeyDown}
          >
            {loading && <div style={hintStyle}>{tr("Loading…")}</div>}
            {!loading && error && <div style={{ ...hintStyle, color: "var(--crit)" }}>{error}</div>}
            {!loading && !error && results.length === 0 && <div style={hintStyle}>{tr("No leads found")}</div>}
            {!loading && !error && results.map((l, i) => {
              const isSelected = l.id === value;
              const isHighlighted = i === highlighted;
              const label = leadLabel(l);
              return (
                <div
                  key={l.id}
                  onClick={() => selectAt(i)}
                  onMouseEnter={() => setHighlighted(i)}
                  title={label}
                  className="picker-option picker-truncate"
                  style={{
                    padding: "7px 12px",
                    fontSize: 13,
                    lineHeight: 1.4,
                    fontFamily: "var(--sans)",
                    cursor: "pointer",
                    borderRadius: "var(--r-sm)",
                    background: isSelected ? "var(--green-wash)" : isHighlighted ? "var(--surface-sunk)" : "transparent",
                    color: isSelected ? "var(--green-deep)" : "var(--ink-soft)",
                    fontWeight: isSelected ? 600 : 400,
                    transition: "background .1s",
                  }}
                >
                  {label}
                </div>
              );
            })}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

const hintStyle: React.CSSProperties = {
  padding: "8px 10px",
  fontSize: 12,
  fontFamily: "var(--sans)",
  color: "var(--ink-mute)",
};
