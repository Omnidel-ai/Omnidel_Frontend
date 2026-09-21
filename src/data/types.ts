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

export type ColumnType = "text" | "code" | "badge" | "flag" | "number" | "date" | "status";

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

export type FieldType = "text" | "textarea" | "number" | "select" | "checkbox" | "date";

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
  masters: DemoMaster[];
}
