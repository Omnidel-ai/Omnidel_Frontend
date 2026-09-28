import type { ColumnDescriptor } from "../components";

/**
 * Shapes of `omnimart.json`.
 *
 * The four work lists share one descriptor, the way the admin masters do —
 * columns, tabs, filters, summary, row actions. Missions is its own shape,
 * because a mission is a promise with a pace rather than a row.
 */

export interface MartRow {
  id: string;
  [key: string]: unknown;
}

export interface MartList {
  key: string;
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
  overview?: MartStoreOverview;
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
  rows: MartRow[];
}

export interface MartStoreOverview {
  eyebrow: string;
  title: string;
  stores: { id: string; name: string; today: number; target: number; status: string }[];
}

export interface MartMission {
  id: string;
  name: string;
  /** The stream it belongs to — the card's eyebrow. */
  stream: string;
  status: "green" | "amber" | "red";
  current: number;
  target: number;
  unit: string;
  /** Per day, to reach the target in the days that remain. */
  requiredPace: number;
  /** Per day, over the last seven days. */
  actualPace: number;
  daysLeft: number;
  tasks: { total: number; open: number; done: number };
}

export interface MartMissionsData {
  label: string;
  subtitle: string;
  searchPlaceholder: string;
  emptyMessage: string;
  emptyHint: string;
  rows: MartMission[];
}

export interface OmniMartData {
  missions: MartMissionsData;
  lists: MartList[];
}
