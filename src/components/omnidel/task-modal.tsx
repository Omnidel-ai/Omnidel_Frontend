"use client";

import { useState, useEffect, useLayoutEffect, useMemo, useRef, useCallback, useId, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { CustomSelect } from "@/components/omnidel/custom-select";
import { cachedJson } from "@/lib/client/options-cache";
import { LeadPicker } from "@/components/omnidel/lead-picker";
import { DoneCheck } from "@/components/omnidel/done-check";
import { LabelPicker } from "@/components/omnidel/label-picker";
import { DatePicker } from "@/components/omnidel/date-picker";
import {
  recurringDisplayLabel,
  normalizeRecurringDays,
  normalizeRecurringMonthDays,
} from "@/lib/task-recurring";
import { monthDaysFromTask } from "@/components/omnidel/recurring-select";
import { Markdown, extractUrls } from "@/components/omnidel/markdown";
import { RichTextEditor, isRichTextEmpty, isTiptapDoc } from "@/components/omnidel/rich-text-editor";
import { LinkPreview } from "@/components/omnidel/link-preview";
import { CommentComposer, COMMENT_EMPTY_DOC, type ComposerAttachment } from "@/components/omnidel/comment-composer";
import { CommentActionsMenu } from "@/components/omnidel/comment-actions-menu";
import { MemberMultiSelect } from "@/components/omnidel/member-multi-select";
import { mergeAssigneePickerOptions } from "@/lib/client/assignee-picker-options";
import { uploadPipelineFile } from "@/lib/client/upload-blob-file";
import { usePermissions } from "@/lib/client/permissions";
import { useIsMobile } from "@/lib/client/use-is-mobile";
import { clampToMaxLength, TASK_TITLE_MAX } from "@/lib/field-limits";
import { AcharyaPicker, formatAcharyaSource } from "@/components/omnidel/acharya-picker";
import { ConfirmDialog } from "@/components/omnidel/confirm-dialog";
import { TaskChecklist, addSubtaskTriggerStyle } from "@/components/omnidel/task-checklist";
import { SubtaskTemplateMenu } from "@/components/omnidel/subtask-template-menu";
import { blobViewUrl } from "@/lib/client/blob-url";
import { ImageLightbox, type LightboxImage } from "@/components/omnidel/image-lightbox";
import { isSimpleTaskType } from "@/lib/simple-task";
import { ShareButton } from "@/components/omnidel/share-sheet";
import { buildTaskShareContent } from "@/lib/omnipulse/task-share";

interface Task {
  id: string; title: string; description: string | null;
  assigned_to: string | null; assigned_to_name?: string | null;
  assignees?: { id: string; name: string }[];
  assigned_on: string | null;
  assigned_by_user_id: string | null; assigned_by_name?: string | null;
  lead_id: string | null; priority: string; status: string;
  lead_no?: string | null; lead_title?: string | null;
  status_label?: string | null; status_color?: string | null;
  due_date: string | null; completed_at: string | null;
  lane: string | null; mission_impact: string | null;
  session_count: number;
  session_count_auto?: boolean;
  break_allowance_total: number | null;
  acharya_id?: string | null;
  resolved_acharya_name?: string | null;
  resolved_acharya_source?: "task" | "list" | "board" | "workspace" | null;
  mission_id: string | null;
  task_type_id: string | null; task_type_name?: string | null; task_type_slug?: string | null; task_type_requires_lead?: boolean;
  linked_site_id: string | null; project_name?: string | null;
  linked_store_id: string | null; recurring: string | null;
  recurring_days?: number[] | null;
  workspace_id?: string | null;
  // Board / list context: sent by GET /api/omnipulse/tasks/[id] and used to
  // build the share deep link + message (src/lib/omnipulse/task-share.ts).
  board_id?: string | null;
  board_name?: string | null;
  list_name?: string | null;
  media_project_id?: string | null;
  media_chat_id?: string | null;
  media_provision?: { project_id: string; chat_id: string; added: string[] };
  media_provision_error?: string;
  is_active: boolean; created_on: string; updated_on: string;
}

// The set of task fields editable in the modal. Edits accumulate in one Draft
// and are saved together — no per-field saving / no autosave on change.
interface Draft {
  title: string;
  description: string;
  status: string;
  lane: string;
  priority: string;
  linked_site_id: string;
  assignee_ids: string[];
  assigned_on: string;
  due_date: string;
  mission_impact: string;
  session_count: string;
  session_count_auto: boolean;
  break_allowance_total: string;
  mission_id: string;
  task_type_id: string;
  lead_id: string;
  acharya_id: string | null;
  /** Empty string = Never (maps to NULL in DB). */
  recurring: string;
  /** weekly: Mon-first 0–6; monthly/custom: day-of-month 1–31. */
  recurring_days: number[];
  /**
   * Weekly only: mon-first weekday → first occurrence ISO.
   * Click Mon 27 → starts[0]="…-27" so Mon 20 is not marked.
   */
  recurring_weekday_starts: Record<number, string>;
}

function draftFromTask(t: Task): Draft {
  const due = (t.due_date || "").slice(0, 10);
  const days =
    t.recurring === "monthly"
      ? monthDaysFromTask(t.recurring, t.recurring_days, t.due_date)
      : t.recurring === "custom"
        ? normalizeRecurringMonthDays(t.recurring_days)
        : normalizeRecurringDays(t.recurring_days);

  // Legacy weekly load: each saved weekday starts from due date until user re-picks.
  const weekdayStarts: Record<number, string> = {};
  if (t.recurring === "weekly" && due) {
    for (const w of days) {
      if (typeof w === "number" && w >= 0 && w <= 6) weekdayStarts[w] = due;
    }
  }

  return {
    title: t.title || "",
    description: t.description || "",
    status: t.status || "planned",
    lane: t.lane || "",
    priority: t.priority || "medium",
    linked_site_id: t.linked_site_id || "",
    assignee_ids: (t.assignees && t.assignees.length > 0)
      ? t.assignees.map((a) => a.id)
      : (t.assigned_to ? [t.assigned_to] : []),
    // Normalize timestamps to YYYY-MM-DD so DatePicker + dirty compare stay clean.
    assigned_on: (t.assigned_on || "").slice(0, 10),
    due_date: due,
    mission_impact: t.mission_impact || "",
    session_count: String(t.session_count ?? 1),
    session_count_auto: t.session_count_auto ?? false,
    break_allowance_total: t.break_allowance_total != null ? String(t.break_allowance_total) : "1",
    mission_id: t.mission_id || "",
    task_type_id: t.task_type_id || "",
    lead_id: t.lead_id || "",
    acharya_id: t.acharya_id ?? null,
    recurring: t.recurring || "",
    recurring_days: days,
    recurring_weekday_starts: weekdayStarts,
  };
}

interface Attachment {
  url: string;
  name: string;
  size: number;
  type: string;
  mime?: string;
  docType?: string;
  filename?: string;
}

interface TaskNote {
  id: string;
  task_id: string;
  author_user_id: string | null;
  author_name: string;
  note_type: string;
  content: string;
  attachments: Attachment[];
  created_on: string;
  edited_at?: string | null;
}

function mergeCommentWithAttachmentMarkdown(content: string, attachments: ComposerAttachment[]): string {
  // CommentAttachments already renders `attachments` as images. Embedding
  // ![alt](url) into the body as well made paste-only comments show every
  // screenshot twice (empty string content is not a TipTap doc, so the old
  // merge path appended markdown image refs on submit).
  const base = content.trim();
  if (isTiptapDoc(base)) return base;
  if (attachments.length > 0 && !base) return COMMENT_EMPTY_DOC;
  return base;
}

/** Drop markdown images whose URLs are already in attachments (legacy doubles). */
function stripAttachedImagesFromMarkdown(source: string, attachments: Attachment[]): string {
  let out = source;
  for (const a of attachments || []) {
    if (!a?.url) continue;
    const escaped = a.url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    out = out.replace(new RegExp(`!\\[[^\\]]*\\]\\(${escaped}\\)`, "g"), "");
  }
  return out.replace(/\n{3,}/g, "\n\n").trim();
}

function dedupeComposerAttachments(attachments: ComposerAttachment[]): ComposerAttachment[] {
  const seenUrls = new Set<string>();
  const seenFingerprint = new Set<string>();
  const out: ComposerAttachment[] = [];
  for (const att of attachments) {
    if (!att?.url) continue;
    if (seenUrls.has(att.url)) continue;
    // Paste can rename the same screenshot (screenshot-…png) on each upload —
    // collapse images by size + mime so doubled pastes don't post twice.
    // Skip size fingerprint when size is 0 (legacy/proof rows) so distinct
    // zero-size images are not collapsed into one.
    const mime = (att.type || "").split(";")[0].trim().toLowerCase().replace("image/jpg", "image/jpeg");
    const fp = att.type?.startsWith("image/") && att.size > 0
      ? `img|${att.size}|${mime}`
      : `${att.name}|${att.size}|${att.type}`;
    if (att.type?.startsWith("image/") && att.size > 0 && seenFingerprint.has(fp)) continue;
    seenUrls.add(att.url);
    if (att.type?.startsWith("image/") && att.size > 0) seenFingerprint.add(fp);
    out.push(att);
  }
  return out;
}

// A comment's author may edit/delete it only within this window after posting.
// Mirrors COMMENT_EDIT_WINDOW_MS on the server (services/tasks.ts) — the server
// re-checks, so this is purely for immediate UI feedback.
const COMMENT_EDIT_WINDOW_MS = 15 * 60 * 1000;

interface FileNote {
  noteId: string;
  att: Attachment;
  uploadedAt: string;
  /** True when backed by a dedicated file note — safe to delete without removing the comment. */
  canDelete: boolean;
}

interface Label {
  id: string;
  slug: string;
  label: string;
  color: string;
  sort_order?: number;
}

/** Order-independent label-id equality for draft vs saved assignment. */
function labelIdsEqual(a: Label[], b: Label[]): boolean {
  if (a.length !== b.length) return false;
  const sa = [...a.map((l) => l.id)].sort();
  const sb = [...b.map((l) => l.id)].sort();
  return sa.every((id, i) => id === sb[i]);
}

interface Props {
  taskId: string | null;
  onClose: () => void;
  onMutate?: () => void;
  boardId?: string;
  canManageOverride?: boolean;
  // Board-scoped user list — when provided, the assignee picker uses ONLY
  // these users (board members for private boards, workspace members for
  // workspace-visible boards). Falls back to global users if omitted.
  users?: { id: string; name: string }[];
}

const LANES = ["m_offices", "m_balconies", "m_biophilic", "m_retail", "people", "platform", "governance"];
const PRIORITIES = ["low", "medium", "high", "urgent"];
const STATUS_OPTIONS = [
  { value: "planned", label: "Planned" },
  { value: "doing", label: "Doing" },
  { value: "done", label: "Done" },
];

function laneLabel(l: string | null) { return l ? l.replace(/^m_/, "").replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()) : "---"; }
function fmtDate(d: string | null) { return d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "---"; }
function fmtSessionSummary(count: number) {
  const n = count || 1;
  const totalMinutes = n * 45;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const duration = hours > 0 && minutes > 0
    ? `${hours}h ${minutes}m`
    : hours > 0
      ? `${hours}h`
      : `${minutes}m`;
  return `${n} session${n === 1 ? "" : "s"} (${duration} total)`;
}
function fmtDateTime(d: string) { return new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }); }

// Solid priority chips — same scale as board cards (LOW/MED/HIGH/URG, no left dot).
const PRIORITY_BADGE: Record<string, { label: string; bg: string; fg: string }> = {
  low:    { label: "LOW",  bg: "#7cb342", fg: "#ffffff" },
  medium: { label: "MED",  bg: "#c9a227", fg: "#ffffff" },
  high:   { label: "HIGH", bg: "#f09020", fg: "#ffffff" },
  urgent: { label: "URG",  bg: "#e53935", fg: "#ffffff" },
};

/** Priority select options with color dots matching the board badge scale. */
const PRIORITY_SELECT_OPTIONS = PRIORITIES.map((p) => ({
  value: p,
  label: p,
  color: PRIORITY_BADGE[p]?.bg ?? "var(--ink-mute)",
}));

