"use client";
import Link from "next/link";
import type { KarigarTask } from "@/lib/api/tasks";
import { useLang, useStrings } from "@/lib/i18n/useLang";
import { dueChipLabel } from "@/lib/i18n/strings";
import { formatSessionBreaksChip, formatTimingRollupLabel } from "@/lib/planned-time";
import { normalizeSlotTimingRollup } from "@/lib/karigar-timing-types";
import { displayTaskTitle, resolveTaskText } from "@/lib/task-text";

/**
 * TaskCard for the /tasks page.
 *
 * Navigates to /tasks/[id] on tap rather than opening an overlay — this is
 * the Apply-flow entry point described in the mobile-tasks-learn-apply spec.
 *
 * Accepts an optional `onNavigate` callback (e.g. to trigger a loading state
 * in the parent) — defaults to a no-op so the component is usable without it.
 */

// Canonical 3-state status (planned/doing/done) + legacy-slug fallback so any
// not-yet-migrated data still renders sensibly.
const LANE_COLOR: Record<string, string> = {
  planned: "var(--terracotta)",
  doing: "var(--ochre)",
  done: "var(--ok)",
  open: "var(--terracotta)",
  in_progress: "var(--ochre)",
  blocked: "var(--crit)",
  on_hold: "var(--terracotta)",
};

/**
 * The due chip's tone. It replaced the status badge in the card's top-right
 * corner: status was already being said three other ways (the lane tab the
 * karigar is standing on, the left accent bar, the done tick), while the ONE
 * thing a card could not tell you was when the work is due.
 */
const DUE_TONE: Record<string, { background: string; color: string }> = {
  overdue: { background: "var(--crit-wash)", color: "var(--crit)" },
  warn: { background: "var(--ochre-wash)", color: "var(--ochre)" },
  neutral: { background: "var(--surface-sunk)", color: "var(--ink-mute)" },
};

type Props = {
  task: KarigarTask;
  showWorkspaceChip?: boolean;
  hrefBuilder?: (taskId: string) => string;
  /** When set, the card deep-links to the nested acharya route
   * (`/acharyas/<slug>/tasks/<id>`); otherwise it keeps the legacy
   * `/tasks/<id>` link. */
  acharyaSlug?: string;
};

/** Clock on the due chip — "18d late" has to read as a date, not a duration. */
function ClockIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ flexShrink: 0 }}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.6V12l3 1.9" />
    </svg>
  );
}

