import { laneForTask, type LaneTaskLike } from "./lane-ids";

/** Presentation of the loaded assignment set, never a lifetime or daily score. */
export function workProgress(tasks: readonly LaneTaskLike[]) {
  const counts = { todo: 0, doing: 0, review: 0, done: 0 };
  for (const task of tasks) {
    const lane = laneForTask(task);
    if (lane) counts[lane] += 1;
  }
  const total = counts.todo + counts.doing + counts.review + counts.done;
  return { ...counts, total, percent: total ? Math.round(counts.done / total * 100) : 0 };
}
