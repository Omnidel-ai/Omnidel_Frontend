/** Shared timing types — safe for client + server (no server-only imports). */

export const SESSION_DURATION_SECONDS = 45 * 60;

export interface SegmentPlan {
  total_planned_seconds: number;
  segment_count: number;
  segment_durations_seconds: number[];
  /** Sum of per-session breaks — display only; do not use as quota. */
  break_allowance_total?: number;
  /** Break quota per session (index 0 = session 1). */
  break_allowance_per_segment?: number[];
}

export interface TimingRollupSubtask {
  id: string;
  title: string;
  session_count: number;
  /** Which task session (1..N) this subtask belongs to. */
  session_slot: number;
  sessions_completed: number;
  status: "pending" | "active" | "completed";
  started_at: string | null;
  completed_at: string | null;
  /** Active work seconds only (excludes voluntary-break pauses). */
  worked_seconds?: number | null;
  break_allowance_per_segment: number[];
  segment_plan: SegmentPlan;
}

export interface TimingRollup {
  total_sessions: number;
  total_planned_seconds: number;
  subtasks: TimingRollupSubtask[];
}

export type TimingMode = "task" | "subtasks" | "simple";

/**
 * The attempt fields needed to resolve session progress. Structural so both the
 * server `AttemptRecord` and the client copies satisfy it.
 */
export interface AttemptSegmentRow {
  segment_index: number;
  status: string;
  checklist_item_id?: string | null;
  segment_plan?: { segment_count?: number | null } | null;
  /**
   * Updates attached per attempt by OmniDel's listAttempts. An update with
   * context `segment_end` is the record that the karigar actually submitted
   * proof for that session.
   */
  updates?: Array<{ update_context?: string | null }> | null;
}

/**
 * Did this attempt's session actually get COMPLETED, as opposed to merely
 * existing?
 *
 * Attempt rows are created on start and closed by several different paths, so
 * "a row exists at segment N" does not mean session N was done:
 *   - `completeSegmentEnd` writes status `finished` AND a `segment_end` update.
 *   - `reconcileActiveAttemptsForStart` closes a STALE attempt as `expired`
 *     when its clock ran out, or `finished`/`admin_override` when time
 *     remained — neither with any proof.
 * Counting rows regardless of status would let a worker start a session, walk
 * away for 45 minutes, and have that lapsed session count as complete —
 * reaching the final segment (and therefore "Mark task as Done") with no
 * evidence submitted for the earlier ones.
 *
 * The `segment_end` update is the unambiguous signal. `close_reason` is not
 * usable here: a real segment end and a timed-out stale close both record
 * "expired", and the field is not on the client attempt record anyway.
 */
function segmentWasSubmitted(a: AttemptSegmentRow): boolean {
  const updates = a.updates ?? [];
  if (updates.length > 0) {
    return updates.some((u) => u.update_context === "segment_end");
  }
  // Payload without updates (older API): `finished` at least excludes the
  // walked-away `expired` case.
  return a.status === "finished";
}

/**
 * Next session (segment) index to request for a TASK-LEVEL multi-session task —
 * one with `session_count > 1` and NO checklist rows.
 *
 * Why this has to read the attempt ledger: for task-level timing
 * `buildTimingRollup` returns **null** (it is built from checklist rows, and
 * there are none), so the task payload carries no per-session progress at all.
 * Callers therefore used to fall back to a hardcoded `1`, which restarted
 * session 1 forever, stacked duplicate `segment_index = 1` attempt rows, and —
 * because only `uq_ops_task_attempts_one_running` guards uniqueness — poisoned
 * the previous-segment lookup so the task could never be completed.
 *
 * The attempt rows are the authoritative record: each carries its
 * `segment_index` and the server's own `segment_plan.segment_count`, so both the
 * progress and the total come from OmniDel rather than being re-derived here.
 *
 * A live (running/paused) attempt resolves to ITS segment — resume, do not
 * advance past work still in progress.
 */
