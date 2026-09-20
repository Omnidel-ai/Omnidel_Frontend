import type { ReactNode } from "react";
import { TableScroll } from "./TableScroll";

export interface Column<T> {
  /** Stable key — also the React key for the cell. */
  key: string;
  header: ReactNode;
  /**
   * CSS grid track for this column: "2fr", "150px", "minmax(170px, 2fr)".
   * Defaults to "1fr".
   */
  width?: string;
  align?: "left" | "right" | "center";
  /** Cell renderer. Without it the row's `key` field is printed as text. */
  render?: (row: T, rowIndex: number) => ReactNode;
  /** Let this cell wrap instead of clipping with an ellipsis. */
  wrap?: boolean;
}

export interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  /** Stable row identity. Falls back to the row index. */
  rowKey?: (row: T, index: number) => string | number;
  /** Replaces the body with shimmering placeholder rows. */
  loading?: boolean;
  /** Placeholder row count while loading. */
  skeletonRows?: number;
  /** Shown when `data` is empty and `loading` is false. */
  emptyMessage?: ReactNode;
  /** Second, muted line under the empty message. */
  emptyHint?: ReactNode;
  /** Makes rows clickable — hover highlight and a pointer cursor. */
  onRowClick?: (row: T, index: number) => void;
  /** Phone-only floor for the row grid, in px. */
  minWidth?: number;
  /** Floor for the card height, in px. Default 480 (as in the app). */
  minHeight?: number;
}

/**
 * The application's list table: a CSS-grid header strip over grid rows, framed
 * by a card that scrolls sideways when the columns do not fit.
 *
 * Presentation only. It receives `columns` and `data` and renders them — it
 * never fetches, never sorts, never filters, and knows nothing about what a
 * row means. Sorting and paging live in the caller (see `Pagination` and
 * `TableControls`, which are equally data-agnostic).
 *
 * States: normal · loading · empty · long text · many rows · mixed widths.
 */
export function Table<T>({
  columns,
  data,
  rowKey,
  loading = false,
  skeletonRows = 5,
  emptyMessage = "Nothing here yet",
  emptyHint,
  onRowClick,
  minWidth = 640,
  minHeight,
}: TableProps<T>) {
  const gridTemplateColumns = columns.map((c) => c.width ?? "1fr").join(" ");

  return (
    <TableScroll minWidth={minWidth} minHeight={minHeight}>
      <div className="table-header" style={{ gridTemplateColumns }} role="row">
        {columns.map((c) => (
          <div
            key={c.key}
            role="columnheader"
            className="table-cell"
            style={{ textAlign: c.align ?? "left" }}
          >
            {c.header}
          </div>
        ))}
      </div>

      {loading ? (
        Array.from({ length: skeletonRows }).map((_, i) => (
          <div key={`sk-${i}`} className="table-row" style={{ gridTemplateColumns }} aria-hidden="true">
            {columns.map((c, ci) => (
              <div key={c.key} className="table-cell">
                <span
                  className="skeleton-bar"
                  style={{ display: "block", width: ci === 0 ? "70%" : "45%" }}
                />
              </div>
            ))}
          </div>
        ))
      ) : data.length === 0 ? (
        <div className="table-empty">
          <span>{emptyMessage}</span>
          {emptyHint && <span style={{ fontSize: 12, color: "var(--ink-faint)" }}>{emptyHint}</span>}
        </div>
      ) : (
        data.map((row, i) => (
          <div
            key={rowKey ? rowKey(row, i) : i}
            role="row"
            className={["table-row", onRowClick ? "table-row--clickable" : ""]
              .filter(Boolean)
              .join(" ")}
            style={{ gridTemplateColumns }}
            onClick={onRowClick ? () => onRowClick(row, i) : undefined}
          >
            {columns.map((c) => (
              <div
                key={c.key}
                role="cell"
                className={["table-cell", c.wrap ? "table-cell--wrap" : ""].filter(Boolean).join(" ")}
                style={{ textAlign: c.align ?? "left" }}
              >
                {c.render ? c.render(row, i) : String((row as Record<string, unknown>)[c.key] ?? "—")}
              </div>
            ))}
          </div>
        ))
      )}
    </TableScroll>
  );
}
