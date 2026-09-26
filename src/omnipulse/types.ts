/**
 * Shapes of `omnipulse.json`.
 *
 * OmniPulse is boards and the work on them, so its screens are card grids and
 * a kanban rather than the admin tables — but the data is described the same
 * way: one file, one set of types, no component inventing its own shape.
 */

export interface OmniPulseTeam {
  id: string;
  name: string;
  slug: string;
  lead: string;
  projects: number;
  members: number;
  /** Created by the system rather than by a person — labelled, and tinted. */
  systemGenerated?: boolean;
  archived?: boolean;
}

export interface OmniPulseTeamsData {
  label: string;
  singular: string;
  subtitle: string;
  searchPlaceholder: string;
  emptyMessage: string;
  emptyHint: string;
  toggles: { key: string; label: string; title?: string }[];
  rows: OmniPulseTeam[];
}

export interface OmniPulseProject {
  id: string;
  name: string;
  team: string;
  teamId: string;
  lead: string;
  visibility: string;
  description: string;
  /** Lists on the board. */
  cards: number;
  total: number;
  mine: number;
  planned: number;
  doing: number;
  done: number;
  /** The board this project opens, when one carries demo lists. */
  boardId?: string;
  pinned?: boolean;
  archived?: boolean;
}

export interface OmniPulseProjectsData {
  label: string;
  singular: string;
  subtitle: string;
  searchPlaceholder: string;
  emptyMessage: string;
  emptyHint: string;
  columns: {
    key: string;
    header: string;
    width?: string;
    align?: "left" | "right" | "center";
    sortable?: boolean;
    type?: string;
  }[];
  rows: OmniPulseProject[];
}

export interface OmniPulseSubmission {
  id: string;
  seq: number;
  task: string;
  karigar: string;
  score: number;
  project: string;
  team: string;
  date: string;
  status: "Pending" | "Approved" | "Returned" | string;
  note: string;
  attachments: number;
}

export interface OmniPulseReviewData {
  label: string;
  searchPlaceholder: string;
  emptyMessage: string;
  emptyHint: string;
  tabs: { label: string; field: string; value: string }[];
  rows: OmniPulseSubmission[];
}

export interface OmniPulseCard {
  id: string;
  title: string;
  labels: string[];
  priority: string;
  due: string;
  /** Past its due date — the chip turns crit and swaps its glyph. */
  overdue?: boolean;
  assignees: string[];
  comments: number;
  attachments: number;
  done: boolean;
}

/** What the task sheet shows beyond what a card carries on the board. */
export interface OmniPulseTaskMeta {
  description?: string;
  taskType?: string;
  acharya?: string;
  mission?: string;
  missionImpact?: string;
  assignedBy?: string;
  assignDate?: string;
  created?: string;
  sessions?: number;
  breaks?: number;
  /** Option lists for the sheet's selects. */
  taskTypes?: string[];
  acharyas?: string[];
  missions?: string[];
}

export interface OmniPulseList {
  id: string;
  title: string;
  /** Column tint and dot colour. */
  tone?: "neutral" | "ochre" | "green";
  /** What a card in this list counts as: Planned, Doing or Done. */
  status?: string;
  /** Total on the server; the rendered cards may be a filtered subset. */
  count?: number;
  cards: OmniPulseCard[];
}

export interface OmniPulseBoard {
  id: string;
  name: string;
  team: string;
  teamId: string;
  visibility: string;
  description: string;
  members: string[];
  taskCount: number;
  lists: OmniPulseList[];
}

export interface OmniPulseData {
  teams: OmniPulseTeamsData;
  projects: OmniPulseProjectsData;
  review: OmniPulseReviewData;
  boards: OmniPulseBoard[];
  /** Filter sections offered in the board's FILTERS popover. */
  boardFilters: { key: string; label: string; options: string[] }[];
  /** Defaults and option lists for the task sheet. */
  taskMeta: OmniPulseTaskMeta;
  /** Everyone who can be assigned, for the sheet's people picker. */
  people: string[];
  /** Label → badge tone, so a card's labels are coloured from data. */
  labelTones: Record<string, string>;
}