export function nextTaskSegmentIndex(
  attempts: AttemptSegmentRow[] | null | undefined,
): number {
  // Task-level attempts only: a checklist-scoped row belongs to the subtask
  // model, which tracks progress in `sessions_completed` instead.
  const rows = (attempts ?? []).filter((a) => !a.checklist_item_id);
  if (!rows.length) return 1;

  const live = rows.find((a) => a.status === "running" || a.status === "paused");
  if (live) return Math.max(1, Math.floor(live.segment_index) || 1);

  const highest = rows
    .filter(segmentWasSubmitted)
    .reduce((max, a) => Math.max(max, Math.floor(a.segment_index) || 1), 0);
  const total = rows.reduce(
    (max, a) => Math.max(max, Math.floor(a.segment_plan?.segment_count ?? 0) || 0),
    0,
  );
  // No session has been SUBMITTED yet — whatever rows exist are starts that were
  // never completed, so the next session to work is still the first.
  if (highest === 0) return 1;
  const next = highest + 1;
  // Clamp to the server's plan when we know it, mirroring the subtask branch
  // (`min(sessions_completed + 1, session_count)`). Whole-task completion is
  // decided on the timer screen from the live attempt, not here.
  return total > 0 ? Math.min(next, total) : next;
}

export function coerceSessionSlot(raw: unknown, fallback = 1): number {
  const parsed = Math.floor(Number(raw));
  if (!Number.isFinite(parsed)) return Math.min(8, Math.max(1, fallback));
  return Math.min(8, Math.max(1, parsed));
}

/** True when every checklist row is a 1-session item (current OmniDel create path). */
export function isSlotTimingModel(rollup: TimingRollup | null | undefined): boolean {
  return !!rollup?.subtasks?.length && rollup.subtasks.every((s) => s.session_count === 1);
}

/**
 * Recompute total_sessions for the slot model so Acharya matches OmniDel even
 * when an older API still summed per-item session_count (5 subtasks → 5 sessions).
 */
export function normalizeSlotTimingRollup(
  rollup: TimingRollup | null | undefined,
  taskSessionCount?: number | null,
): TimingRollup | null {
  if (!rollup?.subtasks?.length) return rollup ?? null;
  const subtasks = [...rollup.subtasks]
    .map((s) => ({
      ...s,
      session_slot: coerceSessionSlot(s.session_slot, 1),
    }))
    .sort((a, b) => {
      if (a.session_slot !== b.session_slot) return a.session_slot - b.session_slot;
      return 0;
    });

  // Work order: only the earliest incomplete item is "active".
  const earliestIncompleteId = subtasks.find((s) => s.status !== "completed")?.id ?? null;
  for (const s of subtasks) {
    if (s.status === "completed") continue;
    s.status = s.id === earliestIncompleteId ? "active" : "pending";
  }

  if (!subtasks.every((s) => s.session_count === 1)) {
    return { ...rollup, subtasks };
  }
  const uniqueSlots = new Set(subtasks.map((s) => s.session_slot)).size;
  const taskSessions =
    typeof taskSessionCount === "number" && taskSessionCount >= 1
      ? Math.min(8, Math.floor(taskSessionCount))
      : null;
  // Reject the old "sum of item sessions" smell (5 items → 5) when distinct
  // session_slot values are present and say fewer sessions (e.g. 3).
  const looksLikeSummedItems =
    taskSessions != null
    && taskSessions === subtasks.length
    && uniqueSlots > 1
    && uniqueSlots < taskSessions;
  const total_sessions = looksLikeSummedItems
    ? uniqueSlots
    : Math.max(1, taskSessions ?? uniqueSlots, uniqueSlots);
  return {
    ...rollup,
    subtasks,
    total_sessions,
    total_planned_seconds: total_sessions * SESSION_DURATION_SECONDS,
  };
}