function PriorityIndicator({ priority }: { priority: string }) {
  const key = (priority || "").toLowerCase();
  const meta = PRIORITY_BADGE[key] ?? {
    label: (priority || "?").slice(0, 4).toUpperCase(),
    bg: "var(--surface-sunk)",
    fg: "var(--ink-soft)",
  };
  return (
    <span
      title={`Priority: ${priority}`}
      style={{
        display: "inline-flex", alignItems: "center",
        padding: "2px 8px", borderRadius: 999,
        background: meta.bg, color: meta.fg,
        fontFamily: "var(--mono)", fontSize: 11,
        letterSpacing: "0.05em", textTransform: "uppercase", whiteSpace: "nowrap",
      }}
    >
      {meta.label}
    </span>
  );
}

function statusColor(s: string) {
  switch (s) {
    case "done":    return { background: "var(--ok-wash)", color: "var(--ok)" };
    case "doing":   return { background: "var(--ochre-wash)", color: "var(--ochre)" };
    case "planned": return { background: "var(--surface-sunk)", color: "var(--ink-mute)" };
    default:        return { background: "var(--surface-sunk)", color: "var(--ink-mute)" };
  }
}

export function TaskModal({ taskId, onClose, onMutate, users, boardId, canManageOverride }: Props) {
  // Render absolutely nothing when no task is selected so we don't waste a fetch.
  if (!taskId) return null;
  return <TaskModalInner taskId={taskId} onClose={onClose} onMutate={onMutate} usersProp={users} boardId={boardId} canManageOverride={canManageOverride} />;
}

