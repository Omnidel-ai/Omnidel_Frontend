import { useEffect, useState, type ReactNode } from "react";
import { useIsMobile } from "../../hooks/useIsMobile";

export interface TableControlsProps {
  search: string;
  onSearch: (value: string) => void;
  placeholder?: string;
  /** Filter controls rendered to the right of the search box. */
  children?: ReactNode;
  /**
   * Keep search + filters on one line on phones, with the search box shrinking.
   * For toolbars whose add button is an icon and so can share the row.
   */
  inlineOnMobile?: boolean;
}

/**
 * Search box (+ optional filter slot) for the toolbar above a table.
 *
 * The value is the caller's — this does not debounce by itself. Pair it with
 * {@link useDebouncedSearch} when the search drives a request.
 */
export function TableControls({
  search,
  onSearch,
  placeholder = "Search…",
  children,
  inlineOnMobile = false,
}: TableControlsProps) {
  const isMobile = useIsMobile();
  const inline = isMobile && inlineOnMobile;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: inline ? 8 : 10,
        flexWrap: isMobile && !inlineOnMobile ? "wrap" : "nowrap",
        ...(inline ? { flex: "1 1 auto", minWidth: 0 } : null),
      }}
    >
      <div
        style={{
          position: "relative",
          ...(isMobile ? (inline ? { flex: "1 1 auto", minWidth: 0 } : { flex: "1 1 100%" }) : null),
        }}
      >
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--ink-mute)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          style={{ position: "absolute", left: 10, top: 10, pointerEvents: "none" }}
        >
          <circle cx="11" cy="11" r="8" />
          <path d="M21 21l-4.35-4.35" />
        </svg>
        <input
          type="text"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          style={{
            width: isMobile ? "100%" : 280,
            padding: "8px 12px 8px 32px",
            fontSize: 13,
            background: "var(--surface)",
            border: "1px solid var(--rule)",
            borderRadius: "var(--r-sm)",
            color: "var(--ink)",
            outline: "none",
            fontFamily: "var(--sans)",
          }}
        />
      </div>
      {children ? <div className="table-controls-filters">{children}</div> : null}
    </div>
  );
}

/**
 * Delays a search value until typing stops.
 *
 * Values shorter than `minChars` are suppressed, except the empty string,
 * which clears the search.
 */
export function useDebouncedSearch(delay = 450, minChars = 3) {
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const trimmed = searchInput.trim();
    if (trimmed.length > 0 && trimmed.length < minChars) return;
    const id = window.setTimeout(() => setDebouncedSearch(trimmed), delay);
    return () => window.clearTimeout(id);
  }, [searchInput, delay, minChars]);

  return { searchInput, setSearchInput, debouncedSearch };
}
