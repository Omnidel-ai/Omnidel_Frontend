"use client";

import { useCallback, useMemo, useState } from "react";
import { TASK_TITLE_MAX } from "@/lib/field-limits";
import { parseSubtasksCell } from "@/lib/omnipulse/csv-format";
import {
  detectStructure,
  foldMergedCellRows,
  nameHeaders,
  type DetectedMetadata,
  type FoldedRecord,
} from "@/lib/omnipulse/csv-structure";
import type {
  BoardField,
  ColumnAssignment,
  ColumnMapping,
  ImportList,
  ImportResult,
  ImportResultV2,
  ImportStep,
  ImportUser,
  Masters,
  NormalizedTask,
  NormalizedTaskInput,
  ParsedTask,
  TaskPriority,
} from "./types";

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10MB
const SAMPLE_ROW_COUNT = 5;
const CREATE_CONCURRENCY = 5; // gentle parallelism so we don't hammer the API
const MAX_FAILURES_SHOWN = 5;

// ─── RFC-4180-ish CSV parser ──────────────────────────────────────────────
// Dependency-free (the project forbids adding packages). Handles quoted fields,
// embedded delimiters/newlines, "" escaped quotes, and CRLF/LF line endings.
// The delimiter is configurable so the same parser reads tab-separated pastes
// (Excel/Sheets copy as TSV) as well as commas. Returns a matrix of string
// rows; fully-empty rows are dropped.
function parseCsvMatrix(text: string, delim = ","): string[][] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  // Strip a leading UTF-8 BOM if present so the first header isn't polluted.
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

  const pushField = () => {
    row.push(field);
    field = "";
  };
  const pushRow = () => {
    pushField();
    // Drop rows that are entirely empty (e.g. trailing blank lines).
    if (row.some((c) => c.trim() !== "")) rows.push(row);
    row = [];
  };

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++; // consume the escaped quote
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
    } else if (ch === delim) {
      pushField();
    } else if (ch === "\n") {
      pushRow();
    } else if (ch === "\r") {
      // swallow — the following \n (if any) triggers the row push
    } else {
      field += ch;
    }
  }
  // Flush the final field/row if the file didn't end with a newline.
  if (field !== "" || row.length > 0) pushRow();
  return rows;
}

// Detect whether pasted free-form text is actually a delimited table (CSV or
// TSV) and, if so, parse it. Returns null for prose/notes so the caller can
// fall back to the free-form AI extractor. The delimiter is chosen by whichever
// of tab/comma is more common in a leading sample; a table needs at least two
// rows that each carry two or more populated cells.
function parsePastedTable(text: string): string[][] | null {
  const sample = text.slice(0, 4000);
  const commas = (sample.match(/,/g) || []).length;
  const tabs = (sample.match(/\t/g) || []).length;
  if (commas === 0 && tabs === 0) return null;
  const delim = tabs > commas ? "\t" : ",";
  let matrix: string[][];
  try {
    matrix = parseCsvMatrix(text, delim);
  } catch {
    return null;
  }
  const multiCol = matrix.filter((r) => r.filter((c) => c.trim() !== "").length >= 2).length;
  return matrix.length >= 2 && multiCol >= 2 ? matrix : null;
}

// Pure matrix → ParsedCsv: detect the header/metadata/blocks, name empty
// headers, and merged-cell-fold each block so no cell is dropped. Shared by the
// file-upload path (applyMatrix) and the paste-a-table path so both feed one
// pipeline. Returns an error message instead of throwing when there's nothing
// importable.
function parseMatrixToParsed(matrix: string[][]): { parsed?: ParsedCsv; error?: string } {
  if (matrix.length === 0) {
    return { error: "This file has no column headers. Add a header row and try again." };
  }
  const structure = detectStructure(matrix);
  const headers = nameHeaders(matrix[structure.headerRowIndex] ?? []);
  const blocks =
    structure.blocks.length > 0
      ? structure.blocks
      : [
          {
            headerRowIndex: structure.headerRowIndex,
            startRow: structure.headerRowIndex + 1,
            endRow: matrix.length - 1,
          },
        ];
  const records: FoldedRecord[] = [];
  for (const block of blocks) {
    const blockRows = matrix.slice(block.startRow, block.endRow + 1);
    records.push(...foldMergedCellRows(blockRows, headers));
  }
  const dataRows = records.map((r) => r.values);
  if (dataRows.length === 0) {
    return { error: "No tasks found in this file after skipping empty rows." };
  }
  return { parsed: { headers, rows: dataRows, metadata: structure.metadata, records } };
}

export interface ParsedCsv {
  headers: string[];
  rows: Record<string, string>[];
  // Label:value rows detected above the header (e.g. "Workstream,Compliance
  // & Risk") — surfaced to the user as read-only suggested-default chips.
  metadata: DetectedMetadata[];
  // Same rows as `rows`, but merged-cell-aware: each record keeps its raw
  // continuation rows (subtask/date rows folded under a blank title column)
  // so a later mapping pass can turn them into subtasks instead of losing
  // them. `records[i].values === rows[i]` for every i.
  records: FoldedRecord[];
}

