/**
 * Type-only stand-in for the Acharya app's `lib/server/omnidel-client.ts`.
 *
 * The real module talks to OmniDel and is server-only. Client screens import
 * just `KarigarTask` from it, so the frontend keeps that type (copied verbatim
 * from omnidel-acharya PR #207) and nothing else. Demo data in
 * `acharya/demo/` is typed against it.
 */
import type { SegmentPlan, TimingMode, TimingRollup } from "@/acharya/lib/karigar-timing-types";

export type { SegmentPlan, TimingMode, TimingRollup, TimingRollupSubtask } from "@/acharya/lib/karigar-timing-types";

export interface KarigarTask {
  id: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  completedAt: string | null;
  statusSlug: string;            // planned | doing | done
  workspaceId: string | null;
  boardName: string | null;      // resolved upstream via board_id → ops_boards.name
  // Tagged onto the task at fetch time so the karigar UI can render workspace
  // chips and open the overlay with the right acharya context. Populated by
  // the aggregator (listMyTasksAcrossWorkspaces).
  workspaceSlug?: string;
  workspaceName?: string;
  acharyaSlug?: string;
  acharyaName?: string;
  acharyaInitial?: string;
  acharyaAvatarUrl?: string | null;
  acharyaSource?: string | null;
  photoCount?: number;
  sessionCount: number;
  breaksPerSession: number;
  plannedTime?: string | null;
  segmentPlan: SegmentPlan | null;
  timingMode: TimingMode;
  timingRollup: TimingRollup | null;
  // Read-only detail fields (task detail page)
  statusLabel: string | null;
  lane: string | null;
  priority: string | null;
  taskTypeId: string | null;
  taskTypeName: string | null;
  taskTypeSlug: string | null;
  isSimpleTask: boolean;
  timerMode: "count_up" | "countdown";
  missionId: string | null;
  missionImpact: string | null;
  listName: string | null;
  assignees: { id: string; name: string }[];
  assignedOn: string | null;
  assignedByName: string | null;
  createdAt: string | null;
  breakAllowanceTotal: number | null;
  projectName: string | null;
  leadNo: string | null;
  leadTitle: string | null;
  labels: { id: string; label: string; color: string | null }[];
  /** OmniDel `ops_tasks.recurring` — daily | weekly | monthly | custom, or null. */
  recurrence: "daily" | "weekly" | "monthly" | "custom" | null;
  reviewStatus?: "pending_review" | "reviewed" | null;
  /** Manager-finalized score (0–1), only when reviewStatus=reviewed. */
  finalScore?: number | null;
  /** Acharya provisional score (0–1) while pending manager review. */
  acharyaScore?: number | null;
  /** Habit task spawned from default template. */
  isHabit?: boolean;
  /** Whether the task completion affects the rolling avg_score (default true). */
  countsTowardScore?: boolean;
}