function TaskModalInner({ taskId, onClose, onMutate, usersProp, boardId, canManageOverride }: { taskId: string; onClose: () => void; onMutate?: () => void; usersProp?: { id: string; name: string }[]; boardId?: string; canManageOverride?: boolean }) {
  const { can, userId, isAdmin } = usePermissions();
  const canManage = canManageOverride ?? (
    isAdmin || can("omnipulse.tasks.update")
  );
  const isMobile = useIsMobile();

  const [task, setTask] = useState<Task | null>(null);
  const [users, setUsers] = useState<{ id: string; name: string }[]>([]);
  const [missions, setMissions] = useState<{ id: string; name_en: string }[]>([]);
  const [taskTypes, setTaskTypes] = useState<{ id: string; name_en: string; slug: string; requires_lead: boolean }[]>([]);
  const [docTypes, setDocTypes] = useState<{ slug: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [fieldError, setFieldError] = useState("");

  // Share: the deep link needs window.location.origin, which only exists on the
  // client. Reading it in an effect (not during render) keeps the SSR markup and
  // the first client render identical — the Share button appears on mount.
  const [shareOrigin, setShareOrigin] = useState("");
  useEffect(() => { setShareOrigin(window.location.origin); }, []);

  // Built from the SAVED task, not the draft: a message quoting an unsaved title
  // next to a link that still shows the old one would just confuse the reader.
  const shareContent = useMemo(() => {
    if (!task) return null;
    return buildTaskShareContent({ ...task, board_id: task.board_id ?? boardId ?? null }, shareOrigin);
  }, [task, boardId, shareOrigin]);

  // Title uses click-to-edit (heading ↔ input); its value lives in `draft`.
  const [editingTitle, setEditingTitle] = useState(false);

  // Single editable draft for ALL task fields. Edits accumulate here and are
  // persisted together by the one Save button in the header — no per-field
  // saving. `null` until the task has loaded.
  const [draft, setDraft] = useState<Draft | null>(null);

  // Notes & Files
  const [notes, setNotes] = useState<TaskNote[]>([]);
  const [fileNotes, setFileNotes] = useState<FileNote[]>([]);
  const [showAddComment, setShowAddComment] = useState(false);
  const [commentContent, setCommentContent] = useState(COMMENT_EMPTY_DOC);
  const [commentAttachments, setCommentAttachments] = useState<ComposerAttachment[]>([]);
  const [commentMentions, setCommentMentions] = useState<{ id: string; name: string }[]>([]);
  const [savingComment, setSavingComment] = useState(false);
  const [noteError, setNoteError] = useState("");
  // Inline comment edit + delete (15-min author window).
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [editAttachments, setEditAttachments] = useState<ComposerAttachment[]>([]);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState("");
  const [deleteNoteId, setDeleteNoteId] = useState<string | null>(null);
  const [deletingNote, setDeletingNote] = useState(false);
  // Ticks so edit/delete controls disappear once the window lapses while the
  // modal stays open. 30s granularity is plenty for a 15-min window.
  const [nowTs, setNowTs] = useState<number>(() => Date.now());
  const [selectedDocType, setSelectedDocType] = useState("others");
  const [uploading, setUploading] = useState(false);
  const [fileDeletingId, setFileDeletingId] = useState<string | null>(null);
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false);
  const [checklistProgress, setChecklistProgress] = useState({ checked: 0, total: 0 });
  const [checklistRefreshToken, setChecklistRefreshToken] = useState(0);
  const [subtaskAddOpen, setSubtaskAddOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const leftColRef = useRef<HTMLDivElement>(null);
  const rightScrollRef = useRef<HTMLDivElement>(null);
  const [commentsOpen, setCommentsOpen] = useState(true);

  // Labels — draft assignment vs last-saved (dirty until Save). Master-label
  // create/edit/delete still hits the catalog APIs immediately.
  const [assignedLabels, setAssignedLabels] = useState<Label[]>([]);
  const [savedLabels, setSavedLabels] = useState<Label[]>([]);
  const [availableLabels, setAvailableLabels] = useState<Label[]>([]);
  // The project (board) that owns this task's labels — returned by the labels
  // endpoint and used to scope inline label creation. Labels are project-scoped
  // (migration 20260801000000), so new labels are created in this board.
  const [labelBoardId, setLabelBoardId] = useState<string | null>(null);

  // OmniStudio media-task provision notice (shown after save when chat is linked)
  const [mediaProvisionPopup, setMediaProvisionPopup] = useState<{ added: string[] } | null>(null);

  const fetchBoardMentions = useCallback(async (query: string) => {
    if (!boardId) return [];
    try {
      const res = await fetch(
        `/api/omnipulse/boards/${boardId}/mentions?q=${encodeURIComponent(query)}`,
      );
      if (!res.ok) return [];
      const data = await res.json();
      return data.items || [];
    } catch (err) {
      console.error("[mentions] board fetch failed:", err);
      return [];
    }
  }, [boardId]);

  // ── Dirty tracking ──────────────────────────────────────────────────────
  // `original` is the saved task projected into Draft shape; a field is dirty
  // when the live draft differs from it. Computed here (before the effects) so
  // the Escape handler can guard against discarding unsaved edits.
  const original = task ? draftFromTask(task) : null;
  const isSimpleTask = !!task && isSimpleTaskType({
    id: task.task_type_id,
    slug: task.task_type_slug,
    name: task.task_type_name,
  });
  // Array-aware equality so assignee_ids (a string[]) compares by set, not by
  // reference — order-independent. Plain objects (recurring_weekday_starts)
  // compare by key/value: `original` is rebuilt via draftFromTask every render,
  // so reference === would always mark the draft dirty and false-trigger
  // "Discard unsaved changes?" on close with no edits.
  function fieldEqual(a: Draft[keyof Draft], b: Draft[keyof Draft]): boolean {
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false;
      const sa = [...a].sort();
      const sb = [...b].sort();
      return sa.every((v, i) => v === sb[i]);
    }
    if (
      a !== null &&
      b !== null &&
      typeof a === "object" &&
      typeof b === "object" &&
      !Array.isArray(a) &&
      !Array.isArray(b)
    ) {
      const ao = a as Record<string, unknown>;
      const bo = b as Record<string, unknown>;
      const ak = Object.keys(ao);
      const bk = Object.keys(bo);
      if (ak.length !== bk.length) return false;
      return ak.every((k) => ao[k] === bo[k]);
    }
    return a === b;
  }
  function dirty(key: keyof Draft): boolean {
    return !!(draft && original && !fieldEqual(draft[key], original[key]));
  }
  const labelsDirty = !labelIdsEqual(assignedLabels, savedLabels);
  const fieldsDirty =
    !!draft && !!original && (Object.keys(draft) as (keyof Draft)[]).some((k) => !fieldEqual(draft[k], original[k]));
  const isDirty = fieldsDirty || labelsDirty;

  // Refs so in-flight fetchTask/fetchLabels responses can see current dirty
  // state without re-creating the callbacks (and re-firing the load effect).
  const fieldsDirtyRef = useRef(fieldsDirty);
  const labelsDirtyRef = useRef(labelsDirty);
  fieldsDirtyRef.current = fieldsDirty;
  labelsDirtyRef.current = labelsDirty;
  // Monotonic request ids — ignore stale responses from overlapping fetches
  // (Strict Mode double-mount, taskId switch, slow network).
  const taskFetchGenRef = useRef(0);
  const labelsFetchGenRef = useRef(0);

  function setField<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((d) => (d ? { ...d, [key]: value } : d));
  }

  const handleChecklistProgress = useCallback((checked: number, total: number) => {
    setChecklistProgress({ checked, total });
  }, []);

  // Load/refresh task from server. Always updates `task` (baseline for dirty
  // checks). Only replaces `draft` when there are no local field edits — so a
  // late refetch cannot wipe assignee/title/etc. selections the user just made
  // without Save. Callers that need a hard reset (new taskId) clear draft first.
  const fetchTask = useCallback(() => {
    const gen = ++taskFetchGenRef.current;
    return fetch(`/api/omnipulse/tasks/${taskId}`).then(r => r.json()).then(d => {
      if (gen !== taskFetchGenRef.current) return;
      setTask(d.item);
      setDraft((prev) => {
        if (!d.item) return null;
        // Keep in-progress edits across refetch / late responses.
        if (prev && fieldsDirtyRef.current) return prev;
        return draftFromTask(d.item);
      });
      if (!fieldsDirtyRef.current) setEditingTitle(false);
      setLoading(false);
    });
  }, [taskId]);

  const fetchNotes = useCallback(() => {
    return fetch(`/api/omnipulse/tasks/${taskId}/notes`).then(r => r.json()).then(d => {
      const items: TaskNote[] = d.items || [];
      setNotes(items);
      // Files section = dedicated file notes only. Comment images/docs stay on
      // the comment when a Files entry is deleted (they are not harvested here).
      const files: FileNote[] = [];
      const seenUrls = new Set<string>();
      for (const note of items) {
        if (note.note_type !== "file" || !Array.isArray(note.attachments)) continue;
        for (const att of note.attachments) {
          const normalized = normalizeAttachment(att, note.content);
          if (!normalized.url || seenUrls.has(normalized.url)) continue;
          seenUrls.add(normalized.url);
          files.push({
            noteId: note.id,
            att: normalized,
            uploadedAt: note.created_on,
            canDelete: true,
          });
        }
      }
      setFileNotes(files);
    });
  }, [taskId]);

  const fetchLabels = useCallback(() => {
    const gen = ++labelsFetchGenRef.current;
    return fetch(`/api/omnipulse/tasks/${taskId}/labels`).then(r => r.json()).then(d => {
      if (gen !== labelsFetchGenRef.current) return;
      const assigned: Label[] = d.assigned || [];
      // Always refresh the saved baseline + catalog; keep draft assignment
      // when the user has unsaved label adds/removes.
      setSavedLabels(assigned);
      setAssignedLabels((prev) => (labelsDirtyRef.current ? prev : assigned));
      setAvailableLabels(d.available || []);
      setLabelBoardId(d.board_id ?? null);
    });
  }, [taskId]);

  useEffect(() => {
    setLoading(true);
    setChecklistProgress({ checked: 0, total: 0 });
    // New task identity (or remount): drop any prior draft so we don't show
    // task A's edits while task B is loading, and so the first fetch seeds draft.
    setTask(null);
    setDraft(null);
    setAssignedLabels([]);
    setSavedLabels([]);
    setEditingTitle(false);
    fetchTask();
    fetchNotes();
    fetchLabels();
    // Board page always passes `users` (often [] while members are still
    // loading). Treat undefined as "fall back to global options"; any array
    // (including empty) is authoritative and synced via the effect below.
    if (usersProp !== undefined) setUsers(usersProp);
    cachedJson<{
      users?: { id: string; name: string }[];
      sites?: { id: string; name: string }[];
      missions?: { id: string; name_en: string }[];
      taskTypes?: { id: string; name_en: string; slug: string; requires_lead: boolean }[];
    }>("/api/omnipulse/tasks/options").then(d => {
      if (usersProp === undefined) setUsers(d.users || []);
      setMissions(d.missions || []);
      setTaskTypes(d.taskTypes || []);
    }).catch(() => {});
    cachedJson<{ docTypes?: { slug: string; name: string }[] }>("/api/omnimart/pipeline/options").then(d => {
      setDocTypes(d.docTypes || []);
    }).catch(() => {});
    // usersProp deliberately omitted: member-list arrival must not remount/reset
    // the task draft. Synced in the dedicated effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchTask, fetchNotes, fetchLabels]);

  // Deep-link / notification open often mounts this modal before the board's
  // member list finishes loading. Without this sync, users stays [] and
  // Assigned To shows Unassigned until the modal is closed and reopened.
  useEffect(() => {
    if (usersProp !== undefined) setUsers(usersProp);
  }, [usersProp]);

  // Close on Escape — guard against losing unsaved edits.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (discardConfirmOpen) return;
      // A sub-dialog (delete-comment confirm) owns Escape while open — it
      // handles its own dismissal, so don't also close/discard the task modal.
      if (deleteNoteId !== null) return;
      if (isDirty) {
        e.preventDefault();
        setDiscardConfirmOpen(true);
        return;
      }
      onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, isDirty, discardConfirmOpen, deleteNoteId]);

  // Lock body scroll while modal open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Re-tick every 30s so a comment's edit/delete controls hide once its 15-min
  // window closes without needing a refetch or user interaction.
  useEffect(() => {
    const t = setInterval(() => setNowTs(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  // Sync right scroll area's maxHeight to live left column height so
  // comments always track exactly how tall the accordion sections are.
  useLayoutEffect(() => {
    if (loading || !task) return;
    const left = leftColRef.current;
    const right = rightScrollRef.current;
    if (!left || !right) return;
    const ro = new ResizeObserver(([entry]) => {
      if (rightScrollRef.current) {
        rightScrollRef.current.style.maxHeight = `${entry.contentRect.height}px`;
      }
    });
    ro.observe(left);
    return () => ro.disconnect();
  }, [loading, task]);

  // Returns true on a successful save so callers (handleSaveAll) can auto-close
  // the modal; false leaves it open with the field error shown.
  // When Media provision succeeds or soft-fails, keep the modal open so the
  // error / ready popup is visible (don't rely on reopen).
  async function patchTask(patch: Record<string, unknown>): Promise<{
    ok: boolean;
    keepOpenForMedia?: boolean;
  }> {
    setFieldError("");
    setActionLoading(true);
    const res = await fetch(`/api/omnipulse/tasks/${taskId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    let ok = res.ok;
    let provision: { added: string[] } | null = null;
    let provisionError: string | null = null;
    try {
      const d = await res.json();
      if (!res.ok) {
        setFieldError(d.error || "Failed to update");
        ok = false;
      } else if (d.item?.media_provision_error) {
        provisionError = String(d.item.media_provision_error);
      } else if (d.item?.media_provision?.added) {
        provision = { added: d.item.media_provision.added as string[] };
      } else if (d.item?.media_provision && !d.item.media_provision.already_linked) {
        provision = { added: (d.item.media_provision.added as string[]) || [] };
      }
      if (ok && d.item && (d.item.media_chat_id || d.item.media_project_id || provisionError)) {
        setTask((prev) =>
          prev
            ? {
                ...prev,
                media_project_id: d.item.media_project_id ?? prev.media_project_id,
                media_chat_id: d.item.media_chat_id ?? prev.media_chat_id,
                media_provision_error: provisionError || undefined,
              }
            : prev,
        );
      }
    } catch {
      if (!res.ok) {
        setFieldError("Failed to update");
        ok = false;
      }
    }
    await fetchTask();
    await fetchNotes();
    setActionLoading(false);
    onMutate?.();
    if (provisionError) {
      setFieldError(provisionError);
      return { ok: true, keepOpenForMedia: true };
    }
    if (provision) {
      setMediaProvisionPopup(provision);
      return { ok: true, keepOpenForMedia: true };
    }
    return { ok };
  }

  async function persistStatus(status: string): Promise<boolean> {
    const res = await fetch(`/api/omnipulse/tasks/${taskId}/status`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setFieldError(d.error || "Failed to update status");
      return false;
    }
    return true;
  }

  /** Apply draft label adds/removes to the server. Returns false on first failure. */
  async function persistLabelDiff(): Promise<boolean> {
    const savedIds = new Set(savedLabels.map((l) => l.id));
    const draftIds = new Set(assignedLabels.map((l) => l.id));
    for (const lb of assignedLabels) {
      if (savedIds.has(lb.id)) continue;
      const res = await fetch(`/api/omnipulse/tasks/${taskId}/labels`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label_id: lb.id }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setFieldError(d.error || "Failed to add label");
        return false;
      }
    }
    for (const lb of savedLabels) {
      if (draftIds.has(lb.id)) continue;
      const res = await fetch(`/api/omnipulse/tasks/${taskId}/labels/${lb.id}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setFieldError(d.error || "Failed to remove label");
        return false;
      }
    }
    return true;
  }

  async function addComment() {
    setNoteError("");
    if (savingComment) return;
    if (isRichTextEmpty(commentContent) && commentAttachments.length === 0) {
      setNoteError("Comment is required");
      return;
    }
    // Clipboard can attach the same image twice — send each URL once.
    const uniqueAttachments = dedupeComposerAttachments(commentAttachments);
    // Comment note keeps images; documents already have tip-tap links.
    const commentImages = uniqueAttachments.filter((a) => a.type?.startsWith("image/"));
    setSavingComment(true);
    const mergedContent = mergeCommentWithAttachmentMarkdown(commentContent, commentImages);
    const res = await fetch(`/api/omnipulse/tasks/${taskId}/notes`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: mergedContent,
        note_type: "note",
        // Attachments uploaded inline via the composer (paste / drag / file
        // picker) ride along on the note row so they survive a refetch.
        attachments: commentImages,
        // @mentioned user ids — the server notifies each one.
        mentions: commentMentions.map((m) => m.id),
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setSavingComment(false);
      setNoteError(data.error || "Failed to add comment");
      return;
    }
    setNotes(prev => [data.item, ...prev]);
    // Promote staged uploads into Files only after a successful post.
    for (const att of uniqueAttachments) {
      try {
        await attachDocumentFromComment(att);
      } catch (err) {
        console.error("[task-modal] promote comment file to Files failed:", err);
      }
    }
    setSavingComment(false);
    setCommentContent(COMMENT_EMPTY_DOC);
    setCommentAttachments([]);
    setCommentMentions([]);
  }

  // Whether the 15-min author window is still open for a comment (client mirror
  // of the server rule; the server re-checks on save/delete).
  function withinCommentWindow(createdOn: string): boolean {
    return nowTs - new Date(createdOn).getTime() <= COMMENT_EDIT_WINDOW_MS;
  }
  // Editing others' words is never allowed — author + open window only.
  function canEditComment(note: TaskNote): boolean {
    return note.note_type === "note" && note.author_user_id === userId && withinCommentWindow(note.created_on);
  }
  // Author within the window, or an admin/manager anytime (moderation).
  function canDeleteComment(note: TaskNote): boolean {
    if (note.note_type !== "note") return false;
    if (isAdmin || canManage) return true;
    return note.author_user_id === userId && withinCommentWindow(note.created_on);
  }

  function startEditComment(note: TaskNote) {
    setEditingNoteId(note.id);
    setEditContent(note.content);
    setEditAttachments([]);
    setEditError("");
  }

  function cancelEditComment() {
    setEditingNoteId(null);
    setEditContent("");
    setEditAttachments([]);
    setEditError("");
  }

  async function saveEditComment(noteId: string) {
    setEditError("");
    if (isRichTextEmpty(editContent) && editAttachments.length === 0) {
      setEditError("Comment is required");
      return;
    }
    const uniqueAttachments = dedupeComposerAttachments(editAttachments);
    setSavingEdit(true);
    // Content-only edit API — new files are staged in editAttachments and
    // promoted to the Files section after a successful save.
    if (!isRichTextEmpty(editContent)) {
      const res = await fetch(`/api/omnipulse/tasks/${taskId}/notes/${noteId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: editContent.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSavingEdit(false);
        setEditError(data.error || "Failed to edit comment");
        return;
      }
      setNotes(prev => prev.map(n => (n.id === noteId ? { ...n, ...data.item } : n)));
    }
    for (const att of uniqueAttachments) {
      try {
        await attachDocumentFromComment(att);
      } catch (err) {
        console.error("[task-modal] promote edited comment file to Files failed:", err);
      }
    }
    setSavingEdit(false);
    cancelEditComment();
  }

  async function confirmDeleteComment() {
    const noteId = deleteNoteId;
    if (!noteId) return;
    const comment = notes.find((n) => n.id === noteId);
    setDeletingNote(true);
    setNoteError("");

    // Collect URLs tied to this comment (attachments + any matching Files entries
    // linked from the comment body — e.g. MD/PDF dropped into the composer).
    const relatedUrls = new Set<string>();
    if (comment) {
      for (const att of comment.attachments || []) {
        if (att?.url) relatedUrls.add(att.url);
      }
      const body = comment.content || "";
      for (const fn of fileNotes) {
        if (fn.att.url && body.includes(fn.att.url)) relatedUrls.add(fn.att.url);
      }
    }

    // Delete dedicated file notes that share those URLs (created when uploading
    // into the comment). Skip the comment note itself — deleted below.
    const fileNotesToRemove = notes.filter(
      (n) =>
        n.note_type === "file" &&
        n.id !== noteId &&
        Array.isArray(n.attachments) &&
        n.attachments.some((a) => a?.url && relatedUrls.has(a.url)),
    );

    for (const fn of fileNotesToRemove) {
      const res = await fetch(`/api/omnipulse/tasks/${taskId}/notes/${fn.id}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setDeletingNote(false);
        setDeleteNoteId(null);
        setNoteError(d.error || "Failed to delete related file");
        return;
      }
      for (const att of fn.attachments || []) {
        if (!att?.url) continue;
        try {
          await fetch("/api/uploads", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: att.url }),
          });
        } catch (err) {
          console.error("[task-modal] blob delete failed (file note already removed):", err);
        }
      }
    }

    const res = await fetch(`/api/omnipulse/tasks/${taskId}/notes/${noteId}`, { method: "DELETE" });
    setDeletingNote(false);
    setDeleteNoteId(null);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setNoteError(d.error || "Failed to delete comment");
      await fetchNotes();
      return;
    }

    // Best-effort blob cleanup for attachments that lived only on the comment.
    for (const url of relatedUrls) {
      const stillReferenced = fileNotesToRemove.some((n) =>
        (n.attachments || []).some((a) => a?.url === url),
      );
      if (stillReferenced) continue;
      try {
        await fetch("/api/uploads", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url }),
        });
      } catch (err) {
        console.error("[task-modal] blob delete failed (comment already removed):", err);
      }
    }

    await fetchNotes();
  }

  async function attachDocumentFromComment(att: ComposerAttachment): Promise<void> {
    const noteRes = await fetch(`/api/omnipulse/tasks/${taskId}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        note_type: "file",
        content: `[${selectedDocType}] ${att.name}`,
        attachments: [{ ...att, docType: selectedDocType }],
      }),
    });
    if (!noteRes.ok) {
      const d = await noteRes.json().catch(() => ({}));
      throw new Error(d.error || "Failed to save file to task");
    }
    const nd = await noteRes.json();
    setNotes((prev) => [nd.item, ...prev]);
    const normalized = normalizeAttachment({ ...att, docType: selectedDocType }, nd.item.content);
    setFileNotes((prev) => {
      if (prev.some((f) => f.att.url === normalized.url)) return prev;
      return [
        { noteId: nd.item.id, att: normalized, uploadedAt: nd.item.created_on, canDelete: true },
        ...prev,
      ];
    });
  }

  async function handleFileUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setNoteError("");
    for (const file of Array.from(files)) {
      try {
        const att = { ...(await uploadPipelineFile(file)), docType: selectedDocType };
        const noteRes = await fetch(`/api/omnipulse/tasks/${taskId}/notes`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ note_type: "file", content: `[${selectedDocType}] ${att.name}`, attachments: [att] }),
        });
        if (noteRes.ok) {
          const nd = await noteRes.json();
          setNotes(prev => [nd.item, ...prev]);
          const normalized = normalizeAttachment(att, nd.item.content);
          setFileNotes(prev => {
            if (prev.some((f) => f.att.url === normalized.url)) return prev;
            return [{ noteId: nd.item.id, att: normalized, uploadedAt: nd.item.created_on, canDelete: true }, ...prev];
          });
        }
      } catch (err: unknown) {
        setNoteError(err instanceof Error ? err.message : "Upload failed");
      }
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function removeFile(noteId: string, url: string) {
    setFileDeletingId(noteId);
    setNoteError("");
    const res = await fetch(`/api/omnipulse/tasks/${taskId}/attachments`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setNoteError(data.error || "Failed to delete file");
      setFileDeletingId(null);
      return;
    }
    // Only purge blob storage when no comment still embeds this URL.
    if (data.deleteBlob !== false) {
      try {
        await fetch("/api/uploads", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url }),
        });
      } catch (err) {
        console.error("[task-modal] blob delete failed (attachment already removed):", err);
      }
    }
    setFileDeletingId(null);
    await fetchNotes();
  }

  function addLabel(lb: Label) {
    // Draft only — persisted on Save with other field edits.
    setAssignedLabels((prev) => (prev.some((a) => a.id === lb.id) ? prev : [...prev, lb]));
  }

  function removeLabel(labelId: string) {
    setAssignedLabels((cur) => cur.filter((a) => a.id !== labelId));
  }

  // Persist EVERY dirty field (plus status + label assignment) in one Save.
  // Field PATCH via patchTask; status uses /status; labels POST/DELETE diff.
  async function handleSaveAll() {
    if (!draft || !original) return;
    const patch: Record<string, unknown> = {};
    if (dirty("title")) {
      const t = draft.title.trim();
      if (t.length < 2) { setFieldError("Title must be at least 2 characters"); return; }
      if (t.length > TASK_TITLE_MAX) {
        setFieldError(`Title must be at most ${TASK_TITLE_MAX} characters`);
        return;
      }
      patch.title = t;
    }
    if (dirty("description")) patch.description = draft.description;
    if (dirty("lane")) patch.lane = draft.lane || null;
    if (dirty("priority")) patch.priority = draft.priority || "medium";
    if (dirty("linked_site_id")) patch.linked_site_id = draft.linked_site_id || null;
    if (dirty("assignee_ids")) patch.assignee_ids = draft.assignee_ids;
    if (dirty("assigned_on")) patch.assigned_on = draft.assigned_on || null;
    if (dirty("due_date")) patch.due_date = draft.due_date || null;
    if (dirty("mission_impact")) patch.mission_impact = draft.mission_impact || null;
    // Sessions are dual-mode. Auto: the server derives the total from subtasks,
    // so we send only the flag, not a budget. Manual: send session_count as the
    // budget (server validates it stays >= the subtask sum). Breaks are a
    // whole-task pool, always task-level.
    if (dirty("session_count_auto")) patch.session_count_auto = draft.session_count_auto;
    if (!draft.session_count_auto && dirty("session_count")) patch.session_count = Number(draft.session_count) || 1;
    if (dirty("break_allowance_total")) {
      patch.break_allowance_total = draft.break_allowance_total === ""
        ? 1
        : Number(draft.break_allowance_total);
    }
    if (dirty("mission_id")) patch.mission_id = draft.mission_id || null;
    if (dirty("task_type_id")) patch.task_type_id = draft.task_type_id || null;
    if (dirty("lead_id")) patch.lead_id = draft.lead_id || null;
    if (dirty("acharya_id")) patch.acharya_id = draft.acharya_id;
    if (dirty("recurring") || dirty("recurring_days")) {
      patch.recurring = draft.recurring || null;
      if (draft.recurring === "weekly") {
        patch.recurring_days = normalizeRecurringDays(draft.recurring_days);
        if ((patch.recurring_days as number[]).length === 0) {
          setFieldError("Pick at least one weekday for Weekly repeat");
          return;
        }
      } else if (draft.recurring === "monthly" || draft.recurring === "custom") {
        patch.recurring_days = normalizeRecurringMonthDays(draft.recurring_days);
        if ((patch.recurring_days as number[]).length === 0) {
          setFieldError(
            draft.recurring === "custom"
              ? "Pick at least one date for Custom repeat"
              : "Pick at least one day of the month for Monthly repeat",
          );
          return;
        }
      } else {
        patch.recurring_days = null;
      }
    }
    // Guard: a lead-requiring type must keep its lead link.
    const effType = taskTypes.find(t => t.id === draft.task_type_id);
    if (effType?.requires_lead && !draft.lead_id) {
      setFieldError("This task type requires a linked lead.");
      return;
    }
    const statusDirty = dirty("status");
    const statusToSave = draft.status;
    const hasFieldPatch = Object.keys(patch).length > 0;
    if (!hasFieldPatch && !statusDirty && !labelsDirty) return;
    setEditingTitle(false);

    let keepOpenForMedia = false;
    if (hasFieldPatch) {
      const result = await patchTask(patch);
      if (!result.ok) return;
      if (result.keepOpenForMedia) keepOpenForMedia = true;
    }
    if (statusDirty) {
      setActionLoading(true);
      const ok = await persistStatus(statusToSave);
      if (!ok) {
        setActionLoading(false);
        return;
      }
      // Refresh task so draft/original status align before label sync / close.
      await fetchTask();
      await fetchNotes();
      setActionLoading(false);
    }
    if (labelsDirty) {
      setActionLoading(true);
      setFieldError("");
      const ok = await persistLabelDiff();
      if (!ok) {
        setActionLoading(false);
        return;
      }
      await fetchLabels();
      setActionLoading(false);
    }
    onMutate?.();
    // Auto-close on a successful save — no need to also hit the X. A failed
    // save keeps the modal open with the error so edits aren't lost.
    // Media provision (success popup or soft-fail error) also keeps it open so
    // the Media section updates in place.
    if (!keepOpenForMedia) onClose();
  }

  function attemptClose() {
    if (isDirty) {
      setDiscardConfirmOpen(true);
      return;
    }
    onClose();
  }

  function confirmDiscardAndClose() {
    setDiscardConfirmOpen(false);
    onClose();
  }

  // "Save" from the discard sheet. Closes the sheet first, then runs the same
  // handleSaveAll the header Save button uses — which closes the modal itself on
  // success and, on failure, leaves it open with the error visible. Dropping the
  // sheet up front matters for that failure path: the error renders in the modal
  // behind it, so keeping the sheet open would hide the reason the save failed.
  async function saveFromDiscardPrompt() {
    setDiscardConfirmOpen(false);
    await handleSaveAll();
  }


  // Board/workspace member names — lets the comment renderer highlight
  // multi-word @mentions (e.g. "@Gaurav Kamble") fully, not just the first word.
  const mentionNames = users.map(u => u.name).filter(Boolean);
  const assigneePickerOptions = mergeAssigneePickerOptions(users, task);

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0,0,0,0.5)",
        display: "flex", alignItems: "flex-start", justifyContent: "center",
        padding: isMobile ? "12px 8px" : "40px 20px",
        overflowY: "auto",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) attemptClose(); }}
    >
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--rule)",
          borderRadius: "var(--r-lg)",
          maxWidth: 860,
          width: "100%",
          maxHeight: isMobile ? "94vh" : "90vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          boxShadow: "var(--shadow-md)",
          position: "relative",
        }}
      >
        {/* Sticky header: title + Cancel/Save/X + labels. Stays put while body scrolls. */}
        <div
          style={{
            flexShrink: 0,
            padding: isMobile ? "16px 16px 12px" : "28px 28px 14px",
            borderBottom: "1px solid var(--rule)",
            background: "var(--surface)",
            zIndex: 2,
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", gap: isMobile ? 8 : 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              {!loading && task && draft ? (
                editingTitle && canManage ? (
                  <>
                    <input
                      autoFocus
                      value={draft.title}
                      maxLength={TASK_TITLE_MAX}
                      onChange={e => setField("title", clampToMaxLength(e.target.value, TASK_TITLE_MAX))}
                      onBlur={() => setEditingTitle(false)}
                      onKeyDown={e => {
                        if (e.key === "Enter") { e.preventDefault(); (e.target as HTMLInputElement).blur(); }
                        if (e.key === "Escape") { setEditingTitle(false); }
                      }}
                      style={{
                        width: "100%", padding: "6px 10px", fontSize: isMobile ? 18 : 22, fontWeight: 600,
                        fontFamily: "var(--serif)", color: "var(--ink)",
                        background: "var(--page)",
                        // Red highlight at the cap (wins over the ochre dirty-ring) so
                        // the user knows why the input stopped accepting characters.
                        border: `1px solid ${draft.title.length >= TASK_TITLE_MAX ? "var(--crit)" : "var(--rule-strong)"}`,
                        borderRadius: "var(--r-sm)",
                        boxShadow: draft.title.length >= TASK_TITLE_MAX
                          ? "0 0 0 2px var(--crit-wash)"
                          : (dirty("title") ? "0 0 0 2px var(--ochre)" : "none"),
                      }}
                    />
                    {draft.title.length >= TASK_TITLE_MAX && (
                      <div style={{ marginTop: 4, fontSize: 11, color: "var(--crit)", fontFamily: "var(--sans)" }}>
                        Title limit reached — {TASK_TITLE_MAX} characters max.
                      </div>
                    )}
                  </>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                    {canManage && (
                      <DoneCheck
                        size={28}
                        done={draft.status === "done"}
                        onToggle={() => setField("status", draft.status === "done" ? "planned" : "done")}
                        disabled={actionLoading}
                      />
                    )}
                    <h2
                      style={{
                        fontFamily: "var(--serif)", margin: 0,
                        cursor: canManage ? "text" : "default",
                        borderRadius: "var(--r-sm)",
                        boxShadow: dirty("title") ? "0 0 0 2px var(--ochre)" : "none",
                        padding: dirty("title") ? "2px 6px" : 0,
                        minWidth: 0,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        fontSize: isMobile ? 18 : undefined,
                      }}
                      onClick={() => { if (canManage) setEditingTitle(true); }}
                      title={draft.title}
                    >
                      {draft.title}
                    </h2>
                  </div>
                )
              ) : (
                <div style={{ height: 32 }} aria-hidden />
              )}
            </div>

            {/* Actions: single Save (+ Cancel) for ALL field edits, then Share + Close. */}
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0, paddingTop: 2 }}>
              {!loading && task && canManage && (
                <>
                  {isDirty && (
                    <button onClick={attemptClose} disabled={actionLoading} style={backBtnStyle}>
                      Cancel
                    </button>
                  )}
                  <button
                    onClick={handleSaveAll}
                    disabled={!isDirty || actionLoading}
                    style={{
                      ...primaryBtnStyle,
                      opacity: !isDirty || actionLoading ? 0.5 : 1,
                      cursor: !isDirty || actionLoading ? "default" : "pointer",
                    }}
                  >
                    {actionLoading ? "Saving…" : "Save"}
                  </button>
                </>
              )}
              {/* Share — read-only action, so viewers get it too (no canManage gate). */}
              {!loading && shareContent && (
                <ShareButton
                  content={shareContent}
                  iconOnly
                  buttonLabel="Share task"
                  note="This link opens the task inside OmniPulse. Whoever you send it to still signs in and still needs access to this board."
                />
              )}
              <button
                onClick={attemptClose}
                style={{
                  width: 32, height: 32, borderRadius: "var(--r-sm)",
                  background: "transparent", border: "1px solid var(--rule)",
                  color: "var(--ink-soft)", cursor: "pointer",
                  fontSize: 16, fontFamily: "var(--sans)",
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  padding: 0,
                }}
                aria-label="Close"
              >×</button>
            </div>
          </div>

          {/* Status + priority + labels — part of sticky top block */}
          {!loading && task && draft && (
            <div style={{ marginTop: 10 }}>
              {isSimpleTask ? (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                  <span
                    className="tag"
                    style={{
                      minWidth: 88, textAlign: "center",
                      ...(draft.status === task.status && task.status_color
                        ? { background: hexWithAlpha(task.status_color, 0.18), color: task.status_color }
                        : statusColor(draft.status)),
                    }}
                  >
                    {draft.status === task.status && task.status_label
                      ? task.status_label
                      : (STATUS_OPTIONS.find((o) => o.value === draft.status)?.label
                        || draft.status.replace(/_/g, " "))}
                  </span>
                  <span
                    className="tag"
                    style={{ background: "var(--green-wash)", color: "var(--green-deep)", minWidth: 0 }}
                  >
                    {task.task_type_name || "Simple task"}
                  </span>
                </div>
              ) : (
              <LabelPicker
                leading={(
                  <>
                    <span
                      className="tag"
                      style={{
                        minWidth: 88, textAlign: "center",
                        ...(draft.status === task.status && task.status_color
                          ? { background: hexWithAlpha(task.status_color, 0.18), color: task.status_color }
                          : statusColor(draft.status)),
                      }}
                    >
                      {draft.status === task.status && task.status_label
                        ? task.status_label
                        : (STATUS_OPTIONS.find((o) => o.value === draft.status)?.label
                          || draft.status.replace(/_/g, " "))}
                    </span>
                    <PriorityIndicator priority={draft.priority} />
                  </>
                )}
                assigned={assignedLabels}
                available={availableLabels}
                canManage={canManage}
                onAdd={(lb) => addLabel(lb)}
                onRemove={(id) => removeLabel(id)}
                onCreate={async ({ label, color }) => {
                  if (!labelBoardId) return null; // no owning project → can't create
                  const res = await fetch("/api/omnimart/task-labels", {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ label, color, board_id: labelBoardId }),
                  });
                  if (!res.ok) return null;
                  const data = await res.json();
                  // Optimistically merge the new label into the available master so
                  // the picker doesn't need a full refetch before showing it.
                  setAvailableLabels((prev) => [...prev, data.item]);
                  return data.item;
                }}
                onUpdate={async (id, { label, color }) => {
                  const res = await fetch(`/api/omnimart/task-labels/${id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ label, color }),
                  });
                  if (!res.ok) return null;
                  const data = await res.json();
                  const item = data.item as { id: string; slug: string; label: string; color: string; sort_order?: number };
                  setAvailableLabels((prev) => prev.map((l) => (l.id === id ? { ...l, ...item } : l)));
                  setAssignedLabels((prev) => prev.map((l) => (l.id === id ? { ...l, ...item } : l)));
                  // Keep saved metadata in sync so a rename/recolor alone is not dirty.
                  setSavedLabels((prev) => prev.map((l) => (l.id === id ? { ...l, ...item } : l)));
                  // Board card colour bars use task.labels — refresh so recolor shows live.
                  onMutate?.();
                  return item;
                }}
                onDelete={async (id) => {
                  const res = await fetch(`/api/omnimart/task-labels/${id}`, { method: "DELETE" });
                  if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    console.error("[task-modal] label delete failed:", res.status, data);
                    return false;
                  }
                  setAvailableLabels((prev) => prev.filter((l) => l.id !== id));
                  setAssignedLabels((prev) => prev.filter((l) => l.id !== id));
                  setSavedLabels((prev) => prev.filter((l) => l.id !== id));
                  onMutate?.();
                  return true;
                }}
              />
              )}
            </div>
          )}
        </div>

        {/* Scrollable body — description, comments, subtasks, details, etc. */}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            padding: isMobile ? "16px 16px 16px" : "18px 28px 28px",
          }}
        >
        {loading || !task || !draft ? (
          <div style={{ padding: "40px 0", textAlign: "center", color: "var(--ink-mute)" }}>Loading...</div>
        ) : (
          <>
            {fieldError && <div className="form-error" style={{ marginBottom: 16 }}>{fieldError}</div>}

            {/* Two-column body */}
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "minmax(0, 1.5fr) minmax(0, 1fr)", gap: isMobile ? 18 : 24, alignItems: "flex-start" }}>
              {/* LEFT COLUMN */}
              <div ref={leftColRef} style={{ display: "flex", flexDirection: "column", gap: 20, minWidth: 0 }}>
                {/* Description — open by default */}
                <AccordionSection title={<>Description{dirty("description") && <EditedDot />}</>}>
                  <RichTextEditor
                    content={draft.description}
                    onChange={v => setField("description", v)}
                    readOnly={!canManage}
                    dirty={dirty("description")}
                    placeholder="Write a detailed description..."
                  />
                </AccordionSection>

                {/* Task Details — expanded by default */}
                <AccordionSection title="Task Details" defaultOpen={true}>
                  <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: "16px 24px" }}>
                    <DI label="STATUS">
                      {canManage ? (
                        <CustomSelect
                          value={draft.status}
                          onChange={(v) => { if (v !== draft.status) setField("status", v); }}
                          options={STATUS_OPTIONS}
                          disabled={actionLoading}
                        />
                      ) : (
                        <span
                          className="tag"
                          style={{
                            minWidth: 88, textAlign: "center",
                            ...(draft.status === task.status && task.status_color
                              ? { background: hexWithAlpha(task.status_color, 0.18), color: task.status_color }
                              : statusColor(draft.status)),
                          }}
                        >
                          {draft.status === task.status && task.status_label
                            ? task.status_label
                            : (STATUS_OPTIONS.find((o) => o.value === draft.status)?.label
                              || draft.status.replace(/_/g, " "))}
                        </span>
                      )}
                    </DI>

                    {!isSimpleTask && (
                    <DI label="PRIORITY" dirty={dirty("priority")}>
                      {canManage ? (
                        <EditField dirty={dirty("priority")}>
                          <CustomSelect
                            value={draft.priority}
                            onChange={v => setField("priority", v)}
                            options={PRIORITY_SELECT_OPTIONS}
                          />
                        </EditField>
                      ) : (
                        <PriorityIndicator priority={task.priority} />
                      )}
                    </DI>
                    )}

                    <DI label="TASK TYPE" dirty={!isSimpleTask && dirty("task_type_id")}>
                      {canManage && !isSimpleTask ? (
                        <EditField dirty={dirty("task_type_id")}>
                          <CustomSelect
                            value={draft.task_type_id}
                            onChange={v => setField("task_type_id", v)}
                            placeholder="General"
                            options={taskTypes.map(t => ({ value: t.id, label: t.name_en }))}
                          />
                        </EditField>
                      ) : (
                        <span>{task.task_type_name || taskTypes.find(t => t.id === task.task_type_id)?.name_en || "Simple task"}</span>
                      )}
                    </DI>

                    {!isSimpleTask && taskTypes.find(t => t.id === draft.task_type_id)?.requires_lead && (
                      <DI label="LEAD" dirty={dirty("lead_id")}>
                        {canManage ? (
                          <EditField dirty={dirty("lead_id")}>
                            <LeadPicker
                              value={draft.lead_id || null}
                              onChange={(id) => setField("lead_id", id || "")}
                              initialLabel={task.lead_id ? (task.lead_no ? `${task.lead_no} — ${task.lead_title || task.title}` : (task.lead_title || null)) : null}
                              placeholder="Search a lead..."
                            />
                          </EditField>
                        ) : (
                          task.lead_id
                            ? <a href={`/omnimart/pipeline/${task.lead_id}`} style={{ color: "var(--green-deep)", textDecoration: "underline", textUnderlineOffset: 3 }}>{task.lead_no || "Linked lead"}</a>
                            : <span>---</span>
                        )}
                      </DI>
                    )}

                    <DI label="ACHARYA" dirty={dirty("acharya_id")}>
                      {canManage ? (
                        <EditField dirty={dirty("acharya_id")}>
                          <AcharyaPicker
                            value={draft.acharya_id}
                            onChange={(v) => setField("acharya_id", v)}
                            label=""
                          />
                          {task.resolved_acharya_name && draft.acharya_id === null && (
                            <div style={{ fontSize: 11, color: "var(--ink-mute)", marginTop: 4 }}>
                              Currently: {task.resolved_acharya_name}
                              {task.resolved_acharya_source ? ` (from ${formatAcharyaSource(task.resolved_acharya_source)})` : ""}
                            </div>
                          )}
                        </EditField>
                      ) : (
                        <ReadOnlyField value={
                          task.resolved_acharya_name
                            ? `${task.resolved_acharya_name}${task.resolved_acharya_source && task.resolved_acharya_source !== "task" ? ` (from ${formatAcharyaSource(task.resolved_acharya_source)})` : ""}`
                            : "---"
                        } />
                      )}
                    </DI>

                    {!isSimpleTask && (
                    <DI label="MISSION" dirty={dirty("mission_id")}>
                      {canManage ? (
                        <EditField dirty={dirty("mission_id")}>
                          <CustomSelect
                            value={draft.mission_id}
                            onChange={v => setField("mission_id", v)}
                            placeholder="Project default"
                            options={[{ value: "", label: "Project default" }, ...missions.map(m => ({ value: m.id, label: m.name_en }))]}
                          />
                        </EditField>
                      ) : (
                        <span>{missions.find(m => m.id === task.mission_id)?.name_en || "---"}</span>
                      )}
                    </DI>
                    )}

                    {!isSimpleTask && (
                    <DI label="MISSION IMPACT" dirty={dirty("mission_impact")}>
                      {canManage ? (
                        <EditField dirty={dirty("mission_impact")}>
                          <input
                            value={draft.mission_impact}
                            onChange={e => setField("mission_impact", e.target.value)}
                            placeholder="How does this task impact mission targets?"
                            style={textInputStyle}
                          />
                        </EditField>
                      ) : (
                        <span>{task.mission_impact || "---"}</span>
                      )}
                    </DI>
                    )}

                  </div>
                </AccordionSection>

                {/* Man Power Details — expanded by default */}
                <AccordionSection title="Man Power Details" defaultOpen={true}>
                  <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: "16px 24px" }}>
                    <DI label="ASSIGNED TO" dirty={dirty("assignee_ids")}>
                      {canManage ? (
                        <EditField dirty={dirty("assignee_ids")}>
                          <MemberMultiSelect
                            value={draft.assignee_ids}
                            onChange={v => setField("assignee_ids", v)}
                            placeholder="Unassigned"
                            options={assigneePickerOptions}
                          />
                        </EditField>
                      ) : (
                        <span>{(task.assignees && task.assignees.length > 0 ? task.assignees.map(a => a.name).join(", ") : task.assigned_to_name) || "---"}</span>
                      )}
                    </DI>

                    <DI label="ASSIGN DATE" dirty={dirty("assigned_on")}>
                      {canManage ? (
                        <EditField dirty={dirty("assigned_on")}>
                          <DatePicker
                            value={draft.assigned_on}
                            onChange={(v) => setField("assigned_on", v)}
                            placeholder="dd-mm-yyyy"
                          />
                        </EditField>
                      ) : (
                        <span>{fmtDate(task.assigned_on)}</span>
                      )}
                    </DI>

                    <DI label="ASSIGNED BY"><ReadOnlyField value={task.assigned_by_name || "---"} /></DI>

                    <DI
                      label="DEADLINE DATE"
                      dirty={dirty("due_date") || (!isSimpleTask && (dirty("recurring") || dirty("recurring_days")))}
                    >
                      {canManage ? (
                        <EditField
                          dirty={dirty("due_date") || (!isSimpleTask && (dirty("recurring") || dirty("recurring_days")))}
                        >
                          <DatePicker
                            value={draft.due_date}
                            onChange={(v) => setField("due_date", v)}
                            placeholder="dd-mm-yyyy"
                            recurring={isSimpleTask ? undefined : {
                              value: draft.recurring,
                              days: draft.recurring_days,
                              weekdayStarts: draft.recurring_weekday_starts,
                              includeLegacyValue: draft.recurring,
                              onChange: (recurring, recurring_days, weekdayStarts) => {
                                setDraft((d) =>
                                  d
                                    ? {
                                        ...d,
                                        recurring,
                                        recurring_days: Array.isArray(recurring_days)
                                          ? recurring_days
                                          : [],
                                        recurring_weekday_starts: weekdayStarts || {},
                                      }
                                    : d,
                                );
                              },
                            }}
                          />
                        </EditField>
                      ) : (
                        <span>
                          {fmtDate(task.due_date)}
                          {!isSimpleTask && task.recurring
                            ? ` · ${recurringDisplayLabel(task.recurring, task.recurring_days)}`
                            : ""}
                        </span>
                      )}
                    </DI>

                    <DI label="CREATED"><ReadOnlyField value={fmtDate(task.created_on)} /></DI>

                    {!isSimpleTask && (
                    <DI
                      label="SESSIONS (45 MIN EACH)"
                      dirty={dirty("session_count") || dirty("session_count_auto")}
                      info="Assign each subtask to a session in Subtasks below."
                    >
                      {canManage ? (
                        <EditField dirty={dirty("session_count")}>
                          <input
                            type="number"
                            min={1}
                            max={8}
                            value={draft.session_count}
                            onChange={(e) => {
                              setField("session_count", e.target.value);
                              if (draft.session_count_auto) setField("session_count_auto", false);
                            }}
                            style={dateInputStyle}
                          />
                        </EditField>
                      ) : (
                        <ReadOnlyField value={fmtSessionSummary(Number(draft.session_count) || task.session_count || 1)} />
                      )}
                    </DI>
                    )}

                    {!isSimpleTask && (
                    <DI
                      label={<ExtraBreaksLabel />}
                      dirty={dirty("break_allowance_total")}
                      info="Voluntary breaks shared across all sessions. The break between sessions is automatic and doesn’t count."
                      infoAtEnd
                    >
                      {canManage ? (
                        <EditField dirty={dirty("break_allowance_total")}>
                          <input
                            type="number"
                            min={0}
                            max={20}
                            value={draft.break_allowance_total}
                            onChange={e => setField("break_allowance_total", e.target.value)}
                            style={dateInputStyle}
                          />
                        </EditField>
                      ) : (
                        <ReadOnlyField value={String(task.break_allowance_total ?? 1)} />
                      )}
                    </DI>
                    )}

                    {task.completed_at && <DI label="COMPLETED"><ReadOnlyField value={fmtDate(task.completed_at)} /></DI>}
                  </div>
                </AccordionSection>

                {/* Subtasks — after Man Power (sessions), before Files */}
                {!isSimpleTask && (
                <AccordionSection
                  title={
                    <>
                      Subtasks
                      {checklistProgress.total > 0 && (
                        <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-mute)", marginLeft: 6 }}>
                          ({checklistProgress.checked}/{checklistProgress.total})
                        </span>
                      )}
                    </>
                  }
                  actions={canManage ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                      {(Number(draft.session_count) || 0) >= 1 && (
                        <button
                          type="button"
                          onClick={() => setSubtaskAddOpen(true)}
                          style={addSubtaskTriggerStyle}
                        >
                          + Add subtask
                        </button>
                      )}
                      <SubtaskTemplateMenu
                        boardId={boardId || labelBoardId}
                        canEdit={canManage}
                        taskId={taskId}
                        hasSubtasks={checklistProgress.total > 0}
                        taskSessionCount={Number(draft.session_count) || 1}
                        onTaskChecklistMutated={() => setChecklistRefreshToken((n) => n + 1)}
                      />
                    </div>
                  ) : undefined}
                >
                  {(Number(draft.session_count) || 0) < 1 ? (
                    <div style={{ fontSize: 13, color: "var(--ink-mute)", padding: "4px 0" }}>
                      Set Sessions above to add subtasks.
                    </div>
                  ) : (
                    <TaskChecklist
                      taskId={taskId}
                      canEdit={canManage}
                      canManage={canManage}
                      taskSessionCount={Number(draft.session_count) || 1}
                      refreshToken={checklistRefreshToken}
                      onProgressChange={handleChecklistProgress}
                      hideAddTrigger
                      addOpen={subtaskAddOpen}
                      onAddOpenChange={setSubtaskAddOpen}
                    />
                  )}
                </AccordionSection>
                )}

                {/* Divider between Subtasks and Files */}
                {!isSimpleTask && (
                  <div
                    role="separator"
                    aria-hidden
                    style={{
                      height: 1,
                      background: "var(--rule)",
                      margin: "4px 0",
                      flexShrink: 0,
                    }}
                  />
                )}

                {/* Files — open by default */}
                <AccordionSection
                  title={<>Files <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-mute)", marginLeft: 4 }}>({fileNotes.length})</span></>}
                  actions={
                    canManage && (
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <input
                          ref={fileInputRef}
                          type="file"
                          multiple
                          style={{ display: "none" }}
                          onChange={e => handleFileUpload(e.target.files)}
                        />
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploading}
                          style={addBtnSmStyle}
                        >
                          {uploading ? "Uploading..." : "+ Add File"}
                        </button>
                      </div>
                    )
                  }
                >
                  {noteError && <div style={{ color: "var(--crit)", fontSize: 12, marginBottom: 10 }}>{noteError}</div>}
                  {fileNotes.length === 0 ? (
                    <div style={{ fontSize: 13, color: "var(--ink-mute)", padding: "4px 0" }}>No files attached yet</div>
                  ) : (
                    <TaskFilesList
                      fileNotes={fileNotes}
                      fileDeletingId={fileDeletingId}
                      canManage={canManage}
                      onRemove={removeFile}
                    />
                  )}
                </AccordionSection>
              </div>

              {/* RIGHT COLUMN — Comments & Notes. The header is always pinned;
                 the scroll area's maxHeight is set live by a ResizeObserver on
                 the left column so it tracks exactly as accordions expand/collapse. */}
              <div style={{ display: "flex", flexDirection: "column" }}>
                {/* Pinned header */}
                <div style={{
                  display: "flex", alignItems: "center",
                  justifyContent: "space-between", gap: 8,
                  marginBottom: commentsOpen ? 12 : 0,
                  transition: "margin-bottom 0.22s ease",
                  flexShrink: 0,
                }}>
                  <button
                    type="button"
                    aria-expanded={commentsOpen}
                    onClick={() => setCommentsOpen(o => !o)}
                    style={{
                      display: "flex", alignItems: "center", gap: 6,
                      background: "none", border: "none", padding: 0,
                      cursor: "pointer", color: "inherit", fontFamily: "inherit",
                      textAlign: "left",
                    }}
                  >
                    <span style={{ fontFamily: "var(--serif)", fontSize: 14, color: "var(--ink)", fontWeight: 400 }}>
                      Comments &amp; Notes
                    </span>
                    <ChevronIcon open={commentsOpen} />
                  </button>
                  {/* Anyone who can VIEW the task (assignees included) can comment —
                      commenting doesn't require manage access. The API gates on
                      canViewTask; own comments stay author-editable within the window. */}
                  {!showAddComment && (
                    <button type="button" onClick={() => setShowAddComment(true)} style={addBtnSmStyle}>
                      + Add Comment
                    </button>
                  )}
                </div>

                {/* Animated content wrapper */}
                <div style={{
                  display: "grid",
                  gridTemplateRows: commentsOpen ? "1fr" : "0fr",
                  transition: "grid-template-rows 0.22s ease",
                }}>
                  <div style={{ overflow: "hidden" }}>
                    {/* Scroll area — maxHeight synced to left column height via ResizeObserver */}
                    <div
                      ref={rightScrollRef}
                      style={{ overflowY: "auto", paddingRight: 4, paddingBottom: 2 }}
                    >
                      {showAddComment && (
                        <CommentComposer
                          value={commentContent}
                          onChange={setCommentContent}
                          attachments={commentAttachments}
                          onAttachmentsChange={setCommentAttachments}
                          insertMarkdownRefs={false}
                          stageDocuments
                          onSubmit={addComment}
                          onCancel={() => {
                            setShowAddComment(false);
                            setCommentContent(COMMENT_EMPTY_DOC);
                            setCommentAttachments([]);
                            setCommentMentions([]);
                            setNoteError("");
                          }}
                          posting={savingComment}
                          error={noteError}
                          autoFocus
                          fetchMentions={boardId ? fetchBoardMentions : undefined}
                        />
                      )}

                      {notes.filter(n => n.note_type !== "file").length === 0 && !showAddComment ? (
                        <div style={{ fontSize: 13, color: "var(--ink-mute)", padding: "4px 0" }}>No comments yet</div>
                      ) : (
                        <div style={{ display: "grid", gap: 10 }}>
                          {notes.filter(n => n.note_type !== "file").map(note => {
                            const isUserComment = note.note_type === "note";
                            const isEditing = editingNoteId === note.id;
                            const previewUrls = isUserComment && !isEditing ? extractUrls(note.content) : [];
                            const showEdit = isUserComment && canEditComment(note);
                            const showDelete = isUserComment && canDeleteComment(note);
                            return (
                              <div key={note.id} style={{
                                borderWidth: 1, borderStyle: "solid", borderColor: "var(--rule)",
                                borderRadius: "var(--r-sm)",
                                padding: "12px 14px", background: "var(--page)",
                                overflowX: "hidden",
                                minWidth: 0,
                              }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                                  {!isUserComment && (
                                    <span className="tag" style={noteTypeStyle(note.note_type)}>{note.note_type.replace(/_/g, " ")}</span>
                                  )}
                                  <span style={{ fontSize: 12, fontWeight: 600 }}>{note.author_name}</span>
                                  <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-mute)" }}>{fmtDateTime(note.created_on)}</span>
                                  {note.edited_at && (
                                    <span
                                      title={`Edited ${fmtDateTime(note.edited_at)}`}
                                      style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-mute)", fontStyle: "italic" }}
                                    >
                                      (edited)
                                    </span>
                                  )}
                                  {!isEditing && (showEdit || showDelete) && (
                                    <span style={{ marginLeft: "auto", display: "inline-flex" }}>
                                      <CommentActionsMenu
                                        showEdit={showEdit}
                                        showDelete={showDelete}
                                        onEdit={() => startEditComment(note)}
                                        onDelete={() => setDeleteNoteId(note.id)}
                                      />
                                    </span>
                                  )}
                                </div>
                                {isEditing ? (
                                  <CommentComposer
                                    value={editContent}
                                    onChange={setEditContent}
                                    attachments={editAttachments}
                                    onAttachmentsChange={setEditAttachments}
                                    insertMarkdownRefs={false}
                                    stageDocuments
                                    onSubmit={() => saveEditComment(note.id)}
                                    onCancel={cancelEditComment}
                                    posting={savingEdit}
                                    error={editError}
                                    autoFocus
                                    submitLabel="Save"
                                    fetchMentions={boardId ? fetchBoardMentions : undefined}
                                  />
                                ) : isUserComment ? (
                                  <div style={commentBodyStyle}>
                                    {/* One box: image(s) first, then text — no nested editor cards. */}
                                    {note.attachments?.length > 0 ? (
                                      <CommentAttachments attachments={note.attachments} />
                                    ) : null}
                                    {isTiptapDoc(note.content) ? (
                                      !isRichTextEmpty(note.content) ? (
                                        <RichTextEditor
                                          content={note.content}
                                          onChange={() => {}}
                                          readOnly
                                          plain
                                        />
                                      ) : null
                                    ) : (() => {
                                      const md = stripAttachedImagesFromMarkdown(
                                        note.content || "",
                                        note.attachments || [],
                                      );
                                      return md ? (
                                        <Markdown source={md} mentionNames={mentionNames} />
                                      ) : null;
                                    })()}
                                  </div>
                                ) : (
                                  <div style={{ fontSize: 13, lineHeight: 1.5, whiteSpace: "pre-wrap", color: "var(--ink)" }}>{note.content}</div>
                                )}
                                {previewUrls.map((u) => <LinkPreview key={u} url={u} />)}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </>
        )}
        </div>
      </div>

      <ConfirmDialog
        open={discardConfirmOpen}
        title="Discard unsaved changes?"
        description="You have unsaved edits on this task. Save them, keep editing, or close without saving?"
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        confirmTone="danger"
        altAction={{ label: "Save", onClick: saveFromDiscardPrompt }}
        onCancel={() => setDiscardConfirmOpen(false)}
        onConfirm={confirmDiscardAndClose}
      />

      <ConfirmDialog
        open={deleteNoteId !== null}
        title="Delete this comment?"
        description="This comment and any files uploaded with it will be removed. This can't be undone."
        confirmLabel={deletingNote ? "Deleting…" : "Delete"}
        cancelLabel="Cancel"
        confirmTone="danger"
        busy={deletingNote}
        onCancel={() => { if (!deletingNote) setDeleteNoteId(null); }}
        onConfirm={confirmDeleteComment}
      />

      <ConfirmDialog
        open={mediaProvisionPopup !== null}
        title="Media workspace ready"
        description={
          mediaProvisionPopup && mediaProvisionPopup.added.length > 0
            ? `OmniStudio chat linked under this board's Studio project. Also added: ${mediaProvisionPopup.added.join(", ")}.`
            : "OmniStudio chat linked under this board's Studio project."
        }
        confirmLabel="OK"
        cancelLabel="Close"
        onCancel={() => setMediaProvisionPopup(null)}
        onConfirm={() => setMediaProvisionPopup(null)}
      />

    </div>
  );
}

// ─── Subcomponents ───────────────────────────────────────────────────────────

function SectionTitle({ children, inline }: { children: React.ReactNode; inline?: boolean }) {
  return (
    <h3 style={{
      fontFamily: "var(--serif)", fontSize: 14, margin: 0,
      marginBottom: inline ? 0 : 10, color: "var(--ink)",
    }}>{children}</h3>
  );
}

// ─── Accordion ────────────────────────────────────────────────────────────────
function AccordionSection({
  title,
  children,
  defaultOpen = true,
  actions,
}: {
  title: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  actions?: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();
  const headerId = panelId + "h";

  return (
    <section>
      <div style={{
        display: "flex", alignItems: "center",
        justifyContent: "space-between", gap: 8,
        marginBottom: open ? 12 : 0,
        transition: "margin-bottom 0.22s ease",
        flexShrink: 0,
      }}>
        <button
          type="button"
          id={headerId}
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen(o => !o)}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            background: "none", border: "none", padding: 0,
            cursor: "pointer", color: "inherit", fontFamily: "inherit",
            textAlign: "left",
          }}
        >
          <span style={{ fontFamily: "var(--serif)", fontSize: 18, color: "var(--ink)", fontWeight: 600 }}>
            {title}
          </span>
          <ChevronIcon open={open} />
        </button>
        {actions != null && <div style={{ flexShrink: 0 }}>{actions}</div>}
      </div>

      <div
        id={panelId}
        role="region"
        aria-labelledby={headerId}
        style={{
          display: "grid",
          gridTemplateRows: open ? "1fr" : "0fr",
          transition: "grid-template-rows 0.22s ease",
        }}
      >
        <div style={{ overflow: "hidden", paddingBottom: 2 }}>
          {children}
        </div>
      </div>
    </section>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width={14} height={14} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true"
      style={{
        flexShrink: 0,
        color: "var(--ink-mute)",
        transform: open ? "rotate(0deg)" : "rotate(-90deg)",
        transition: "transform 0.22s ease",
      }}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function ExtraBreaksLabel() {
  const wordGap: CSSProperties = { width: 3, flexShrink: 0 };
  const dot: CSSProperties = { margin: "0 2px", letterSpacing: 0 };
  return (
    <span style={{ display: "inline-flex", alignItems: "baseline", whiteSpace: "nowrap", letterSpacing: 0 }}>
      <span>EXTRA</span>
      <span style={wordGap} />
      <span>BREAKS</span>
      <span style={dot} aria-hidden>·</span>
      <span>WHOLE</span>
      <span style={wordGap} />
      <span>TASK</span>
      <span style={dot} aria-hidden>·</span>
      <span>default:</span>
      <span>1</span>
    </span>
  );
}

function DI({
  label,
  dirty,
  children,
  info,
  infoAtEnd,
}: {
  label: React.ReactNode;
  dirty?: boolean;
  children: React.ReactNode;
  info?: string;
  infoAtEnd?: boolean;
}) {
  return (
    <div style={{ minWidth: 0 }}>
      <div
        style={{
          fontFamily: "var(--mono)",
          fontSize: 10,
          letterSpacing: infoAtEnd ? 0 : "0.1em",
          textTransform: "uppercase",
          color: dirty ? "var(--ochre)" : "var(--ink-mute)",
          marginBottom: 6,
          display: "flex",
          alignItems: "center",
          gap: 6,
          justifyContent: "flex-start",
          flexWrap: "nowrap",
          whiteSpace: "nowrap",
        }}
      >
        {label}
        {dirty ? <EditedDot /> : null}
        {info ? <FieldInfoTip text={info} /> : null}
      </div>
      <div style={{ fontSize: 13, color: "var(--ink)", minWidth: 0 }}>{children}</div>
    </div>
  );
}

// Small amber dot marking a field whose value differs from what's saved.
function EditedDot() {
  return <span title="Unsaved change" style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--ochre)", display: "inline-block", flexShrink: 0 }} />;
}

