"use client";

import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { ConfirmDialog } from "@/components/omnidel/confirm-dialog";
import { CustomSelect } from "@/components/omnidel/custom-select";
import { useTr } from "@/lib/client/language";

export interface ChecklistItem {
  id: string;
  task_id: string;
  title: string;
  is_done: boolean;
  sort_order: number;
  session_count: number;
  session_slot: number;
  sessions_completed: number;
  status: "pending" | "active" | "completed";
  started_at: string | null;
  completed_at: string | null;
  break_allowance_per_segment: number[];
  created_on: string;
}

interface TaskAttemptSummary {
  id: string;
  status: "running" | "paused" | "finished" | "expired" | "abandoned";
  segment_index: number;
  checklist_item_id: string | null;
  paused_remaining_seconds?: number | null;
}

export interface DraftChecklistItem {
  id: string;
  title: string;
  is_done: boolean;
  session_count: number;
  /** Which task session (1..N) this subtask belongs to. */
  session_slot: number;
  break_allowance_per_segment: number[];
}

const SESSION_COUNT_MAX = 8;

function coerceSessionSlot(raw: unknown, maxSlots = SESSION_COUNT_MAX, fallback = 1): number {
  const parsed = Math.floor(Number(raw));
  if (!Number.isFinite(parsed)) return Math.min(maxSlots, Math.max(1, fallback));
  return Math.min(maxSlots, Math.max(1, parsed));
}

function defaultTiming(sessionSlot = 1): Pick<DraftChecklistItem, "session_count" | "session_slot" | "break_allowance_per_segment"> {
  return { session_count: 1, session_slot: coerceSessionSlot(sessionSlot), break_allowance_per_segment: [1] };
}

function normalizeRequiredSessions(raw: unknown): number {
  const parsed = Math.floor(Number(raw) || 1);
  return Math.min(SESSION_COUNT_MAX, Math.max(1, parsed));
}

function normalizeCompletedSessions(raw: unknown, required: number): number {
  return Math.min(required, Math.max(0, Math.floor(Number(raw) || 0)));
}

function normalizeItemTiming(item: Partial<DraftChecklistItem>): Pick<DraftChecklistItem, "session_count" | "break_allowance_per_segment"> {
  const session_count = normalizeRequiredSessions(item.session_count);
  return { session_count, break_allowance_per_segment: Array(session_count).fill(1) };
}

function normalizeChecklistItem(row: ChecklistItem): ChecklistItem {
  const session_count = normalizeRequiredSessions(row.session_count);
  const sessions_completed = normalizeCompletedSessions(row.sessions_completed, session_count);
  // status/is_done are server-authoritative — a reopened-full subtask (sessions
  // preserved) has sessions_completed >= session_count while the server says
  // it's not done anymore, so the sessions heuristic must not override that.
  const isCompleted = row.is_done === false ? false : row.status === "completed" || row.is_done;
  return {
    ...row,
    session_count,
    session_slot: coerceSessionSlot(row.session_slot),
    sessions_completed: isCompleted ? session_count : sessions_completed,
    status: isCompleted ? "completed" : row.status,
    is_done: isCompleted,
    break_allowance_per_segment: Array.isArray(row.break_allowance_per_segment)
      ? row.break_allowance_per_segment.slice(0, session_count)
      : Array(session_count).fill(1),
  };
}

