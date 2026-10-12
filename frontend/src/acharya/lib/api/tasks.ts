"use client";

/**
 * Client-side wrapper for the omnidel-acharya task endpoints.
 *
 * All calls go through this app's /api/work/* proxy, which strips
 * manager-only fields and enforces karigar-session auth before forwarding
 * to OmniDel's API.
 *
 * Auth is carried by the karigar-session cookie — no explicit header needed;
 * the browser sends it automatically. fetch() is called without `credentials`
 * override because same-site cookies work by default.
 */

import type { SegmentPlan, TimingMode, TimingRollup } from "@/acharya/lib/karigar-timing-types";

export type { SegmentPlan, TimingMode, TimingRollup } from "@/acharya/lib/karigar-timing-types";

export interface KarigarTask {
  id: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  completedAt: string | null;
  statusSlug: string;
  workspaceId: string | null;
  boardName: string | null;
  workspaceSlug?: string;
  workspaceName?: string;
  acharyaSlug?: string;
  acharyaName?: string;
  acharyaInitial?: string;
  acharyaAvatarUrl?: string | null;
  /** Number of 45-min sessions (parent task or rollup when subtasks). */
  sessionCount: number;
  /** Breaks allowed per session on parent task (0 when timing_mode=subtasks). */
  breaksPerSession: number;
  plannedTime?: string | null;
  segmentPlan?: SegmentPlan | null;
  timingMode?: TimingMode;
  timingRollup?: TimingRollup | null;
  taskTypeId?: string | null;
  taskTypeName?: string | null;
  taskTypeSlug?: string | null;
  isSimpleTask?: boolean;
  timerMode?: "count_up" | "countdown";
  reviewStatus?: "pending_review" | "reviewed" | null;
  finalScore?: number | null;
  acharyaScore?: number | null;
  /** Habit task spawned from default template. */
  isHabit?: boolean;
  /** Whether the task completion affects the rolling avg_score (default true). */
  countsTowardScore?: boolean;
  /** ISO timestamps — board sorts newest first. */
  createdAt?: string | null;
  assignedOn?: string | null;
  // Read-only detail fields the voice tools speak about (see
  // lib/voice/task-voice-summary.ts). Present on GET /api/work/tasks/[id].
  statusLabel?: string | null;
  assignedByName?: string | null;
  assignees?: { id: string; name: string }[];
  priority?: string | null;
  listName?: string | null;
  projectName?: string | null;
  leadTitle?: string | null;
  labels?: { id: string; label: string; color: string | null }[];
  recurrence?: "daily" | "weekly" | "monthly" | "custom" | null;
}

export interface WorkspaceSummary {
  slug: string;
  name: string;
  acharya: { slug: string; displayName: string; avatarUrl?: string | null } | null;
}

export interface AllTasksResponse {
  items: KarigarTask[];
  workspaces: WorkspaceSummary[];
}

export class TasksApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly body?: unknown,
  ) {
    super(message);
    this.name = "TasksApiError";
  }
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { cache: "no-store", ...init });
  if (!res.ok) {
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      /* ignore parse error */
    }
    throw new TasksApiError(
      res.status,
      (body as { error?: string } | null)?.error ?? `tasks API ${path} → ${res.status}`,
      body,
    );
  }
  return res.json() as Promise<T>;
}

/**
 * Fetch all tasks assigned to the signed-in karigar across every workspace
 * they belong to. Returns tasks tagged with workspace + acharya metadata.
 */
export async function fetchAllTasks(fresh = false): Promise<AllTasksResponse> {
  const suffix = fresh ? "?fresh=1" : "";
  return apiFetch<AllTasksResponse>(`/api/work/all-tasks${suffix}`);
}

/**
 * One task with its read-only detail fields. Used by the voice tools
 * (`open_task`, `get_task_details`) so the acharya can say who assigned a task
 * and when; null on 404 so a handler can answer "not found" instead of throwing
 * into the model's lap.
 */
export async function fetchTask(taskId: string): Promise<KarigarTask | null> {
  try {
    const res = await apiFetch<{ item: KarigarTask }>(`/api/work/tasks/${encodeURIComponent(taskId)}`);
    return res.item ?? null;
  } catch (e) {
    if (e instanceof TasksApiError && e.status === 404) return null;
    throw e;
  }
}

// 3-state status, aligned with OmniDel's mst_task_statuses (planned/doing/done)
// after the 2026-06-11 status migration. The legacy slugs (open/in_progress/
// blocked) are no longer accepted by OmniDel's /status endpoint.
export type StatusSlug = "planned" | "doing" | "done";

/**
 * Move a task to a different status lane.
 * Returns the updated task from the server (server is the source of truth).
 */
export async function updateTaskStatus(
  taskId: string,
  status: StatusSlug,
): Promise<KarigarTask> {
  const { item } = await apiFetch<{ item: KarigarTask }>(
    `/api/work/tasks/${encodeURIComponent(taskId)}/status`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    },
  );
  return item;
}
