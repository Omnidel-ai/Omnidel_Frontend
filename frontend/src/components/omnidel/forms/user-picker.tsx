"use client";

// UNUSED — Page audit 2026-09-16: nothing in src/ imports this module.
// No importers (348 lines).
// Deletion candidate. See docs/architecture/page-audit-2026-09-16.md.

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cachedJson } from "@/lib/client/options-cache";
import { useTr } from "@/lib/client/language";

interface UserOption {
  id: string;
  name: string;
}

export function UserPicker({
  value,
  onChange,
  placeholder,
  excludeIds,
}: {
  value: string | null;
  onChange: (userId: string) => void;
  placeholder?: string;
  excludeIds?: string[];
}) {
  const tr = useTr();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [highlighted, setHighlighted] = useState(-1);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Popover is portaled to <body> with position:fixed so it escapes parent
  // overflow:auto/hidden containers (e.g. the scrollable Workspace Members
  // list). Coords come from the trigger's bounding rect.
  const popoverRef = useRef<HTMLDivElement>(null);
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number; width: number } | null>(null);

  useLayoutEffect(() => {
    if (!open || !ref.current) {
      setPopoverPos(null);
      return;
    }
    function updatePos() {
      if (!ref.current) return;
      const r = ref.current.getBoundingClientRect();
      setPopoverPos({ top: r.bottom + 4, left: r.left, width: r.width });
    }
    updatePos();
    window.addEventListener("scroll", updatePos, true);
    window.addEventListener("resize", updatePos);
    return () => {
      window.removeEventListener("scroll", updatePos, true);
      window.removeEventListener("resize", updatePos);
    };
  }, [open]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await cachedJson<{ users?: { id: string; name: string }[] }>("/api/omnipulse/tasks/options");
        if (!cancelled) {
          setUsers(Array.isArray(data?.users) ? data.users : []);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load users");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

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
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  const excludeSet = useMemo(() => new Set(excludeIds || []), [excludeIds]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter(u => {
      if (excludeSet.has(u.id) && u.id !== value) return false;
      if (!q) return true;
      return (u.name || "").toLowerCase().includes(q);
    });
  }, [users, search, excludeSet, value]);

  const selected = users.find(u => u.id === value) || null;

  function selectAt(index: number) {
    const opt = filtered[index];
    if (!opt) return;
    onChange(opt.id);
    setOpen(false);
    setSearch("");
    setHighlighted(-1);
  }

  function handleTriggerKeyDown(e: React.KeyboardEvent) {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setOpen(true);
        setHighlighted(0);
      }
    }
  }

  function handleListKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted(h => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted(h => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlighted >= 0 && highlighted < filtered.length) {
        selectAt(highlighted);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      setSearch("");
      setHighlighted(-1);
    }
  }

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => {
          setOpen(o => !o);
          setHighlighted(0);
        }}
        onKeyDown={handleTriggerKeyDown}
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
        {selected ? selected.name : placeholder || tr("Select user...")}
        <svg
          width="10"
          height="6"
          viewBox="0 0 10 6"
          fill="none"
          style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)" }}
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

      {open && popoverPos && typeof document !== "undefined" && createPortal(
        <div
          ref={popoverRef}
          style={{
            position: "fixed",
            top: popoverPos.top,
            left: popoverPos.left,
            // Autofit width: at minimum the trigger's width, but grow to fit
            // the longest user name (so 'GunoMata Reena J Sarkar' isn't clipped).
            // Cap at the viewport edge so it never escapes the right side.
            minWidth: popoverPos.width,
            width: "max-content",
            maxWidth: `calc(100vw - ${popoverPos.left}px - 16px)`,
            maxHeight: 280,
            background: "var(--surface)",
            border: "1px solid var(--rule)",
            borderRadius: "var(--r-sm)",
            boxShadow: "var(--shadow-md)",
            zIndex: 2000,
            padding: "6px",
            display: "flex",
            flexDirection: "column",
            gap: 6,
            overflow: "hidden",   // belt-and-braces — outer popover never extends past maxHeight
          }}
        >
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={e => {
              setSearch(e.target.value);
              setHighlighted(0);
            }}
            onKeyDown={handleListKeyDown}
            placeholder={tr("Search users...")}
            style={{
              width: "100%",
              padding: "8px 10px",
              fontSize: 13,
              fontFamily: "var(--sans)",
              background: "var(--page)",
              color: "var(--ink-soft)",
              border: "1px solid var(--rule)",
              borderRadius: "var(--r-sm)",
              outline: "none",
            }}
          />
          <div
            className="themed-scroll-y"
            style={{
              // Inner list takes the remaining space inside the 260px popover.
              // flex:1 + minHeight:0 lets the scroll engage at the right size
              // regardless of how tall the search input renders.
              flex: 1,
              minHeight: 0,
              maxHeight: 200,
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
            }}
            onKeyDown={handleListKeyDown}
          >
            {loading && (
              <div
                style={{
                  padding: "8px 10px",
                  fontSize: 12,
                  fontFamily: "var(--sans)",
                  color: "var(--ink-mute)",
                }}
              >
                {tr("Loading...")}
              </div>
            )}
            {!loading && error && (
              <div
                style={{
                  padding: "8px 10px",
                  fontSize: 12,
                  fontFamily: "var(--sans)",
                  color: "var(--crit)",
                }}
              >
                {error}
              </div>
            )}
            {!loading && !error && filtered.length === 0 && (
              <div
                style={{
                  padding: "8px 10px",
                  fontSize: 12,
                  fontFamily: "var(--sans)",
                  color: "var(--ink-mute)",
                }}
              >
                {tr("No users found")}
              </div>
            )}
            {!loading && !error && filtered.map((u, i) => {
              const isSelected = u.id === value;
              const isHighlighted = i === highlighted;
              return (
                <div
                  key={u.id}
                  onClick={() => selectAt(i)}
                  onMouseEnter={() => setHighlighted(i)}
                  style={{
                    // The popover auto-fits content width, so rows keep
                    // names on a single line WITHOUT truncation — they're
                    // fully visible because the dropdown grew to fit.
                    padding: "7px 12px",
                    fontSize: 13,
                    lineHeight: 1.4,
                    fontFamily: "var(--sans)",
                    cursor: "pointer",
                    borderRadius: "var(--r-sm)",
                    background: isSelected
                      ? "var(--green-wash)"
                      : isHighlighted
                      ? "var(--surface-sunk)"
                      : "transparent",
                    color: isSelected ? "var(--green-deep)" : "var(--ink-soft)",
                    fontWeight: isSelected ? 600 : 400,
                    transition: "background .1s",
                    whiteSpace: "nowrap",
                  }}
                >
                  {u.name || tr("(unnamed)")}
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
