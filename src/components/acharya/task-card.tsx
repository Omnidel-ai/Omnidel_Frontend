"use client";
import Link from "next/link";
import type { KarigarTask } from "@/lib/api/tasks";
import { useLang, useStrings } from "@/lib/i18n/useLang";
import { dueChipLabel } from "@/lib/i18n/strings";
import { formatSessionBreaksChip, formatTimingRollupLabel } from "@/lib/planned-time";
import { normalizeSlotTimingRollup } from "@/lib/karigar-timing-types";
import { displayTaskTitle, resolveTaskText } from "@/lib/task-text";
import { laneForTask } from "@/lib/lane-ids";
import { taskCategory } from "@/lib/task-category";
import WorkSymbol from "@/components/acharya/WorkSymbol";

/**
 * TaskCard for the /tasks page.
 *
 * Navigates to /tasks/[id] on tap rather than opening an overlay — this is
 * the Apply-flow entry point described in the mobile-tasks-learn-apply spec.
 *
 * Accepts an optional `onNavigate` callback (e.g. to trigger a loading state
 * in the parent) — defaults to a no-op so the component is usable without it.
 */

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
  const lane = laneForTask(task);
  const due = dueChipLabel(task.dueDate, lang);
  const isDone = lane === "done";
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

  /**
   * Sessions done out of sessions planned — the reference's segmented bar,
   * drawn from `timingRollup` rather than from anything new. Only rendered
   * when the task actually has a plan: a bar with one segment, or with no
   * total, says nothing and takes a line saying it.
   */
  const plannedSessions = timingRollup?.total_sessions ?? 0;
  const doneSessions = timingRollup
    ? Math.min(
        timingRollup.subtasks.reduce((sum, st) => sum + (st.sessions_completed ?? 0), 0),
        plannedSessions,
      )
    : 0;
  const showProgress = plannedSessions > 1;

  const href = acharyaSlug
    ? `/acharyas/${acharyaSlug}/tasks/${encodeURIComponent(task.id)}`
    : hrefBuilder
      ? hrefBuilder(task.id)
      : `/tasks/${encodeURIComponent(task.id)}`;

  return (
    <Link
      href={href}
      className="press w-full text-left block journey-task-card"
      data-lane={lane ?? undefined}
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
      <div className="journey-task-row" style={{ display: "flex", alignItems: "center" }}>
        {/* The symbol owns its own colour now (it is keyed to the trade, not
            the lane), so there is no `color` here for it to inherit. */}
        <span className="journey-task-symbol"><WorkSymbol category={taskCategory(task)} /></span>
        <div className="journey-task-body" style={{ flex: 1, minWidth: 0, padding: "12px 14px" }}>
          {/* Title first. Scanning a lane is scanning for a NAME — the chips
              are the same two or three values on most cards in the list, so
              leading with them made every card open identically and pushed the
              one distinguishing line into second place. They qualify the title
              now instead of introducing it. */}
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 7 }}>
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
                // Two lines, then an ellipsis. It used to share one line with
                // the due chip; that chip lives in the row below, so the title
                // has the full width and can say more of itself.
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
                flex: 1,
                minWidth: 0,
                textDecoration: isDone ? "line-through" : undefined,
                opacity: isDone ? 0.6 : 1,
              }}
            >
              {taskTitle}
            </h3>
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

          {/* Tag row, under the title: what KIND of work this is, with the
              date pinned to the right the way a priority pill is. */}
          {(showWorkspaceChip && task.workspaceName) || task.boardName || sessionChipLabel || (task.finalScore != null) || (task.reviewStatus === "pending_review") || task.isHabit || due ? (
            <div
              // Named, not positional: work-journey.css rounds these chips and
              // normalises their type, and it used to reach them as the body's
              // first child — which is the title row now.
              className="journey-task-tags"
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 8,
              }}
            >
              {task.isHabit && (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 3,
                    fontSize: 10,
                    fontFamily: "var(--mono)",
                    letterSpacing: "0.04em",
                    padding: "2px 8px",
                    borderRadius: 999,
                    background: "var(--surface-sunk)",
                    color: "var(--ink-soft)",
                    border: "1px solid var(--rule)",
                  }}
                >
                  <span aria-hidden style={{ fontSize: 9 }}>⚡</span>
                  {s.habit}
                </span>
              )}
              {task.isHabit && task.countsTowardScore === false && (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    fontSize: 9,
                    fontFamily: "var(--mono)",
                    letterSpacing: "0.02em",
                    padding: "2px 6px",
                    borderRadius: 999,
                    background: "var(--surface-sunk)",
                    color: "var(--ink-mute)",
                  }}
                >
                  {s.noScoreImpact}
                </span>
              )}
              <div
                style={{
                  flex: 1,
                  minWidth: 0,
                  display: "flex",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 6,
                  rowGap: 6,
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
          ) : null}

          {/* Sessions done, drawn as the plan itself rather than as a
              percentage: one segment per planned session, filled as they are
              finished. A karigar counts sessions, not percent, and the shape
              of the bar is the shape of their day. */}
          {showProgress && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 9 }}>
              <span aria-hidden style={{ display: "flex", gap: 3, flex: 1, minWidth: 0 }}>
                {Array.from({ length: plannedSessions }, (_, i) => (
                  <span
                    key={i}
                    style={{
                      flex: 1,
                      height: 4,
                      borderRadius: 999,
                      background: i < doneSessions ? "var(--green-deep)" : "var(--surface-sunk)",
                    }}
                  />
                ))}
              </span>
              <span
                style={{
                  flexShrink: 0,
                  fontFamily: "var(--mono)",
                  fontSize: 10,
                  color: "var(--ink-mute)",
                }}
              >
                {doneSessions}/{plannedSessions}
              </span>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