// Wraps an editable control with an amber ring when its value is dirty.
function EditField({ children }: { dirty?: boolean; children: React.ReactNode }) {
  // Dirty is shown on the field label (DI turns ochre + dot). The old 2px ring
  // sat OUTSIDE the input's own 1px border and read as a doubled/offset border,
  // so it's removed — the input keeps its single clean border.
  return <div style={{ minWidth: 0 }}>{children}</div>;
}

// Read-only field that visually matches the input/CustomSelect boxes used for
// editable fields. Use this for non-editable values like Assigned By / Created /
// Completed / Recurring so the Details grid stays visually uniform.
function ReadOnlyField({ value }: { value: React.ReactNode }) {
  return (
    <div style={readOnlyFieldStyle}>{value}</div>
  );
}

function FieldInfoTip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    function place() {
      const r = btnRef.current!.getBoundingClientRect();
      const popW = popRef.current?.offsetWidth || 220;
      const popH = popRef.current?.offsetHeight || 72;
      let left = r.right + 8;
      let top = r.top + r.height / 2 - popH / 2;
      if (left + popW > window.innerWidth - 8) left = Math.max(8, r.left - popW - 8);
      if (top < 8) top = 8;
      if (top + popH > window.innerHeight - 8) top = Math.max(8, window.innerHeight - popH - 8);
      setPos({ top, left });
    }
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open, text]);
  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || popRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return (
    <>
      <button
        ref={btnRef}
        type="button"
        aria-label="Field info"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        style={{ ...fieldInfoIconStyle, cursor: "pointer", background: "transparent", padding: 0 }}
      >
        i
      </button>
      {open && typeof document !== "undefined"
        ? createPortal(
            <span ref={popRef} role="tooltip" style={{ ...fieldInfoPopoverStyle, top: pos.top, left: pos.left }}>
              {text}
            </span>,
            document.body,
          )
        : null}
    </>
  );
}

