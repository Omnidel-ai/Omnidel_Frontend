"use client";

import { useEffect, useId, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { CustomSelect } from "@/components/omnidel/custom-select";
import { DatePicker } from "@/components/omnidel/date-picker";
import { LeadPicker, type LeadOption } from "@/components/omnidel/lead-picker";
import { parseSubtasksCell, resolveAssignee, normalizeDateCell } from "@/lib/omnipulse/csv-format";
import { TASK_TITLE_MIN, BREAKS_MAX } from "@/lib/omnipulse/import-types";
import { PROGRESS_OPTIONS } from "./types";
import type {
  ColumnAssignment,
  GridAssignee,
  GridRow,
  MasterOption,
  Masters,
  NormalizedTaskInput,
  ParsedTask,
} from "./types";
import { useTr } from "@/lib/client/language";

// ============================================================================
// PreviewGrid — the editable correction surface both import paths (template
// upload + AI paste) land in before anything is created (spec §3). One row
// per parsed task; every cell is editable; dropdowns are the board's live
// masters (§3 "Masters"). Assignee resolution follows §4: unique
// email/phone/name match auto-assigns, 2+ name matches or no match is
// flagged "needs checking" with a name·phone·email candidate dropdown — never
// "first match wins".
//
// This component owns its own edit state (built once from the incoming
// ParsedTask[] + masters) and never calls the import endpoint itself — it
// only emits NormalizedTaskInput[] via onInsert. Task 9 wires that callback
// to POST /api/omnipulse/boards/[id]/import.
// ============================================================================

let keySeq = 0;
function nextKey(): string {
  keySeq += 1;
  return `row-${Date.now()}-${keySeq}`;
}

function toGridAssignees(raw: string[], masters: Masters): GridAssignee[] {
  return raw.map((name) => {
    const resolved = resolveAssignee(name, masters.members);
    return { raw: name, memberId: resolved.status === "ok" ? resolved.memberId : undefined };
  });
}

// Case-insensitive name → id against an entity master; "" when blank/unmatched.
function resolveOptionId(raw: string | undefined, options: MasterOption[]): string {
  const v = (raw ?? "").trim().toLowerCase();
  if (!v) return "";
  return options.find((o) => o.name.trim().toLowerCase() === v)?.id ?? "";
}

const PROGRESS_VALUES = new Set<string>(PROGRESS_OPTIONS.map((o) => o.value));

// Normalize a free-text lifecycle value (e.g. "Planned", "In progress",
// "Complete") to one of planned/doing/done; "" when it doesn't map to any.
function normalizeProgress(raw: string | undefined): string {
  const v = (raw ?? "").trim().toLowerCase();
  if (!v) return "";
  if (PROGRESS_VALUES.has(v)) return v;
  if (/(progress|doing|wip|active|ongoing|started)/.test(v)) return "doing";
  if (/(done|complete|closed|finished|shipped|resolved)/.test(v)) return "done";
  if (/(plan|todo|to-?do|backlog|\bnew\b|open|not started)/.test(v)) return "planned";
  return "";
}

function blankRow(masters: Masters): GridRow {
  return {
    key: nextKey(),
    title: "",
    description: "",
    due_date: "",
    session_count: 1,
    breaks: 0,
    status_list_id: masters.statuses[0]?.id ?? "",
    priority: "medium",
    label_ids: [],
    new_labels: [],
    assignees: [],
    subtasksText: "",
    progress: "",
    assigned_on: "",
    mission_impact: "",
    task_type_id: "",
    mission_id: "",
    acharya_id: "",
    lead_ref: "",
    lead_label: "",
  };
}

// Whether a task type id requires a linked lead (drives the lead prompt +
// needs-attention flag). Safe on an empty/unmatched id.
function typeRequiresLead(taskTypeId: string, masters: Masters): boolean {
  if (!taskTypeId) return false;
  return !!masters.taskTypes.find((t) => t.id === taskTypeId)?.requiresLead;
}

function fromParsedTask(
  task: ParsedTask,
  masters: Masters,
  assignment?: ColumnAssignment,
): GridRow {
  // Status/list placement. A task with a `list_name` (workstream/group,
  // extracted separately from `status`) is placed by EXACT name match against
  // the board's real lists only — never by the semantic assignTasksToColumns
  // guess, and never left to fall back to "first list": if nothing matches,
  // status_list_id stays unset (the wizard's confirm-lists step already asked
  // whether to create it; if declined, the row imports with no list and the
  // user assigns one manually, per Shubham's decision).
  //
  // A task without a list_name keeps the pre-existing behavior: prefer the
  // board-aware assignment (reads the board's real columns, handles
  // workstream boards as well as linear pipelines), else an exact match of
  // the free-text status against a list name, else leave unset.
  let status_list_id = "";
  let status_low_confidence = false;
  if (task.list_name) {
    const listMatch = masters.statuses.find(
      (s) => s.name.trim().toLowerCase() === task.list_name!.trim().toLowerCase(),
    );
    status_list_id = listMatch?.id ?? "";
  } else if (assignment && masters.statuses.some((s) => s.id === assignment.columnId)) {
    status_list_id = assignment.columnId;
    status_low_confidence = assignment.confidence === "low";
  } else {
    const statusMatch = task.status
      ? masters.statuses.find(
          (s) => s.name.trim().toLowerCase() === task.status!.trim().toLowerCase(),
        )
      : undefined;
    status_list_id = statusMatch?.id ?? "";
  }

  // Labels: split into ids for exact (case-insensitive) matches against team
  // labels, and new_labels for anything that doesn't exist yet.
  const label_ids: string[] = [];
  const new_labels: string[] = [];
  for (const raw of task.labels) {
    const name = raw.trim();
    if (!name) continue;
    const match = masters.labels.find((l) => l.label.trim().toLowerCase() === name.toLowerCase());
    if (match) label_ids.push(match.id);
    else new_labels.push(name);
  }

  const hasSubtasks = task.subtasks.length > 0;

  // Confidently-parseable dates (ISO, Excel serial, month-name, unambiguous
  // slashed) are normalized to YYYY-MM-DD up front so the grid's date picker
  // shows them; anything the normalizer won't guess (ambiguous DD/MM vs MM/DD,
  // or junk) keeps its raw text so DateCell can flag it — see normalizeDateCell.
  const keepDate = (raw: string | undefined) => {
    const r = normalizeDateCell(raw ?? "");
    return r.status === "ok" ? r.iso : (raw ?? "").trim();
  };

  return {
    key: nextKey(),
    title: task.title,
    description: task.description ?? "",
    due_date: keepDate(task.due_date),
    session_count: hasSubtasks
      ? task.subtasks.reduce((sum, s) => sum + s.session_count, 0)
      : task.session_count ?? 1,
    breaks: task.breaks ?? 0,
    status_list_id,
    status_low_confidence,
    listName: task.list_name,
    priority: task.priority ?? "medium",
    label_ids,
    new_labels,
    assignees: toGridAssignees(task.assigneeRaw, masters),
    subtasksText:
      task.subtasks.length > 0
        ? task.subtasks.map((s) => `${s.title} (${s.session_count})`).join("; ")
        : "",
    progress: normalizeProgress(task.progress),
    assigned_on: keepDate(task.assigned_on),
    mission_impact: task.mission_impact ?? "",
    task_type_id: resolveOptionId(task.task_type, masters.taskTypes),
    mission_id: resolveOptionId(task.mission, masters.missions),
    acharya_id: resolveOptionId(task.acharya, masters.acharyas),
    lead_ref: task.lead ?? "",
    lead_label: task.lead ?? "",
  };
}

function rowHasSubtasks(row: GridRow): boolean {
  return parseSubtasksCell(row.subtasksText).length > 0;
}

// A date cell blocks insert when it holds a non-empty value that isn't
// confidently a single date — an ambiguous slashed date (day & month both ≤12,
// so DD/MM vs MM/DD can't be told apart) or an unreadable value. The user must
// pick a real date in the picker before the row can import (their decision:
// never silently guess a locale). Empty and normalized-ISO values pass.
function dateCellBlocks(value: string): boolean {
  const status = normalizeDateCell(value).status;
  return status === "ambiguous" || status === "invalid";
}

// A row is invalid (blocks insert) when its title is shorter than the server's
// minimum (validateTaskTitle in services/tasks.ts rejects trim().length <
// TASK_TITLE_MIN), or when a date cell can't be resolved to a single ISO date
// (dateCellBlocks). Flagging it here keeps such rows out of the "Insert N
// tasks" count instead of letting them fail per-row inside the bulk-create
// endpoint. Ambiguous / unresolved assignees are flagged for attention but
// don't block insert — spec §5 allows importing unassigned.
function rowIsInvalid(row: GridRow): boolean {
  return (
    row.title.trim().length < TASK_TITLE_MIN ||
    dateCellBlocks(row.due_date) ||
    dateCellBlocks(row.assigned_on)
  );
}

function rowNeedsAttention(row: GridRow, masters: Masters, listsBeingCreated: string[] = []): boolean {
  if (rowIsInvalid(row)) return true;
  // Low-confidence column placement — the assignment didn't clearly fit any
  // column, so ask the user to confirm/correct the status cell before insert.
  if (row.status_low_confidence) return true;
  // Extracted a workstream/group that has no list yet and won't get one —
  // the row will import with list_id null; flag it so the user notices and
  // assigns a list manually rather than missing it silently.
  if (listCaption(row, listsBeingCreated)?.startsWith("No list")) return true;
  // Lead-requiring task type (e.g. Pipeline / Marketing) with no lead linked —
  // createTask would reject it, so flag for a lead before insert.
  if (typeRequiresLead(row.task_type_id, masters) && !row.lead_ref.trim()) return true;
  return row.assignees.some((a) => {
    if (a.memberId) return false;
    const resolved = resolveAssignee(a.raw, masters.members);
    return resolved.status === "ambiguous" || resolved.status === "none";
  });
}

function toNormalizedTaskInput(row: GridRow): NormalizedTaskInput {
  const subtasks = parseSubtasksCell(row.subtasksText);
  const hasSubtasks = subtasks.length > 0;
  const assignee_ids = row.assignees.map((a) => a.memberId).filter((id): id is string => !!id);
  // Unresolved raw names still ride along as assigneeRaw so the import
  // route's server-side safety pass (§4) gets one more chance at them, and
  // any true misses land in the result step's `unresolved`/`ambiguous` lists.
  const assigneeRaw = row.assignees.filter((a) => !a.memberId).map((a) => a.raw);

  return {
    title: row.title.trim(),
    description: row.description.trim() || undefined,
    status_list_id: row.status_list_id || undefined,
    // Only ride along when the list doesn't exist yet client-side (no
    // status_list_id) — the import route resolves it against `createLists`.
    list_name: !row.status_list_id && row.listName ? row.listName : undefined,
    priority: row.priority || undefined,
    assignee_ids: assignee_ids.length > 0 ? assignee_ids : undefined,
    assigneeRaw: assigneeRaw.length > 0 ? assigneeRaw : undefined,
    label_ids: row.label_ids.length > 0 ? row.label_ids : undefined,
    new_labels: row.new_labels.length > 0 ? row.new_labels : undefined,
    due_date: row.due_date || undefined,
    session_count: hasSubtasks ? undefined : row.session_count,
    breaks: row.breaks,
    subtasks,
    progress: row.progress || undefined,
    assigned_on: row.assigned_on || undefined,
    mission_impact: row.mission_impact.trim() || undefined,
    task_type_id: row.task_type_id || undefined,
    mission_id: row.mission_id || undefined,
    acharya_id: row.acharya_id || undefined,
    lead_ref: row.lead_ref.trim() || undefined,
  };
}

const PRIORITY_LABELS: Record<string, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

export function PreviewGrid({
  rows: initialRows,
  masters,
  assignments,
  listsBeingCreated,
  onInsert,
  busy,
}: {
  rows: ParsedTask[];
  masters: Masters;
  // Board-aware column placements aligned to `rows` by the assignment's `index`
  // field. null when the assignment call was unavailable — rows then fall back
  // to exact status-name matching (see fromParsedTask).
  assignments?: ColumnAssignment[] | null;
  // Workstream/group names the user confirmed creating on the wizard's
  // confirm-lists step — purely informational here, drives the "will create"
  // vs. "no list, assign manually" caption under a row's Status cell.
  listsBeingCreated?: string[];
  onInsert: (rows: NormalizedTaskInput[]) => void;
  busy?: boolean;
}) {
  const tr = useTr();
  const [rows, setRows] = useState<GridRow[]>(() => {
    const byIndex = new Map((assignments ?? []).map((a) => [a.index, a]));
    return initialRows.map((t, i) => fromParsedTask(t, masters, byIndex.get(i)));
  });

  const statusOptions = useMemo(
    () => masters.statuses.map((s) => ({ value: s.id, label: s.name })),
    [masters.statuses],
  );
  const priorityOptions = useMemo(
    () => masters.priorities.map((p) => ({ value: p, label: PRIORITY_LABELS[p] ?? p })),
    [masters.priorities],
  );
  // Add-task parity dropdowns. Each leads with a blank option so a row can be
  // left unset (progress → create default; mission → project default; the
  // rest → simply unassigned).
  const progressOptions = useMemo(
    () => [{ value: "", label: "—" }, ...PROGRESS_OPTIONS.map((o) => ({ value: o.value, label: o.label }))],
    [],
  );
  const taskTypeOptions = useMemo(
    () => [{ value: "", label: "General" }, ...masters.taskTypes.map((t) => ({ value: t.id, label: t.name }))],
    [masters.taskTypes],
  );
  const missionOptions = useMemo(
    () => [{ value: "", label: "Project default" }, ...masters.missions.map((m) => ({ value: m.id, label: m.name }))],
    [masters.missions],
  );
  const acharyaOptions = useMemo(
    () => [{ value: "", label: "—" }, ...masters.acharyas.map((a) => ({ value: a.id, label: a.name }))],
    [masters.acharyas],
  );

  const attentionCount = useMemo(
    () => rows.filter((r) => rowNeedsAttention(r, masters, listsBeingCreated)).length,
    [rows, masters, listsBeingCreated],
  );
  const validCount = rows.filter((r) => !rowIsInvalid(r)).length;

  // Row awaiting a lead pick (a lead-requiring task type was chosen). Drives
  // the lead-prompt popup below.
  const [leadPromptKey, setLeadPromptKey] = useState<string | null>(null);

  function updateRow(key: string, patch: Partial<GridRow>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function deleteRow(key: string) {
    setRows((prev) => prev.filter((r) => r.key !== key));
  }

  function addRow() {
    setRows((prev) => [...prev, blankRow(masters)]);
  }

  function handleInsert() {
    const validRows = rows.filter((r) => !rowIsInvalid(r));
    onInsert(validRows.map(toNormalizedTaskInput));
  }

  return (
    <div style={wrapStyle}>
      <div style={summaryRowStyle}>
        <span style={{ fontSize: 13, color: "var(--ink-soft)" }}>
          {rows.length} row{rows.length === 1 ? "" : "s"}
        </span>
        {attentionCount > 0 && (
          <span style={attentionBadgeStyle}>
            {attentionCount} row{attentionCount === 1 ? "" : "s"} {tr("need attention")}
          </span>
        )}
        <button type="button" className="btn-secondary" onClick={addRow} disabled={busy} style={addRowBtnStyle}>
          {tr("+ Add row")}
        </button>
      </div>

      <div className="table-wrap themed-scroll-x" style={tableWrapStyle}>
        <div style={{ overflowX: "auto" }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={{ ...thStyle, width: 26 }} />
                <th style={{ ...thStyle, minWidth: 160 }}>{tr("Title")}</th>
                <th style={{ ...thStyle, minWidth: 160 }}>{tr("Description")}</th>
                <th style={{ ...thStyle, minWidth: 130 }}>{tr("Status")}</th>
                <th style={{ ...thStyle, minWidth: 110 }}>{tr("Progress")}</th>
                <th style={{ ...thStyle, minWidth: 110 }}>{tr("Priority")}</th>
                <th style={{ ...thStyle, minWidth: 180 }}>{tr("Assignee")}</th>
                <th style={{ ...thStyle, minWidth: 160 }}>{tr("Labels")}</th>
                <th style={{ ...thStyle, minWidth: 110 }}>{tr("Due date")}</th>
                <th style={{ ...thStyle, minWidth: 110 }}>{tr("Assign date")}</th>
                <th style={{ ...thStyle, minWidth: 140 }}>{tr("Task type")}</th>
                <th style={{ ...thStyle, minWidth: 140 }}>{tr("Mission")}</th>
                <th style={{ ...thStyle, minWidth: 160 }}>{tr("Mission impact")}</th>
                <th style={{ ...thStyle, minWidth: 140 }}>{tr("Acharya")}</th>
                <th style={{ ...thStyle, minWidth: 120 }}>{tr("Lead")}</th>
                <th style={{ ...thStyle, minWidth: 80 }}>{tr("Sessions")}</th>
                <th style={{ ...thStyle, minWidth: 80 }}>{tr("Breaks")}</th>
                <th style={{ ...thStyle, minWidth: 220 }}>{tr("Subtasks")}</th>
                <th style={{ ...thStyle, width: 36 }} />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <GridRowView
                  key={row.key}
                  row={row}
                  masters={masters}
                  statusOptions={statusOptions}
                  priorityOptions={priorityOptions}
                  progressOptions={progressOptions}
                  taskTypeOptions={taskTypeOptions}
                  missionOptions={missionOptions}
                  acharyaOptions={acharyaOptions}
                  listsBeingCreated={listsBeingCreated ?? []}
                  disabled={!!busy}
                  onChange={(patch) => updateRow(row.key, patch)}
                  onDelete={() => deleteRow(row.key)}
                  onLeadRequired={() => setLeadPromptKey(row.key)}
                />
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={19} className="table-empty">
                    {tr("No rows. Add one to get started.")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div style={footerRowStyle}>
        <button
          type="button"
          className="btn-primary"
          disabled={busy || validCount === 0}
          onClick={handleInsert}
        >
          {busy ? tr("Importing…") : `Insert ${validCount} task${validCount === 1 ? "" : "s"} →`}
        </button>
      </div>

      {leadPromptKey && (
        <LeadPromptModal
          onPick={(leadId, lead) => {
            // Store the lead_no when available (human-readable AND resolvable
            // by the import route's lead_no matcher); fall back to the id.
            const ref = lead?.lead_no || leadId;
            const label = lead
              ? lead.lead_no
                ? `${lead.lead_no} — ${lead.title}`
                : lead.title
              : ref;
            updateRow(leadPromptKey, { lead_ref: ref, lead_label: label });
            setLeadPromptKey(null);
          }}
          onClose={() => setLeadPromptKey(null)}
        />
      )}
    </div>
  );
}

// Lead-link popup, shown when a lead-requiring task type (e.g. Pipeline /
// Marketing) is chosen for a row. Portals to <body> so it sits above the
// import wizard modal. Picking a lead fills the row's Lead cell; "Skip for
// now" leaves the row flagged as needing attention.
function LeadPromptModal({
  onPick,
  onClose,
}: {
  onPick: (leadId: string, lead: LeadOption | null) => void;
  onClose: () => void;
}) {
  const tr = useTr();
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div
      style={leadOverlayStyle}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div style={leadCardStyle} role="dialog" aria-modal="true" aria-label={tr("Link a lead")}>
        <h3 style={{ fontFamily: "var(--serif)", margin: "0 0 6px" }}>{tr("Link a lead")}</h3>
        <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: "0 0 14px", lineHeight: 1.5 }}>
          {tr("This task type requires a linked lead. Search for the lead this task belongs to.")}
        </p>
        <LeadPicker
          value={null}
          onChange={(id, lead) => {
            if (id) onPick(id, lead);
          }}
          placeholder={tr("Search a lead…")}
        />
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 18 }}>
          <button type="button" className="btn-secondary" onClick={onClose}>
            {tr("Skip for now")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// Caption shown under the Status cell for a row that carries a workstream/
// group name (list_name) — null once it's already reflected by status_list_id
// (an exact match, or resolved by this session's own list creation).
function listCaption(row: GridRow, listsBeingCreated: string[]): string | null {
  if (!row.listName || row.status_list_id) return null;
  const willCreate = listsBeingCreated.some(
    (n) => n.trim().toLowerCase() === row.listName!.trim().toLowerCase(),
  );
  return willCreate
    ? `Will create list "${row.listName}"`
    : `No list "${row.listName}" — assign manually`;
}

// A date cell that only ever holds a clean ISO value or a flagged raw string.
// Confidently-parseable dates were normalized to YYYY-MM-DD upstream
// (fromParsedTask), so the OmniDel DatePicker shows them; anything the
// normalizer couldn't read without guessing (an ambiguous DD/MM vs MM/DD, or
// junk) is shown empty with an amber prompt, and blocks insert (rowIsInvalid)
// until the user picks a real date. Bind ISO or empty — never hand a non-ISO
// string to DatePicker — and surface the raw text only in the caption.
function DateCell({
  value,
  onChange,
  disabled,
  ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
  ariaLabel: string;
}) {
  const tr = useTr();
  const { status, iso } = normalizeDateCell(value);
  const flagged = status === "ambiguous" || status === "invalid";
  return (
    <>
      <div aria-label={ariaLabel} aria-invalid={flagged || undefined}>
        <DatePicker
          value={status === "ok" ? iso : ""}
          onChange={onChange}
          disabled={disabled}
          placeholder="dd-mm-yyyy"
          style={flagged ? { ...invalidInputStyle } : undefined}
        />
      </div>
      {flagged && (
        <div style={listCaptionWarnStyle} title={tr("Enter a date as YYYY-MM-DD")}>
          {status === "ambiguous"
            ? `Ambiguous date "${value.trim()}" — pick the right day`
            : `Couldn't read "${value.trim()}" — pick a date`}
        </div>
      )}
    </>
  );
}

// ── One row's cells ─────────────────────────────────────────────────────────
function GridRowView({
  row,
  masters,
  statusOptions,
  priorityOptions,
  progressOptions,
  taskTypeOptions,
  missionOptions,
  acharyaOptions,
  listsBeingCreated,
  disabled,
  onChange,
  onDelete,
  onLeadRequired,
}: {
  row: GridRow;
  masters: Masters;
  statusOptions: { value: string; label: string }[];
  priorityOptions: { value: string; label: string }[];
  progressOptions: { value: string; label: string }[];
  taskTypeOptions: { value: string; label: string }[];
  missionOptions: { value: string; label: string }[];
  acharyaOptions: { value: string; label: string }[];
  listsBeingCreated: string[];
  disabled: boolean;
  onChange: (patch: Partial<GridRow>) => void;
  onDelete: () => void;
  // Called when a lead-requiring task type is picked for a row with no lead —
  // opens the lead-link popup.
  onLeadRequired: () => void;
}) {
  const tr = useTr();
  const requiresLead = typeRequiresLead(row.task_type_id, masters);
  const invalid = rowIsInvalid(row);
  const needsAttention = rowNeedsAttention(row, masters, listsBeingCreated);
  const hasSubtasks = rowHasSubtasks(row);
  const subtaskChips = parseSubtasksCell(row.subtasksText);

  return (
    <tr style={needsAttention ? attentionRowStyle : undefined}>
      <td style={tdStyle}>
        {needsAttention && (
          <span title={tr("This row needs attention")} aria-label={tr("Needs attention")} style={warnDotStyle} />
        )}
      </td>
      <td style={tdStyle}>
        <input
          type="text"
          value={row.title}
          onChange={(e) => onChange({ title: e.target.value })}
          disabled={disabled}
          placeholder={tr("Task title")}
          aria-invalid={invalid}
          aria-label={tr("Title")}
          style={{ ...cellInputStyle, ...(invalid ? invalidInputStyle : undefined) }}
        />
      </td>
      <td style={tdStyle}>
        <input
          type="text"
          value={row.description}
          onChange={(e) => onChange({ description: e.target.value })}
          disabled={disabled}
          placeholder={tr("Description")}
          aria-label={tr("Description")}
          style={cellInputStyle}
        />
      </td>
      <td style={tdStyle}>
        <CustomSelect
          value={row.status_list_id}
          onChange={(v) => onChange({ status_list_id: v, status_low_confidence: false })}
          options={statusOptions}
          placeholder={tr("Status")}
          disabled={disabled}
          compact
        />
        {(() => {
          const caption = listCaption(row, listsBeingCreated);
          if (!caption) return null;
          const willCreate = caption.startsWith("Will create");
          return <div style={willCreate ? listCaptionCreateStyle : listCaptionWarnStyle}>{caption}</div>;
        })()}
      </td>
      <td style={tdStyle}>
        <CustomSelect
          value={row.progress}
          onChange={(v) => onChange({ progress: v })}
          options={progressOptions}
          placeholder={tr("Progress")}
          disabled={disabled}
          compact
        />
      </td>
      <td style={tdStyle}>
        <CustomSelect
          value={row.priority}
          onChange={(v) => onChange({ priority: v })}
          options={priorityOptions}
          placeholder={tr("Priority")}
          disabled={disabled}
          compact
        />
      </td>
      <td style={tdStyle}>
        <AssigneeCell
          assignees={row.assignees}
          members={masters.members}
          disabled={disabled}
          onChange={(assignees) => onChange({ assignees })}
        />
      </td>
      <td style={tdStyle}>
        <LabelCell
          labelIds={row.label_ids}
          newLabels={row.new_labels}
          masters={masters}
          disabled={disabled}
          onChange={(label_ids, new_labels) => onChange({ label_ids, new_labels })}
        />
      </td>
      <td style={tdStyle}>
        <DateCell
          value={row.due_date}
          onChange={(v) => onChange({ due_date: v })}
          disabled={disabled}
          ariaLabel={tr("Due date")}
        />
      </td>
      <td style={tdStyle}>
        <DateCell
          value={row.assigned_on}
          onChange={(v) => onChange({ assigned_on: v })}
          disabled={disabled}
          ariaLabel={tr("Assign date")}
        />
      </td>
      <td style={tdStyle}>
        <CustomSelect
          value={row.task_type_id}
          onChange={(v) => {
            onChange({ task_type_id: v });
            // Picking a lead-requiring type (Pipeline/Marketing/…) with no lead
            // yet pops the lead-link prompt straight away.
            if (typeRequiresLead(v, masters) && !row.lead_ref.trim()) onLeadRequired();
          }}
          options={taskTypeOptions}
          placeholder={tr("Task type")}
          disabled={disabled}
          compact
        />
      </td>
      <td style={tdStyle}>
        <CustomSelect
          value={row.mission_id}
          onChange={(v) => onChange({ mission_id: v })}
          options={missionOptions}
          placeholder={tr("Mission")}
          disabled={disabled}
          compact
        />
      </td>
      <td style={tdStyle}>
        <input
          type="text"
          value={row.mission_impact}
          onChange={(e) => onChange({ mission_impact: e.target.value })}
          disabled={disabled}
          placeholder={tr("Mission impact")}
          aria-label={tr("Mission impact")}
          style={cellInputStyle}
        />
      </td>
      <td style={tdStyle}>
        <CustomSelect
          value={row.acharya_id}
          onChange={(v) => onChange({ acharya_id: v })}
          options={acharyaOptions}
          placeholder={tr("Acharya")}
          disabled={disabled}
          compact
        />
      </td>
      <td style={tdStyle}>
        {requiresLead ? (
          <button
            type="button"
            onClick={onLeadRequired}
            disabled={disabled}
            aria-label={tr("Link a lead")}
            style={row.lead_ref.trim() ? leadChosenBtnStyle : leadNeededBtnStyle}
          >
            {row.lead_ref.trim() ? row.lead_label || row.lead_ref : tr("Link a lead…")}
          </button>
        ) : (
          <input
            type="text"
            value={row.lead_ref}
            onChange={(e) => onChange({ lead_ref: e.target.value, lead_label: e.target.value })}
            disabled={disabled}
            placeholder={tr("Lead no / title")}
            aria-label={tr("Lead")}
            style={cellInputStyle}
          />
        )}
      </td>
      <td style={tdStyle}>
        <input
          type="number"
          min={1}
          max={8}
          value={row.session_count}
          onChange={(e) => onChange({ session_count: Math.min(8, Math.max(1, Number(e.target.value) || 1)) })}
          disabled={disabled || hasSubtasks}
          title={hasSubtasks ? "Auto-summed from subtasks" : undefined}
          aria-label={tr("Session count")}
          style={{ ...cellInputStyle, ...(hasSubtasks ? disabledCellStyle : undefined) }}
        />
      </td>
      <td style={tdStyle}>
        <input
          type="number"
          min={0}
          max={BREAKS_MAX}
          value={row.breaks}
          onChange={(e) =>
            onChange({ breaks: Math.min(BREAKS_MAX, Math.max(0, Number(e.target.value) || 0)) })
          }
          disabled={disabled}
          aria-label={tr("Break count")}
          style={cellInputStyle}
        />
      </td>
      <td style={tdStyle}>
        <input
          type="text"
          value={row.subtasksText}
          onChange={(e) => onChange({ subtasksText: e.target.value })}
          disabled={disabled}
          placeholder={tr("Design (2); Build (3)")}
          aria-label={tr("Subtasks")}
          style={cellInputStyle}
        />
        {subtaskChips.length > 0 && (
          <div style={chipRowStyle}>
            {subtaskChips.map((s, i) => (
              <span key={`${s.title}-${i}`} style={subtaskChipStyle}>
                {s.title} <span style={{ opacity: 0.7 }}>×{s.session_count}</span>
              </span>
            ))}
          </div>
        )}
      </td>
      <td style={tdStyle}>
        <button
          type="button"
          onClick={onDelete}
          disabled={disabled}
          aria-label={tr("Delete row")}
          style={deleteBtnStyle}
        >
          ×
        </button>
      </td>
    </tr>
  );
}

// ── Assignee cell ────────────────────────────────────────────────────────────
// Renders each assignee as a chip. Resolved chips (memberId set) show the
// member's name; unresolved/ambiguous chips are flagged and, when clicked,
// open a candidate dropdown (name · phone · email per §4). A search box adds
// more members.
function AssigneeCell({
  assignees,
  members,
  disabled,
  onChange,
}: {
  assignees: GridAssignee[];
  members: Masters["members"];
  disabled: boolean;
  onChange: (assignees: GridAssignee[]) => void;
}) {
  const tr = useTr();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const listboxId = useId();

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setQ("");
      }
    }
    if (open) document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const byId = new Map(members.map((m) => [m.id, m]));
  const filtered = members.filter((m) => m.name.toLowerCase().includes(q.trim().toLowerCase()));

  function candidateLabel(m: Masters["members"][number]): string {
    return [m.name, m.phone, m.email].filter(Boolean).join(" · ");
  }

  function setMemberFor(idx: number, memberId: string) {
    const next = assignees.map((a, i) => (i === idx ? { ...a, memberId } : a));
    onChange(next);
  }

  function removeAt(idx: number) {
    onChange(assignees.filter((_, i) => i !== idx));
  }

  function addMember(memberId: string) {
    if (assignees.some((a) => a.memberId === memberId)) return;
    onChange([...assignees, { raw: byId.get(memberId)?.name ?? "", memberId }]);
    setQ("");
  }

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <div style={multiControlStyle} onClick={() => !disabled && setOpen((o) => !o)}>
        {assignees.length === 0 && <span style={{ color: "var(--ink-mute)", fontSize: 12 }}>{tr("Unassigned")}</span>}
        {assignees.map((a, idx) => {
          const resolved = resolveAssignee(a.raw, members);
          const flagged = !a.memberId;
          const member = a.memberId ? byId.get(a.memberId) : undefined;
          return (
            <AssigneeChip
              key={`${a.raw}-${idx}`}
              label={member?.name ?? a.raw}
              flagged={flagged}
              disabled={disabled}
              candidates={resolved.candidates}
              candidateLabel={candidateLabel}
              onPick={(memberId) => setMemberFor(idx, memberId)}
              onRemove={() => removeAt(idx)}
            />
          );
        })}
      </div>

      {open && !disabled && (
        <div className="custom-select-dropdown" style={memberDropdownStyle}>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={tr("Search members…")}
            autoFocus
            aria-label={tr("Search members")}
            role="combobox"
            aria-expanded={open}
            aria-controls={listboxId}
            style={searchInputStyle}
          />
          <div id={listboxId} role="listbox" style={{ maxHeight: 180, overflowY: "auto" }}>
            {filtered.length === 0 && (
              <div style={{ padding: "8px 10px", fontSize: 12, color: "var(--ink-mute)" }}>{tr("No members")}</div>
            )}
            {filtered.map((m) => (
              <button
                key={m.id}
                type="button"
                role="option"
                aria-selected={assignees.some((a) => a.memberId === m.id)}
                onClick={() => addMember(m.id)}
                style={memberOptionStyle}
              >
                {candidateLabel(m)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function AssigneeChip({
  label,
  flagged,
  disabled,
  candidates,
  candidateLabel,
  onPick,
  onRemove,
}: {
  label: string;
  flagged: boolean;
  disabled: boolean;
  candidates: Masters["members"];
  candidateLabel: (m: Masters["members"][number]) => string;
  onPick: (memberId: string) => void;
  onRemove: () => void;
}) {
  const tr = useTr();
  const [pickerOpen, setPickerOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setPickerOpen(false);
    }
    if (pickerOpen) document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [pickerOpen]);

  return (
    <span ref={ref} style={{ position: "relative" }}>
      <span
        style={flagged ? flaggedChipStyle : chipStyle}
        role={flagged && candidates.length > 0 ? "button" : undefined}
        tabIndex={flagged && candidates.length > 0 ? 0 : undefined}
        onClick={(e) => {
          e.stopPropagation();
          if (flagged && candidates.length > 0) setPickerOpen((o) => !o);
        }}
        title={flagged ? "Needs checking — click to resolve" : label}
      >
        {label}
        {flagged && <span style={{ marginLeft: 4 }}>{tr("needs checking")}</span>}
        {!disabled && (
          <span
            role="button"
            aria-label={`Remove ${label}`}
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            style={chipRemoveStyle}
          >
            ×
          </span>
        )}
      </span>

      {pickerOpen && candidates.length > 0 && (
        <div className="custom-select-dropdown" style={candidateDropdownStyle}>
          {candidates.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                onPick(c.id);
                setPickerOpen(false);
              }}
              style={memberOptionStyle}
            >
              {candidateLabel(c)}
            </button>
          ))}
        </div>
      )}
    </span>
  );
}

// ── Labels cell ──────────────────────────────────────────────────────────────
// Multiselect of team labels + free-text "add new" (becomes new_labels, which
// the import route creates on insert — mirrors LabelPicker's create flow).
function LabelCell({
  labelIds,
  newLabels,
  masters,
  disabled,
  onChange,
}: {
  labelIds: string[];
  newLabels: string[];
  masters: Masters;
  disabled: boolean;
  onChange: (labelIds: string[], newLabels: string[]) => void;
}) {
  const tr = useTr();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setDraft("");
      }
    }
    if (open) document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const byId = new Map(masters.labels.map((l) => [l.id, l]));

  function toggleLabel(id: string) {
    onChange(labelIds.includes(id) ? labelIds.filter((x) => x !== id) : [...labelIds, id], newLabels);
  }

  function removeNewLabel(name: string) {
    onChange(labelIds, newLabels.filter((n) => n !== name));
  }

  function addNewLabel() {
    const name = draft.trim();
    if (!name) return;
    const existing = masters.labels.find((l) => l.label.trim().toLowerCase() === name.toLowerCase());
    if (existing) {
      if (!labelIds.includes(existing.id)) onChange([...labelIds, existing.id], newLabels);
    } else if (!newLabels.includes(name)) {
      onChange(labelIds, [...newLabels, name]);
    }
    setDraft("");
  }

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <div style={multiControlStyle} onClick={() => !disabled && setOpen((o) => !o)}>
        {labelIds.length === 0 && newLabels.length === 0 && (
          <span style={{ color: "var(--ink-mute)", fontSize: 12 }}>{tr("No labels")}</span>
        )}
        {labelIds.map((id) => {
          const lb = byId.get(id);
          if (!lb) return null;
          return (
            <span key={id} style={{ ...chipStyle, color: lb.color, background: "var(--surface-sunk)" }}>
              {lb.label}
              {!disabled && (
                <span
                  role="button"
                  aria-label={`Remove ${lb.label}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleLabel(id);
                  }}
                  style={chipRemoveStyle}
                >
                  ×
                </span>
              )}
            </span>
          );
        })}
        {newLabels.map((name) => (
          <span key={name} style={newLabelChipStyle} title={tr("New label — will be created on insert")}>
            + {name}
            {!disabled && (
              <span
                role="button"
                aria-label={`Remove ${name}`}
                onClick={(e) => {
                  e.stopPropagation();
                  removeNewLabel(name);
                }}
                style={chipRemoveStyle}
              >
                ×
              </span>
            )}
          </span>
        ))}
      </div>

      {open && !disabled && (
        <div className="custom-select-dropdown" style={memberDropdownStyle}>
          <div style={{ maxHeight: 160, overflowY: "auto" }}>
            {masters.labels.map((lb) => {
              const on = labelIds.includes(lb.id);
              return (
                <button
                  key={lb.id}
                  type="button"
                  onClick={() => toggleLabel(lb.id)}
                  style={{ ...memberOptionStyle, color: on ? lb.color : "var(--ink-soft)", fontWeight: on ? 600 : 400 }}
                >
                  {lb.label}
                </button>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: 6, padding: 8, borderTop: "1px solid var(--rule)" }}>
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addNewLabel();
                }
              }}
              placeholder={tr("New label name")}
              aria-label={tr("New label name")}
              style={{ ...searchInputStyle, borderBottom: "none" }}
            />
            <button type="button" onClick={addNewLabel} disabled={!draft.trim()} style={addLabelBtnStyle}>
              {tr("Add")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────
const wrapStyle: CSSProperties = { display: "flex", flexDirection: "column", gap: 10 };
const summaryRowStyle: CSSProperties = { display: "flex", alignItems: "center", gap: 12 };
const attentionBadgeStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: "var(--ochre)",
  background: "var(--ochre-wash)",
  padding: "4px 10px",
  borderRadius: 999,
};
const addRowBtnStyle: CSSProperties = { marginLeft: "auto", padding: "6px 12px", fontSize: 12 };
// No inner max-height/overflow-y here on purpose. The assignee/label cell
// dropdowns (AssigneeCell, LabelCell, AssigneeChip's candidate picker) use
// position:absolute, not a portal — a scrollable ancestor with a fixed
// max-height would clip them for any row near the bottom of that box. The
// modal card itself (.modal-card in globals.css) is already overflow-y:auto
// with its own max-height, so letting the grid grow to its natural height
// and having the WHOLE MODAL scroll (instead of a nested table viewport)
// keeps every dropdown's clipping ancestor far enough away to never trigger.
const tableWrapStyle: CSSProperties = { minHeight: 0 };
const tableStyle: CSSProperties = { width: "100%", borderCollapse: "collapse", fontFamily: "var(--sans)" };
const thStyle: CSSProperties = {
  position: "sticky",
  top: 0,
  padding: "10px 8px",
  textAlign: "left",
  fontFamily: "var(--mono)",
  fontSize: 10,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--ink-soft)",
  background: "var(--surface-sunk)",
  borderBottom: "1px solid var(--rule-strong)",
  whiteSpace: "nowrap",
};
const tdStyle: CSSProperties = {
  padding: "6px 8px",
  borderBottom: "1px solid var(--rule)",
  verticalAlign: "top",
};
const attentionRowStyle: CSSProperties = { background: "var(--ochre-wash)" };
const warnDotStyle: CSSProperties = {
  display: "inline-block",
  width: 8,
  height: 8,
  borderRadius: "50%",
  background: "var(--ochre)",
  marginTop: 8,
};
const cellInputStyle: CSSProperties = {
  width: "100%",
  padding: "6px 8px",
  fontSize: 13,
  fontFamily: "var(--sans)",
  background: "var(--page)",
  color: "var(--ink)",
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "var(--rule-strong)",
  borderRadius: "var(--r-sm)",
  boxSizing: "border-box",
};
const invalidInputStyle: CSSProperties = {
  borderColor: "var(--crit)",
  background: "var(--crit-wash)",
};
const disabledCellStyle: CSSProperties = { opacity: 0.6, cursor: "not-allowed" };
const listCaptionCreateStyle: CSSProperties = {
  marginTop: 4,
  fontSize: 11,
  color: "var(--green-deep)",
};
const listCaptionWarnStyle: CSSProperties = {
  marginTop: 4,
  fontSize: 11,
  color: "var(--ochre)",
};
const deleteBtnStyle: CSSProperties = {
  width: 24,
  height: 24,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  border: "none",
  background: "transparent",
  color: "var(--ink-mute)",
  fontSize: 16,
  lineHeight: 1,
  cursor: "pointer",
  borderRadius: "var(--r-sm)",
};
const chipRowStyle: CSSProperties = { display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 };
const subtaskChipStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 3,
  padding: "2px 7px",
  borderRadius: 999,
  background: "var(--surface-sunk)",
  color: "var(--ink-soft)",
  fontSize: 11,
  fontFamily: "var(--mono)",
  whiteSpace: "nowrap",
};
const multiControlStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 4,
  minHeight: 30,
  padding: "4px 6px",
  cursor: "pointer",
  background: "var(--page)",
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "var(--rule-strong)",
  borderRadius: "var(--r-sm)",
};
const chipStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  padding: "2px 4px 2px 8px",
  borderRadius: 999,
  background: "var(--surface-sunk)",
  color: "var(--ink-soft)",
  fontSize: 11,
  fontFamily: "var(--sans)",
  whiteSpace: "nowrap",
};
const flaggedChipStyle: CSSProperties = {
  ...chipStyle,
  color: "var(--ochre)",
  background: "var(--ochre-wash)",
  cursor: "pointer",
};
const newLabelChipStyle: CSSProperties = {
  ...chipStyle,
  color: "var(--green-deep)",
  background: "var(--green-wash)",
};
const chipRemoveStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 14,
  height: 14,
  borderRadius: "50%",
  cursor: "pointer",
  fontSize: 12,
  lineHeight: 1,
};
const memberDropdownStyle: CSSProperties = {
  position: "absolute",
  top: "calc(100% + 4px)",
  left: 0,
  minWidth: 240,
  zIndex: 2000,
  background: "var(--surface)",
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "var(--rule)",
  borderRadius: "var(--r-sm)",
  boxShadow: "var(--shadow-md)",
  overflow: "hidden",
};
const candidateDropdownStyle: CSSProperties = {
  position: "absolute",
  top: "calc(100% + 4px)",
  left: 0,
  minWidth: 220,
  zIndex: 2000,
  background: "var(--surface)",
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "var(--rule)",
  borderRadius: "var(--r-sm)",
  boxShadow: "var(--shadow-md)",
  overflow: "hidden",
  padding: "4px 0",
};
const searchInputStyle: CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  fontSize: 12,
  border: "none",
  borderBottom: "1px solid var(--rule)",
  background: "var(--page)",
  color: "var(--ink)",
  outline: "none",
  fontFamily: "var(--sans)",
  boxSizing: "border-box",
};
const memberOptionStyle: CSSProperties = {
  display: "block",
  width: "100%",
  textAlign: "left",
  padding: "7px 10px",
  fontSize: 12,
  cursor: "pointer",
  borderWidth: 0,
  background: "transparent",
  color: "var(--ink-soft)",
  fontFamily: "var(--sans)",
};
const addLabelBtnStyle: CSSProperties = {
  padding: "6px 10px",
  fontSize: 11,
  fontWeight: 500,
  background: "var(--green-deep)",
  color: "#f4efdf",
  border: "1px solid var(--green-deep)",
  borderRadius: "var(--r-sm)",
  cursor: "pointer",
  fontFamily: "var(--sans)",
  whiteSpace: "nowrap",
};
const footerRowStyle: CSSProperties = { display: "flex", justifyContent: "flex-end" };
const leadNeededBtnStyle: CSSProperties = {
  width: "100%",
  padding: "6px 8px",
  fontSize: 12,
  fontFamily: "var(--sans)",
  textAlign: "left",
  cursor: "pointer",
  color: "var(--ochre)",
  background: "var(--ochre-wash)",
  border: "1px solid var(--ochre)",
  borderRadius: "var(--r-sm)",
  boxSizing: "border-box",
};
const leadChosenBtnStyle: CSSProperties = {
  ...leadNeededBtnStyle,
  color: "var(--ink)",
  background: "var(--page)",
  border: "1px solid var(--rule-strong)",
};
const leadOverlayStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  // Above the import wizard's .modal-overlay (--z-modal: 1000) but BELOW the
  // LeadPicker's own dropdown, which portals to <body> at 2000. The picker is
  // rendered inside this popup, so a higher value here (it was 3000) buries the
  // lead list behind the overlay and makes leads unclickable. Keep this < 2000.
  zIndex: 1500,
  background: "rgba(0,0,0,0.5)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "24px 16px",
};
const leadCardStyle: CSSProperties = {
  width: "100%",
  maxWidth: 440,
  // Reserve vertical room so the LeadPicker's search + results list (which
  // portals open just below the field) always has space to render its rows
  // instead of getting squeezed into a couple of lines on a short card.
  minHeight: 320,
  display: "flex",
  flexDirection: "column",
  background: "var(--surface)",
  border: "1px solid var(--rule)",
  borderRadius: "var(--r-md)",
  boxShadow: "var(--shadow-md)",
  padding: "22px 24px",
};