// ─── Normalizers ──────────────────────────────────────────────────────────
const PRIORITY_BUCKETS: { value: NormalizedTask["priority"]; keys: string[] }[] = [
  { value: "urgent", keys: ["urgent", "critical", "blocker", "asap", "immediate", "p0"] },
  { value: "high", keys: ["high", "important", "p1", "p2"] },
  { value: "low", keys: ["low", "minor", "trivial", "someday", "nice to have", "p4"] },
];

export function normalizePriority(value: string): NormalizedTask["priority"] {
  const v = value.toLowerCase().trim();
  for (const b of PRIORITY_BUCKETS) {
    if (b.keys.some((k) => v.includes(k))) return b.value;
  }
  return "medium";
}

// Status synonym buckets — used to land a CSV status value into an existing
// board list when there's no direct name match.
const STATUS_BUCKETS: string[][] = [
  ["hold", "block", "pause", "pending", "wait", "stuck"],
  ["progress", "doing", "active", "wip", "start", "ongoing", "current"],
  ["test", "qa", "review", "staging", "verify", "check"],
  ["done", "complete", "closed", "finished", "shipped", "resolved"],
  ["todo", "to-do", "to do", "backlog", "new", "open", "planned", "not started"],
];

// Deterministic status→list resolver. This is now the CLIENT-SIDE FALLBACK for
// the upload→mapping path: runImport prefers the board-aware AI assignment
// (POST .../assign-columns) and only keeps this result when that call fails.
// Resolution order:
//   1. exact (case-insensitive) list-name match
//   2. substring match either direction
//   3. keyword bucket — the value's bucket, matched against list names
//   4. fall back to the first list
export function resolveListId(value: string, lists: ImportList[]): string | undefined {
  if (lists.length === 0) return undefined;
  const v = value.toLowerCase().trim();
  if (!v) return lists[0].id;

  const exact = lists.find((l) => l.name.toLowerCase().trim() === v);
  if (exact) return exact.id;

  const contains = lists.find((l) => {
    const n = l.name.toLowerCase().trim();
    return n.includes(v) || v.includes(n);
  });
  if (contains) return contains.id;

  const bucket = STATUS_BUCKETS.find((syns) => syns.some((s) => v.includes(s)));
  if (bucket) {
    const byBucket = lists.find((l) => {
      const n = l.name.toLowerCase();
      return bucket.some((s) => n.includes(s));
    });
    if (byBucket) return byBucket.id;
  }
  return lists[0].id;
}

