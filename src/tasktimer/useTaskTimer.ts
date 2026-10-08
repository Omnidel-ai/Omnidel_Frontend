import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  CapturePayload,
  CaptureReason,
  TaskTimerData,
  TaskTimerView,
  TimerStage,
  TimerTask,
  TimerUpdate,
} from "./types";

/** The one timer a person can have going. Only one task runs at a time. */
interface ActiveTimer {
  taskId: string;
  stage: "ready" | "running" | "break";
  session: number;
  /** Wall-clock end of the session while running (ms). */
  deadline: number;
  /** Seconds left, held while on a break or before the session starts. */
  heldSeconds: number;
  breaksLeft: number;
  extraMinutesLeft: number;
}

/** Per-task record the attempts API would keep. */
interface Progress {
  completed: number;
  updates: TimerUpdate[];
  reviewing: boolean;
}

function sessionSeconds(task: TimerTask): number {
  return task.sessionMinutes * 60;
}

function clockLabel(ms: number): string {
  return new Date(ms).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" }).toLowerCase();
}

/**
 * Demo state for the task timer: which task holds the timer, how far it is,
 * which task the panel shows and whether the panel is open.
 *
 * Mirrors the Acharya app's rules — one running task, a deadline anchored to
 * the local clock (never decremented), breaks hold the remaining time, an
 * expired session owes an update, the last session ends in a final update.
 * Replace this hook with the attempts API; the chip and the panel stay.
 */
