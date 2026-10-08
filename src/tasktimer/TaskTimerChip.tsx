import { formatClock } from "../components/TimerRing";
import type { TaskTimerView } from "./types";

export interface TaskTimerChipProps {
  view: TaskTimerView;
  open: boolean;
  onClick: () => void;
  /** Phones: drop the title, keep the clock. */
  compact?: boolean;
}

/** Tone and clock text for the chip, by where the timer is. */
function chipFace(v: TaskTimerView): { color: string; wash: string; clock: string; label: string } {
  const warning = v.stage === "running" && v.remainingSeconds <= v.totalSeconds * 0.25;
  switch (v.stage) {
    case "expired":
      return { color: "var(--crit)", wash: "var(--crit-wash)", clock: "Time up", label: "session time is up" };
    case "break":
      return { color: "var(--ink-mute)", wash: "var(--surface-sunk)", clock: "On break", label: "on a break" };
    case "ready":
      return {
        color: "var(--green-deep)",
        wash: "var(--green-wash)",
        clock: `Session ${v.session} ready`,
        label: `session ${v.session} ready to start`,
      };
    default:
      return warning
        ? { color: "var(--ochre)", wash: "var(--ochre-wash)", clock: formatClock(v.remainingSeconds), label: "remaining" }
        : { color: "var(--green-deep)", wash: "var(--green-wash)", clock: formatClock(v.remainingSeconds), label: "remaining" };
  }
}

/**
 * Topbar chip for the running task: a live dot, the task's name and its clock.
 *
 * Sits left of the urgent triangle. It is drawn only while a timer is held, so
 * a person who is not working on anything sees the topbar they always had.
 * Clicking it opens the task timer panel.
 */
export function TaskTimerChip({ view, open, onClick, compact = false }: TaskTimerChipProps) {
  const face = chipFace(view);
  const live = view.stage === "running";

  return (
    <button
      type="button"
      className="tt-chip"
      onClick={onClick}
      aria-expanded={open}
      aria-haspopup="dialog"
      aria-label={`Task timer: ${view.task.title}, ${view.stage === "running" ? `${face.clock} ${face.label}` : face.label}`}
      title={view.task.title}
      style={compact ? { flexShrink: 0, padding: "0 4px 0 9px" } : undefined}
    >
      {view.stage === "break" ? (
        <svg width="12" height="12" viewBox="0 0 24 24" fill={face.color} aria-hidden="true" style={{ flexShrink: 0 }}>
          <rect x="6" y="4" width="4" height="16" rx="1" />
          <rect x="14" y="4" width="4" height="16" rx="1" />
        </svg>
      ) : (
        <span
          className="tt-chip__dot"
          aria-hidden="true"
          style={{ color: face.color, animationPlayState: live || view.stage === "expired" ? "running" : "paused" }}
        />
      )}
      {!compact && <span className="tt-chip__title">{view.task.title}</span>}
      <span
        className={`tt-chip__clock${view.stage === "expired" ? " timer-expired-pulse" : ""}`}
        style={{ color: face.color, background: face.wash }}
        aria-hidden="true"
      >
        {face.clock}
      </span>
    </button>
  );
}