// ─── Helpers (mirrored from former /tasks/[id]/page.tsx) ─────────────────────

function noteTypeStyle(type: string): { background: string; color: string } {
  if (type === "file") return { background: "var(--ochre-wash)", color: "var(--ochre)" };
  if (type === "file_delete") return { background: "var(--crit-wash, var(--surface-sunk))", color: "var(--crit)" };
  if (type === "reassign") return { background: "var(--amber-wash)", color: "var(--amber)" };
  if (type === "status_change") return { background: "var(--ok-wash)", color: "var(--ok)" };
  if (type === "session_start") return { background: "var(--green-wash)", color: "var(--green-deep)" };
  if (type === "session_complete") return { background: "var(--ok-wash)", color: "var(--ok)" };
  if (type === "break") return { background: "var(--ochre-wash)", color: "var(--ochre)" };
  if (type === "subtask_complete") return { background: "var(--amber-wash)", color: "var(--amber)" };
  if (type === "system") return { background: "var(--surface-sunk)", color: "var(--ink-soft)" };
  return { background: "var(--green-wash)", color: "var(--green-deep)" };
}

function docTypeLabel(slug?: string) {
  if (!slug) return "Others";
  return slug.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

function docTagStyle(docType?: string): { background: string; color: string } {
  switch (docType) {
    case "site_visit": return { background: "var(--green-wash)", color: "var(--green-deep)" };
    case "invoice":    return { background: "var(--ochre-wash)", color: "var(--ochre)" };
    case "proposal":   return { background: "var(--terra-wash)", color: "var(--terracotta)" };
    case "quotation":  return { background: "var(--amber-wash)", color: "var(--amber)" };
    case "agreement":  return { background: "var(--green-wash)", color: "var(--green-deep)" };
    case "photo":      return { background: "var(--surface-sunk)", color: "var(--ink-soft)" };
    case "report":     return { background: "var(--ok-wash)", color: "var(--ok)" };
    default:           return { background: "var(--surface-sunk)", color: "var(--ink-mute)" };
  }
}

function viewUrl(blobUrl: string) {
  return `/api/uploads/view?url=${encodeURIComponent(blobUrl)}`;
}

function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileIcon(type: string) {
  if (type.startsWith("image/")) return "IMG";
  if (type === "application/pdf") return "PDF";
  if (type.includes("spreadsheet") || type.includes("excel") || type === "text/csv") return "XLS";
  if (type.includes("word") || type.includes("document")) return "DOC";
  return "FILE";
}

function fileNameFromNoteContent(content: string): string | null {
  const m = content.match(/^\[[^\]]+\]\s*(.+)$/);
  return m?.[1]?.trim() || null;
}

