/** Shapes of the `home` block in `demo.json`. */

export interface HomeRow {
  id: string;
  /** What the row is about — the task, the mention, the announcement. */
  text: string;
  /** The right-hand column: a due date, a created date, a posted date. */
  meta: string;
}

export interface HomeSlice {
  label: string;
  value: number;
  /** Token name for the slice colour: planned · doing · done · blocked. */
  tone: string;
}

export interface HomeData {
  title: string;
  subtitle: string;
  /** Printed in the eyebrow beside "Overview". */
  today: string;
  stats: { label: string; value: string; icon: string }[];
  assignedToMe: { open: HomeRow[]; done: HomeRow[] };
  assignedByMe: { open: HomeRow[]; done: HomeRow[] };
  mentions: HomeRow[];
  announcements: HomeRow[];
  byStatus: HomeSlice[];
  byMission: HomeSlice[];
}
