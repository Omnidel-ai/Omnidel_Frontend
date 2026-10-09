"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { CustomSelect } from "@/components/omnidel/custom-select";
import { MemberMultiSelect } from "@/components/omnidel/member-multi-select";
import { cachedJson } from "@/lib/client/options-cache";
import { LeadPicker } from "@/components/omnidel/lead-picker";
import { useIsMobile } from "@/lib/client/use-is-mobile";
import { clampToMaxLength, TASK_TITLE_MAX } from "@/lib/field-limits";
import { AcharyaPicker } from "@/components/omnidel/acharya-picker";
import { RichTextEditor, isRichTextEmpty } from "@/components/omnidel/rich-text-editor";
import { CommentComposer, COMMENT_EMPTY_DOC, type ComposerAttachment } from "@/components/omnidel/comment-composer";
import { uploadPipelineFile } from "@/lib/client/upload-blob-file";
import { consumeGuidedFill, onFieldFill, offFieldFill } from "@/lib/client/task-guided-fill";
import { TaskChecklistDraft, saveDraftChecklistItems, addSubtaskTriggerStyle, type DraftChecklistItem } from "@/components/omnidel/task-checklist";
import { SubtaskTemplateMenu } from "@/components/omnidel/subtask-template-menu";
import { ProjectSetupModal } from "@/components/omnidel/omnipulse/project-setup-modal";
import { ConfirmDialog } from "@/components/omnidel/confirm-dialog";
import { LabelPicker, type Label } from "@/components/omnidel/label-picker";
import { DatePicker } from "@/components/omnidel/date-picker";
import { normalizeRecurringDays, normalizeRecurringMonthDays } from "@/lib/task-recurring";
import { isSimpleTaskType } from "@/lib/simple-task";
import { useTr } from "@/lib/client/language";

interface PendingFile {
  key: string;
  file: File;
}

interface TaskTypeOption {
  id: string;
  name_en: string;
  slug: string;
  requires_lead: boolean;
}

// ============================================================================
// TaskCreateModal — board-aware task creation.
//
// Two modes:
//   1. Board mode (boardId provided): POST includes list_id + board_id so the
//      task lands inside the right per-board list. If initialListId is omitted
//      the modal pulls the board's cards (GET /api/omnipulse/boards/<id>/lists)
//      and picks the first one (lowest sort_order). The header shows
//      "New task in <list name>" so the user knows where it lands.
//   2. Legacy mode (no boardId): falls back to the flat POST without list_id —
//      kept so admin/founder flat creation paths still work while the rest of
//      the app migrates to workspace/board scoping.
// ============================================================================

const LANES = ["m_offices", "m_balconies", "m_biophilic", "m_retail", "people", "platform", "governance"];
const PRIORITIES = ["low", "medium", "high", "urgent"];
const STATUS_OPTIONS = [
  { value: "planned", label: "Planned" },
  { value: "doing", label: "Doing" },
  { value: "done", label: "Done" },
];

function statusColor(s: string): CSSProperties {
  switch (s) {
    case "done":    return { background: "var(--ok-wash)", color: "var(--ok)" };
    case "doing":   return { background: "var(--ochre-wash)", color: "var(--ochre)" };
    case "planned": return { background: "var(--surface-sunk)", color: "var(--ink-mute)" };
    default:        return { background: "var(--surface-sunk)", color: "var(--ink-mute)" };
  }
}

function statusLabel(s: string) {
  return STATUS_OPTIONS.find(o => o.value === s)?.label ?? s.replace(/_/g, " ");
}

