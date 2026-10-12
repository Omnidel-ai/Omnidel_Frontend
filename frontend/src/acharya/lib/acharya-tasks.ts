/**
 * Pure, isomorphic helpers for grouping karigar tasks by acharya and lane.
 * No "use client" / server-only imports — safe from RSC pages and client comps.
 */

import { LANE_IDS, laneForTask, type LaneId, type LaneTaskLike } from "@/acharya/lib/lane-ids";

export type { LaneId };

export interface AcharyaTaskLike extends LaneTaskLike {
  acharyaSlug?: string | null;
}

export interface AcharyaTaskRollup {
  todo: number;
  doing: number;
  review: number;
  done: number;
  total: number;
  hasDoing: boolean;
}

function emptyRollup(): AcharyaTaskRollup {
  return { todo: 0, doing: 0, review: 0, done: 0, total: 0, hasDoing: false };
}

export function rollupTasksByAcharya<T extends AcharyaTaskLike>(
  tasks: T[],
  defaultSlug: string,
): Map<string, AcharyaTaskRollup> {
  const map = new Map<string, AcharyaTaskRollup>();

  for (const task of tasks) {
    const lane = laneForTask(task);
    if (!lane) continue; // unrecognized status slug — don't miscount it

    const slug = task.acharyaSlug ?? defaultSlug;
    const rollup = map.get(slug) ?? emptyRollup();
    rollup[lane] += 1;
    rollup.total += 1;
    rollup.hasDoing = rollup.doing > 0;
    map.set(slug, rollup);
  }

  return map;
}

// Preference order: most open (todo+doing) tasks. Done tasks do not make an
// acharya more prominent; ties keep the earlier (first-seen) acharya.
function isBetterRollup(candidate: AcharyaTaskRollup, current: AcharyaTaskRollup): boolean {
  const candidateOpen = candidate.todo + candidate.doing;
  const currentOpen = current.todo + current.doing;
  if (candidateOpen !== currentOpen) return candidateOpen > currentOpen;

  return false;
}

export function pickMainAcharyaSlug(rollups: Map<string, AcharyaTaskRollup>): string | null {
  let best: string | null = null;
  let bestRollup: AcharyaTaskRollup | null = null;

  for (const [slug, rollup] of rollups) {
    if (!bestRollup || isBetterRollup(rollup, bestRollup)) {
      best = slug;
      bestRollup = rollup;
    }
  }

  return best;
}

export function openTaskCount(rollup: AcharyaTaskRollup | undefined): number {
  return rollup ? rollup.todo + rollup.doing : 0;
}

export function pickFocusTask<T extends AcharyaTaskLike>(tasks: T[]): T | null {
  const doingTask = tasks.find((t) => laneForTask(t) === "doing");
  if (doingTask) return doingTask;

  const todoTask = tasks.find((t) => laneForTask(t) === "todo");
  if (todoTask) return todoTask;

  return null;
}

/** How many cards to paint per lane before "Show more". */
export const BOARD_LANE_PAGE_SIZE = 10;

export type BoardLaneTotals = Record<LaneId, number>;

type TaskWithDates = AcharyaTaskLike & {
  id?: string;
  assignedOn?: string | null;
  createdAt?: string | null;
};

export function sortTasksNewestFirst<T extends TaskWithDates>(tasks: T[]): T[] {
  return [...tasks].sort((a, b) => {
    const ta = taskNewestMs(a);
    const tb = taskNewestMs(b);
    if (tb !== ta) return tb - ta;
    return (b.id || "").localeCompare(a.id || "");
  });
}

/**
 * Prefer created_on (full timestamptz). assigned_on is often date-only
 * (YYYY-MM-DD → midnight), which ties every same-day task and hides a just-
 * created card under an older one that shares the calendar day.
 */
function taskNewestMs(t: TaskWithDates): number {
  const created = Date.parse(t.createdAt || "") || 0;
  if (created) return created;
  return Date.parse(t.assignedOn || "") || 0;
}

export function countTasksByLane(tasks: AcharyaTaskLike[]): BoardLaneTotals {
  const totals: BoardLaneTotals = { todo: 0, doing: 0, review: 0, done: 0 };
  for (const task of tasks) {
    const lane = laneForTask(task);
    if (lane) totals[lane] += 1;
  }
  return totals;
}

/**
 * First `perLane` tasks per Planned/Doing/Review/Done (newest first).
 * Keeps the initial board HTML/hydration light; full list is prefetched client-side.
 */
export function seedTasksPerLane<T extends TaskWithDates>(
  tasks: T[],
  perLane: number = BOARD_LANE_PAGE_SIZE,
): T[] {
  const buckets: Record<LaneId, T[]> = { todo: [], doing: [], review: [], done: [] };
  for (const task of tasks) {
    const lane = laneForTask(task);
    if (!lane) continue;
    buckets[lane].push(task);
  }
  const out: T[] = [];
  for (const id of LANE_IDS) {
    out.push(...sortTasksNewestFirst(buckets[id]).slice(0, perLane));
  }
  return out;
}
