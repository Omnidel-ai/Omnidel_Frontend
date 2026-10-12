// Shared types for the OmniPulse "Import CSV" wizard.

import type { Member } from "@/lib/omnipulse/csv-format";
import type { ParsedTask, NormalizedTaskInput, TaskPriority } from "@/lib/omnipulse/import-types";

export type { ParsedTask, NormalizedTaskInput, Member, TaskPriority };

// A board task field a CSV column can map to. "status" places the card by
// semantic board-column matching; "list" names the workstream/group to match
// verbatim against the board's real lists instead (create-if-missing confirm
// flow). "skip" ignores the column. Kept in sync with BoardField in
// lib/server/services/csv-import-ai.ts.
export type BoardField =
  | "title"
  | "description"
  | "status"
  | "priority"
  | "assignee"
  | "due_date"
  | "labels"
  | "list"
  | "subtask_title"
  | "skip";

// Options for the per-column mapping dropdowns (label = what the user sees).
export const BOARD_FIELD_OPTIONS: { value: BoardField; label: string }[] = [
  { value: "title", label: "Title" },
  { value: "description", label: "Description" },
  { value: "status", label: "Status / Column" },
  { value: "priority", label: "Priority" },
  { value: "assignee", label: "Assignee" },
  { value: "due_date", label: "Due date" },
  { value: "labels", label: "Labels" },
  { value: "list", label: "List / Group" },
  { value: "subtask_title", label: "Subtask title" },
  { value: "skip", label: "Skip" },
];

// A board list (kanban column) the import can drop cards into.
export interface ImportList {
  id: string;
  name: string;
}

// A board member the import can resolve assignees against.
export interface ImportUser {
  id: string;
  name: string;
}

// Wizard step. "choose" → pick a path (template download vs. paste-anything);
// "upload" → pick a file; "paste" → free-form text entry (AI extraction wired
// in a later task); "confirmLists" → extracted tasks named workstreams/lists
// that don't exist on the board yet — create them or import without;
// "grid" → editable preview before create; "mapping" → the legacy manual
// column-mapping fallback (only reached if AI extraction is unavailable/fails
// for a non-template upload); "result" → success / error summary.
export type ImportStep = "choose" | "upload" | "paste" | "confirmLists" | "grid" | "mapping" | "result";

// Mapping from CSV header → chosen board field.
export type ColumnMapping = Record<string, BoardField>;

// A normalized, ready-to-create task built from one CSV row.
export interface NormalizedTask {
  title: string;
  description?: string;
  priority: "low" | "medium" | "high" | "urgent";
  list_id?: string;
  // Raw status/category text from the CSV (before column resolution) — sent to
  // the board-aware column-assignment endpoint so it can place the card by the
  // board's real columns. `list_id` above holds the deterministic fallback.
  statusRaw?: string;
  // Raw assignee values from the CSV (names/emails) — resolved to user ids at
  // create time against the board's member list.
  assigneeRaw: string[];
}

// One task→column placement returned by the board-aware assignment endpoint,
// aligned to the request's task array by `index`. Re-exported from the shared
// (client-safe) column-assign module so the client and server agree on shape.
export type { AssignConfidence, ColumnAssignment } from "@/lib/omnipulse/column-assign";

// Outcome of an import run, surfaced on the result step.
export interface ImportResult {
  created: number;
  total: number;
  // Rows dropped because they had no title after mapping.
  skippedNoTitle: number;
  // Assignee values that matched no board member (informational).
  unresolvedAssignees: string[];
  // Tasks the board-aware assignment placed with low confidence (didn't clearly
  // fit any column) — surfaced so the user can spot-check their placement.
  lowConfidence: number;
  // Per-task create failures (title + message), capped for display.
  failures: { title: string; message: string }[];
}

// Outcome of a grid → POST /api/omnipulse/boards/[id]/import run (Task 9).
// Mirrors the bulk-import route's response shape exactly — unlike the legacy
// per-row-fetch ImportResult above, this comes back from a single request.
export interface ImportResultV2 {
  created: number;
  total: number;
  skippedNoTitle: number;
  // Raw assignee strings that matched no board member (server-side pass).
  unresolved: string[];
  // Raw assignee strings that matched 2+ board members.
  ambiguous: string[];
  // Lists created from the list-match/create confirm step, if any.
  listsCreated: string[];
  failures: { title: string; message: string }[];
  // Tasks that WERE created but where a post-create extra (lifecycle status, a
  // label, a subtask) didn't apply. Counted as created, never as failed.
  // Optional: an older server build won't send it.
  partial?: { title: string; message: string }[];
}

