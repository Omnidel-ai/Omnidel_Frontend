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
  archived?: boolean;
}

export interface OmniPulseTeamsData {
  label: string;
  singular: string;
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
  visibility: "Team" | "Private" | "Everyone" | string;
  description: string;
  total: number;
  mine: number;
  done: number;
  doing: number;
  todo: number;
  archived?: boolean;
}

export interface OmniPulseProjectsData {
  label: string;
  singular: string;
  searchPlaceholder: string;
  emptyMessage: string;
  emptyHint: string;
  columns: {
    key: string;
    header: string;
    width?: string;
    align?: "left" | "right" | "center";
    sortable?: boolean;
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
  priority: "High" | "Normal" | "Low" | string;
  due: string;
  assignees: string[];
  comments: number;
  attachments: number;
  done: boolean;
}

export interface OmniPulseList {
  id: string;
  title: string;
  cards: OmniPulseCard[];
}

export interface OmniPulseBoard {
  id: string;
  name: string;
  team: string;
  lead: string;
  lists: OmniPulseList[];
}

export interface OmniPulseData {
  teams: OmniPulseTeamsData;
  projects: OmniPulseProjectsData;
  review: OmniPulseReviewData;
  boards: OmniPulseBoard[];
  /** Label → badge tone, so a card's labels are coloured from data. */
  labelTones: Record<string, string>;
}
