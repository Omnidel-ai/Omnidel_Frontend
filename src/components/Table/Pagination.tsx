import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { CustomSelect } from "../Select/CustomSelect";
import { useIsMobile } from "../../hooks/useIsMobile";

const DEFAULT_PER_PAGE_OPTIONS = [10, 20, 30, 50];

export interface PaginationProps {
  /** 1-based. */
  page: number;
  total: number;
  perPage: number;
  onChange: (page: number) => void;
  /** Noun for the total count — "leads", "areas". */
  label?: string;
  perPageOptions?: number[];
  /** Omit to hide the rows-per-page select. */
  onPerPageChange?: (perPage: number) => void;
  /** Hide the left-hand "N leads" count. */
  hideTotal?: boolean;
}

/**
 * Count, range, rows-per-page and prev/next, under a table.
 *
 * Fully controlled: it renders the numbers it is given and reports intent.
 * Pair it with {@link useTablePagination} (client state) — the fetching, if
 * any, stays in the caller.
 */
export function Pagination({
  page,
  total,
  perPage,
  onChange,
  label = "total",
  perPageOptions,
  onPerPageChange,
  hideTotal = false,
}: PaginationProps) {
  const isMobile = useIsMobile();
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const pageOptions = perPageOptions ?? DEFAULT_PER_PAGE_OPTIONS;
  const showRange = total > 0;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginTop: 12,
        padding: "0 2px",
        flexWrap: "wrap",
        gap: 8,
        minWidth: 0,
        maxWidth: "100%",
      }}
    >
      {hideTotal ? (
        <span />
      ) : (
        <span style={countStyle}>
          {total} {label}
        </span>
      )}

      {(showRange || totalPages > 1 || onPerPageChange) && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexWrap: isMobile ? "wrap" : "nowrap",
            justifyContent: isMobile ? "flex-end" : undefined,
            minWidth: 0,
            maxWidth: "100%",
          }}
        >
          {showRange && (
            <span style={{ ...countStyle, whiteSpace: "nowrap" }}>
              {(page - 1) * perPage + 1}–{Math.min(page * perPage, total)} of {total}
            </span>
          )}
          {onPerPageChange && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
              <span style={{ ...countStyle, whiteSpace: "nowrap" }}>Rows</span>
              <div style={{ width: 64 }}>
                <CustomSelect
                  aria-label="Rows per page"
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
              <button
                type="button"
                onClick={() => onChange(page - 1)}
                disabled={page <= 1}
                style={pgBtnStyle(page <= 1)}
              >
                Prev
              </button>
              <button
                type="button"
                onClick={() => onChange(page + 1)}
                disabled={page >= totalPages}
                style={pgBtnStyle(page >= totalPages)}
              >
                Next
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

const countStyle: CSSProperties = {
  fontFamily: "var(--mono)",
  fontSize: 12,
  color: "var(--ink-mute)",
  flexShrink: 0,
};

function pgBtnStyle(disabled: boolean): CSSProperties {
  return {
    padding: "6px 14px",
    fontSize: 12,
    fontWeight: 500,
    background: disabled ? "transparent" : "var(--surface)",
    border: "1px solid var(--rule-strong)",
    borderRadius: "var(--r-sm)",
    cursor: disabled ? "not-allowed" : "pointer",
    color: disabled ? "var(--ink-faint)" : "var(--ink)",
    fontFamily: "var(--sans)",
    opacity: disabled ? 0.5 : 1,
  };
}

/**
 * Page/perPage state for a server-driven table.
 *
 * `total` clamps the page when the result set shrinks (no "page 5 of a
 * 1-page result"), and `resetKey` — pass the debounced search — sends the
 * table back to page 1 when the query changes.
 */
export function useTablePagination(initialPerPage = 10, total?: number, resetKey?: unknown) {
  const [page, setPage] = useState(1);
  const [perPage, setPerPageState] = useState(initialPerPage);

  const prevResetKey = useRef(resetKey);
  useEffect(() => {
    if (prevResetKey.current !== resetKey) {
      prevResetKey.current = resetKey;
      setPage(1);
    }
  }, [resetKey]);

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

/** Client-side paging for an in-memory list. */
export function usePagination<T>(items: T[], perPage: number) {
  const [page, setPage] = useState(1);
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));

  useEffect(() => {
    setPage((p) => Math.min(p, totalPages));
  }, [totalPages]);

  return { page, setPage, total, perPage, paginated: items.slice((page - 1) * perPage, page * perPage) };
}