// ─── Editable preview grid (Task 8) ───────────────────────────────────────
// Board-scoped dropdown sources, read from GET /api/omnipulse/boards/[id]/import-masters.
// Feeds both the grid's dropdowns and (in an earlier task) the downloaded
// template's example row.
export interface MasterLabel {
  id: string;
  label: string;
  color: string;
}

// An id/name master row for the entity dropdowns added for Add-task parity
// (task type, mission, acharya). Name is what the CSV/xlsx template lists and
// what the grid resolves against, case-insensitively.
export interface MasterOption {
  id: string;
  name: string;
  // Task types only: when true, picking this type requires a linked lead
  // (mirrors mst_task_types.requires_lead) — the grid then prompts for one.
  requiresLead?: boolean;
}

export interface Masters {
  statuses: ImportList[];
  labels: MasterLabel[];
  members: Member[];
  priorities: readonly string[];
  // Add-task parity dropdown sources (from GET .../import-masters).
  taskTypes: MasterOption[];
  missions: MasterOption[];
  acharyas: MasterOption[];
}

// Fixed lifecycle-status options — mirrors STATUS_OPTIONS in the create/edit
// task modals. Distinct from the board-column ("status_list_id") placement.
export const PROGRESS_OPTIONS = [
  { value: "planned", label: "Planned" },
  { value: "doing", label: "Doing" },
  { value: "done", label: "Done" },
] as const;

// One assignee slot in a grid row: the raw text the row started with (from
// the CSV/AI parse) plus whatever the user has since resolved it to. `raw` is
// kept even after resolution so re-running resolveAssignee (e.g. after masters
// refresh) has something to match against; `memberId` is set once the user
// picks a candidate (or the raw value auto-resolved to exactly one member).
export interface GridAssignee {
  raw: string;
  memberId?: string;
}

// One row of the editable preview grid — a superset of ParsedTask fields
// reshaped for in-place editing (ids instead of free-text label/status
// values, since the grid resolves those against masters as the user edits).
export interface GridRow {
  // Stable client-side key (not persisted) — lets rows be deleted/reordered
  // without relying on array index, which would break as rows are removed.
  key: string;
  title: string;
  description: string;
  due_date: string;
  session_count: number;
  breaks: number;
  status_list_id: string;
  // True when the board-aware assignment placed this row's column with low
  // confidence (no clear fit). Drives the grid's "needs attention" flag so the
  // user reviews it before insert. Cleared once the user edits the status cell.
  status_low_confidence?: boolean;
  // Raw workstream/grouping value this task was extracted with, if any (see
  // ParsedTask.list_name). Drives a small caption under the Status cell:
  // unset when it exactly matched an existing list (status_list_id already
  // reflects it); otherwise shows whether the list will be created (per the
  // wizard's confirm-lists step) or the row will import with no list.
  listName?: string;
  priority: string;
  // Existing team label ids the row is tagged with.
  label_ids: string[];
  // Label names typed in by the user that don't match an existing label yet
  // — created on insert (see the import route's new_labels handling).
  new_labels: string[];
  assignees: GridAssignee[];
  // Raw subtasks text cell, e.g. "Design (2); Build (3)" — parsed live via
  // parseSubtasksCell for the chip preview and again at insert time.
  subtasksText: string;
  // ── Add-task parity fields ────────────────────────────────────────────────
  // Lifecycle status (planned/doing/done); "" leaves the create default.
  progress: string;
  // Assign date (YYYY-MM-DD); "" = server default (today, per createTask).
  assigned_on: string;
  mission_impact: string;
  // Entity ids resolved against masters ("" when unset / unmatched). Only the
  // id is sent — the grid resolves against the same master set the server
  // uses, so an unresolved value wouldn't resolve server-side either.
  task_type_id: string;
  mission_id: string;
  acharya_id: string;
  // Lead reference (lead_no when picked via the lead prompt, else typed
  // lead_no / title / uuid); resolved server-side. Only meaningful for
  // lead-requiring task types.
  lead_ref: string;
  // Human-readable label for a lead chosen via the prompt (e.g.
  // "L00001/25-26 — Acme office"); display-only, never sent to the server.
  lead_label: string;
}