function laneLabel(l: string) {
  return l.replace(/^m_/, "").replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fmtDate(d: string | null) {
  return d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "---";
}

interface BoardListOption {
  id: string;
  name: string;
  sort_order: number;
}

// Editable form shape for the create modal.
type CreateForm = {
  title: string;
  description: string;
  status: string;
  lane: string;
  priority: string;
  due_date: string;
  session_count: string;
  /** When true, task session total tracks the sum of subtask sessions (no budget error). */
  session_count_auto: boolean;
  break_allowance_total: string;
  mission_impact: string;
  mission_id: string;
  assignee_ids: string[];
  assigned_on: string;
  task_type_id: string;
  lead_id: string;
  recurring: string;
  /** weekly: Mon-first 0–6; monthly/custom: day-of-month 1–31. */
  recurring_days: number[];
  /** Weekly: mon-first weekday → first occurrence ISO. */
  recurring_weekday_starts: Record<number, string>;
};

// Serialize the user-meaningful draft state for a dirty check. Excludes
// task_type_id and the resolved list id — those are auto-defaulted after open
// (not typed by the user), so including them would falsely read as "dirty" and
// pop the discard prompt on an untouched form.
function serializeDraft(
  form: CreateForm,
  acharyaId: string | null,
  subtasks: DraftChecklistItem[],
  destWorkspaceId: string,
  destBoardId: string,
  labelIds: string[] = [],
  pendingFileKeys: string[] = [],
  createComment: string = COMMENT_EMPTY_DOC,
  createCommentAttCount: number = 0,
): string {
  return JSON.stringify({
    title: form.title.trim(),
    description: form.description,
    status: form.status,
    lane: form.lane,
    priority: form.priority,
    due_date: form.due_date,
    session_count: form.session_count,
    session_count_auto: form.session_count_auto,
    break_allowance_total: form.break_allowance_total,
    mission_impact: form.mission_impact,
    mission_id: form.mission_id,
    assignee_ids: [...form.assignee_ids].sort(),
    assigned_on: form.assigned_on,
    lead_id: form.lead_id,
    recurring: form.recurring,
    recurring_days:
      form.recurring === "custom" ||
      form.recurring === "monthly" ||
      form.recurring === "weekly"
        ? [...form.recurring_days].sort((a, b) => a - b)
        : [],
    recurring_weekday_starts: form.recurring_weekday_starts,
    acharyaId,
    subtasks,
    destWorkspaceId,
    destBoardId,
    labelIds: [...labelIds].sort(),
    pendingFileKeys: [...pendingFileKeys].sort(),
    createComment,
    createCommentAttCount,
  });
}

interface Props {
  open: boolean;
  onClose: () => void;
  // Called after a successful create. Receives the new task id so the parent
  // can route into a view/edit modal if it wants.
  onCreated?: (newTaskId: string) => void;
  // When set, the modal POSTs in board mode (list_id + board_id included).
  boardId?: string;
  // Pre-selects a destination list. If omitted but boardId is set the modal
  // resolves the board's first list.
  initialListId?: string;
  // Seed the assign/deadline dates (YYYY-MM-DD) — used when creating from a
  // calendar day so the task lands on the clicked date. Default: assign = today,
  // deadline = empty.
  initialAssignedOn?: string;
  initialDueDate?: string;
  // Board-scoped user list — when provided, the assignee picker uses ONLY
  // these users (board members for private boards, workspace members for
  // workspace-visible boards). When omitted the modal falls back to the
  // global user list from /api/omnimart/tasks/options.
  users?: { id: string; name: string }[];
  // ── From-lead mode (Phase 6) ──────────────────────────────────────────────
  // When set, the task is force-linked to this lead, the type is locked to
  // "pipeline", and the modal renders Workspace → Board selects (scoped to the
  // user) instead of taking a fixed boardId.
  lockedLeadId?: string | null;
  lockedLeadNo?: string | null;
  pickDestination?: boolean;
  /** When TASK TYPE is set to Simple Task, parent should close this modal and open SimpleTaskCreateModal. */
  onSwitchToSimple?: () => void;
}

export function TaskCreateModal({ open, onClose, onCreated, boardId, initialListId, initialAssignedOn, initialDueDate, users: usersProp, lockedLeadId, lockedLeadNo, pickDestination, onSwitchToSimple }: Props) {
  const tr = useTr();
  const isMobile = useIsMobile();
  const [users, setUsers] = useState<{ id: string; name: string }[]>([]);
  const [boardLists, setBoardLists] = useState<BoardListOption[]>([]);
  const [resolvedListId, setResolvedListId] = useState<string>("");
  // "Need a project? Set one up" — opens the Acharya-guided project setup modal
  // (it portals above this one), without disturbing the task create flow.
  const [projectSetupOpen, setProjectSetupOpen] = useState(false);

  const [missions, setMissions] = useState<{ id: string; name_en: string }[]>([]);
  const [taskTypes, setTaskTypes] = useState<TaskTypeOption[]>([]);
  const [currentUserName, setCurrentUserName] = useState("");
  // From-lead destination picker (Phase 6)
  const [workspaces, setWorkspaces] = useState<{ id: string; name: string }[]>([]);
  const [destBoards, setDestBoards] = useState<{ id: string; name: string }[]>([]);
  const [destWorkspaceId, setDestWorkspaceId] = useState("");
  const [destBoardId, setDestBoardId] = useState("");
  const [form, setForm] = useState<CreateForm>({
    title: "",
    description: "",
    status: "planned",
    lane: "",
    priority: "medium",
    due_date: "",
    session_count: "1",
    session_count_auto: false,
    break_allowance_total: "1",
    mission_impact: "",
    mission_id: "",
    assignee_ids: [] as string[],
    assigned_on: todayIso(),
    task_type_id: "",
    lead_id: "",
    recurring: "",
    recurring_days: [],
    recurring_weekday_starts: {},
  });
  const [error, setError] = useState("");
  const [mediaProvisionNotice, setMediaProvisionNotice] = useState<{
    taskId: string;
    added: string[];
  } | null>(null);
  // Discard-confirmation on close when the form has unsaved input. The pristine
  // snapshot is captured on open (see the reset effect); `isDirty` compares live
  // state to it. Mirrors the task detail modal's unsaved-changes guard.
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false);
  const pristineSnapshotRef = useRef<string>("");
  const [acharyaId, setAcharyaId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // Set to true when the modal was opened from a MahAcharya guided walkthrough
  // (i.e. consumeGuidedFill() returned non-null). Used to show the save hint.
  const [isGuided, setIsGuided] = useState(false);
  const [draftSubtasks, setDraftSubtasks] = useState<DraftChecklistItem[]>([]);
  const titleInputRef = useRef<HTMLInputElement | null>(null);
  // Labels selected before the task exists — assigned after POST succeeds.
  const [assignedLabels, setAssignedLabels] = useState<Label[]>([]);
  const [availableLabels, setAvailableLabels] = useState<Label[]>([]);
  // Staged files + first comment (posted after task create — same as Simple Task).
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [createComment, setCreateComment] = useState(COMMENT_EMPTY_DOC);
  const [createCommentAtts, setCreateCommentAtts] = useState<ComposerAttachment[]>([]);
  const [commentsOpen, setCommentsOpen] = useState(true);
  const [subtaskAddOpen, setSubtaskAddOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Board that owns the label master (board mode or from-lead destination).
  const labelBoardId = boardId || destBoardId || "";
  // Mentions need a board id — same pool as task edit modal.
  const mentionBoardId = boardId || destBoardId || "";

  const fetchBoardMentions = useCallback(async (query: string) => {
    if (!mentionBoardId) return [];
    try {
      const res = await fetch(
        `/api/omnipulse/boards/${mentionBoardId}/mentions?q=${encodeURIComponent(query)}`,
      );
      if (!res.ok) return [];
      const data = await res.json();
      return data.items || [];
    } catch (err) {
      console.error("[mentions] board fetch failed:", err);
      return [];
    }
  }, [mentionBoardId]);

  // Dirty when live draft state differs from the pristine snapshot taken on open.
  const isDirty = serializeDraft(
    form, acharyaId, draftSubtasks, destWorkspaceId, destBoardId,
    assignedLabels.map((l) => l.id),
    pendingFiles.map((p) => p.key),
    createComment,
    createCommentAtts.length,
  ) !== pristineSnapshotRef.current;
  // Close attempt: confirm first if there's unsaved input, else close immediately.
  function attemptClose() {
    if (isDirty) { setConfirmCloseOpen(true); return; }
    onClose();
  }

  // Reset state when the modal opens. resolvedListId starts from initialListId
  // so the user sees the destination immediately; if missing it's filled in
  // once the board's lists arrive.
  // consumeGuidedFill() reads any pending MahAcharya walkthrough values (title,
  // priority, assignee_ids, due_date) and seeds the form. Returns null on a
  // normal manual open so behaviour is identical when no guided fill is waiting.
  useEffect(() => {
    if (!open) return;
    const guided = consumeGuidedFill();
    setIsGuided(guided !== null);
    const initialForm: CreateForm = {
      title: guided?.title ?? "",
      description: "",
      status: "planned",
      lane: "",
      priority: guided?.priority ?? "medium",
      // guided-fill wins over calendar seed; calendar seed wins over empty string.
      due_date: guided?.due_date ?? initialDueDate ?? "",
      session_count: "1",
      // Default on so adding subtasks does not immediately hit the budget error.
      session_count_auto: false,
      break_allowance_total: "1",
      mission_impact: "",
      mission_id: "",
      assignee_ids: guided?.assignee_ids ?? [],
      // calendar seed for assigned_on; guided-fill doesn't set this field.
      assigned_on: initialAssignedOn ?? todayIso(),
      task_type_id: "",
      lead_id: lockedLeadId || "",
      recurring: "",
      recurring_days: [],
      recurring_weekday_starts: {},
    };
    setForm(initialForm);
    setResolvedListId(initialListId || "");
    setAcharyaId(null);
    setDraftSubtasks([]);
    setDestWorkspaceId("");
    setDestBoardId("");
    setAssignedLabels([]);
    setAvailableLabels([]);
    setPendingFiles([]);
    setCreateComment(COMMENT_EMPTY_DOC);
    setCreateCommentAtts([]);
    setCommentsOpen(true);
    setSubtaskAddOpen(false);
    setError("");
    setConfirmCloseOpen(false);
    // Capture the pristine baseline for the dirty check (see serializeDraft).
    pristineSnapshotRef.current = serializeDraft(initialForm, null, [], "", "");
    setTimeout(() => titleInputRef.current?.focus(), 50);
  }, [open, initialListId, lockedLeadId, initialAssignedOn, initialDueDate]);

  // Guided-fill live subscription. While the modal is open, the Walkthrough may
  // call applyFieldFill() as it advances through fill steps. We listen and update
  // the relevant form fields in real-time so the user sees values appear as the
  // tour progresses (priority, assignees, due_date). This is a no-op on normal
  // manual opens — applyFieldFill() is only called during a guided tour.
  useEffect(() => {
    if (!open) return;
    function handleFieldFill(
      key: "title" | "priority" | "assignee_ids" | "due_date",
      value: string | string[] | undefined,
    ) {
      if (value === undefined) return;
      if (key === "assignee_ids" && Array.isArray(value)) {
        setForm((f) => ({ ...f, assignee_ids: value }));
      } else if (key === "title" && typeof value === "string") {
        setForm((f) => ({ ...f, title: value }));
      } else if (key === "priority" && typeof value === "string") {
        setForm((f) => ({ ...f, priority: value }));
      } else if (key === "due_date" && typeof value === "string") {
        setForm((f) => ({ ...f, due_date: value }));
      }
    }
    onFieldFill(handleFieldFill);
    return () => { offFieldFill(handleFieldFill); };
  }, [open]);

  // Options fetch — users + missions + task types for the selects.
  // When a `users` prop is provided (board-scoped), we use it directly.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    if (usersProp) {
      setUsers(usersProp);
    }
    cachedJson<{ users?: { id: string; name: string }[]; missions?: { id: string; name_en: string }[]; taskTypes?: TaskTypeOption[]; currentUserName?: string }>("/api/omnipulse/tasks/options").then(opt => {
      if (cancelled) return;
      if (!usersProp) setUsers(opt.users || []);
      setCurrentUserName(opt.currentUserName || "");
      setMissions(opt.missions || []);
      const types = (opt.taskTypes || []) as TaskTypeOption[];
      setTaskTypes(types);
      // From-lead mode: lock the type to "pipeline" (the lead-requiring type).
      // Otherwise default to "General" so the type is never blank (no "No type").
      if (pickDestination) {
        const pipeline = types.find(t => t.slug === "pipeline") || types.find(t => t.requires_lead);
        if (pipeline) setForm(f => ({ ...f, task_type_id: pipeline.id }));
      } else {
        const general =
          types.find(t => t.slug === "general") ||
          types.find(t => !t.requires_lead && !isSimpleTaskType({ id: t.id, slug: t.slug, name: t.name_en })) ||
          types[0];
        if (general && !isSimpleTaskType({ id: general.id, slug: general.slug, name: general.name_en })) {
          setForm(f => ({ ...f, task_type_id: f.task_type_id || general.id }));
        }
      }
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [open, usersProp, pickDestination]);

  // From-lead destination picker: load the user's workspaces, then the boards in
  // the chosen workspace. Both endpoints already scope to what the user can see.
  useEffect(() => {
    if (!open || !pickDestination) return;
    let cancelled = false;
    fetch("/api/omnipulse/workspaces?relevant=1").then(r => r.json()).then(d => {
      if (!cancelled) {
        const items = (d.items || []) as { id: string; name: string; is_system?: boolean }[];
        setWorkspaces(items.filter(w => !w.is_system).map(w => ({ id: w.id, name: w.name })));
      }
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [open, pickDestination]);

  useEffect(() => {
    if (!open || !pickDestination || !destWorkspaceId) {
      setDestBoards([]);
      // Clearing the team back to "Select team" must drop the project with it —
      // otherwise a board from the previous team stays in state, invisible
      // behind the now-disabled picker, and still gets submitted.
      setDestBoardId("");
      return;
    }
    let cancelled = false;
    setDestBoardId("");
    fetch(`/api/omnipulse/boards?workspace_id=${destWorkspaceId}`).then(r => r.json()).then(d => {
      if (!cancelled) setDestBoards((d.items || []).map((b: { id: string; name: string }) => ({ id: b.id, name: b.name })));
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [open, pickDestination, destWorkspaceId]);

  // Load project label master for the picker (board mode or from-lead dest board).
  useEffect(() => {
    if (!open || !labelBoardId) {
      setAvailableLabels([]);
      return;
    }
    let cancelled = false;
    fetch(`/api/omnimart/task-labels?board_id=${encodeURIComponent(labelBoardId)}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        const items = (d.items || []) as Label[];
        setAvailableLabels(items);
      })
      .catch(() => {
        if (!cancelled) setAvailableLabels([]);
      });
    return () => { cancelled = true; };
  }, [open, labelBoardId]);

  // Board-mode card resolution: pull /api/omnipulse/boards/<id>/lists so the
  // modal knows the destination name (for the header note) and can default
  // resolvedListId when the caller didn't pass initialListId.
  useEffect(() => {
    if (!open || !boardId) {
      setBoardLists([]);
      return;
    }
    let cancelled = false;
    fetch(`/api/omnipulse/boards/${boardId}/lists`)
      .then(r => (r.ok ? r.json() : Promise.reject(new Error("Could not load lists"))))
      .then(d => {
        if (cancelled) return;
        const items = (d.items || []) as BoardListOption[];
        const sorted = [...items].sort((a, b) => a.sort_order - b.sort_order);
        setBoardLists(sorted);
        // Only auto-pick the first list when the caller didn't supply one.
        if (!initialListId && sorted.length > 0) {
          setResolvedListId(sorted[0].id);
        }
      })
      .catch(() => {
        if (!cancelled) setBoardLists([]);
      });
    return () => { cancelled = true; };
  }, [open, boardId, initialListId]);

  // Esc closes — but guard against losing unsaved input, and let the discard
  // confirm dialog own Escape while it's open.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (confirmCloseOpen) return;
      if (isDirty) { setConfirmCloseOpen(true); return; }
      onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, isDirty, confirmCloseOpen]);

  // Lock body scroll while modal is open.
  useEffect(() => {
    if (!open) return;
    const prev = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => { document.documentElement.style.overflow = prev; };
  }, [open]);

  async function postFileNote(targetTaskId: string, file: File) {
    const att = await uploadPipelineFile(file);
    const noteRes = await fetch(`/api/omnipulse/tasks/${targetTaskId}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        note_type: "file",
        content: `[document] ${att.name}`,
        attachments: [{ ...att, docType: "document" }],
      }),
    });
    if (!noteRes.ok) {
      const d = await noteRes.json().catch(() => ({}));
      throw new Error((d as { error?: string }).error || `Failed to attach ${file.name}`);
    }
  }

  async function postCommentNote(
    targetTaskId: string,
    content: string,
    attachments: ComposerAttachment[] = [],
  ) {
    const images = attachments.filter((a) => a.type?.startsWith("image/"));
    const noteRes = await fetch(`/api/omnipulse/tasks/${targetTaskId}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        note_type: "note",
        content,
        attachments: images,
      }),
    });
    if (!noteRes.ok) {
      const d = await noteRes.json().catch(() => ({}));
      throw new Error((d as { error?: string }).error || "Failed to post comment");
    }
  }

  if (!open) return null;

  const selectedType = taskTypes.find(t => t.id === form.task_type_id) || null;
  const needsLead = !!selectedType?.requires_lead;

  async function handleCreate() {
    setError("");
    if (!form.title.trim()) { setError("Title is required"); return; }
    if (form.title.trim().length > TASK_TITLE_MAX) {
      setError(`Title must be at most ${TASK_TITLE_MAX} characters`);
      return;
    }
    if (needsLead && !form.lead_id) { setError("This task type requires a linked lead."); return; }
    // From-lead mode: enforce the pipeline-type lock on submit, not just in the
    // UI — if the type didn't load, block rather than silently create a
    // mistyped, possibly lead-less task.
    if (pickDestination) {
      // Names no master row: this fires when the options fetch failed OR when no
      // lead-requiring task type is configured at all.
      if (!form.task_type_id) { setError("Task type unavailable — reopen and try again."); return; }
      if (!form.lead_id) { setError("This pipeline task must be linked to a lead."); return; }
      if (!destBoardId) { setError("Pick a team and project for this task."); return; }
    }
    setSaving(true);
    // Base payload — kept compatible with the existing flat POST shape.
    const payload: Record<string, unknown> = {
      ...form,
      lane: form.lane || null,
      assignee_ids: form.assignee_ids,
      assigned_on: form.assigned_on || null,
      due_date: form.due_date || null,
      session_count: Number(form.session_count) || 1,
      session_count_auto: false,
      break_allowance_total: form.break_allowance_total === "" ? 1 : Number(form.break_allowance_total),
      task_type_id: form.task_type_id || null,
      lead_id: form.lead_id || null,
      acharya_id: acharyaId,
      recurring: form.recurring || null,
      recurring_days:
        form.recurring === "weekly"
          ? normalizeRecurringDays(form.recurring_days)
          : form.recurring === "monthly" || form.recurring === "custom"
            ? normalizeRecurringMonthDays(form.recurring_days)
            : null,
    };
    if (
      form.recurring === "weekly" &&
      (!payload.recurring_days || (payload.recurring_days as number[]).length === 0)
    ) {
      setError("Pick at least one weekday for Weekly repeat");
      setSaving(false);
      return;
    }
    if (
      (form.recurring === "monthly" || form.recurring === "custom") &&
      (!payload.recurring_days || (payload.recurring_days as number[]).length === 0)
    ) {
      setError(
        form.recurring === "custom"
          ? "Pick at least one date for Custom repeat"
          : "Pick at least one day of the month for Monthly repeat",
      );
      setSaving(false);
      return;
    }
    // Destination: from-lead picker (board only, first list resolved server-side)
    // → explicit boardId prop → legacy flat create.
    if (pickDestination) {
      payload.board_id = destBoardId;
    } else if (boardId) {
      payload.board_id = boardId;
      if (resolvedListId) payload.list_id = resolvedListId;
    }
    try {
      const res = await fetch("/api/omnipulse/tasks", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSaving(false);
        setError(data.error || "Failed to create task");
        return;
      }
      const newId = data?.item?.id as string | undefined;
      if (newId && form.status !== "planned") {
        const statusRes = await fetch(`/api/omnipulse/tasks/${newId}/status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: form.status }),
        });
        if (!statusRes.ok) {
          const statusData = await statusRes.json().catch(() => ({}));
          setSaving(false);
          setError(statusData.error || "Task created but status could not be set");
          return;
        }
      }
      if (newId && draftSubtasks.length > 0) {
        try {
          await saveDraftChecklistItems(newId, draftSubtasks);
        } catch (err) {
          setSaving(false);
          setError(err instanceof Error ? err.message : "Task created but subtasks could not be saved");
          return;
        }
      }
      // Apply labels selected during create (task must exist first).
      if (newId && assignedLabels.length > 0) {
        for (const lb of assignedLabels) {
          try {
            const labRes = await fetch(`/api/omnipulse/tasks/${newId}/labels`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ label_id: lb.id }),
            });
            if (!labRes.ok) {
              console.error("[task-create] assign label failed:", lb.id, await labRes.text());
            }
          } catch (err) {
            console.error("[task-create] assign label failed:", lb.id, err);
          }
        }
      }
      // Staged files + optional first comment (same soft-fail pattern as Simple Task).
      if (newId) {
        for (const pf of pendingFiles) {
          try {
            await postFileNote(newId, pf.file);
          } catch (err) {
            console.error("[task-create] post-create file failed:", err);
          }
        }
        if (!isRichTextEmpty(createComment) || createCommentAtts.length > 0) {
          try {
            await postCommentNote(newId, createComment, createCommentAtts);
          } catch (err) {
            console.error("[task-create] post-create comment failed:", err);
          }
        }
      }
      setSaving(false);
      const provision = data?.item?.media_provision as { added?: string[] } | undefined;
      const provisionError = data?.item?.media_provision_error as string | undefined;
      if (newId && provisionError) {
        setError(provisionError);
        onCreated?.(newId);
        return;
      }
      if (newId && provision) {
        setMediaProvisionNotice({
          taskId: newId,
          added: Array.isArray(provision.added) ? provision.added : [],
        });
        return;
      }
      onCreated?.(newId || "");
      onClose();
    } catch (err) {
      setSaving(false);
      setError(err instanceof Error ? err.message : "Failed to create task");
    }
  }

  function finishAfterMediaNotice() {
    const id = mediaProvisionNotice?.taskId || "";
    setMediaProvisionNotice(null);
    onCreated?.(id);
    onClose();
  }

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0,0,0,0.5)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "24px 16px", overflowY: "auto",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) attemptClose(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        style={{
          width: "100%", maxWidth: isMobile ? "100%" : 1080, maxHeight: "90vh",
          display: "flex", flexDirection: "column", overflow: "hidden",
          background: "var(--surface)", border: "1px solid var(--rule)",
          borderRadius: "var(--r-md)", boxShadow: "var(--shadow-md)",
          position: "relative",
        }}
      >
        {/* No × in the corner — the footer's Cancel button is the one way out
            (plus Escape and a scrim click, both routed through attemptClose),
            so a second close affordance would just be a duplicate. */}

        {/* Scrollable body — flex:1 + overflow-y:auto so the sticky footer
            below is a separate, non-overlapping flex sibling rather than a
            sticky child sharing this scroll box (which used to clip the
            last "Man Power Details" fields under the footer). */}
        <div style={{ flex: "1 1 auto", overflowY: "auto", padding: "22px 24px" }}>
        {/* Header — no paddingRight now that the × is gone; the title input
            runs the full width like the Description box under it. */}
        <div style={{ marginBottom: 14 }}>
          <input
            ref={titleInputRef}
            data-mah="task-title-input"
            value={form.title}
            maxLength={TASK_TITLE_MAX}
            onChange={e => setForm(f => ({ ...f, title: clampToMaxLength(e.target.value, TASK_TITLE_MAX) }))}
            placeholder={tr("Task title")}
            style={{
              width: "100%", padding: "6px 10px", fontSize: 22, fontWeight: 600,
              fontFamily: "var(--serif)", color: "var(--ink)",
              background: "var(--page)",
              // Red highlight when the cap is reached so the user knows WHY the
              // input stopped accepting characters (maxLength alone is silent).
              border: `1px solid ${form.title.length >= TASK_TITLE_MAX ? "var(--crit)" : "var(--rule-strong)"}`,
              borderRadius: "var(--r-sm)",
              ...(form.title.length >= TASK_TITLE_MAX ? { boxShadow: "0 0 0 2px var(--crit-wash)" } : null),
            }}
          />
          {form.title.length >= TASK_TITLE_MAX && (
            <div style={{ marginTop: 4, fontSize: 11, color: "var(--crit)", fontFamily: "var(--sans)" }}>
              {tr("Title limit reached —")} {TASK_TITLE_MAX} {tr("characters max.")}
            </div>
          )}
          {/* Status + priority + labels (max 3 labels on first row; + Add after last label) */}
          <div style={{ marginTop: 10 }}>
            <LabelPicker
              leading={(
                <>
                  <span style={{
                    padding: "3px 10px", fontSize: 11, fontFamily: "var(--mono)",
                    textTransform: "uppercase", letterSpacing: "0.06em",
                    borderRadius: 999, minWidth: 88, textAlign: "center",
                    ...statusColor(form.status),
                  }}>{tr(statusLabel(form.status))}</span>
                  <PriorityIndicator priority={form.priority} />
                </>
              )}
              assigned={assignedLabels}
              available={availableLabels}
              canManage={!!labelBoardId}
              onAdd={(lb) => {
                setAssignedLabels((prev) => (prev.some((a) => a.id === lb.id) ? prev : [...prev, lb]));
              }}
              onRemove={(id) => {
                setAssignedLabels((prev) => prev.filter((l) => l.id !== id));
              }}
              onCreate={async ({ label, color }) => {
                if (!labelBoardId) return null;
                const res = await fetch("/api/omnimart/task-labels", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ label, color, board_id: labelBoardId }),
                });
                if (!res.ok) return null;
                const data = await res.json();
                const item = data.item as Label;
                setAvailableLabels((prev) => [...prev, item]);
                setAssignedLabels((prev) => [...prev, item]);
                return item;
              }}
              onUpdate={async (id, { label, color }) => {
                const res = await fetch(`/api/omnimart/task-labels/${id}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ label, color }),
                });
                if (!res.ok) return null;
                const data = await res.json();
                const item = data.item as Label;
                setAvailableLabels((prev) => prev.map((l) => (l.id === id ? { ...l, ...item } : l)));
                setAssignedLabels((prev) => prev.map((l) => (l.id === id ? { ...l, ...item } : l)));
                return item;
              }}
              onDelete={async (id) => {
                const res = await fetch(`/api/omnimart/task-labels/${id}`, { method: "DELETE" });
                if (!res.ok) return false;
                setAvailableLabels((prev) => prev.filter((l) => l.id !== id));
                setAssignedLabels((prev) => prev.filter((l) => l.id !== id));
                return true;
              }}
            />
          </div>

        </div>

        {error && (
          <div style={{
            color: "var(--crit)", fontSize: 13, marginBottom: 16,
            padding: "8px 12px", background: "var(--surface-sunk)",
            borderRadius: "var(--r-sm)",
          }}>{error}</div>
        )}

        {/* Two-column body — form + Files on the left; Comments on the right
            (matches Simple Task create). Files/comments stage until Create Task. */}
        <div style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "minmax(0, 1.5fr) minmax(0, 1fr)",
          gap: isMobile ? 18 : 24,
          alignItems: "flex-start",
        }}>
          {/* LEFT COLUMN */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>
            <section>
              <SectionTitle>{tr("Description")}</SectionTitle>
              {/* Rich-text editor — same Tiptap editor as TaskModal so create
                  and edit share identical formatting + data format. */}
              <RichTextEditor
                content={form.description}
                onChange={v => setForm(f => ({ ...f, description: v }))}
                placeholder={tr("Add a more detailed description...")}
              />
            </section>

            <section>
              <SectionTitle>{tr("Task Details")}</SectionTitle>
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "minmax(0, 1fr) minmax(0, 1fr)", gap: "12px 24px" }}>
                {/* Field order is the grid's source order (row-major, 2 up):
                    what the task IS (type + lead) before where it LANDS
                    (team + project), then the rest. */}
                <DI label={tr("TASK TYPE")}>
                  {pickDestination ? (
                    // Locked to the lead-requiring master row, but SHOW that row's
                    // real name — it is admin-editable (currently "Pipeline /
                    // Marketing"), so a literal here goes stale on the first rename.
                    <div style={readOnlyFieldStyle}>{selectedType?.name_en || "—"}</div>
                  ) : (
                    <CustomSelect
                      value={form.task_type_id}
                      onChange={v => {
                        const picked = taskTypes.find(t => t.id === v);
                        if (
                          picked &&
                          onSwitchToSimple &&
                          isSimpleTaskType({ id: picked.id, slug: picked.slug, name: picked.name_en })
                        ) {
                          onSwitchToSimple();
                          return;
                        }
                        setForm(f => ({ ...f, task_type_id: v, lead_id: "" }));
                      }}
                      placeholder={tr("General")}
                      options={taskTypes.map(t => ({ value: t.id, label: t.name_en }))}
                    />
                  )}
                </DI>
                {(needsLead || pickDestination) && (
                  <DI label={tr("LEAD")}>
                    {pickDestination ? (
                      <div style={readOnlyFieldStyle}>{lockedLeadNo || tr("Linked lead")}</div>
                    ) : (
                      <LeadPicker
                        value={form.lead_id || null}
                        onChange={(id) => setForm(f => ({ ...f, lead_id: id || "" }))}
                        placeholder={tr("Search a lead…")}
                      />
                    )}
                  </DI>
                )}
                {pickDestination && (
                  <>
                    <DI label={tr("TEAM")}>
                      <CustomSelect
                        value={destWorkspaceId}
                        onChange={setDestWorkspaceId}
                        placeholder={tr("Select team")}
                        options={[{ value: "", label: "Select team" }, ...workspaces.map(w => ({ value: w.id, label: w.name }))]}
                      />
                    </DI>
                    <DI label={tr("PROJECT")}>
                      {/* Projects are scoped to the team, so this stays locked until
                          one is picked. No empty "Select project" option: the field
                          is required, and CustomSelect renders a matching option's
                          label INSTEAD of the placeholder (custom-select.tsx: the
                          trigger is `selected?.label || placeholder`) — so that
                          entry is what made the old "Pick a team first" placeholder
                          unreachable. With it gone the placeholder does the talking. */}
                      <CustomSelect
                        value={destBoardId}
                        onChange={setDestBoardId}
                        disabled={!destWorkspaceId}
                        placeholder={destWorkspaceId ? "Select project" : "Select team first"}
                        options={destBoards.map(b => ({ value: b.id, label: b.name }))}
                      />
                    </DI>
                  </>
                )}
                <DI label={tr("STATUS")}>
                  <CustomSelect
                    value={form.status}
                    onChange={v => setForm(f => ({ ...f, status: v }))}
                    options={STATUS_OPTIONS}
                  />
                </DI>
                <DI label={tr("PRIORITY")}>
                  <div data-mah="task-priority-select">
                    <CustomSelect
                      value={form.priority}
                      onChange={v => setForm(f => ({ ...f, priority: v }))}
                      options={PRIORITIES.map(p => ({ value: p, label: p }))}
                    />
                  </div>
                </DI>
                {boardId && boardLists.length > 0 && (
                  <DI label={tr("CARD")}>
                    <CustomSelect
                      value={resolvedListId}
                      onChange={v => setResolvedListId(v)}
                      placeholder={tr("Select card")}
                      options={boardLists.map(l => ({ value: l.id, label: l.name }))}
                    />
                  </DI>
                )}
                {boardId && (
                  <DI label={tr("ACHARYA")}>
                    <AcharyaPicker
                      value={acharyaId}
                      onChange={setAcharyaId}
                      label=""
                    />
                  </DI>
                )}
                <DI label={tr("MISSION")}>
                  <CustomSelect
                    value={form.mission_id}
                    onChange={v => setForm(f => ({ ...f, mission_id: v }))}
                    placeholder={tr("Project default")}
                    options={[{ value: "", label: "Project default" }, ...missions.map(m => ({ value: m.id, label: m.name_en }))]}
                  />
                </DI>
                <DI label={tr("MISSION IMPACT")}>
                  <input
                    value={form.mission_impact}
                    onChange={e => setForm(f => ({ ...f, mission_impact: e.target.value }))}
                    placeholder={tr("How does this impact mission?")}
                    style={dateInputStyle}
                  />
                </DI>
              </div>
            </section>

            <section style={{ marginTop: 20 }}>
              <SectionTitle>{tr("Man Power Details")}</SectionTitle>
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "minmax(0, 1fr) minmax(0, 1fr)", gap: "12px 24px" }}>
                <DI label={tr("ASSIGNED TO")}>
                  <div data-mah="task-assignee-select">
                    <MemberMultiSelect
                      value={form.assignee_ids}
                      onChange={v => setForm(f => ({ ...f, assignee_ids: v }))}
                      placeholder={tr("Unassigned")}
                      options={users}
                    />
                  </div>
                </DI>
                <DI label={tr("ASSIGN DATE")}>
                  <DatePicker
                    value={form.assigned_on}
                    onChange={(v) => setForm((f) => ({ ...f, assigned_on: v }))}
                    placeholder="dd-mm-yyyy"
                  />
                </DI>
                <DI label={tr("ASSIGNED BY")}>
                  <ReadOnlyField value={currentUserName || "---"} />
                </DI>
                <DI label={tr("DEADLINE DATE")}>
                  <DatePicker
                    data-mah="task-due-date-input"
                    value={form.due_date}
                    onChange={(v) => setForm((f) => ({ ...f, due_date: v }))}
                    placeholder="dd-mm-yyyy"
                    recurring={{
                      value: form.recurring,
                      days: form.recurring_days,
                      weekdayStarts: form.recurring_weekday_starts,
                      onChange: (recurring, recurring_days, weekdayStarts) =>
                        setForm((f) => ({
                          ...f,
                          recurring,
                          recurring_days: Array.isArray(recurring_days) ? recurring_days : [],
                          recurring_weekday_starts: weekdayStarts || {},
                        })),
                    }}
                  />
                </DI>
                <DI label={tr("CREATED")}>
                  <ReadOnlyField value={fmtDate(todayIso())} />
                </DI>
                <DI
                  label={tr("SESSIONS (45 MIN EACH)")}
                  info="Set sessions first, then assign each subtask to a session below."
                >
                  <input
                    type="number"
                    min={1}
                    max={8}
                    value={form.session_count}
                    onChange={(e) => {
                      const next = e.target.value;
                      const maxSlots = Math.max(1, Math.min(8, Math.floor(Number(next) || 1)));
                      setForm((f) => ({ ...f, session_count: next, session_count_auto: false }));
                      setDraftSubtasks((prev) =>
                        prev.map((item) => ({
                          ...item,
                          session_slot: Math.min(item.session_slot || 1, maxSlots),
                        })),
                      );
                    }}
                    style={dateInputStyle}
                  />
                </DI>
                <DI
                  label={<ExtraBreaksLabel />}
                  info="Voluntary breaks shared across all sessions. The break between sessions is automatic and doesn’t count."
                  infoAtEnd
                >
                  <input
                    type="number"
                    min={0}
                    max={20}
                    value={form.break_allowance_total}
                    onChange={e => setForm(f => ({ ...f, break_allowance_total: e.target.value }))}
                    style={dateInputStyle}
                  />
                </DI>
              </div>
            </section>

            <section style={{ marginTop: 20 }}>
              <div style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
                marginBottom: 8,
              }}>
                <SectionTitle inline>{tr("Subtasks")}</SectionTitle>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                  {(Number(form.session_count) || 0) >= 1 && (
                    <button
                      type="button"
                      onClick={() => setSubtaskAddOpen(true)}
                      style={addSubtaskTriggerStyle}
                    >
                      {tr("+ Add subtask")}
                    </button>
                  )}
                  <SubtaskTemplateMenu
                    boardId={labelBoardId || null}
                    canEdit
                    draftItems={draftSubtasks}
                    onDraftChange={setDraftSubtasks}
                    taskSessionCount={Number(form.session_count) || 1}
                  />
                </div>
              </div>
              {(Number(form.session_count) || 0) < 1 ? (
                <div style={{ fontSize: 13, color: "var(--ink-mute)", padding: "4px 0 10px" }}>
                  {tr("Set Sessions above to add subtasks.")}
                </div>
              ) : (
                <TaskChecklistDraft
                  items={draftSubtasks}
                  onChange={setDraftSubtasks}
                  taskSessionCount={Number(form.session_count) || 1}
                  hideAddTrigger
                  addOpen={subtaskAddOpen}
                  onAddOpenChange={setSubtaskAddOpen}
                />
              )}
            </section>

              {/* Divider between Subtasks and Files */}
              <div
                role="separator"
                aria-hidden
                style={{
                  height: 1,
                  background: "var(--rule)",
                  margin: "8px 0 4px",
                  flexShrink: 0,
                }}
              />

              {/* Files — staged until Create Task (same as Simple Task) */}
              <AccordionSection
                title={<>{tr("Files")} <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-mute)", marginLeft: 4 }}>({pendingFiles.length})</span></>}
                actions={
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      style={{ display: "none" }}
                      onChange={(e) => {
                        const list = e.target.files;
                        if (!list) return;
                        setPendingFiles((prev) => [
                          ...prev,
                          ...Array.from(list).map((file) => ({
                            key: `${file.name}-${file.size}-${file.lastModified}-${Math.random()}`,
                            file,
                          })),
                        ]);
                        e.target.value = "";
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      style={addBtnSmStyle}
                    >
                      {tr("+ Add File")}
                    </button>
                  </div>
                }
              >
                {pendingFiles.length === 0 ? (
                  <div style={{ fontSize: 13, color: "var(--ink-mute)", padding: "4px 0" }}>{tr("No files attached yet")}</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {pendingFiles.map((pf) => (
                      <div key={pf.key} style={fileRowStyle}>
                        <div style={fileThumbBtnStyle}>
                          <span style={fileThumbExtStyle}>
                            {(pf.file.name.split(".").pop() || "FILE").toUpperCase().slice(0, 4)}
                          </span>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={fileNameStyle}>{pf.file.name}</div>
                          <div style={fileMetaStyle}>
                            {tr("Pending upload")}
                            <span style={{ opacity: 0.55 }}> · </span>
                            {fmtSize(pf.file.size)}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setPendingFiles((prev) => prev.filter((x) => x.key !== pf.key))}
                          style={textBtnStyle}
                        >
                          {tr("Remove")}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </AccordionSection>
          </div>

          {/* RIGHT — Comments & Notes */}
          <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
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
                onClick={() => setCommentsOpen((o) => !o)}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  background: "none", border: "none", padding: 0,
                  cursor: "pointer", color: "inherit", fontFamily: "inherit",
                  textAlign: "left",
                }}
              >
                <span style={{ fontFamily: "var(--serif)", fontSize: 14, color: "var(--ink)", fontWeight: 400 }}>
                  {tr("Comments & Notes")}
                </span>
                <ChevronIcon open={commentsOpen} />
              </button>
            </div>
            <div style={{
              display: "grid",
              gridTemplateRows: commentsOpen ? "1fr" : "0fr",
              transition: "grid-template-rows 0.22s ease",
            }}>
              <div style={{ overflow: "hidden" }}>
                <CommentComposer
                  value={createComment}
                  onChange={setCreateComment}
                  attachments={createCommentAtts}
                  onAttachmentsChange={setCreateCommentAtts}
                  insertMarkdownRefs={false}
                  stageDocuments
                  onSubmit={() => {}}
                  onCancel={() => {
                    setCreateComment(COMMENT_EMPTY_DOC);
                    setCreateCommentAtts([]);
                  }}
                  posting={false}
                  error=""
                  submitLabel={tr("Add comment")}
                  fetchMentions={mentionBoardId ? fetchBoardMentions : undefined}
                />
                <p style={{
                  margin: "8px 0 0",
                  fontSize: 12,
                  lineHeight: 1.4,
                  color: "var(--ink-mute)",
                }}>
                  {tr("Comments are posted only after you click")} <strong style={{ fontWeight: 600, color: "var(--ink-soft)" }}>{tr("Create Task")}</strong>{tr(". If you cancel or close without creating, this draft will not be saved.")}
                </p>
              </div>
            </div>
          </div>
        </div>
        </div>

        {/* Footer — static flex sibling below the scroll area (not sticky
            inside it), so it never overlaps the last scrolled field. */}
        <div style={{
          display: "flex", gap: 8, justifyContent: "flex-end", alignItems: "center",
          flexShrink: 0,
          background: "var(--surface)", borderTop: "1px solid var(--rule)",
          padding: "14px 24px",
        }}>
          {/* Already on a board — project setup is redundant. Keep for lead/destination flows. */}
          {(!boardId || pickDestination) ? (
            <button
              type="button"
              onClick={() => setProjectSetupOpen(true)}
              style={{ ...projectSetupGhostStyle, marginRight: "auto" }}
            >
              {tr("Need a project? Set one up")}
            </button>
          ) : (
            <div style={{ marginRight: "auto" }} />
          )}
          {isGuided && !saving && (
            <span style={guidedSaveHintStyle}>{tr("Review and tap Create Task")}</span>
          )}
          <button onClick={attemptClose} style={cancelBtnStyle}>{tr("Cancel")}</button>
          <button data-mah="task-save-btn" onClick={handleCreate} disabled={saving} style={saveBtnStyle}>
            {saving ? tr("Creating...") : tr("Create Task")}
          </button>
        </div>
      </div>

      <ProjectSetupModal open={projectSetupOpen} onClose={() => setProjectSetupOpen(false)} />

      <ConfirmDialog
        open={confirmCloseOpen}
        title={tr("Discard this task?")}
        description="Your changes will be lost."
        confirmLabel={tr("Discard")}
        cancelLabel={tr("Keep editing")}
        confirmTone="danger"
        onCancel={() => setConfirmCloseOpen(false)}
        onConfirm={() => { setConfirmCloseOpen(false); onClose(); }}
      />

      <ConfirmDialog
        open={mediaProvisionNotice !== null}
        title={tr("Media workspace ready")}
        description={
          mediaProvisionNotice && mediaProvisionNotice.added.length > 0
            ? `OmniStudio chat linked under this board's Studio project. Also added: ${mediaProvisionNotice.added.join(", ")}.`
            : "OmniStudio chat linked under this board's Studio project."
        }
        confirmLabel={tr("OK")}
        cancelLabel={tr("Close")}
        onCancel={finishAfterMediaNotice}
        onConfirm={finishAfterMediaNotice}
      />
    </div>
  );
}

