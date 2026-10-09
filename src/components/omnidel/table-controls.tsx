"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useStrings, useTr } from "@/lib/client/language";
import { CustomSelect } from "@/components/omnidel/custom-select";
import { useIsMobile } from "@/lib/client/use-is-mobile";

export function TableControls({ search, onSearch, children, inlineOnMobile = false }: {
  search: string;
  onSearch: (v: string) => void;
  children?: React.ReactNode;
  /**
   * Keep search + filters on a single line on phones, with the search box
   * shrinking to whatever the filters leave. For toolbars whose action button
   * is an icon and so can share the row (see TableAddButton). Off by default —
   * pages without one still read better with a full-width search.
   */
  inlineOnMobile?: boolean;
}) {
  const str = useStrings();
  // On mobile the fixed 280px search + filter buttons overflow; let the search
  // take the full row and the controls wrap below. Desktop keeps the 280px row.
  const isMobile = useIsMobile();
  const inline = isMobile && inlineOnMobile;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: inline ? 8 : 10,
        flexWrap: isMobile && !inlineOnMobile ? "wrap" : "nowrap",
        // Shrinkable so the sibling action button keeps its full width.
        ...(inline ? { flex: "1 1 auto", minWidth: 0 } : null),
      }}
    >
      <div style={{ position: "relative", ...(isMobile ? (inline ? { flex: "1 1 auto", minWidth: 0 } : { flex: "1 1 100%" }) : null) }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--ink-mute)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ position: "absolute", left: 10, top: 10 }}>
          <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
        </svg>
        <input
          type="text"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder={str.ui.searchPlaceholder}
          style={{
            width: isMobile ? "100%" : 280, padding: "8px 12px 8px 32px", fontSize: 13,
            background: "var(--surface)", border: "1px solid var(--rule)",
            borderRadius: "var(--r-sm)", color: "var(--ink)",
            outline: "none", fontFamily: "var(--sans)",
            boxSizing: "border-box",
          }}
        />
      </div>
      {children ? (
        <div className="table-controls-filters">{children}</div>
      ) : null}
    </div>
  );
}

const DEFAULT_PER_PAGE_OPTIONS = [10, 20, 30, 50];

export function Pagination({ page, total, perPage, onChange, label, perPageOptions, onPerPageChange, hideTotal }: {
  page: number; total: number; perPage: number; onChange: (p: number) => void; label?: string;
  perPageOptions?: number[];
  onPerPageChange?: (n: number) => void;
  /** Hide the left “N leads / playlists” count. */
  hideTotal?: boolean;
}) {
  const str = useStrings();
  const tr = useTr();
  const isMobile = useIsMobile();
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const pageOptions = perPageOptions ?? DEFAULT_PER_PAGE_OPTIONS;
  const showRange = total > 0;

  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      marginTop: 12, padding: "0 2px", flexWrap: "wrap", gap: 8,
      minWidth: 0, maxWidth: "100%",
    }}>
      {/* Total count — bottom left */}
      {hideTotal ? (
        <span />
      ) : (
        <span style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--ink-mute)", flexShrink: 0 }}>
          {/* `label` is the caller's noun — "leads", "kaarigars", "areas". Some
              callers already pass tr("..."), most pass the bare English; tr() is
              a no-op on an already-translated string, so this covers both. */}
          {total} {tr(label || "total")}
        </span>
      )}

      {/* Pagination — bottom right. On phones, allow the range/rows/buttons
          cluster to wrap so it never forces page-level horizontal scroll.
          Desktop keeps a single nowrap row (unchanged). */}
      {(showRange || totalPages > 1 || onPerPageChange) && (
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexWrap: isMobile ? "wrap" : "nowrap",
          justifyContent: isMobile ? "flex-end" : undefined,
          minWidth: 0,
          maxWidth: "100%",
        }}>
          {showRange && (
            <span style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--ink-mute)", whiteSpace: "nowrap" }}>
              {(page - 1) * perPage + 1}–{Math.min(page * perPage, total)} {tr("of")} {total}
            </span>
          )}
          {onPerPageChange && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
              <span style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--ink-mute)", whiteSpace: "nowrap" }}>{str.ui.rows}</span>
              <div style={{ width: 64 }}>
                <CustomSelect
                  value={String(perPage)}
                  onChange={(v) => onPerPageChange(Number(v))}
                  options={pageOptions.map((n) => ({ value: String(n), label: String(n) }))}
                  preferOpenUpward
                  compact
                />
              </div>
            </div>
          )}
          {(totalPages > 1 || onPerPageChange) && (
            <>
              <button onClick={() => onChange(page - 1)} disabled={page <= 1} style={pgBtnStyle(page <= 1)}>{str.ui.prev}</button>
              <button onClick={() => onChange(page + 1)} disabled={page >= totalPages} style={pgBtnStyle(page >= totalPages)}>{str.ui.next}</button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function pgBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    padding: "6px 14px", fontSize: 12, fontWeight: 500,
    background: disabled ? "transparent" : "var(--surface)",
    border: "1px solid var(--rule-strong)", borderRadius: "var(--r-sm)",
    cursor: disabled ? "not-allowed" : "pointer",
    color: disabled ? "var(--ink-faint)" : "var(--ink)",
    fontFamily: "var(--sans)", opacity: disabled ? 0.5 : 1,
  };
}