export function TaskCardLink({ task, showWorkspaceChip, hrefBuilder, acharyaSlug }: Props) {
  const lang = useLang();
  const s = useStrings();
  const accent = LANE_COLOR[task.statusSlug] ?? "var(--rule)";
  const due = dueChipLabel(task.dueDate, lang);
  const isDone = task.statusSlug === "done";
  // One place for the date, top-right, whatever it says — overdue included. It
  // used to be split between a promoted badge under the title and a chip in the
  // metadata row, which is two layouts for one fact.
  const dueTone = due ? DUE_TONE[due.tone] ?? DUE_TONE.neutral : null;
  const sessionCount = task.sessionCount ?? task.segmentPlan?.segment_count ?? 0;
  const breaksPerSession = task.breaksPerSession ?? task.segmentPlan?.break_allowance_per_segment?.[0] ?? 0;
  const timingRollup = normalizeSlotTimingRollup(task.timingRollup, sessionCount);
  const chipSessionCount = timingRollup?.total_sessions ?? sessionCount;
  const chipBreaks = task.timingMode === "subtasks" ? 0 : breaksPerSession;
  const sessionChipLabel = timingRollup
    ? formatTimingRollupLabel(
        timingRollup.subtasks.length,
        timingRollup.total_sessions,
        timingRollup.total_planned_seconds,
        lang,
      ).replace(/ · [^·]+ total$/, "")
    : chipSessionCount
      ? formatSessionBreaksChip(chipSessionCount, chipBreaks, lang)
      : null;
  const taskTitle = displayTaskTitle(task.title, lang);
  const taskDescription = resolveTaskText(task.description, lang);

  const href = acharyaSlug
    ? `/acharyas/${acharyaSlug}/tasks/${encodeURIComponent(task.id)}`
    : hrefBuilder
      ? hrefBuilder(task.id)
      : `/tasks/${encodeURIComponent(task.id)}`;

  return (
    <Link
      href={href}
      className="press w-full text-left block"
      style={{
        textDecoration: "none",
        borderRadius: "var(--r-md)",
        background: "var(--surface)",
        borderWidth: 1,
        borderStyle: "solid",
        borderColor: "var(--rule)",
        boxShadow: "var(--shadow-sm)",
        overflow: "hidden",
      }}
      aria-label={s.openTask(taskTitle)}
    >
      <div style={{ display: "flex", alignItems: "stretch" }}>
        {/* Left accent bar indicates status lane */}
        <div
          aria-hidden
          style={{
            width: 4,
            flexShrink: 0,
            background: accent,
            opacity: isDone ? 0.5 : 1,
          }}
        />
        <div style={{ flex: 1, minWidth: 0, padding: "12px 14px" }}>
          {/* Title row */}
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, marginBottom: 2 }}>
            {/* Done tick — shown only when the task is completed */}
            {isDone && (
              <span aria-hidden style={{ flexShrink: 0, display: "inline-flex", marginTop: 1 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ok)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M8.5 12.5l2.4 2.4 4.6-5" />
                </svg>
              </span>
            )}
            <h3
              style={{
                fontFamily: "var(--sans)",
                fontSize: 15,
                fontWeight: 500,
                lineHeight: 1.35,
                color: "var(--ink)",
                margin: 0,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                flex: 1,
                minWidth: 0,
                textDecoration: isDone ? "line-through" : undefined,
                opacity: isDone ? 0.6 : 1,
              }}
            >
              {taskTitle}
            </h3>
            {/* Due date. No acharya avatar beside it any more: on an acharya's
                own board every card is that same face, and on the work list the
                acharya is already named in the row the karigar tapped to get
                here — it was 28px of noise in the corner where the date belongs. */}
            {due && dueTone && (
              <span
                style={{
                  flexShrink: 0,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  fontSize: 10.5,
                  fontFamily: "var(--mono)",
                  letterSpacing: "0.04em",
                  padding: "2px 8px",
                  borderRadius: "var(--r-sm)",
                  background: dueTone.background,
                  color: dueTone.color,
                  opacity: isDone ? 0.6 : 1,
                }}
              >
                <ClockIcon />
                {due.label}
              </span>
            )}
          </div>

          {/* Description */}
          {taskDescription && (
            <p
              style={{
                fontSize: 12.5,
                color: "var(--ink-soft)",
                lineHeight: 1.45,
                margin: 0,
                marginTop: 2,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                opacity: isDone ? 0.5 : 0.85,
              }}
            >
              {taskDescription}
            </p>
          )}

          {/* Chips row: workspace + board + sessions. The date lives in the
              title row now, so it is deliberately not repeated here. */}
          {(showWorkspaceChip && task.workspaceName) || task.boardName || sessionChipLabel || (task.finalScore != null) ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 6,
                marginTop: 8,
              }}
            >
              {task.finalScore != null && (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    fontSize: 10,
                    fontFamily: "var(--mono)",
                    letterSpacing: "0.08em",
                    padding: "2px 8px",
                    borderRadius: 999,
                    background: "var(--ok-wash)",
                    color: "var(--ok)",
                  }}
                >
                  {(task.finalScore * 10).toFixed(1)}/10
                </span>
              )}
              {task.reviewStatus === "pending_review" && task.finalScore == null && (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    fontSize: 10,
                    fontFamily: "var(--mono)",
                    letterSpacing: "0.08em",
                    padding: "2px 8px",
                    borderRadius: 999,
                    background: "var(--ochre-wash)",
                    color: "var(--ochre)",
                  }}
                >
                  Reviewing
                </span>
              )}
              {showWorkspaceChip && task.workspaceName && (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    fontSize: 10,
                    fontFamily: "var(--mono)",
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    padding: "2px 8px",
                    borderRadius: 999,
                    background: "var(--rule)",
                    color: "var(--ink-soft)",
                  }}
                >
                  {task.workspaceName}
                </span>
              )}
              {task.boardName && (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    fontSize: 10,
                    fontFamily: "var(--mono)",
                    letterSpacing: "0.04em",
                    padding: "2px 8px",
                    borderRadius: 999,
                    background: "var(--surface-sunk)",
                    color: "var(--ink-mute)",
                  }}
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                    <line x1="9" x2="9" y1="3" y2="21" />
                    <line x1="15" x2="15" y1="3" y2="21" />
                  </svg>
                  {task.boardName}
                </span>
              )}
              {sessionChipLabel && (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    fontSize: 10,
                    fontFamily: "var(--mono)",
                    letterSpacing: "0.08em",
                    padding: "2px 8px",
                    borderRadius: 999,
                    background: "var(--surface-sunk)",
                    color: "var(--ink-mute)",
                  }}
                >
                  {sessionChipLabel}
                </span>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </Link>
  );
}
