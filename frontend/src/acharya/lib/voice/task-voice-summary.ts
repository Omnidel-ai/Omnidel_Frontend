/**
 * A task, shaped for an acharya to TALK about.
 *
 * The mint prompt lists tasks as title + status + id — enough to open one, not
 * enough to answer "who gave me this, when, how many sessions, does it repeat".
 * QA asked exactly those and got "I cannot see the task", which was literally
 * true: the information was never in the model's context. `open_task` and
 * `get_task_details` now return this.
 *
 * Snake_case keys, plain values, dates as YYYY-MM-DD — the model reads this and
 * speaks it; the prompt tells it to say dates naturally and never read ids.
 * Structural source type so the server `KarigarTask` and the client copy
 * (`lib/api/tasks.ts`, most fields optional) both satisfy it without a cast.
 *
 * ISOMORPHIC: used from the browser handlers and from scripts/verify-voice-tools.ts.
 */

import type { SegmentPlan, TimingMode, TimingRollup } from "@/acharya/lib/karigar-timing-types";

export type TaskRecurrence = "daily" | "weekly" | "monthly" | "custom";

export interface VoiceTaskSource {
  id: string;
  title: string;
  description?: string | null;
  statusSlug: string;
  statusLabel?: string | null;
  dueDate?: string | null;
  completedAt?: string | null;
  createdAt?: string | null;
  assignedOn?: string | null;
  assignedByName?: string | null;
  assignees?: { id: string; name: string }[];
  sessionCount?: number;
  breaksPerSession?: number;
  segmentPlan?: SegmentPlan | null;
  timingMode?: TimingMode;
  timingRollup?: TimingRollup | null;
  isSimpleTask?: boolean;
  timerMode?: "count_up" | "countdown";
  priority?: string | null;
  boardName?: string | null;
  listName?: string | null;
  projectName?: string | null;
  leadTitle?: string | null;
  labels?: { id: string; label: string; color: string | null }[];
  recurrence?: TaskRecurrence | null;
  reviewStatus?: "pending_review" | "reviewed" | null;
  finalScore?: number | null;
  acharyaScore?: number | null;
  acharyaName?: string;
}

export interface VoiceTaskSummary {
  task_id: string;
  title: string;
  status: string;
  assigned_by: string | null;
  assigned_on: string | null;
  due: string | null;
  created: string | null;
  completed: string | null;
  /** "45-minute sessions" — the number the karigar is asked about. */
  sessions: number;
  simple_task: boolean;
  timer: "count up until they submit" | "45-minute countdown sessions";
  /** Subtasks with how many are done, when the task has any. */
  subtasks: { total: number; done: number } | null;
  repeats: TaskRecurrence | null;
  priority: string | null;
  board: string | null;
  list: string | null;
  project: string | null;
  lead: string | null;
  labels: string[];
  review: "waiting for the manager's review" | "reviewed" | null;
  score_percent: number | null;
  description: string | null;
}

export const VOICE_TASK_DESCRIPTION_CHARS = 400;

export function summariseTaskForVoice(t: VoiceTaskSource): VoiceTaskSummary {
  const simple = t.isSimpleTask === true || t.timingMode === "simple";
  const sessions = Math.max(0, Math.floor(Number(t.sessionCount ?? t.segmentPlan?.segment_count ?? 0) || 0));
  const rollup = t.timingRollup?.subtasks ?? [];
  const subtasks =
    rollup.length > 0
      ? { total: rollup.length, done: rollup.filter((s) => s.status === "completed").length }
      : null;
  const score = t.finalScore ?? (t.reviewStatus === "reviewed" ? null : t.acharyaScore ?? null);

  return {
    task_id: t.id,
    title: t.title,
    status: t.statusLabel?.trim() || t.statusSlug,
    assigned_by: t.assignedByName?.trim() || null,
    assigned_on: toDate(t.assignedOn),
    due: toDate(t.dueDate),
    created: toDate(t.createdAt),
    completed: toDate(t.completedAt),
    sessions: simple ? 0 : sessions,
    simple_task: simple,
    timer: simple || t.timerMode === "count_up" ? "count up until they submit" : "45-minute countdown sessions",
    subtasks,
    repeats: t.recurrence ?? null,
    priority: t.priority?.trim() || null,
    board: t.boardName?.trim() || null,
    list: t.listName?.trim() || null,
    project: t.projectName?.trim() || null,
    lead: t.leadTitle?.trim() || null,
    labels: (t.labels ?? []).map((l) => l.label).filter(Boolean),
    review:
      t.reviewStatus === "pending_review"
        ? "waiting for the manager's review"
        : t.reviewStatus === "reviewed"
          ? "reviewed"
          : null,
    score_percent: typeof score === "number" ? Math.round(score * 100) : null,
    description: trimDescription(t.description),
  };
}

/** ISO timestamp or date-only string → YYYY-MM-DD; anything unparseable → null. */
function toDate(v: string | null | undefined): string | null {
  if (!v) return null;
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

function trimDescription(v: string | null | undefined): string | null {
  const s = (v ?? "").replace(/\s+/g, " ").trim();
  if (!s) return null;
  if (s.length <= VOICE_TASK_DESCRIPTION_CHARS) return s;
  const cut = s.slice(0, VOICE_TASK_DESCRIPTION_CHARS);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), VOICE_TASK_DESCRIPTION_CHARS - 40))}…`;
}