function SectionTitle({ children, inline }: { children: React.ReactNode; inline?: boolean }) {
  return (
    <h3 style={{
      fontFamily: "var(--serif)", fontSize: 14, margin: 0,
      marginBottom: inline ? 0 : 8, color: "var(--ink)",
    }}>{children}</h3>
  );
}

function ReadOnlyField({ value }: { value: ReactNode }) {
  return (
    <div style={readOnlyFieldStyle}>{value}</div>
  );
}

function ExtraBreaksLabel() {
  const tr = useTr();
  const wordGap: CSSProperties = { width: 3, flexShrink: 0 };
  const dot: CSSProperties = { margin: "0 2px", letterSpacing: 0 };
  return (
    <span style={{ display: "inline-flex", alignItems: "baseline", whiteSpace: "nowrap", letterSpacing: 0 }}>
      <span>{tr("EXTRA")}</span>
      <span style={wordGap} />
      <span>{tr("BREAKS")}</span>
      <span style={dot} aria-hidden>·</span>
      <span>{tr("WHOLE")}</span>
      <span style={wordGap} />
      <span>{tr("TASK")}</span>
      <span style={dot} aria-hidden>·</span>
      <span>{tr("default:")}</span>
      <span>1</span>
    </span>
  );
}

function DI({
  label,
  children,
  info,
  infoAtEnd,
}: {
  label: ReactNode;
  children: ReactNode;
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
          color: "var(--ink-mute)",
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
        {info ? <FieldInfoTip text={info} /> : null}
      </div>
      <div style={{ fontSize: 13, color: "var(--ink)", minWidth: 0 }}>{children}</div>
    </div>
  );
}