export function fmtSessionDuration(sessionCount: number): string {
  const totalMinutes = normalizeRequiredSessions(sessionCount) * 45;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h`;
  return `${minutes}m`;
}

export function computeChecklistTimingRollup(items: { session_count: number }[]) {
  const total_sessions = items.reduce((sum, i) => sum + normalizeRequiredSessions(i.session_count), 0);
  const total_planned_seconds = total_sessions * 45 * 60;
  return { total_sessions, total_planned_seconds, subtask_count: items.length };
}

interface Props {
  taskId: string;
  canEdit: boolean;
  canManage?: boolean;
  taskSessionCount?: number;
  refreshToken?: number;
  onProgressChange?: (checked: number, total: number) => void;
  onSubtaskCountChange?: (count: number) => void;
  onTimingRollupChange?: (rollup: ReturnType<typeof computeChecklistTimingRollup> | null) => void;
  /** Hide the footer "+ Add subtask" (parent places it in the section header). */
  hideAddTrigger?: boolean;
  addOpen?: boolean;
  onAddOpenChange?: (open: boolean) => void;
}

interface DraftProps {
  items: DraftChecklistItem[];
  onChange: (items: DraftChecklistItem[]) => void;
  taskSessionCount?: number;
  /** Hide the footer "+ Add subtask" (parent places it in the section header). */
  hideAddTrigger?: boolean;
  addOpen?: boolean;
  onAddOpenChange?: (open: boolean) => void;
}

function progressFromItems(items: Array<{ is_done: boolean; status?: string; session_count?: number; sessions_completed?: number }>) {
  const total = items.length;
  const checked = items.filter((item) => item.status === "completed" || item.is_done).length;
  return { total, checked };
}

function newDraftId() {
  return `draft-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Build draft checklist rows from a board subtask template. */
export function draftItemsFromTemplateSteps(
  steps: Array<{ title: string; session_count?: number; session_slot?: number }>,
  maxSlots = SESSION_COUNT_MAX,
): DraftChecklistItem[] {
  const out: DraftChecklistItem[] = [];
  for (const step of steps) {
    const title = (step.title || "").trim();
    if (!title) continue;
    const session_count = Math.min(8, Math.max(1, Math.floor(Number(step.session_count) || 1)));
    out.push({
      id: newDraftId(),
      title,
      is_done: false,
      session_count,
      session_slot: coerceSessionSlot(step.session_slot, maxSlots, 1),
      break_allowance_per_segment: Array(session_count).fill(1),
    });
  }
  return out;
}

export async function saveDraftChecklistItems(taskId: string, items: DraftChecklistItem[]) {
  for (const item of items) {
    const timing = normalizeItemTiming(item);
    const res = await fetch(`/api/omnipulse/tasks/${taskId}/checklist`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: item.title,
        is_done: item.is_done,
        session_count: timing.session_count,
        session_slot: coerceSessionSlot(item.session_slot),
        break_allowance_per_segment: timing.break_allowance_per_segment,
      }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      throw new Error(d.error || "Failed to save subtask");
    }
  }
}

function ChecklistProgressBar({ checked, total }: { checked: number; total: number }) {
  if (total === 0) return null;
  const pct = Math.round((checked / total) * 100);
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-mute)" }}>
          {checked}/{total} complete
        </span>
        <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-mute)" }}>{pct}%</span>
      </div>
      <div style={{ height: 6, borderRadius: 999, background: "var(--surface-sunk)", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: "var(--ok)", borderRadius: 999, transition: "width 200ms ease" }} />
      </div>
    </div>
  );
}

function AllocationFooter({ items, taskSessionCount }: { items: { session_slot?: number; session_count?: number }[]; taskSessionCount?: number }) {
  const tr = useTr();
  if (items.length === 0) return null;
  const slots = new Set(items.map((i) => coerceSessionSlot(i.session_slot)));
  const taskSessions = Math.max(1, Number(taskSessionCount) || 1);
  return (
    <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-mute)", marginTop: 10 }}>
      {items.length} subtask{items.length === 1 ? "" : "s"} across {slots.size} {tr("session slot")}{slots.size === 1 ? "" : "s"}
      {taskSessionCount ? ` · task has ${taskSessions} session${taskSessions === 1 ? "" : "s"} · ${fmtSessionDuration(taskSessions)}` : ""}
    </div>
  );
}

