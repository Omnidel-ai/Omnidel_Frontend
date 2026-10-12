/**
 * Shared lane ids + status-slug maps. Isomorphic (no "use client") so server
 * pages and acharya-tasks helpers can classify tasks without importing lanes.ts.
 */

export type LaneId = "todo" | "doing" | "review" | "done";

/** Status slugs that belong in each board lane (keep in sync with getLanes). */
export const LANE_STATUS_SLUGS: Record<LaneId, readonly string[]> = {
  todo: ["planned", "open", "blocked", "on_hold"],
  doing: ["doing", "in_progress"],
  // OmniDel has no karigar-facing "review" status today — the lane is driven by
  // `reviewStatus` (see laneForTask). These slugs are here so that if OmniDel
  // ever does promote one, it lands in the right lane without another release.
  review: ["review", "reviewing", "in_review", "pending_review"],
  done: ["done"],
};

export const LANE_IDS: readonly LaneId[] = ["todo", "doing", "review", "done"];

/**
 * A `?tab=` value, if it names a real lane. Shared because the lane travels in
 * the URL now: the tabs read it, the resume trail records it, and the Continue
 * card labels it — three places that must agree on what counts as a lane.
 */
export function laneFromTab(tab: string | null | undefined): LaneId | null {
  return tab && LANE_IDS.includes(tab as LaneId) ? (tab as LaneId) : null;
}

/** The lane a stored path carries in its query string, if any. */
export function laneFromPath(path: string): LaneId | null {
  const q = path.indexOf("?");
  if (q === -1) return null;
  return laneFromTab(new URLSearchParams(path.slice(q + 1)).get("tab"));
}

// Slug -> lane lookup built once (shared by getLanes and the task helpers).
const SLUG_TO_LANE = new Map<string, LaneId>();
for (const id of LANE_IDS) {
  for (const slug of LANE_STATUS_SLUGS[id]) SLUG_TO_LANE.set(slug, id);
}

export function laneForStatus(statusSlug: string): LaneId | null {
  return SLUG_TO_LANE.get(statusSlug) ?? null;
}

/** The fields lane classification needs. Structural, so both KarigarTask and
 *  the leaner seed rows satisfy it. */
export interface LaneTaskLike {
  statusSlug: string;
  reviewStatus?: "pending_review" | "reviewed" | null;
  finalScore?: number | null;
}

/**
 * Lane for a task — **review beats status**.
 *
 * Submitting proof closes the attempt and parks the task on OmniPulse's review
 * queue (`reviewStatus: "pending_review"`, no `finalScore` yet). Its status slug
 * stays whatever it was, so the card used to sit in Doing (or Done) wearing a
 * "Reviewing" chip — the karigar could not tell "still my job" from "waiting on
 * the manager". Its own lane, between Doing and Done, is that distinction.
 *
 * `finalScore != null` means the manager has finalised it, so a reviewed task
 * falls back to its status lane (Done) rather than lingering here.
 */
export function laneForTask(task: LaneTaskLike): LaneId | null {
  if (task.reviewStatus === "pending_review" && task.finalScore == null) return "review";
  return laneForStatus(task.statusSlug);
}