/**
 * Core server-driven pagination hook.
 *
 * @param initialPerPage - Rows per page (default 10).
 * @param total          - Total record count from the server. When provided,
 *                         `page` is clamped to `max(1, ceil(total/perPage))`
 *                         whenever `total` changes (prevents the "page 5 of
 *                         1-page result" empty-table bug).
 * @param resetKey       - Any value (e.g. the current `debouncedSearch`).
 *                         When this value changes, `page` resets to 1.
 *                         Pass the debounced search term here to fix the
 *                         "search then stale page" bug.
 */
export function useTablePagination(
  initialPerPage = 10,
  total?: number,
  resetKey?: unknown,
) {
  const [page, setPage] = useState(1);
  const [perPage, setPerPageState] = useState(initialPerPage);

  // Reset to page 1 when the search/filter key changes.
  const prevResetKey = useRef(resetKey);
  useEffect(() => {
    if (prevResetKey.current !== resetKey) {
      prevResetKey.current = resetKey;
      setPage(1);
    }
  }, [resetKey]);

  // Clamp page whenever total or perPage changes.
  useEffect(() => {
    if (total === undefined) return;
    const totalPages = Math.max(1, Math.ceil(total / perPage));
    setPage((p) => Math.min(p, totalPages));
  }, [total, perPage]);

  const setPerPage = useCallback((n: number) => {
    setPerPageState(n);
    setPage(1);
  }, []);

  return { page, setPage, perPage, setPerPage };
}

export function usePagination<T>(items: T[], perPage: number) {
  const [page, setPage] = useState(1);
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));

  // Clamp page whenever total / perPage changes (e.g. search narrows results).
  useEffect(() => {
    setPage((p) => Math.min(p, totalPages));
  }, [totalPages]);

  const paginated = items.slice((page - 1) * perPage, page * perPage);
  return { page, setPage, total, paginated, perPage };
}

/**
 * Debounced search hook — delays propagation of the raw input value
 * so that consumers only see a new `debouncedSearch` after the user
 * stops typing for `delay` ms.  Values shorter than `minChars` are
 * suppressed (except empty‑string, which clears the search).
 *
 * Usage:
 *   const { searchInput, setSearchInput, debouncedSearch: search } = useDebouncedSearch();
 *   <TableControls search={searchInput} onSearch={setSearchInput} />
 *   // use `search` in your fetch useCallback deps — it only changes after the debounce.
 */
export function useDebouncedSearch(delay = 450, minChars = 3) {
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const trimmed = searchInput.trim();
    // Allow empty string (to clear search) or minChars+ characters
    if (trimmed.length > 0 && trimmed.length < minChars) return;
    const id = window.setTimeout(() => setDebouncedSearch(trimmed), delay);
    return () => window.clearTimeout(id);
  }, [searchInput, delay, minChars]);

  return { searchInput, setSearchInput, debouncedSearch };
}
