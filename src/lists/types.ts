import type { ColumnDescriptor } from "../components";

/**
 * A work list, as JSON describes it.
 *
 * Shared by OmniMart and OmniVarsity — the columns, the views in the header,
 * the filters, the row actions. Anything only one screen needs is optional.
 */

export interface ListRow {
  id: string;
  [key: string]: unknown;
}

export interface ListDescriptor {
  key: string;
  /** First crumb — the module this list belongs to. */
  module: string;
  label: string;
  singular: string;
  subtitle?: string;
  searchPlaceholder: string;
  emptyMessage?: string;
  emptyHint?: string;
  /** Noun for the count and the pagination footer. */
  countLabel: string;
  minWidth?: number;
  /**
   * The views in the header. The first has no field and means "everything";
   * `kind` lets a view be something other than a table.
   */
  tabs?: { label: string; field?: string; value?: string; kind?: "table" | "overview" | "placeholder" }[];
  /** Adds an Export CSV button beside the add button. */
  exportable?: boolean;
  /** Exact wording of the add button, e.g. "+ Add lead". */
  addLabel?: string;
  /** Tiles for a view of kind "overview". */
  overview?: ListOverview;
  filters?: { key: string; label: string; options: string[] }[];
  summary?: {
    label: string;
    kind: "count" | "sum";
    field?: string;
    where?: { field: string; value: unknown };
    /** Render the total as rupees. */
    money?: boolean;
  }[];
  columns: ColumnDescriptor[];
  /** Buttons on every row, in order. */
  rowActions?: string[];
  rows: ListRow[];
}

export interface ListOverview {
  eyebrow: string;
  title: string;
  stores: { id: string; name: string; today: number; target: number; status: string }[];
}