function fileNameFromUrl(url: string): string | null {
  if (!url) return null;
  try {
    const last = new URL(url).pathname.split("/").pop();
    return last ? last.replace(/^\d+-/, "") : null;
  } catch {
    const last = url.split("/").pop();
    return last ? last.replace(/^\d+-/, "") : null;
  }
}

function normalizeAttachment(att: unknown, content?: string): Attachment {
  const a = (att && typeof att === "object" ? att : {}) as Record<string, unknown>;
  const url = typeof a.url === "string" ? a.url : "";
  const name =
    (typeof a.name === "string" && a.name.trim()) ||
    (typeof a.filename === "string" && a.filename.trim()) ||
    (content ? fileNameFromNoteContent(content) : null) ||
    fileNameFromUrl(url) ||
    "Untitled file";
  const type =
    (typeof a.type === "string" && a.type) ||
    (typeof a.mime_type === "string" && a.mime_type) ||
    "";
  const size = typeof a.size === "number" ? a.size : Number(a.size) || 0;
  return {
    url,
    name,
    size,
    type,
    docType: typeof a.docType === "string" ? a.docType : undefined,
  };
}

function fmtAddedAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return `Added ${fmtDate(iso)}`;
  const sec = Math.floor(ms / 1000);
  if (sec < 45) return "Added just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `Added ${min} minute${min === 1 ? "" : "s"} ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `Added ${hr} hour${hr === 1 ? "" : "s"} ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `Added ${day} day${day === 1 ? "" : "s"} ago`;
  return `Added ${fmtDate(iso)}`;
}