// Solid priority chip — matches board / task modal (LOW MED HIGH URG).
const PRIORITY_BADGE: Record<string, { label: string; bg: string; fg: string }> = {
  low:    { label: "LOW",  bg: "#7cb342", fg: "#ffffff" },
  medium: { label: "MED",  bg: "#c9a227", fg: "#ffffff" },
  high:   { label: "HIGH", bg: "#f09020", fg: "#ffffff" },
  urgent: { label: "URG",  bg: "#e53935", fg: "#ffffff" },
};

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


const dateInputStyle: CSSProperties = {
  width: "100%", padding: "7px 9px", fontSize: 12,
  background: "var(--page)", color: "var(--ink-soft)",
  border: "1px solid var(--rule-strong)", borderRadius: "var(--r-sm)",
  fontFamily: "var(--sans)",
};

function FieldInfoTip({ text }: { text: string }) {
  const tr = useTr();
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
        aria-label={tr("Field info")}
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
  width: "100%", padding: "7px 9px", fontSize: 12,
  background: "var(--page)", color: "var(--ink-soft)",
  border: "1px solid var(--rule-strong)", borderRadius: "var(--r-sm)",
  fontFamily: "var(--sans)",
  minHeight: 32, display: "flex", alignItems: "center",
};
const saveBtnStyle: CSSProperties = { padding: "8px 20px", fontSize: 12, fontWeight: 500, background: "var(--green-deep)", color: "var(--surface)", borderWidth: 1, borderStyle: "solid", borderColor: "var(--green-deep)", borderRadius: "var(--r-sm)", cursor: "pointer", fontFamily: "var(--sans)" };
const cancelBtnStyle: CSSProperties = { padding: "8px 14px", fontSize: 12, fontWeight: 500, background: "var(--surface)", color: "var(--ink-soft)", border: "1px solid var(--rule-strong)", borderRadius: "var(--r-sm)", cursor: "pointer", fontFamily: "var(--sans)" };
const projectSetupGhostStyle: CSSProperties = { padding: "8px 12px", fontSize: 12, fontWeight: 500, background: "transparent", color: "var(--green-deep)", border: "none", borderRadius: "var(--r-sm)", cursor: "pointer", fontFamily: "var(--sans)" };
const guidedSaveHintStyle: CSSProperties = { fontFamily: "var(--sans)", fontSize: 12, color: "var(--green-deep)", fontWeight: 500, marginRight: 4 };

const addBtnSmStyle: CSSProperties = {
  padding: "6px 12px",
  fontSize: 12,
  fontWeight: 500,
  background: "var(--green-deep)",
  color: "#f4efdf",
  border: "1px solid var(--green-deep)",
  borderRadius: "var(--r-sm)",
  cursor: "pointer",
  fontFamily: "var(--sans)",
};

const textBtnStyle: CSSProperties = {
  border: "none",
  background: "transparent",
  color: "var(--crit)",
  fontSize: 12,
  cursor: "pointer",
  fontFamily: "var(--sans)",
  flexShrink: 0,
};

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
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
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

function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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

function AccordionSection({
  title,
  children,
  defaultOpen = true,
  actions,
}: {
  title: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  actions?: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();
  const headerId = `${panelId}h`;

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
          onClick={() => setOpen((o) => !o)}
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
        {actions != null ? <div style={{ flexShrink: 0 }}>{actions}</div> : null}
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

