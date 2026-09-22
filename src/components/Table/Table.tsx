import type { ReactNode } from "react";
import { EmptyState } from "../EmptyState/EmptyState";
import { SkeletonRows } from "../Skeleton/Skeleton";
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
  /** Title of the built-in empty state. */
  emptyMessage?: ReactNode;
  /** Second, muted line under the empty message. */
  emptyHint?: ReactNode;
  /**
   * Distinguishes "nothing created yet" from "the filter matched nothing" —
   * the table cannot know which, because it never sees the query.
   */
  emptyVariant?: "empty" | "no-results" | "error";
  /** Action button inside the empty state ("Add the first lane"). */
  emptyAction?: ReactNode;
  /**
   * Replaces the built-in empty state entirely. Use it when the screen needs
   * more than a title, a line and a button.
   */
  empty?: ReactNode;
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
  emptyVariant = "empty",
  emptyAction,
  empty,
  onRowClick,
  minWidth = 640,
  minHeight,
}: TableProps<T>) {
  const gridTemplateColumns = columns.map((c) => c.width ?? "1fr").join(" ");

  return (
    <TableScroll minWidth={minWidth} minHeight={minHeight} busy={loading}>
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
        <SkeletonRows
          rows={skeletonRows}
          columns={columns.length}
          gridTemplateColumns={gridTemplateColumns}
        />
      ) : data.length === 0 ? (
        (empty ?? (
          <EmptyState
            variant={emptyVariant}
            title={typeof emptyMessage === "string" ? emptyMessage : "Nothing here yet"}
            description={emptyHint}
            action={emptyAction}
          />
        ))
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