function splitAssignees(value: string): string[] {
  return value
    .split(/[,;/]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

// Match raw CSV assignee values (names or emails) to board member ids.
function resolveAssigneeIds(
  raw: string[],
  users: ImportUser[],
): { ids: string[]; unresolved: string[] } {
  const ids = new Set<string>();
  const unresolved: string[] = [];
  for (const value of raw) {
    const v = value.toLowerCase().trim();
    if (!v) continue;
    // Compare against the email local-part too ("jane@x.com" → "jane").
    const local = v.includes("@") ? v.split("@")[0] : v;
    const match = users.find((u) => {
      const name = u.name.toLowerCase().trim();
      if (name === v || name === local) return true;
      const tokens = name.split(/\s+/);
      return tokens.includes(v) || tokens.includes(local);
    });
    if (match) ids.add(match.id);
    else unresolved.push(value);
  }
  return { ids: [...ids], unresolved };
}

// ─── Template CSV → ParsedTask[] (Task 9, §2 Path A) ───────────────────────
// The template download (Task 4) always emits these exact headers, in this
// order — see HEADERS in import-template/route.ts. Because the header set is
// known ahead of time, the template path skips AI/column-mapping entirely and
// goes straight to the editable grid.
const TEMPLATE_HEADERS = [
  "title",
  "status",
  "priority",
  "description",
  "assignee",
  "labels",
  "due_date",
  "session_count",
  "breaks",
  "subtasks",
] as const;

const TASK_PRIORITIES: readonly TaskPriority[] = ["low", "medium", "high", "urgent"];

function toTaskPriority(value: string): TaskPriority | undefined {
  const v = value.trim().toLowerCase();
  return TASK_PRIORITIES.includes(v as TaskPriority) ? (v as TaskPriority) : undefined;
}

// True when the parsed headers are (a superset of) the known template
// columns — used to decide whether an uploaded file is the template (skip
// mapping, go straight to the grid) or an arbitrary CSV (fall back to the
// existing AI-column-mapping path).
function looksLikeTemplate(headers: string[]): boolean {
  const set = new Set(headers.map((h) => h.trim().toLowerCase()));
  return set.has("title") && (set.has("subtasks") || set.has("labels"));
}

// Maps one template CSV row (keyed by the known headers) into a ParsedTask —
// the same shape the AI extractor produces, so both paths feed one grid.
function templateRowToParsedTask(row: Record<string, string>): ParsedTask | null {
  const title = (row.title ?? "").trim();
  if (!title) return null;

  const sessionCountRaw = (row.session_count ?? "").trim();
  const breaksRaw = (row.breaks ?? "").trim();
  const priority = toTaskPriority(row.priority ?? "");

  return {
    title: title.slice(0, TASK_TITLE_MAX),
    description: (row.description ?? "").trim() || undefined,
    status: (row.status ?? "").trim() || undefined,
    priority,
    assigneeRaw: splitAssignees(row.assignee ?? ""),
    labels: splitAssignees(row.labels ?? ""),
    due_date: (row.due_date ?? "").trim() || undefined,
    session_count: sessionCountRaw ? Number.parseInt(sessionCountRaw, 10) || undefined : undefined,
    breaks: breaksRaw ? Number.parseInt(breaksRaw, 10) || undefined : undefined,
    subtasks: parseSubtasksCell(row.subtasks ?? ""),
    // Add-task parity columns (raw values; resolved to ids in the grid).
    progress: (row.progress ?? "").trim() || undefined,
    assigned_on: (row.assigned_on ?? "").trim() || undefined,
    mission_impact: (row.mission_impact ?? "").trim() || undefined,
    task_type: (row.task_type ?? "").trim() || undefined,
    mission: (row.mission ?? "").trim() || undefined,
    acharya: (row.acharya ?? "").trim() || undefined,
    lead: (row.lead ?? "").trim() || undefined,
  };
}

// Picks the detected metadata-banner entry to apply as every extracted task's
// default list_name (e.g. "Workstream: Compliance & Risk"). Prefers a
// workstream/group-ish label when there's more than one banner row; otherwise
// the first one — matches the AI extractor's own metadataDefault fallback.
function pickMetadataDefault(metadata: DetectedMetadata[]): string | undefined {
  if (metadata.length === 0) return undefined;
  const groupish = metadata.find((m) => /workstream|group|category|team|section/i.test(m.label));
  return (groupish ?? metadata[0]).value || undefined;
}

// Deterministic ParsedTask builder for the legacy manual-mapping fallback step
// (only reached when the AI import path — extractTasksFromRecords — is
// unavailable or the request itself fails; see analyzeAndAdvance). Reuses the
// user-confirmed column mapping to feed the SAME grid + bulk-import pipeline
// as the AI paths, rather than the old standalone per-row create flow, so the
// widened BoardField vocabulary (due_date/labels/list/subtask_title) actually
// does something. A row whose title column is blank but whose subtask_title
// column has a value continues the previous row as a subtask — the mapping
// equivalent of csv-structure.ts's merged-cell fold, keyed off the user's
// confirmed mapping instead of the auto-detected title column.
function buildParsedTasksFromMapping(
  parsed: ParsedCsv,
  mapping: ColumnMapping,
  metadataDefault: string | undefined,
): ParsedTask[] {
  // "Last column wins" when a field is mapped more than once, matching the
  // duplicateFields warning shown on the mapping step.
  const colFor = (field: BoardField) =>
    [...Object.entries(mapping)].reverse().find(([, f]) => f === field)?.[0];
  const titleCol = colFor("title");
  const descCol = colFor("description");
  const statusCol = colFor("status");
  const priorityCol = colFor("priority");
  const assigneeCol = colFor("assignee");
  const dueCol = colFor("due_date");
  const labelsCol = colFor("labels");
  const listCol = colFor("list");
  const subtaskCol = colFor("subtask_title");

  const tasks: ParsedTask[] = [];
  let current: ParsedTask | null = null;

  for (const row of parsed.rows) {
    const title = titleCol ? (row[titleCol] ?? "").trim() : "";

    if (!title && current && subtaskCol) {
      const subtitle = (row[subtaskCol] ?? "").trim();
      if (subtitle) current.subtasks.push({ title: subtitle.slice(0, TASK_TITLE_MAX), session_count: 1 });
      continue;
    }
    if (!title) continue;

    current = {
      title: title.slice(0, TASK_TITLE_MAX),
      description: descCol ? (row[descCol] ?? "").trim() || undefined : undefined,
      status: statusCol ? (row[statusCol] ?? "").trim() || undefined : undefined,
      priority: priorityCol ? toTaskPriority((row[priorityCol] ?? "").trim()) : undefined,
      assigneeRaw: assigneeCol ? splitAssignees(row[assigneeCol] ?? "") : [],
      labels: labelsCol ? splitAssignees(row[labelsCol] ?? "") : [],
      due_date: dueCol ? (row[dueCol] ?? "").trim() || undefined : undefined,
      subtasks: [],
      list_name: (listCol ? (row[listCol] ?? "").trim() : "") || metadataDefault || undefined,
    };
    tasks.push(current);
  }

  return tasks;
}

// ─── Hook ───────────────────────────────────────────────────────────────────
export function useCSVImport(params: {
  boardId: string;
  lists: ImportList[];
  users: ImportUser[];
}) {
  const { boardId, lists, users } = params;

  const [step, setStep] = useState<ImportStep>("choose");
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<ParsedCsv | null>(null);
  const [uploadError, setUploadError] = useState("");
  // Metadata banner rows detected above the header (e.g. "Workstream,
  // Compliance & Risk") — shown as read-only chips on the upload step and
  // available here for a later step to apply as suggested defaults.
  const [detectedMetadata, setDetectedMetadata] = useState<DetectedMetadata[]>([]);

  // ── "choose" step state ─────────────────────────────────────────────────
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const [downloadError, setDownloadError] = useState("");

  // ── "paste" step state ──────────────────────────────────────────────────
  const [pasteText, setPasteText] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState("");

  // ── "grid" step state ────────────────────────────────────────────────────
  // gridRows feeds <PreviewGrid rows={...}>; masters is fetched once per
  // modal-open (lazily, the first time either import path reaches the grid)
  // from GET /api/omnipulse/boards/[id]/import-masters.
  const [gridRows, setGridRows] = useState<ParsedTask[]>([]);
  const [masters, setMasters] = useState<Masters | null>(null);
  const [mastersLoading, setMastersLoading] = useState(false);
  const [mastersError, setMastersError] = useState("");

  const [analyzing, setAnalyzing] = useState(false);
  const [mapping, setMapping] = useState<ColumnMapping>({});

  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [result, setResult] = useState<ImportResult | null>(null);
  const [gridResult, setGridResult] = useState<ImportResultV2 | null>(null);

  // Board-aware column assignments for the grid path, aligned to gridRows by
  // index. `assigning` gates the grid render so PreviewGrid builds its rows
  // once, after assignments are known (it reads them in its initial state).
  const [gridAssignments, setGridAssignments] = useState<ColumnAssignment[] | null>(null);
  const [assigning, setAssigning] = useState(false);

  // ── "confirmLists" step state ───────────────────────────────────────────
  // Extracted tasks awaiting a decision, and the list_names among them that
  // don't match any of the board's real lists — set by
  // proceedToGridWithListCheck, consumed by confirmCreateLists/skipListCreation.
  const [confirmListNames, setConfirmListNames] = useState<string[]>([]);
  const [pendingGridTasks, setPendingGridTasks] = useState<ParsedTask[]>([]);
  // Names the user confirmed creating — sent to the import route as
  // `createLists` and passed to PreviewGrid so it can caption pending rows.
  const [listsToCreate, setListsToCreate] = useState<string[]>([]);

  const rowCount = parsed?.rows.length ?? 0;

  // ── masters: fetch once, reused by both import paths' grid step ─────────
  const ensureMasters = useCallback(async (): Promise<Masters | null> => {
    if (masters) return masters;
    setMastersError("");
    setMastersLoading(true);
    try {
      const res = await fetch(`/api/omnipulse/boards/${boardId}/import-masters`);
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || "Could not load board data for the import grid.");
      }
      const data = (await res.json()) as Masters;
      setMasters(data);
      return data;
    } catch (err) {
      setMastersError(
        err instanceof Error ? err.message : "Could not load board data for the import grid.",
      );
      return null;
    } finally {
      setMastersLoading(false);
    }
  }, [boardId, masters]);

  // Board-aware task→column placement. Reads the board's ACTUAL current columns
  // server-side (fetched fresh each call) and returns one assignment per task,
  // aligned by index. Returns null on any failure so callers can fall back to
  // their own deterministic/exact-match behavior. Never throws.
  const fetchColumnAssignments = useCallback(
    async (
      items: { title: string; description?: string; status?: string }[],
    ): Promise<ColumnAssignment[] | null> => {
      if (items.length === 0) return [];
      try {
        const res = await fetch(`/api/omnipulse/boards/${boardId}/assign-columns`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tasks: items }),
        });
        if (!res.ok) return null;
        const data = (await res.json()) as { assignments?: ColumnAssignment[] };
        return data.assignments ?? null;
      } catch {
        return null;
      }
    },
    [boardId],
  );

  // Common hand-off into the grid step, used by both import paths. Loads masters
  // and the board-aware column assignments before the grid renders, so each row
  // lands in its best-fit column up front (user can still override any cell).
  const goToGrid = useCallback(
    async (tasks: ParsedTask[]) => {
      setGridRows(tasks);
      setGridAssignments(null);
      setStep("grid");
      setAssigning(true);
      const m = await ensureMasters();
      // Only ask the model to place tasks when we actually have columns.
      const assignments =
        m && m.statuses.length > 0
          ? await fetchColumnAssignments(
              tasks.map((t) => ({ title: t.title, description: t.description, status: t.status })),
            )
          : null;
      setGridAssignments(assignments);
      setAssigning(false);
    },
    [ensureMasters, fetchColumnAssignments],
  );

  // Compares each extracted task's list_name against the board's actual lists
  // (via the same masters fetch PreviewGrid's status dropdown uses) and, when
  // any don't match, routes to "confirmLists" instead of the grid so the user
  // can choose to create them or import without (Shubham's decision). A
  // template CSV never sets list_name, so this is always a no-op pass-through
  // for that path.
  const proceedToGridWithListCheck = useCallback(
    async (tasks: ParsedTask[]) => {
      const m = await ensureMasters();
      const names = [
        ...new Set(tasks.map((t) => t.list_name?.trim()).filter((n): n is string => !!n)),
      ];
      const unmatched = names.filter(
        (name) => !m || !m.statuses.some((s) => s.name.trim().toLowerCase() === name.toLowerCase()),
      );
      if (unmatched.length > 0) {
        setPendingGridTasks(tasks);
        setConfirmListNames(unmatched);
        setStep("confirmLists");
        return;
      }
      setListsToCreate([]);
      await goToGrid(tasks);
    },
    [ensureMasters, goToGrid],
  );

  // "confirmLists" step actions — either create the missing lists (the import
  // route does the actual creation; this just records which names to send) or
  // proceed with no list for those tasks, per §4/§5 of the brief.
  const confirmCreateLists = useCallback(async () => {
    const tasks = pendingGridTasks;
    setListsToCreate(confirmListNames);
    setConfirmListNames([]);
    setPendingGridTasks([]);
    await goToGrid(tasks);
  }, [confirmListNames, pendingGridTasks, goToGrid]);

  const skipListCreation = useCallback(async () => {
    const tasks = pendingGridTasks;
    setListsToCreate([]);
    setConfirmListNames([]);
    setPendingGridTasks([]);
    await goToGrid(tasks);
  }, [pendingGridTasks, goToGrid]);

  // Fields mapped to more than one column (excludes "skip") — drives the
  // "mapped to more than one column" warnings on the mapping step.
  const duplicateFields = useMemo<BoardField[]>(() => {
    const counts = new Map<BoardField, number>();
    for (const field of Object.values(mapping)) {
      if (field === "skip") continue;
      counts.set(field, (counts.get(field) ?? 0) + 1);
    }
    return [...counts.entries()].filter(([, n]) => n > 1).map(([f]) => f);
  }, [mapping]);

  // ── "choose" step: download the board-seeded template, then advance ────────
  const downloadTemplate = useCallback(async () => {
    setDownloadError("");
    setDownloadingTemplate(true);
    try {
      const res = await fetch(`/api/omnipulse/boards/${boardId}/import-template`);
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || "Could not download the template.");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `import-template-${boardId}.xlsx`;
      link.rel = "noopener";
      link.style.display = "none";
      document.body.appendChild(link);
      link.click();
      // Defer cleanup to a later task. Revoking the blob URL (or removing the
      // anchor) on the same tick as click() can abort the download before the
      // browser has read the blob — some browsers then navigate to the now-dead
      // URL, opening a blank new tab on every attempt. Give the download a tick
      // to commit first; the timers are fire-and-forget (safe after unmount).
      setTimeout(() => {
        link.remove();
        URL.revokeObjectURL(url);
      }, 1000);
      // No step change: the download is triggered on demand from the upload
      // step's "Download template" button, so we stay where we are instead of
      // auto-advancing (which used to make the download feel like it "popped").
    } catch (err) {
      setDownloadError(
        err instanceof Error ? err.message : "Could not download the template.",
      );
    } finally {
      setDownloadingTemplate(false);
    }
  }, [boardId]);

  // ── "choose" step: template path. Goes to the upload step, where the user
  // downloads the board-seeded template on demand (the download button lives
  // under the drop area) and then uploads the filled-in file back. ────────────
  const chooseTemplate = useCallback(() => {
    setDownloadError("");
    setStep("upload");
  }, []);

  // ── "choose" step: switch to the free-form paste path ──────────────────────
  const choosePaste = useCallback(() => {
    setDownloadError("");
    setStep("paste");
  }, []);

  // ── "choose" step: bring your own CSV/template. Goes straight to the upload
  // step (no board-seeded template download) — the upload path's
  // analyzeAndAdvance already routes any non-template file through the same AI
  // extraction (extractTasksFromRecords) that infers the user's columns
  // automatically, so a hand-made or exported spreadsheet "just works". ───────
  const chooseUpload = useCallback(() => {
    setDownloadError("");
    setStep("upload");
  }, []);

  // Shared extraction core for a parsed table (from a file upload OR a pasted
  // spreadsheet). Template headers skip straight to the grid; any other table
  // goes through the AI records-extractor (which has its own deterministic,
  // no-API fallback in csv-import-ai.ts), and only a fully failed/empty
  // extraction drops to the legacy manual column-mapping step.
  const runExtraction = useCallback(
    async (p: ParsedCsv) => {
      if (looksLikeTemplate(p.headers)) {
        const tasks = p.rows
          .map(templateRowToParsedTask)
          .filter((t): t is ParsedTask => t !== null);
        await proceedToGridWithListCheck(tasks);
        return;
      }

      setAnalyzing(true);
      const metadataDefault = pickMetadataDefault(p.metadata);
      try {
        const res = await fetch(`/api/omnipulse/boards/${boardId}/import-extract`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            headers: p.headers,
            records: p.records.map((r) => ({ values: r.values, children: r.children })),
            metadataDefault,
          }),
        });
        if (res.ok) {
          const data = (await res.json()) as { tasks?: ParsedTask[] };
          const tasks = data.tasks ?? [];
          if (tasks.length > 0) {
            setAnalyzing(false);
            await proceedToGridWithListCheck(tasks);
            return;
          }
        }
      } catch {
        // Falls through to the legacy manual-mapping fallback below.
      }

      // Legacy fallback — the AI import produced nothing usable, or the request
      // itself failed. Manual column mapping still gets the user to an import.
      let aiMapping: ColumnMapping | null = null;
      try {
        const res = await fetch("/api/omnipulse/csv-import-analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            headers: p.headers,
            sampleRows: p.rows.slice(0, SAMPLE_ROW_COUNT),
          }),
        });
        if (res.ok) {
          const data = (await res.json()) as { mapping?: ColumnMapping | null };
          aiMapping = data.mapping ?? null;
        }
      } catch {
        // Silent — fall through to the all-"skip" manual mapping below.
      }

      // Every header gets an entry; unmapped (or AI-unavailable) → "skip".
      const full: ColumnMapping = {};
      for (const h of p.headers) {
        full[h] = aiMapping?.[h] ?? "skip";
      }
      setMapping(full);
      setAnalyzing(false);
      setStep("mapping");
    },
    [boardId, proceedToGridWithListCheck],
  );

  // ── "paste" step: if the pasted text is itself a delimited table (CSV/TSV),
  // run it through the SAME structured pipeline as a file upload — it handles
  // merged-cell blocks, per-subtask dates, and metadata banners and has a
  // no-API deterministic fallback, so a pasted spreadsheet works even when the
  // free-form AI extractor is unavailable. Otherwise (prose/notes), send the
  // raw text to the free-form AI extractor as before. ─────────────────────────
  const continueFromPaste = useCallback(async () => {
    const text = pasteText.trim();
    if (!text) return;
    setExtractError("");
    setExtracting(true);
    try {
      const matrix = parsePastedTable(pasteText);
      if (matrix) {
        const { parsed: p } = parseMatrixToParsed(matrix);
        if (p) {
          setFile(null);
          setUploadError("");
          setDetectedMetadata(p.metadata);
          setParsed(p);
          setExtracting(false);
          await runExtraction(p);
          return;
        }
      }

      const res = await fetch(`/api/omnipulse/boards/${boardId}/import-extract`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || "Could not extract tasks from this text.");
      }
      const data = (await res.json()) as { tasks?: ParsedTask[] };
      const tasks = data.tasks ?? [];
      if (tasks.length === 0) {
        setExtractError("No tasks could be found in that text. Try adding more detail.");
        return;
      }
      await proceedToGridWithListCheck(tasks);
    } catch (err) {
      setExtractError(
        err instanceof Error ? err.message : "Could not extract tasks from this text.",
      );
    } finally {
      setExtracting(false);
    }
  }, [pasteText, boardId, proceedToGridWithListCheck, runExtraction]);

  // Shared tail of the upload flow: a raw string matrix (from either the CSV
  // parser or the server-side .xlsx parse) → detected header + merged-cell-
  // folded records → parsed state. Real exports rarely put a clean header on
  // row 1, so we detect it (skipping any metadata banner rows above) and fold
  // merged-cell task/subtask blocks so no cell is silently dropped. A clean
  // template (header on row 0, one title per row) folds 1:1.
  const applyMatrix = useCallback((f: File, matrix: string[][]) => {
    const { parsed: p, error } = parseMatrixToParsed(matrix);
    if (!p) {
      setUploadError(error ?? "No tasks found in this file.");
      return;
    }
    setFile(f);
    setDetectedMetadata(p.metadata);
    setParsed(p);
  }, []);

  // ── Step 1: validate + parse a chosen file (.csv or .xlsx) ─────────────────
  // The downloaded template is an .xlsx (dropdowns need Excel), so uploads
  // accept .xlsx as well as .csv. .xlsx bytes are parsed server-side (Node
  // zlib) via the board's xlsx-parse route into the same string matrix a CSV
  // yields — everything after applyMatrix is format-agnostic.
  const selectFile = useCallback(
    async (f: File) => {
      setUploadError("");
      setParsed(null);
      setFile(null);
      setDetectedMetadata([]);

      const lower = f.name.toLowerCase();
      const isXlsx =
        lower.endsWith(".xlsx") ||
        f.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      const isCsv =
        lower.endsWith(".csv") ||
        f.type === "text/csv" ||
        f.type === "application/vnd.ms-excel";

      if (f.size > MAX_FILE_BYTES) {
        setUploadError("File too large. Maximum size is 10MB.");
        return;
      }

      if (isXlsx) {
        try {
          const res = await fetch(`/api/omnipulse/boards/${boardId}/xlsx-parse`, {
            method: "POST",
            headers: { "Content-Type": "application/octet-stream" },
            body: f,
          });
          if (!res.ok) {
            const body = await res.json().catch(() => null);
            setUploadError(body?.error || "Could not read this .xlsx file.");
            return;
          }
          const data = (await res.json()) as { matrix?: string[][] };
          applyMatrix(f, data.matrix ?? []);
        } catch {
          setUploadError("Could not read this .xlsx file. Try re-saving it, or upload a .csv.");
        }
        return;
      }

      if (!isCsv) {
        setUploadError("Could not read this file. Upload a .csv or .xlsx file.");
        return;
      }

      let text: string;
      try {
        text = await f.text();
      } catch {
        setUploadError("Could not read this file. Make sure it's a valid .csv file.");
        return;
      }

      let matrix: string[][];
      try {
        matrix = parseCsvMatrix(text);
      } catch {
        setUploadError("Could not read this file. Make sure it's a valid .csv file.");
        return;
      }

      applyMatrix(f, matrix);
    },
    [boardId, applyMatrix],
  );

  // ── Step 1 → 2: template headers skip straight to the grid. Non-template
  // files go through the SAME AI import as paste (Shubham's decision,
  // 2026-07-08) — extractTasksFromRecords sees the already merged-cell-folded
  // records, so continuation rows read as subtasks and a detected metadata
  // banner (e.g. "Workstream: Compliance & Risk") applies as a default
  // list_name. That extraction has its own internal deterministic fallback
  // for a missing/failing AI call (see csv-import-ai.ts), so the legacy
  // manual column-mapping step below is only reached if the request itself
  // fails or returns nothing at all. ──────────────────────────────────────
  const analyzeAndAdvance = useCallback(async () => {
    if (!parsed) return;
    await runExtraction(parsed);
  }, [parsed, runExtraction]);

  // ── "mapping" step (legacy fallback) → build ParsedTask[] from the
  // confirmed mapping and feed the same grid + list-check pipeline as the AI
  // paths, rather than the old standalone per-row create flow. ─────────────
  const continueFromMapping = useCallback(async () => {
    if (!parsed) return;
    const metadataDefault = pickMetadataDefault(detectedMetadata);
    const tasks = buildParsedTasksFromMapping(parsed, mapping, metadataDefault);
    await proceedToGridWithListCheck(tasks);
  }, [parsed, mapping, detectedMetadata, proceedToGridWithListCheck]);

  const setColumnField = useCallback((header: string, field: BoardField) => {
    setMapping((prev) => ({ ...prev, [header]: field }));
  }, []);

  // ── Build normalized tasks from the confirmed mapping ──────────────────────
  const buildTasks = useCallback((): {
    tasks: NormalizedTask[];
    skippedNoTitle: number;
  } => {
    if (!parsed) return { tasks: [], skippedNoTitle: 0 };
    const defaultListId = lists[0]?.id;
    const tasks: NormalizedTask[] = [];
    let skippedNoTitle = 0;

    for (const row of parsed.rows) {
      const task: NormalizedTask = {
        title: "",
        priority: "medium",
        list_id: defaultListId,
        assigneeRaw: [],
      };
      // Header order = insertion order, so a field mapped to multiple columns
      // resolves "last column wins" (matches the duplicate-field warning).
      for (const [col, field] of Object.entries(mapping)) {
        if (field === "skip") continue;
        const value = (row[col] ?? "").trim();
        if (!value) continue;
        if (field === "title") task.title = value.slice(0, TASK_TITLE_MAX);
        else if (field === "description") task.description = value;
        else if (field === "priority") task.priority = normalizePriority(value);
        else if (field === "status") {
          // Keep the raw status text for the board-aware assignment call; set a
          // deterministic list_id now as the fallback if that call fails.
          task.statusRaw = value;
          task.list_id = resolveListId(value, lists);
        } else if (field === "assignee") task.assigneeRaw = splitAssignees(value);
      }
      if (task.title) tasks.push(task);
      else skippedNoTitle++;
    }
    return { tasks, skippedNoTitle };
  }, [parsed, mapping, lists]);

  // ── Step 2 → 3: create the tasks with bounded concurrency + progress ───────
  const runImport = useCallback(async (): Promise<ImportResult> => {
    const { tasks, skippedNoTitle } = buildTasks();
    setImporting(true);
    setProgress({ done: 0, total: tasks.length });

    // Board-aware column placement: overrides each task's deterministic-fallback
    // list_id with the model's choice, read against the board's real columns.
    // On failure the resolveListId fallback set in buildTasks stands.
    let lowConfidence = 0;
    const assignments = await fetchColumnAssignments(
      tasks.map((t) => ({ title: t.title, description: t.description, status: t.statusRaw })),
    );
    if (assignments) {
      for (const a of assignments) {
        const task = tasks[a.index];
        if (!task) continue;
        task.list_id = a.columnId;
        if (a.confidence === "low") lowConfidence += 1;
      }
    }

    const failures: ImportResult["failures"] = [];
    const unresolvedSet = new Set<string>();
    let created = 0;
    let processed = 0;

    const createOne = async (task: NormalizedTask) => {
      const { ids, unresolved } = resolveAssigneeIds(task.assigneeRaw, users);
      unresolved.forEach((u) => unresolvedSet.add(u));
      const payload: Record<string, unknown> = {
        title: task.title,
        priority: task.priority,
        board_id: boardId,
      };
      if (task.description) payload.description = task.description;
      if (task.list_id) payload.list_id = task.list_id;
      if (ids.length) payload.assignee_ids = ids;
      try {
        const res = await fetch("/api/omnipulse/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.error || `Failed (${res.status})`);
        }
        created++;
      } catch (err) {
        if (failures.length < MAX_FAILURES_SHOWN) {
          failures.push({
            title: task.title,
            message: err instanceof Error ? err.message : "Create failed",
          });
        }
      } finally {
        processed++;
        setProgress({ done: processed, total: tasks.length });
      }
    };

    // Bounded worker pool — CREATE_CONCURRENCY in flight at a time.
    let cursor = 0;
    const worker = async () => {
      while (cursor < tasks.length) {
        const idx = cursor++;
        await createOne(tasks[idx]);
      }
    };
    await Promise.all(
      Array.from({ length: Math.min(CREATE_CONCURRENCY, tasks.length) }, worker),
    );

    const res: ImportResult = {
      created,
      total: tasks.length,
      skippedNoTitle,
      unresolvedAssignees: [...unresolvedSet],
      lowConfidence,
      failures,
    };
    setResult(res);
    setImporting(false);
    setStep("result");
    return res;
  }, [buildTasks, users, boardId, fetchColumnAssignments]);

  // Count of tasks the legacy manual-mapping fallback would carry into the
  // grid (has a title after the confirmed mapping) — for the mapping step's
  // "Continue" button label. The AI/template paths don't need this; they
  // build their ParsedTask[] directly and go straight to the list check.
  const importableCount = useMemo(
    () =>
      parsed ? buildParsedTasksFromMapping(parsed, mapping, pickMetadataDefault(detectedMetadata)).length : 0,
    [parsed, mapping, detectedMetadata],
  );

  // ── "grid" step → POST /api/omnipulse/boards/[id]/import (Task 6/9) ────────
  // PreviewGrid already reshaped its rows into NormalizedTaskInput[]; this is
  // a single bulk-create request, unlike the legacy per-row runImport above.
  // Includes `createLists` when the confirm-lists step's "Create & import"
  // was chosen, so the route creates those board lists before placing rows.
  const runGridImport = useCallback(
    async (rows: NormalizedTaskInput[]) => {
      setImporting(true);
      setProgress({ done: 0, total: rows.length });
      try {
        const res = await fetch(`/api/omnipulse/boards/${boardId}/import`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tasks: rows,
            createLists: listsToCreate.length > 0 ? listsToCreate : undefined,
          }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.error || `Import failed (${res.status})`);
        }
        const data = (await res.json()) as ImportResultV2;
        setGridResult(data);
        setProgress({ done: data.total, total: data.total });
        setStep("result");
      } catch (err) {
        setGridResult({
          created: 0,
          total: rows.length,
          skippedNoTitle: 0,
          unresolved: [],
          ambiguous: [],
          listsCreated: [],
          failures: [
            {
              title: "",
              message: err instanceof Error ? err.message : "Import failed",
            },
          ],
        });
        setStep("result");
      } finally {
        setImporting(false);
      }
    },
    [boardId, listsToCreate],
  );

  const reset = useCallback(() => {
    setStep("choose");
    setFile(null);
    setParsed(null);
    setUploadError("");
    setDetectedMetadata([]);
    setDownloadingTemplate(false);
    setDownloadError("");
    setPasteText("");
    setExtracting(false);
    setExtractError("");
    setGridRows([]);
    setGridAssignments(null);
    setAssigning(false);
    setMasters(null);
    setMastersLoading(false);
    setMastersError("");
    setAnalyzing(false);
    setMapping({});
    setImporting(false);
    setProgress({ done: 0, total: 0 });
    setResult(null);
    setGridResult(null);
    setConfirmListNames([]);
    setPendingGridTasks([]);
    setListsToCreate([]);
  }, []);

  const backToMapping = useCallback(() => {
    setResult(null);
    setStep("mapping");
  }, []);

  // Back button from "upload", "paste", or "confirmLists" returns to the
  // path-choice step.
  const backToChoose = useCallback(() => {
    setUploadError("");
    setDownloadError("");
    setExtractError("");
    setConfirmListNames([]);
    setPendingGridTasks([]);
    setStep("choose");
  }, []);

  return {
    // state
    step,
    file,
    parsed,
    rowCount,
    uploadError,
    detectedMetadata,
    downloadingTemplate,
    downloadError,
    pasteText,
    extracting,
    extractError,
    gridRows,
    gridAssignments,
    assigning,
    masters,
    mastersLoading,
    mastersError,
    analyzing,
    mapping,
    duplicateFields,
    importing,
    progress,
    result,
    gridResult,
    importableCount,
    confirmListNames,
    listsToCreate,
    // actions
    downloadTemplate,
    chooseTemplate,
    choosePaste,
    chooseUpload,
    setPasteText,
    continueFromPaste,
    selectFile,
    analyzeAndAdvance,
    continueFromMapping,
    setColumnField,
    runImport,
    runGridImport,
    confirmCreateLists,
    skipListCreation,
    reset,
    backToMapping,
    backToChoose,
  };
}
