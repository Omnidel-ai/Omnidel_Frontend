import { TaskTimerChip, TaskTimerPanel, type TaskTimerView } from "../tasktimer";
import timerData from "../data/tasktimer.json";
import type { TaskTimerData } from "../tasktimer";
import { Case, Section } from "./Case";

const DATA = timerData as TaskTimerData;
const [ADMIN, RAZORPAY] = DATA.tasks;
const noop = () => undefined;

const base: TaskTimerView = {
  task: RAZORPAY,
  stage: "running",
  session: 1,
  completed: 0,
  remainingSeconds: 1932,
  totalSeconds: 2700,
  breaksLeft: 1,
  extraMinutesLeft: 60,
  capture: null,
};

/** Every state the panel and chip can be in, frozen — the live demo is in the topbar. */
const STATES: { label: string; view: TaskTimerView }[] = [
  { label: "Ready — not started", view: { ...base, stage: "ready", remainingSeconds: 2700 } },
  { label: "Running", view: base },
  { label: "Running — last quarter (warning)", view: { ...base, remainingSeconds: 412 } },
  { label: "Time up — an update is owed", view: { ...base, stage: "expired", remainingSeconds: 0 } },
  { label: "On break", view: { ...base, stage: "break", remainingSeconds: 1210, breaksLeft: 0 } },
  { label: "Session complete — proof form", view: { ...base, remainingSeconds: 540, capture: "session" } },
  {
    label: "Between sessions",
    view: { ...base, stage: "ready", session: 2, completed: 1, remainingSeconds: 2700 },
  },
  { label: "All sessions complete", view: { ...base, stage: "allDone", session: 2, completed: 2 } },
  { label: "Reviewing", view: { ...base, stage: "reviewing", session: 2, completed: 2 } },
  {
    label: "Another task is running",
    view: { ...base, stage: "ready", remainingSeconds: 2700, blockedBy: { id: ADMIN.id, title: ADMIN.title } },
  },
];

/**
 * The task timer — the topbar chip and the panel it opens — in every state.
 *
 * The real one lives in the shell (click the clock left of the urgent
 * triangle). Here the states are frozen so the ones that take forty minutes
 * to reach live, like "time up", can be reviewed side by side.
 */
export function TaskTimerSection() {
  return (
    <Section id="task-timer" title="Task timer">
      <Case label="Topbar chip — running · warning · time up · on break · between sessions">
        {[STATES[1], STATES[2], STATES[3], STATES[4], STATES[6]].map((s) => (
          <TaskTimerChip key={s.label} view={{ ...s.view, task: ADMIN }} open={false} onClick={noop} />
        ))}
      </Case>
      <div className="pg-case">
        <div className="pg-case__label">Panel — every state</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(380px, 100%), 1fr))", gap: 16, width: "100%" }}>
          {STATES.map((s) => (
            <figure key={s.label} style={{ margin: 0 }}>
              <figcaption className="pg-case__label" style={{ marginBottom: 6 }}>
                {s.label}
              </figcaption>
              <div
                style={{
                  height: 640,
                  border: "1px solid var(--rule)",
                  borderRadius: "var(--r-md)",
                  overflow: "hidden",
                  background: "var(--page)",
                }}
              >
                <TaskTimerPanel
                  view={s.view}
                  onClose={noop}
                  onStart={noop}
                  onResume={noop}
                  onCapture={noop}
                  onCancelCapture={noop}
                  onSubmitCapture={noop}
                  onRequestTime={noop}
                  onViewTask={noop}
                />
              </div>
            </figure>
          ))}
        </div>
      </div>
    </Section>
  );
}
