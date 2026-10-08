/**
 * Task timer — the Acharya app's task detail and active session screens,
 * folded into one OmniDel panel.
 *
 * UI only. Nothing here talks to the attempts API; `useTaskTimer` simulates
 * it on the wall clock so every state can be reached in the demo. When the
 * feature is built, the hook is what gets replaced — the chip and the panel
 * take a `TaskTimerView` and do not care where it came from.
 */

export interface TimerSubtask {
  id: string;
  title: string;
  /** 1-based session slot the subtask is planned into. */
  session: number;
  status: "done" | "current" | "pending";
  /** Worked time, shown on done subtasks. */
  workedSeconds?: number;
}

export interface TimerUpdate {
  id: string;
  /** Already worded: "10:42 am". */
  at: string;
  text: string;
  /** Number of proof photos attached — drawn as placeholder tiles. */
  photos: number;
  session: number;
}

export interface TimerTask {
  id: string;
  title: string;
  workspace: string;
  board: string;
  /** Board status label: Planned · Doing · Review · Done. */
  status: string;
  /** Already worded: "Wed, 8 Oct". */
  due?: string;
  description: string;
  sessions: number;
  sessionMinutes: number;
  breaksPerSession: number;
  subtasks?: TimerSubtask[];
  acharya: { name: string; initials: string };
  /** Shown from the second attempt on: "Attempt 2 of 3 · 80% score". */
  attempt?: { n: number; of: number; score: number };
  updates: TimerUpdate[];
}

export interface TaskTimerData {
  tasks: TimerTask[];
  /** The session already running when the page loads. */
  running?: { taskId: string; session: number; elapsedSeconds: number; breaksUsed: number };
  /** Extra time a karigar can request per attempt, in minutes. */
  extraMinutesPerAttempt: number;
}

/**
 * Where a task's timer is.
 *
 * - `ready`     — not running; the next session can be started.
 * - `running`   — counting down.
 * - `break`     — paused on a break; the remaining time is held.
 * - `expired`   — the session ran out; an update is owed.
 * - `allDone`   — every session finished; the final update is owed.
 * - `reviewing` — submitted; nothing left to do here.
 */
export type TimerStage = "ready" | "running" | "break" | "expired" | "allDone" | "reviewing";

/** Which proof form is open in the panel. */
export type CaptureReason = "session" | "expired" | "break" | "final";

export interface TaskTimerView {
  task: TimerTask;
  stage: TimerStage;
  /** 1-based session that is running, or that starts next. */
  session: number;
  /** Sessions already finished. */
  completed: number;
  remainingSeconds: number;
  totalSeconds: number;
  breaksLeft: number;
  extraMinutesLeft: number;
  capture: CaptureReason | null;
  /** Another task holds the one timer — this task can be read, not started. */
  blockedBy?: { id: string; title: string };
}

export interface CapturePayload {
  text: string;
  photos: number;
}
