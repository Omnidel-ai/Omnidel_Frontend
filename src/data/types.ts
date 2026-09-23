/**
 * Shapes of `demo.json`.
 *
 * This is demo data, not a backend contract. When the real API lands, these
 * types are replaced by the generated contract types and only the data layer
 * changes — the shell and the admin UI read the same shapes either way.
 */

export interface DemoUser {
  name: string;
  role: string;
  phone: string;
  teams: { id: string; name: string }[];
  languages: { code: string; label: string }[];
  activeLanguage: string;
}

export interface DemoBrand {
  name: string;
  badge: string;
  environment: string;
}

export interface DemoNavChild {
  label: string;
  href: string;
  badge?: number;
  /**
   * A third level — Admin's groups (Sales & Pipeline, People & Access, …) hold
   * their pages here. A child with `children` is a heading, not a destination.
   */
  children?: DemoNavChild[];
}

export interface DemoNavItem {
  label: string;
  href: string;
  icon: string;
  /** Rendered as a bold section heading with a chevron. */
  children?: DemoNavChild[];
}

export interface DemoNotification {
  id: string;
  title: string;
  body: string;
  at: string;
  unread: boolean;
  tone: "info" | "success" | "warn" | "crit";
}

export interface DemoStatusItem {
  key: string;
  label: string;
  value: string;
  tone: "ok" | "warn" | "crit" | "neutral";
  /** Muted second line in the tooltip / wide layout. */
  detail?: string;
}

export interface DemoAssistantMessage {
  role: "user" | "assistant";
  text: string;
}

export interface DemoAssistant {
  name: string;
  greeting: string;
  suggestions: string[];
  /** Canned replies, matched on a lower-cased keyword found in the question. */
  replies: { match: string; text: string }[];
  fallback: string;
}


export interface DemoPoint {
  label: string;
  value: number;
}

export interface DemoStat {
  key: string;
  label: string;
  value: string;
  /** Signed, so direction is in the text and not only in the tone. */
  delta?: string;
  deltaTone: "ok" | "warn" | "crit" | "neutral";
  hint?: string;
}

export interface DemoActivity {
  id: string;
  who: string;
  what: string;
  at: string;
  tone: "ok" | "warn" | "crit" | "info";
}

export interface DemoDashboard {
  greeting: string;
  subtitle: string;
  stats: DemoStat[];
  weekly: { label: string; unit: string; points: DemoPoint[] };
  stages: { label: string; points: DemoPoint[] };
  statuses: { label: string; value: number; tone: "ok" | "warn" | "crit" | "neutral" }[];
  activity: DemoActivity[];
}

export type ColumnType =
  | "text"
  | "code"
  | "badge"
  | "flag"
  | "number"
  | "percent"
  | "date"
  | "status"
  /** Colour swatch + the value, for a row that carries a hex or a hint. */
  | "color"
  /** An array of strings, rendered as small pills. */
  | "chips"
  /** Initials avatar + name. */
  | "user";

export interface DemoColumn {
  key: string;
  header: string;
  /** CSS grid track. */
  width?: string;
  type?: ColumnType;
  align?: "left" | "right" | "center";
  /** For `badge`: value → tone. */
  tones?: Record<string, string>;
}

export type FieldType =
  | "text"
  | "textarea"
  | "number"
  | "select"
  | "checkbox"
  | "date"
  /** Colour picker from a fixed swatch list. */
  | "color"
  /** Several values from `options`, stored as an array. */
  | "multiselect";

export interface DemoField {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  placeholder?: string;
  hint?: string;
  options?: { value: string; label: string }[];
  /** Immutable after creation (a code, a slug). */
  readOnlyOnEdit?: boolean;
}

export interface DemoMaster {
  key: string;
  /** Plural, for headings and counts. */
  label: string;
  /** Singular, for "+ Add …" and dialog titles. */
  singular: string;
  module: string;
  section: string;
  eyebrow?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  /** Second line under the empty-state title. */
  emptyHint?: string;
  /** Phone-only floor for the row grid. */
  minWidth?: number;
  columns: DemoColumn[];
  fields: DemoField[];
  rows: DemoRow[];

  /* ── Optional parameters. Every master uses the SAME page component; these
        switch on the parts that only some of them need. ───────────────── */

  /** Up/down arrows that swap this numeric field between adjacent rows. */
  reorder?: { field: string };
  /**
   * A flag only one row may hold (a default language, a home branch). Adds a
   * "Make default" action and clears the flag on every other row.
   */
  singleFlag?: { field: string; label: string; action?: string };
  /** Extra equality filters in the toolbar, beside the view select. */
  filters?: { key: string; label: string; options: { value: string; label: string }[] }[];
  /** Grouping tabs above the toolbar, each matching one field value. */
  tabs?: { label: string; field: string; value: string }[];
  /** Counters above the table. `sum` needs `field`. */
  summary?: { label: string; kind: "count" | "sum"; field?: string; where?: { field: string; value: unknown } }[];
  /** Adds a "Download CSV" button that exports the rows currently in view. */
  exportable?: boolean;
  /** Per-row child records, edited in a panel opened from the row. */
  detail?: DemoDetailPanel;
}

export interface DemoDetailPanel {
  /** Row action label, e.g. "Fields". */
  action: string;
  /** Panel title; `{row}` is replaced with the row's name. */
  title: string;
  /** Key on the row holding the child array. */
  itemsKey: string;
  singular: string;
  columns: DemoColumn[];
  fields: DemoField[];
  emptyMessage?: string;
}

export interface DemoSettingsGroup {
  title: string;
  description?: string;
  fields: DemoField[];
}

/**
 * A single-record admin screen — Business Details, company settings.
 *
 * The other admin layout: groups of fields instead of columns, saved in place.
 * It shares the field controls and the validation with the master dialog.
 */
export interface DemoSettings {
  key: string;
  label: string;
  module: string;
  section: string;
  eyebrow?: string;
  description?: string;
  groups: DemoSettingsGroup[];
  values: Record<string, unknown>;
}

export interface DemoRow {
  id: string;
  is_active: boolean;
  /** Archived rows leave the working list and can be restored. */
  is_archived?: boolean;
  [key: string]: unknown;
}

export interface DemoData {
  brand: DemoBrand;
  dashboard: DemoDashboard;
  user: DemoUser;
  nav: DemoNavItem[];
  status: DemoStatusItem[];
  notifications: DemoNotification[];
  assistant: DemoAssistant;
  /** From `masters.json`, merged in at the edge (see App.tsx). */
  masters: DemoMaster[];
  /** Single-record admin screens. */
  settings: DemoSettings[];
}