function fileTypeLabel(att: Attachment): string {
  if (att.type?.startsWith("image/")) {
    const sub = att.type.slice(6).toUpperCase();
    if (sub === "JPEG") return "JPG";
    return sub || "IMG";
  }
  const fromName = (att.name || "").split(".").pop()?.toUpperCase();
  if (fromName && fromName !== att.name.toUpperCase()) return fromName.slice(0, 5);
  return fileIcon(att.type || "");
}

async function downloadAttachment(fn: FileNote) {
  const res = await fetch(viewUrl(fn.att.url));
  if (!res.ok) throw new Error("Download failed");
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = fn.att.name || "download";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objectUrl);
}

function FileActionsMenu({
  canDelete,
  deleting,
  onView,
  onDownload,
  onDelete,
}: {
  canDelete: boolean;
  deleting?: boolean;
  onView: () => void;
  onDownload: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);

  const place = useCallback(() => {
    const b = btnRef.current;
    if (!b) return;
    const r = b.getBoundingClientRect();
    setPos({ top: r.bottom + 4, right: Math.max(8, window.innerWidth - r.right) });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  function choose(action: () => void) {
    setOpen(false);
    action();
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        aria-label="File actions"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        style={kebabBtnStyle}
      >
        &#8942;
      </button>
      {open && pos && createPortal(
        <div
          ref={menuRef}
          role="menu"
          style={{ ...commentMenuPopoverStyle, top: pos.top, right: pos.right }}
        >
          <button type="button" role="menuitem" style={commentMenuRowStyle} onClick={() => choose(onView)}>
            View
          </button>
          <button type="button" role="menuitem" style={commentMenuRowStyle} onClick={() => choose(onDownload)}>
            Download
          </button>
          {canDelete && (
            <button
              type="button"
              role="menuitem"
              style={{ ...commentMenuRowStyle, color: "var(--crit)" }}
              onClick={() => choose(onDelete)}
              disabled={deleting}
            >
              {deleting ? "Deleting…" : "Delete"}
            </button>
          )}
        </div>,
        document.body,
      )}
    </>
  );
}

function TaskFilesList({
  fileNotes,
  fileDeletingId,
  canManage,
  onRemove,
}: {
  fileNotes: FileNote[];
  fileDeletingId: string | null;
  canManage: boolean;
  onRemove: (noteId: string, url: string) => void | Promise<void>;
}) {
  const [previewIdx, setPreviewIdx] = useState<number | null>(null);
  const [pendingDelete, setPendingDelete] = useState<FileNote | null>(null);
  const [downloadError, setDownloadError] = useState("");

  const imageFiles = fileNotes.filter((fn) => isFileImage(fn.att));
  const lightboxImages: LightboxImage[] = imageFiles.map((fn) => ({
    src: blobViewUrl(fn.att.url),
    alt: fn.att.name || "attachment",
  }));

  function openFile(fn: FileNote) {
    if (isFileImage(fn.att)) {
      const idx = imageFiles.findIndex((f) => f.att.url === fn.att.url);
      setPreviewIdx(idx >= 0 ? idx : 0);
      return;
    }
    window.open(viewUrl(fn.att.url), "_blank", "noopener,noreferrer");
  }

  async function handleDownload(fn: FileNote) {
    setDownloadError("");
    try {
      await downloadAttachment(fn);
    } catch (err: unknown) {
      setDownloadError(err instanceof Error ? err.message : "Download failed");
    }
  }

  return (
    <div style={{ width: "100%", minWidth: 0 }}>
      {downloadError ? (
        <div style={{ color: "var(--crit)", fontSize: 12, marginBottom: 8 }}>{downloadError}</div>
      ) : null}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {fileNotes.map((fn) => {
          const image = isFileImage(fn.att);
          const typeLabel = fileTypeLabel(fn.att);
          const deleting = fileDeletingId === fn.noteId;
          return (
            <div key={`${fn.noteId}:${fn.att.url}`} style={fileRowStyle}>
              <button
                type="button"
                onClick={() => openFile(fn)}
                style={fileThumbBtnStyle}
                aria-label={image ? `Preview ${fn.att.name}` : `Open ${fn.att.name}`}
                title={fn.att.name}
              >
                {image ? (
                  <img
                    src={blobViewUrl(fn.att.url)}
                    alt=""
                    style={fileThumbImgStyle}
                    draggable={false}
                  />
                ) : (
                  <span style={fileThumbExtStyle}>{typeLabel.slice(0, 4)}</span>
                )}
              </button>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={fileNameStyle}
                  title={fn.att.name}
                  onClick={() => openFile(fn)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      openFile(fn);
                    }
                  }}
                >
                  {fn.att.name}
                </div>
                <div style={fileMetaStyle} title={fmtDateTime(fn.uploadedAt)}>
                  {fmtAddedAgo(fn.uploadedAt)}
                  <span style={{ opacity: 0.55 }}> · </span>
                  {typeLabel}
                  <span style={{ opacity: 0.55 }}> · </span>
                  {fmtSize(fn.att.size)}
                </div>
              </div>

              <FileActionsMenu
                canDelete={canManage}
                deleting={deleting}
                onView={() => openFile(fn)}
                onDownload={() => void handleDownload(fn)}
                onDelete={() => setPendingDelete(fn)}
              />
            </div>
          );
        })}
      </div>

      {previewIdx !== null && lightboxImages.length > 0 ? (
        <ImageLightbox
          images={lightboxImages}
          index={previewIdx}
          onIndexChange={setPreviewIdx}
          onClose={() => setPreviewIdx(null)}
        />
      ) : null}

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete this file?"
        description={
          pendingDelete
            ? `"${pendingDelete.att.name}" will be removed from this task. This can't be undone.`
            : undefined
        }
        confirmLabel={
          pendingDelete && fileDeletingId === pendingDelete.noteId ? "Deleting…" : "Delete"
        }
        cancelLabel="Cancel"
        confirmTone="danger"
        busy={Boolean(pendingDelete && fileDeletingId === pendingDelete.noteId)}
        onCancel={() => {
          if (pendingDelete && fileDeletingId === pendingDelete.noteId) return;
          setPendingDelete(null);
        }}
        onConfirm={async () => {
          if (!pendingDelete) return;
          await onRemove(pendingDelete.noteId, pendingDelete.att.url);
          setPendingDelete(null);
        }}
      />
    </div>
  );
}