export function useTaskTimer(data: TaskTimerData) {
  const [now, setNow] = useState(() => Date.now());
  const [open, setOpen] = useState(false);
  const [viewingId, setViewingId] = useState<string | null>(data.running?.taskId ?? null);
  const [capture, setCapture] = useState<CaptureReason | null>(null);
  const [progress, setProgress] = useState<Record<string, Progress>>(() =>
    Object.fromEntries(
      data.tasks.map((t) => [
        t.id,
        {
          completed: data.running?.taskId === t.id ? data.running.session - 1 : 0,
          updates: t.updates,
          reviewing: false,
        },
      ]),
    ),
  );
  const [active, setActive] = useState<ActiveTimer | null>(() => {
    const r = data.running;
    const task = r && data.tasks.find((t) => t.id === r.taskId);
    if (!r || !task) return null;
    return {
      taskId: r.taskId,
      stage: "running",
      session: r.session,
      deadline: Date.now() + (sessionSeconds(task) - r.elapsedSeconds) * 1000,
      heldSeconds: 0,
      breaksLeft: Math.max(0, task.breaksPerSession - r.breaksUsed),
      extraMinutesLeft: data.extraMinutesPerAttempt,
    };
  });

  const ticking = active?.stage === "running";
  useEffect(() => {
    if (!ticking) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    // A backgrounded tab throttles intervals; re-read the clock on return.
    const onVisible = () => !document.hidden && setNow(Date.now());
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [ticking]);

  const taskById = useCallback((id: string) => data.tasks.find((t) => t.id === id), [data.tasks]);

  /** Build the view for any task — the running one or one being read. */
  const viewFor = useCallback(
    (taskId: string): TaskTimerView | null => {
      const task = taskById(taskId);
      if (!task) return null;
      const p = progress[taskId];
      const total = sessionSeconds(task);
      const mine = active?.taskId === taskId ? active : null;
      const updates = p?.updates ?? task.updates;
      const t = { ...task, updates };

      let stage: TimerStage;
      let remaining = total;
      if (p?.reviewing) stage = "reviewing";
      else if (mine?.stage === "running") {
        remaining = Math.max(0, Math.ceil((mine.deadline - now) / 1000));
        stage = remaining === 0 ? "expired" : "running";
      } else if (mine?.stage === "break") {
        remaining = mine.heldSeconds;
        stage = "break";
      } else if ((p?.completed ?? 0) >= task.sessions) stage = "allDone";
      else stage = "ready";

      const blocker =
        active && active.taskId !== taskId && !progress[active.taskId]?.reviewing ? taskById(active.taskId) : undefined;

      return {
        task: t,
        stage,
        session: mine?.session ?? Math.min(task.sessions, (p?.completed ?? 0) + 1),
        completed: p?.completed ?? 0,
        remainingSeconds: remaining,
        totalSeconds: mine?.stage === "running" || mine?.stage === "break" ? Math.max(total, remaining) : total,
        breaksLeft: mine?.breaksLeft ?? task.breaksPerSession,
        extraMinutesLeft: mine?.extraMinutesLeft ?? data.extraMinutesPerAttempt,
        capture: mine || stage === "allDone" ? capture : null,
        blockedBy: blocker && stage === "ready" ? { id: blocker.id, title: blocker.title } : undefined,
      };
    },
    [active, capture, data.extraMinutesPerAttempt, now, progress, taskById],
  );

  const runningView = active ? viewFor(active.taskId) : null;
  const view = viewingId ? viewFor(viewingId) : runningView;

  function addUpdate(taskId: string, session: number, payload: CapturePayload) {
    if (!payload.text && payload.photos === 0) return;
    setProgress((all) => ({
      ...all,
      [taskId]: {
        ...all[taskId],
        updates: [
          ...all[taskId].updates,
          { id: `up-${Date.now()}`, at: clockLabel(Date.now()), text: payload.text, photos: payload.photos, session },
        ],
      },
    }));
  }

  /** Close the session the active timer is on and move to the next one. */
  function finishSession(taskId: string) {
    const task = taskById(taskId);
    if (!task) return;
    const done = (progress[taskId]?.completed ?? 0) + 1;
    setProgress((all) => ({ ...all, [taskId]: { ...all[taskId], completed: done } }));
    setCapture(null);
    if (done >= task.sessions) {
      // Every session is in; the panel now asks for the final update.
      setActive(null);
    } else {
      setActive((a) =>
        a && {
          ...a,
          stage: "ready",
          session: done + 1,
          heldSeconds: sessionSeconds(task),
          breaksLeft: task.breaksPerSession,
        },
      );
    }
  }

  const actions = {
    open(taskId?: string) {
      setViewingId(taskId ?? active?.taskId ?? viewingId);
      setCapture((c) => (taskId && taskId !== active?.taskId ? null : c));
      setOpen(true);
    },
    close() {
      setOpen(false);
    },
    view(taskId: string) {
      setViewingId(taskId);
    },
    start(taskId: string) {
      const task = taskById(taskId);
      if (!task) return;
      if (active && active.taskId !== taskId && !progress[active.taskId]?.reviewing) return;
      const completed = progress[taskId]?.completed ?? 0;
      setActive({
        taskId,
        stage: "running",
        session: completed + 1,
        deadline: Date.now() + sessionSeconds(task) * 1000,
        heldSeconds: 0,
        breaksLeft: active?.taskId === taskId ? active.breaksLeft : task.breaksPerSession,
        extraMinutesLeft: active?.taskId === taskId ? active.extraMinutesLeft : data.extraMinutesPerAttempt,
      });
      setCapture(null);
      setViewingId(taskId);
      setNow(Date.now());
    },
    resume() {
      setActive((a) => a && { ...a, stage: "running", deadline: Date.now() + a.heldSeconds * 1000 });
      setNow(Date.now());
    },
    requestTime(minutes: number) {
      setActive((a) => {
        if (!a || a.extraMinutesLeft < minutes) return a;
        const base = a.stage === "running" ? Math.max(a.deadline, Date.now()) : Date.now() + a.heldSeconds * 1000;
        const deadline = base + minutes * 60_000;
        return a.stage === "running"
          ? { ...a, deadline, extraMinutesLeft: a.extraMinutesLeft - minutes }
          : { ...a, heldSeconds: a.heldSeconds + minutes * 60, extraMinutesLeft: a.extraMinutesLeft - minutes };
      });
      setNow(Date.now());
    },
    /** Open a proof form: session complete, break, expired or final. */
    capture(reason: CaptureReason) {
      setCapture(reason);
    },
    cancelCapture() {
      setCapture(null);
    },
    submitCapture(payload: CapturePayload) {
      const v = view;
      if (!v || !capture) return;
      const taskId = v.task.id;
      addUpdate(taskId, v.session, payload);
      if (capture === "break") {
        setActive(
          (a) =>
            a && {
              ...a,
              stage: "break",
              heldSeconds: Math.max(0, Math.ceil((a.deadline - Date.now()) / 1000)),
              breaksLeft: Math.max(0, a.breaksLeft - 1),
            },
        );
      } else if (capture === "final") {
        setActive((a) => (a?.taskId === taskId ? null : a));
        setProgress((all) => ({
          ...all,
          [taskId]: { ...all[taskId], completed: v.task.sessions, reviewing: true },
        }));
      } else {
        finishSession(taskId);
        return;
      }
      setCapture(null);
    },
  };

  // Keep the chip honest: it shows the timer only while one is held.
  const chip = useMemo(
    () => (runningView && runningView.stage !== "reviewing" ? runningView : null),
    [runningView],
  );

  return { open, view, chip, actions };
}

export type TaskTimerActions = ReturnType<typeof useTaskTimer>["actions"];