function ChecklistCheckbox({ checked, disabled, onToggle }: { checked: boolean; disabled?: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      aria-label={checked ? "Marked complete" : "Mark complete"}
      disabled={disabled}
      onClick={onToggle}
      style={{
        flexShrink: 0,
        width: 16,
        height: 16,
        padding: 0,
        borderRadius: "var(--r-sm)",
        border: `1.5px solid ${checked ? "var(--green-deep)" : "var(--rule-strong)"}`,
        background: checked ? "var(--green-deep)" : "transparent",
        cursor: disabled ? "default" : "pointer",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        opacity: disabled ? 0.5 : 1,
        transition: "background 130ms ease, border-color 130ms ease",
      }}
    >
      {checked && (
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#f4efdf" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      )}
    </button>
  );
}

function PencilIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

function sessionSlotOptions(maxSessions: number) {
  return Array.from({ length: Math.max(1, maxSessions) }, (_, i) => {
    const n = i + 1;
    return { value: String(n), label: `Session ${n}` };
  });
}

function SessionSlotSelect({
  value,
  maxSessions,
  disabled,
  onChange,
  "aria-label": ariaLabel = "Session for this subtask",
}: {
  value: number;
  maxSessions: number;
  disabled?: boolean;
  onChange: (slot: number) => void;
  "aria-label"?: string;
}) {
  const slots = Math.max(1, maxSessions);
  // Same CustomSelect chrome as Task Type / other OmniDel pickers — not a native
  // <select> (those force the OS blue highlight).
  return (
    <div
      style={{ flexShrink: 0, width: 118 }}
      aria-label={ariaLabel}
    >
      <CustomSelect
        value={String(coerceSessionSlot(value, slots))}
        onChange={(v) => onChange(coerceSessionSlot(v, slots))}
        options={sessionSlotOptions(slots)}
        disabled={disabled}
        minWidth={118}
        dropdownMinWidth={118}
        style={{
          background: "var(--page)",
          border: "1px solid var(--rule-strong)",
          borderRadius: "var(--r-sm)",
          color: "var(--ink-soft)",
          fontSize: 12,
          fontFamily: "var(--sans)",
          padding: "6px 28px 6px 10px",
        }}
      />
    </div>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function SubtaskRow({
  item,
  maxSessions,
  canEdit,
  busy,
  liveState,
  isEditing,
  editTitle,
  onToggle,
  onStartEdit,
  onEditChange,
  onEditCommit,
  onEditCancel,
  onSessionSlotChange,
  onDelete,
}: {
  item: ChecklistItem;
  maxSessions: number;
  canEdit: boolean;
  busy?: boolean;
  liveState?: "in_progress" | "on_break" | null;
  isEditing: boolean;
  editTitle: string;
  onToggle: () => void;
  onStartEdit: () => void;
  onEditChange: (v: string) => void;
  onEditCommit: () => void;
  onEditCancel: () => void;
  onSessionSlotChange: (slot: number) => void;
  onDelete: () => void;
}) {
  const tr = useTr();
  const slot = coerceSessionSlot(item.session_slot, maxSessions);
  const isCompleted = item.status === "completed" || item.is_done;
  const stateLabel = liveState === "on_break" ? "On break" : liveState === "in_progress" ? "In progress" : null;

  return (
    <div style={{ padding: "8px 4px", borderBottom: "1px solid var(--rule)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <ChecklistCheckbox checked={isCompleted} disabled={!canEdit || busy || isCompleted} onToggle={onToggle} />
        <div style={{ flex: 1, minWidth: 0 }}>
          {isEditing ? (
            <input
              autoFocus
              value={editTitle}
              onChange={(e) => onEditChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onEditCommit();
                if (e.key === "Escape") onEditCancel();
              }}
              style={editInputStyle}
            />
          ) : (
            <span
              title={item.title}
              style={{
                ...titleTextStyle,
                textDecoration: isCompleted ? "line-through" : "none",
                color: isCompleted ? "var(--ink-mute)" : "var(--ink)",
              }}
            >
              {item.title}
            </span>
          )}
        </div>
        {canEdit ? (
          <SessionSlotSelect
            value={slot}
            maxSessions={maxSessions}
            disabled={busy}
            onChange={onSessionSlotChange}
          />
        ) : (
          <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-mute)", flexShrink: 0, whiteSpace: "nowrap" }}>
            {tr("Session")} {slot}
          </span>
        )}
        {canEdit && (
          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
            {isEditing ? (
              <button type="button" aria-label={tr("Save")} title={tr("Save")} onClick={onEditCommit} disabled={busy} style={saveBtnStyle}>
                <CheckIcon />
              </button>
            ) : (
              <button type="button" aria-label={`Rename ${item.title}`} title={tr("Rename")} onClick={onStartEdit} disabled={busy} style={editBtnStyle}>
                <PencilIcon />
              </button>
            )}
            <button
              type="button"
              aria-label={`Delete ${item.title}`}
              title={tr("Delete")}
              onClick={onDelete}
              disabled={busy}
              style={deleteBtnStyle}
              onMouseEnter={(e) => { e.currentTarget.style.background = "var(--crit)"; e.currentTarget.style.color = "#fff"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "var(--crit-wash)"; e.currentTarget.style.color = "var(--crit)"; }}
            >
              <TrashIcon />
            </button>
          </div>
        )}
      </div>
      {stateLabel && (
        <div style={{ marginTop: 6, marginLeft: 26, fontFamily: "var(--mono)", fontSize: 11, color: isCompleted ? "var(--ink-mute)" : liveState === "on_break" ? "var(--ochre)" : "var(--green-deep)" }}>
          {stateLabel}
        </div>
      )}
    </div>
  );
}

function AddSubtask({
  onAdd,
  busy,
  onOpenChange,
  maxSlots = 1,
  hideTrigger = false,
  open: openProp,
}: {
  onAdd: (title: string, sessionSlot: number) => void;
  busy?: boolean;
  onOpenChange?: (open: boolean) => void;
  maxSlots?: number;
  hideTrigger?: boolean;
  open?: boolean;
}) {
  const tr = useTr();
  const [internalOpen, setInternalOpen] = useState(false);
  const controlled = openProp !== undefined;
  const open = controlled ? openProp : internalOpen;
  const setOpen = (v: boolean) => {
    if (!controlled) setInternalOpen(v);
    onOpenChange?.(v);
  };
  const [title, setTitle] = useState("");
  const [sessionSlot, setSessionSlot] = useState(1);
  const slots = Math.max(1, Math.min(SESSION_COUNT_MAX, Math.floor(Number(maxSlots) || 1)));
  const canSubmit = !!title.trim() && !busy;
  const submit = () => {
    if (!canSubmit) return;
    onAdd(title.trim(), coerceSessionSlot(sessionSlot, slots));
    setTitle("");
    setSessionSlot(1);
    setOpen(false);
  };
  const cancel = () => {
    setTitle("");
    setSessionSlot(1);
    setOpen(false);
  };

  if (!open) {
    if (hideTrigger) return null;
    return (
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
        <button type="button" onClick={() => setOpen(true)} style={addSubtaskTriggerStyle}>{tr("+ Add subtask")}</button>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "stretch" }}>
        <input
          autoFocus
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
            if (e.key === "Escape") cancel();
          }}
          placeholder={tr("Subtask name...")}
          style={{ ...addInputStyle, flex: 1 }}
        />
        <SessionSlotSelect
          value={coerceSessionSlot(sessionSlot, slots)}
          maxSessions={slots}
          disabled={busy}
          onChange={setSessionSlot}
        />
      </div>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button type="button" onClick={submit} disabled={!canSubmit} style={addBtnPrimary}>
          {tr("Add")}
        </button>
        <button type="button" onClick={cancel} style={addBtnGhost}>{tr("Cancel")}</button>
      </div>
    </div>
  );
}

function notifyRollup(items: { session_count: number }[], cb?: (r: ReturnType<typeof computeChecklistTimingRollup> | null) => void) {
  cb?.(items.length > 0 ? computeChecklistTimingRollup(items) : null);
}

export function TaskChecklist({
  taskId,
  canEdit,
  canManage = false,
  taskSessionCount,
  refreshToken,
  onProgressChange,
  onSubtaskCountChange,
  onTimingRollupChange,
  hideAddTrigger = false,
  addOpen: addOpenProp,
  onAddOpenChange,
}: Props) {
  const tr = useTr();
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<ChecklistItem | null>(null);
  const [reopenTarget, setReopenTarget] = useState<ChecklistItem | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [activeAttempt, setActiveAttempt] = useState<TaskAttemptSummary | null>(null);
  const [addOpenInternal, setAddOpenInternal] = useState(false);
  const addOpen = addOpenProp ?? addOpenInternal;
  const setAddOpen = (v: boolean) => {
    if (addOpenProp === undefined) setAddOpenInternal(v);
    onAddOpenChange?.(v);
  };

  const fetchItems = useCallback(() => {
    setLoading(true);
    const maxSlots = Math.max(1, Number(taskSessionCount) || 1);
    return fetch(`/api/omnipulse/tasks/${taskId}/checklist`)
      .then(async (r) => {
        if (!r.ok) {
          const d = await r.json().catch(() => ({}));
          throw new Error(d.error || "Failed to load subtasks");
        }
        return r.json();
      })
      .then(async (d) => {
        const next: ChecklistItem[] = (d.items || []).map((row: ChecklistItem) => normalizeChecklistItem(row));
        const over = next.filter((i) => coerceSessionSlot(i.session_slot) > maxSlots);
        for (const item of over) {
          const slot = coerceSessionSlot(item.session_slot, maxSlots);
          await fetch(`/api/omnipulse/tasks/${taskId}/checklist/${item.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ session_slot: slot }),
          });
          item.session_slot = slot;
        }
        const normalized = next.map((row) =>
          normalizeChecklistItem({ ...row, session_slot: coerceSessionSlot(row.session_slot, maxSlots) }),
        );
        setItems(normalized);
        const { checked, total } = progressFromItems(normalized);
        onProgressChange?.(checked, total);
        onSubtaskCountChange?.(normalized.length);
        notifyRollup(normalized, onTimingRollupChange);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load subtasks"))
      .finally(() => setLoading(false));
  }, [taskId, taskSessionCount, onProgressChange, onSubtaskCountChange, onTimingRollupChange]);

  useEffect(() => {
    void fetchItems();
  }, [fetchItems, refreshToken]);

  const fetchActiveAttempt = useCallback(async () => {
    try {
      const res = await fetch(`/api/omnipulse/tasks/${taskId}/attempts`);
      if (!res.ok) return;
      const data = await res.json();
      const attempts: TaskAttemptSummary[] = Array.isArray(data.items) ? data.items : [];
      const next = attempts.find((attempt) => attempt.status === "running" || attempt.status === "paused") || null;
      setActiveAttempt(next);
    } catch {
      // Non-fatal: checklist UI should still render without live attempt state.
    }
  }, [taskId]);

  useEffect(() => {
    void fetchActiveAttempt();
    const id = window.setInterval(() => { void fetchActiveAttempt(); }, 15000);
    return () => window.clearInterval(id);
  }, [fetchActiveAttempt, refreshToken]);

  async function patchDone(item: ChecklistItem, done: boolean) {
    setBusyId(item.id);
    setError("");
    const res = await fetch(`/api/omnipulse/tasks/${taskId}/checklist/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_done: done }),
    });
    setBusyId(null);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error || "Failed to update subtask");
      return;
    }
    await fetchItems();
  }

  function toggleDone(item: ChecklistItem) {
    if (!canEdit || busyId === item.id) return;
    const completed = item.status === "completed" || item.is_done;
    if (completed && !canManage) return;
    if (completed) {
      setReopenTarget(item);
      return;
    }
    void patchDone(item, true);
  }

  async function confirmReopen() {
    if (!reopenTarget) return;
    const target = reopenTarget;
    setReopenTarget(null);
    await patchDone(target, false);
  }

  async function saveSessionSlot(item: ChecklistItem, sessionSlot: number) {
    if (!canEdit || busyId === item.id) return;
    const slot = coerceSessionSlot(sessionSlot, Number(taskSessionCount) || SESSION_COUNT_MAX);
    setItems((prev) => prev.map((i) => (i.id === item.id ? normalizeChecklistItem({ ...i, session_slot: slot }) : i)));
    setBusyId(item.id);
    setError("");
    const res = await fetch(`/api/omnipulse/tasks/${taskId}/checklist/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_slot: slot }),
    });
    setBusyId(null);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error || "Failed to update session");
      await fetchItems();
      return;
    }
    await fetchItems();
  }

  async function addItem(title: string, sessionSlot: number) {
    const t = title.trim();
    if (!t || adding) return;
    setAdding(true);
    setError("");
    const res = await fetch(`/api/omnipulse/tasks/${taskId}/checklist`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: t,
        session_count: 1,
        session_slot: coerceSessionSlot(sessionSlot, Number(taskSessionCount) || 1),
      }),
    });
    setAdding(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error || "Failed to add subtask");
      return;
    }
    await fetchItems();
  }

  async function saveEdit(item: ChecklistItem) {
    const title = editTitle.trim();
    setEditingId(null);
    if (!title || title === item.title) return;
    setBusyId(item.id);
    setError("");
    const res = await fetch(`/api/omnipulse/tasks/${taskId}/checklist/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    setBusyId(null);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error || "Failed to update subtask");
      return;
    }
    await fetchItems();
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleteTarget(null);
    setBusyId(target.id);
    setError("");
    const res = await fetch(`/api/omnipulse/tasks/${taskId}/checklist/${target.id}`, { method: "DELETE" });
    setBusyId(null);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error || "Failed to delete subtask");
      return;
    }
    await fetchItems();
  }

  const { checked, total } = progressFromItems(items);
  if (loading) return <div style={{ fontSize: 13, color: "var(--ink-mute)", padding: "4px 0" }}>{tr("Loading subtasks…")}</div>;

  return (
    <div>
      <ChecklistProgressBar checked={checked} total={total} />
      {error && <div style={{ color: "var(--crit)", fontSize: 12, marginBottom: 10 }}>{error}</div>}

      {items.length === 0 ? (
        addOpen ? null : (
          <div style={{ fontSize: 13, color: "var(--ink-mute)", padding: "4px 0 10px" }}>{tr("No subtasks yet")}</div>
        )
      ) : (
        <div style={{ display: "grid", gap: 2, marginBottom: canEdit ? 10 : 0 }}>
          {items.map((item) => (
            <SubtaskRow
              key={item.id}
              item={item}
              maxSessions={Math.max(1, Number(taskSessionCount) || 1)}
              canEdit={canEdit}
              busy={busyId === item.id}
              liveState={
                activeAttempt?.checklist_item_id === item.id
                  ? activeAttempt.status === "paused"
                    ? "on_break"
                    : activeAttempt.status === "running"
                      ? "in_progress"
                      : null
                  : null
              }
              isEditing={editingId === item.id}
              editTitle={editTitle}
              onToggle={() => toggleDone(item)}
              onStartEdit={() => { if (canEdit) { setEditingId(item.id); setEditTitle(item.title); } }}
              onEditChange={setEditTitle}
              onEditCommit={() => { void saveEdit(item); }}
              onEditCancel={() => setEditingId(null)}
              onSessionSlotChange={(slot) => { void saveSessionSlot(item, slot); }}
              onDelete={() => setDeleteTarget(item)}
            />
          ))}
        </div>
      )}

      {canEdit && (
        <AddSubtask
          onAdd={(t, slot) => { void addItem(t, slot); }}
          busy={adding}
          open={addOpen}
          onOpenChange={setAddOpen}
          hideTrigger={hideAddTrigger}
          maxSlots={Math.max(1, Number(taskSessionCount) || 1)}
        />
      )}

      <AllocationFooter items={items} taskSessionCount={taskSessionCount} />

      <ConfirmDialog
        open={!!deleteTarget}
        title={tr("Delete subtask?")}
        description={deleteTarget ? `Remove "${deleteTarget.title}" from this task?` : undefined}
        confirmLabel={tr("Delete")}
        cancelLabel={tr("Cancel")}
        confirmTone="danger"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />

      <ConfirmDialog
        open={!!reopenTarget}
        title={tr("Reopen subtask?")}
        description={reopenTarget ? `Reopen "${reopenTarget.title}"? Its completed sessions are kept.` : undefined}
        confirmLabel={tr("Reopen")}
        cancelLabel={tr("Cancel")}
        onCancel={() => setReopenTarget(null)}
        onConfirm={() => { void confirmReopen(); }}
      />
    </div>
  );
}