function isFileImage(att: Attachment): boolean {
  if (att.type?.startsWith("image/")) return true;
  return /\.(png|jpe?g|gif|webp|bmp|svg)(\?|#|$)/i.test(att.name || att.url || "");
}

const fileRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "8px 4px",
  minWidth: 0,
  borderRadius: "var(--r-sm)",
};

const fileThumbBtnStyle: CSSProperties = {
  flexShrink: 0,
  width: 56,
  height: 44,
  padding: 0,
  border: "1px solid var(--rule)",
  borderRadius: "var(--r-sm)",
  overflow: "hidden",
  background: "var(--surface-sunk)",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const fileThumbImgStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  objectFit: "cover",
  display: "block",
};

const fileThumbExtStyle: CSSProperties = {
  fontFamily: "var(--mono)",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.04em",
  color: "var(--ink-soft)",
};

const fileNameStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: "var(--ink)",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  cursor: "pointer",
  lineHeight: 1.35,
};

const fileMetaStyle: CSSProperties = {
  marginTop: 2,
  fontSize: 11,
  fontFamily: "var(--mono)",
  color: "var(--ink-mute)",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  lineHeight: 1.35,
};

function isCommentImageAttachment(a: { url?: string; name?: string; type?: string; mime?: string }) {
  if (a.type?.startsWith("image/")) return true;
  if (a.mime?.startsWith("image/")) return true;
  if (/^Proof image\b/i.test(a.name || "")) return true;
  return /\.(png|jpe?g|webp|gif|heic|heif)(\?|#|$)/i.test(a.url || a.name || "");
}

function CommentAttachments({ attachments }: { attachments: Attachment[] }) {
  const seenUrls = new Set<string>();
  const seenImageFp = new Set<string>();
  const images: Attachment[] = [];
  const files: Attachment[] = [];
  for (const a of attachments || []) {
    if (!a?.url) continue;
    if (seenUrls.has(a.url)) continue;
    if (isCommentImageAttachment(a)) {
      // Ignore volatile paste names so already-doubled comments render once.
      // size === 0 (legacy proof rows) must not collapse distinct images.
      const mime = (a.type || a.mime || "").split(";")[0].trim().toLowerCase().replace("image/jpg", "image/jpeg");
      if (a.size > 0) {
        const fp = `img|${a.size}|${mime}`;
        if (seenImageFp.has(fp)) continue;
        seenImageFp.add(fp);
      }
      seenUrls.add(a.url);
      images.push(a);
    } else {
      seenUrls.add(a.url);
      files.push(a);
    }
  }
  const [previewIdx, setPreviewIdx] = useState<number | null>(null);
  if (images.length === 0 && files.length === 0) return null;

  const lightboxImages: LightboxImage[] = images.map((a) => ({
    src: blobViewUrl(a.url),
    alt: a.name || "attachment",
  }));

  return (
    <>
      {images.length > 0 ? (
        <div style={commentImagesRowStyle}>
          {images.map((a, i) => (
            <button
              key={a.url}
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setPreviewIdx(i);
              }}
              style={commentImageBtnStyle}
              aria-label={`Preview ${a.name || "image"}`}
              title={a.name || "Preview image"}
            >
              <img
                src={blobViewUrl(a.url)}
                alt={a.name || "attachment"}
                style={commentImageStyle}
                draggable={false}
              />
            </button>
          ))}
        </div>
      ) : null}
      {files.length > 0 ? (
        <div style={commentFilesRowStyle}>
          {files.map((a) => (
            <a
              key={a.url}
              href={blobViewUrl(a.url)}
              target="_blank"
              rel="noopener noreferrer"
              style={commentFileChipStyle}
              title={a.name || "attachment"}
            >
              <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--green-deep)", fontWeight: 600 }}>
                {(a.name?.split(".").pop() || "FILE").toUpperCase().slice(0, 4)}
              </span>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {a.name || "attachment"}
              </span>
            </a>
          ))}
        </div>
      ) : null}
      {previewIdx !== null && lightboxImages.length > 0 ? (
        <ImageLightbox
          images={lightboxImages}
          index={previewIdx}
          onIndexChange={setPreviewIdx}
          onClose={() => setPreviewIdx(null)}
        />
      ) : null}
    </>
  );
}

/** Image + text sit flush inside the outer comment card — no nested frames. */
const commentBodyStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 10,
  minWidth: 0,
};

const commentImagesRowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
};

const commentImageBtnStyle: CSSProperties = {
  display: "block",
  padding: 0,
  border: "none",
  borderRadius: "var(--r-sm)",
  overflow: "hidden",
  background: "transparent",
  cursor: "zoom-in",
  lineHeight: 0,
};

const commentImageStyle: CSSProperties = {
  display: "block",
  maxWidth: "100%",
  maxHeight: 260,
  objectFit: "contain",
  borderRadius: "var(--r-sm)",
};

const commentFilesRowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
};

const commentFileChipStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  maxWidth: 220,
  padding: "4px 8px",
  borderRadius: "var(--r-sm)",
  border: "1px solid var(--rule)",
  background: "var(--surface-sunk)",
  textDecoration: "none",
  color: "var(--ink-soft)",
  fontSize: 12,
  fontFamily: "var(--sans)",
};

// Mixes a CSS-style hex (#rrggbb) with an alpha to render colored label washes
// without needing per-label CSS variables. Falls back to the raw color if it's
// not a recognised hex (CSS vars passed in just pass through).
function hexWithAlpha(color: string, alpha: number) {
  if (!color) return "var(--surface-sunk)";
  const m = color.trim().match(/^#?([0-9a-fA-F]{6})$/);
  if (!m) return color;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// ─── Style constants ────────────────────────────────────────────────────────

const backBtnStyle: CSSProperties = { padding: "7px 14px", fontSize: 12, fontWeight: 500, background: "var(--surface)", color: "var(--ink-soft)", border: "1px solid var(--rule-strong)", borderRadius: "var(--r-sm)", cursor: "pointer", fontFamily: "var(--sans)" };
const primaryBtnStyle: CSSProperties = { padding: "7px 14px", fontSize: 12, fontWeight: 500, background: "var(--green-deep)", color: "#f4efdf", border: "1px solid var(--green-deep)", borderRadius: "var(--r-sm)", cursor: "pointer", fontFamily: "var(--sans)" };
const addBtnSmStyle: CSSProperties = { padding: "6px 12px", fontSize: 12, fontWeight: 500, background: "var(--green-deep)", color: "#f4efdf", border: "1px solid var(--green-deep)", borderRadius: "var(--r-sm)", cursor: "pointer", fontFamily: "var(--sans)" };
const dateInputStyle: CSSProperties = {
  width: "100%", padding: "7px 9px", fontSize: 12,
  background: "var(--page)", color: "var(--ink-soft)",
  border: "1px solid var(--rule-strong)", borderRadius: "var(--r-sm)",
  fontFamily: "var(--sans)",
};
const fieldInfoIconStyle: CSSProperties = {
  flexShrink: 0,
  width: 18,
  height: 18,
  borderRadius: "50%",
  border: "1px solid var(--rule-strong)",
  color: "var(--ink-mute)",
  fontFamily: "var(--serif)",
  fontSize: 11,
  fontStyle: "italic",
  fontWeight: 600,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  lineHeight: 1,
  userSelect: "none",
};
const fieldInfoPopoverStyle: CSSProperties = {
  position: "fixed",
  zIndex: 1200,
  width: 220,
  padding: "8px 10px",
  background: "var(--surface)",
  color: "var(--ink)",
  border: "1px solid var(--rule-strong)",
  borderRadius: "var(--r-sm)",
  fontFamily: "var(--sans)",
  fontSize: 12,
  fontStyle: "normal",
  fontWeight: 400,
  letterSpacing: "normal",
  textTransform: "none",
  lineHeight: 1.4,
  whiteSpace: "normal",
};
const readOnlyFieldStyle: CSSProperties = {
  // Visually identical to dateInputStyle so the Details grid stays uniform
  // across editable + read-only fields.
  width: "100%", padding: "7px 9px", fontSize: 12,
  background: "var(--page)", color: "var(--ink-soft)",
  border: "1px solid var(--rule-strong)", borderRadius: "var(--r-sm)",
  fontFamily: "var(--sans)",
  // Match the height of an empty input/CustomSelect (which renders a placeholder)
  minHeight: 32, display: "flex", alignItems: "center",
};
const textInputStyle: CSSProperties = { width: "100%", padding: "7px 9px", fontSize: 13, fontFamily: "var(--sans)", border: "1px solid var(--rule-strong)", borderRadius: "var(--r-sm)", background: "var(--page)", color: "var(--ink)" };
const kebabBtnStyle: CSSProperties = { padding: "0 6px", fontSize: 16, lineHeight: 1, fontWeight: 700, background: "transparent", border: "none", borderRadius: "var(--r-sm)", cursor: "pointer", color: "var(--ink-soft)", fontFamily: "var(--sans)" };
const commentMenuPopoverStyle: CSSProperties = { position: "fixed", minWidth: 140, background: "var(--surface)", borderWidth: 1, borderStyle: "solid", borderColor: "var(--rule)", borderRadius: "var(--r-sm)", boxShadow: "var(--shadow-md)", zIndex: 1100, padding: "4px 0" };
const commentMenuRowStyle: CSSProperties = { display: "block", width: "100%", textAlign: "left", padding: "7px 12px", fontSize: 12, background: "transparent", borderWidth: 0, cursor: "pointer", fontFamily: "var(--sans)", color: "var(--ink-soft)" };