/** Incomplete checklist rows outside the given session slot. */
export function hasIncompleteOutsideSlot(
  rollup: TimingRollup | null | undefined,
  sessionSlot: number,
): boolean {
  if (!rollup?.subtasks?.length) return false;
  const slot = coerceSessionSlot(sessionSlot, 1);
  return rollup.subtasks.some(
    (s) => s.status !== "completed" && coerceSessionSlot(s.session_slot, 1) !== slot,
  );
}

/** How many session slots are fully complete. */
export function completedSessionSlotCount(rollup: TimingRollup | null | undefined): number {
  if (!rollup?.subtasks?.length) return 0;
  const bySlot = new Map<number, TimingRollupSubtask[]>();
  for (const s of rollup.subtasks) {
    const slot = coerceSessionSlot(s.session_slot, 1);
    const list = bySlot.get(slot) ?? [];
    list.push(s);
    bySlot.set(slot, list);
  }
  let done = 0;
  for (const items of bySlot.values()) {
    if (items.every((s) => s.status === "completed")) done += 1;
  }
  return done;
}

/**
 * Seconds left in a shared session_slot budget (45:00 − work already done).
 * Prefers worked_seconds (excludes breaks); falls back to started→completed wall time.
 * Used by Acharya when the OmniDel API still starts attempts with a fresh 45:00.
 */
export function sharedSlotRemainingFromRollup(
  rollup: TimingRollup | null | undefined,
  sessionSlot: number,
  opts?: { excludeItemId?: string | null },
): number | null {
  if (!isSlotTimingModel(rollup)) return null;
  const slot = coerceSessionSlot(sessionSlot, 1);
  const inSlot = rollup!.subtasks.filter(
    (s) => coerceSessionSlot(s.session_slot, 1) === slot,
  );
  if (inSlot.length <= 1) return null;

  let used = 0;
  let hasCompleted = false;
  for (const s of inSlot) {
    if (opts?.excludeItemId && s.id === opts.excludeItemId) continue;
    if (s.status !== "completed") continue;
    hasCompleted = true;
    if (typeof s.worked_seconds === "number" && Number.isFinite(s.worked_seconds) && s.worked_seconds > 0) {
      used += Math.min(SESSION_DURATION_SECONDS, Math.floor(s.worked_seconds));
      continue;
    }
    if (s.started_at && s.completed_at) {
      const startMs = Date.parse(s.started_at);
      const endMs = Date.parse(s.completed_at);
      if (Number.isFinite(startMs) && Number.isFinite(endMs) && endMs > startMs) {
        used += Math.min(
          SESSION_DURATION_SECONDS,
          Math.floor((endMs - startMs) / 1000),
        );
      }
    }
  }
  if (!hasCompleted || used <= 0) return null;
  const left = SESSION_DURATION_SECONDS - used;
  if (left <= 0) return null;
  return Math.min(SESSION_DURATION_SECONDS, left);
}

/**
 * Clamp a running attempt's remaining seconds down to the shared-slot leftover
 * when the server wrongly started a fresh ~45:00 after mates already worked.
 */
export function clampRemainingToSharedSlot(
  remainingSeconds: number,
  rollup: TimingRollup | null | undefined,
  sessionSlot: number,
  opts?: {
    excludeItemId?: string | null;
    /** Start budget for this attempt (interval_seconds). */
    attemptBudgetSeconds?: number | null;
  },
): number {
  const rem = Math.max(0, Math.floor(remainingSeconds));
  const budget = sharedSlotRemainingFromRollup(rollup, sessionSlot, {
    excludeItemId: opts?.excludeItemId,
  });
  if (budget == null) return rem;
  const startBudget =
    typeof opts?.attemptBudgetSeconds === "number" && opts.attemptBudgetSeconds > 0
      ? Math.min(SESSION_DURATION_SECONDS, opts.attemptBudgetSeconds)
      : SESSION_DURATION_SECONDS;
  const workSoFar = Math.max(0, startBudget - rem);
  const correct = Math.max(0, budget - workSoFar);
  // Only clamp when clearly over budget (server gave a near-fresh 45:00).
  if (rem <= correct + 30) return rem;
  return correct;
}