export function TaskChecklistDraft({
  items,
  onChange,
  taskSessionCount,
  hideAddTrigger = false,
  addOpen: addOpenProp,
  onAddOpenChange,
}: DraftProps) {
  const tr = useTr();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<DraftChecklistItem | null>(null);
  const [addOpenInternal, setAddOpenInternal] = useState(false);
  const addOpen = addOpenProp ?? addOpenInternal;
  const setAddOpen = (v: boolean) => {
    if (addOpenProp === undefined) setAddOpenInternal(v);
    onAddOpenChange?.(v);
  };
  const { checked, total } = progressFromItems(items);
  const maxSlots = Math.max(1, Number(taskSessionCount) || 1);

  useEffect(() => {
    const needsClamp = items.some((i) => coerceSessionSlot(i.session_slot) > maxSlots);
    if (!needsClamp) return;
    onChange(
      items.map((i) => ({
        ...i,
        session_slot: coerceSessionSlot(i.session_slot, maxSlots),
      })),
    );
  }, [maxSlots]); // eslint-disable-line react-hooks/exhaustive-deps -- only when session total changes

  function addItem(title: string, sessionSlot: number) {
    const t = title.trim();
    if (!t) return;
    onChange([
      ...items,
      {
        id: newDraftId(),
        title: t,
        is_done: false,
        ...defaultTiming(coerceSessionSlot(sessionSlot, maxSlots)),
      },
    ]);
  }

  return (
    <div>
      <ChecklistProgressBar checked={checked} total={total} />

      {items.length === 0 ? (
        addOpen ? null : (
          <div style={{ fontSize: 13, color: "var(--ink-mute)", padding: "4px 0 10px" }}>{tr("No subtasks yet")}</div>
        )
      ) : (
        <div style={{ display: "grid", gap: 2, marginBottom: 10 }}>
          {items.map((item) => (
            <SubtaskRow
              key={item.id}
              item={normalizeChecklistItem({
                ...item,
                session_slot: coerceSessionSlot(item.session_slot, maxSlots),
                task_id: "",
                sort_order: 0,
                sessions_completed: item.is_done ? normalizeRequiredSessions(item.session_count) : 0,
                status: item.is_done ? "completed" : "pending",
                started_at: null,
                completed_at: null,
                created_on: "",
              })}
              maxSessions={maxSlots}
              canEdit
              busy={false}
              isEditing={editingId === item.id}
              editTitle={editTitle}
              onToggle={() => onChange(items.map((i) => (i.id === item.id ? { ...i, is_done: true } : i)))}
              onStartEdit={() => { setEditingId(item.id); setEditTitle(item.title); }}
              onEditChange={setEditTitle}
              onEditCommit={() => {
                const t = editTitle.trim();
                setEditingId(null);
                if (t && t !== item.title) onChange(items.map((i) => (i.id === item.id ? { ...i, title: t } : i)));
              }}
              onEditCancel={() => setEditingId(null)}
              onSessionSlotChange={(slot) =>
                onChange(items.map((i) => (i.id === item.id ? { ...i, session_slot: coerceSessionSlot(slot, maxSlots) } : i)))
              }
              onDelete={() => setDeleteTarget(item)}
            />
          ))}
        </div>
      )}

      <AddSubtask
        onAdd={addItem}
        open={addOpen}
        onOpenChange={setAddOpen}
        hideTrigger={hideAddTrigger}
        maxSlots={maxSlots}
      />

      <AllocationFooter items={items} taskSessionCount={taskSessionCount} />

      <ConfirmDialog
        open={!!deleteTarget}
        title={tr("Delete subtask?")}
        description={deleteTarget ? `Remove "${deleteTarget.title}" from this task?` : undefined}
        confirmLabel={tr("Delete")}
        cancelLabel={tr("Cancel")}
        confirmTone="danger"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) onChange(items.filter((i) => i.id !== deleteTarget.id));
          setDeleteTarget(null);
        }}
      />
    </div>
  );
}

const editInputStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
  padding: "4px 8px",
  fontSize: 13,
  fontFamily: "var(--sans)",
  border: "1px solid var(--rule-strong)",
  borderRadius: "var(--r-sm)",
  background: "var(--page)",
  color: "var(--ink)",
};

const titleTextStyle: CSSProperties = {
  display: "block",
  minWidth: 0,
  fontSize: 13,
  fontFamily: "var(--sans)",
  lineHeight: 1.45,
  overflowWrap: "anywhere",
};

const editBtnStyle: CSSProperties = {
  flexShrink: 0,
  width: 26,
  height: 26,
  padding: 0,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  border: "1px solid var(--rule-strong)",
  borderRadius: "var(--r-sm)",
  background: "var(--surface)",
  color: "var(--ink-mute)",
  cursor: "pointer",
  transition: "background 120ms ease, color 120ms ease",
};

const saveBtnStyle: CSSProperties = {
  flexShrink: 0,
  width: 26,
  height: 26,
  padding: 0,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  border: "1px solid var(--green-deep)",
  borderRadius: "var(--r-sm)",
  background: "var(--green-deep)",
  color: "#f4efdf",
  cursor: "pointer",
};

const deleteBtnStyle: CSSProperties = {
  flexShrink: 0,
  width: 26,
  height: 26,
  padding: 0,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  border: "1px solid color-mix(in srgb, var(--crit) 35%, transparent)",
  borderRadius: "var(--r-sm)",
  background: "var(--crit-wash)",
  color: "var(--crit)",
  cursor: "pointer",
  transition: "background 120ms ease, color 120ms ease",
};

const addInputStyle: CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  fontSize: 13,
  fontFamily: "var(--sans)",
  border: "1px solid var(--rule-strong)",
  borderRadius: "var(--r-sm)",
  background: "var(--page)",
  color: "var(--ink)",
  outline: "none",
};

/** Shared style for "+ Add subtask" when placed in a section header. */
export const addSubtaskTriggerStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  padding: "6px 12px",
  border: "1px solid var(--green-deep)",
  borderRadius: "var(--r-sm)",
  background: "var(--surface)",
  color: "var(--green-deep)",
  fontSize: 12.5,
  fontFamily: "var(--sans)",
  fontWeight: 600,
  cursor: "pointer",
};

const addBtnPrimary: CSSProperties = {
  padding: "6px 16px",
  border: "none",
  borderRadius: "var(--r-sm)",
  background: "var(--green-deep)",
  color: "#f4efdf",
  fontSize: 13,
  fontWeight: 600,
  fontFamily: "var(--sans)",
};

const addBtnGhost: CSSProperties = {
  padding: "6px 10px",
  border: "none",
  background: "none",
  color: "var(--ink-mute)",
  fontSize: 13,
  fontFamily: "var(--sans)",
  cursor: "pointer",
};
