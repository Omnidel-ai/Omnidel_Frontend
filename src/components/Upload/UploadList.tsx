import { Badge } from "../Badge";
import { FileKindIcon } from "../ImageField";
import { formatBytes } from "../../lib/blob";
import type { UploadQueue, UploadTask } from "../../lib/upload";

export interface UploadListProps {
  queue: UploadQueue;
  /** Hides rows that finished cleanly — for a caller that draws those itself. */
  hideDone?: boolean;
}

const TONE = {
  queued: "neutral",
  uploading: "neutral",
  done: "ok",
  failed: "crit",
  cancelled: "amber",
} as const;

const WORD = {
  queued: "Queued",
  uploading: "Uploading",
  done: "Stored",
  failed: "Failed",
  cancelled: "Cancelled",
} as const;

/**
 * What happened to each file that was offered, and what can still be done.
 *
 * One row per file, and the verb on the right follows the state: **Cancel**
 * while it is moving, **Retry** once it has failed or been cancelled,
 * **Remove** once it is done or being given up on. Only one of them is ever
 * offered, because a row with three buttons makes the reader choose before
 * they have read the state.
 *
 * A failed row keeps its reason. That is the difference between a control a
 * person can recover from and one they reload the page over.
 */
export function UploadList({ queue, hideDone = false }: UploadListProps) {
  const rows = hideDone ? queue.tasks.filter((t) => t.status !== "done") : queue.tasks;
  if (rows.length === 0) return null;

  return (
    <ul className="uploads" aria-label="Uploads" aria-live="polite">
      {rows.map((task) => (
        <li key={task.id} className="uploads__row">
          <span className="uploads__icon" aria-hidden="true">
            <FileKindIcon kind={task.kind} />
          </span>

          <span className="uploads__body">
            <span className="uploads__head">
              <span className="picker-truncate" title={task.name}>
                {task.name}
              </span>
              <span className="uploads__size">{formatBytes(task.size)}</span>
              <Badge tone={TONE[task.status]}>{WORD[task.status]}</Badge>
            </span>

            {task.status === "uploading" ? (
              <Bar fraction={task.progress} />
            ) : task.error ? (
              <span className="uploads__error">{task.error}</span>
            ) : null}
          </span>

          <span className="uploads__actions">
            {task.status === "uploading" || task.status === "queued" ? (
              <button type="button" className="btn-ghost btn-sm" onClick={() => queue.cancel(task.id)}>
                Cancel
              </button>
            ) : task.status === "failed" || task.status === "cancelled" ? (
              <button type="button" className="btn-ghost btn-sm" onClick={() => queue.retry(task.id)}>
                Retry
              </button>
            ) : null}
            <button
              type="button"
              className="btn-ghost btn-sm"
              aria-label={`Remove ${task.name}`}
              onClick={() => queue.dismiss(task.id)}
            >
              Remove
            </button>
          </span>
        </li>
      ))}
    </ul>
  );
}

/**
 * The progress bar.
 *
 * Percentage as text as well as width: at the far end of the bar the last few
 * per cent are a couple of pixels, and "98%" is the difference between "nearly
 * there" and "stuck".
 */
function Bar({ fraction }: { fraction: number }) {
  const pct = Math.round(fraction * 100);
  return (
    <span className="uploads__bar">
      <span
        className="uploads__track"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <span className="uploads__fill" style={{ width: `${pct}%` }} />
      </span>
      <span className="uploads__pct">{pct}%</span>
    </span>
  );
}

export type { UploadTask };
