import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { TimerRing, formatClock, type TimerPhase } from "../components/TimerRing";
import type { CapturePayload, CaptureReason, TaskTimerView, TimerSubtask, TimerTask } from "./types";

/** Desktop width of the panel; the page gives up exactly this much. */
export const TASK_TIMER_W = 440;

export interface TaskTimerPanelProps {
  view: TaskTimerView;
  onClose: () => void;
  onStart: () => void;
  onResume: () => void;
  onCapture: (reason: CaptureReason) => void;
  onCancelCapture: () => void;
  onSubmitCapture: (payload: CapturePayload) => void;
  onRequestTime: (minutes: number) => void;
  /** "Go to running task" — show the task that holds the timer. */
  onViewTask: (taskId: string) => void;
}

/**
 * The task timer panel: the Acharya app's task detail screen and its active
 * session screen as one surface.
 *
 * Top to bottom it answers, in order: what am I on (title, board, due) — how
 * far through am I (session N of M, breaks) — how long is left (the ring) —
 * what do I do now (one primary action, or the proof form that action opened)
 * — and then the reference material the detail screen used to carry: the
 * description, the session plan, subtasks and the updates already shared.
 *
 * When another task holds the timer, the same panel reads as the detail
 * screen: no ring, the "another task is running" notice and a way across.
 */
export function TaskTimerPanel(props: TaskTimerPanelProps) {
  const { view, onClose } = props;
  const { task, stage } = view;
  const scrollRef = useRef<HTMLDivElement>(null);
  const live = stage === "running" || stage === "break" || stage === "expired";
  const hasTimer = !view.blockedBy && stage !== "reviewing" && stage !== "allDone";

  // A new task in the panel starts at its top, not wherever the last one was.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [task.id]);

  return (
    <aside aria-label="Task timer" style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      <header style={headerStyle}>
        <span aria-hidden="true" style={avatarStyle}>
          {task.acharya.initials}
        </span>
        <span style={{ minWidth: 0, flex: 1 }}>
          <span className="tt-eyebrow" style={{ display: "block", color: live ? "var(--green-deep)" : "var(--ink-mute)" }}>
            {live ? "Active session" : "Task"}
          </span>
          <span style={acharyaNameStyle}>{task.acharya.name}</span>
        </span>
        {live && !view.capture && (
          <button type="button" style={taskDoneStyle} onClick={() => props.onCapture("final")}>
            Task Done
          </button>
        )}
        <button type="button" onClick={onClose} aria-label="Close task timer" style={closeStyle}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </header>

      <div ref={scrollRef} className="themed-scroll-y" style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
        <div style={{ padding: "20px 22px 28px", display: "flex", flexDirection: "column", gap: 18 }}>
          <TitleBlock task={task} stage={stage} />

          {view.blockedBy && <BlockedNotice title={view.blockedBy.title} onOpen={() => props.onViewTask(view.blockedBy!.id)} />}

          {hasTimer && <SessionCard view={view} />}
          {hasTimer && <TimerBlock {...props} />}

          {!view.capture && <Actions {...props} />}
          {view.capture && (
            <CaptureForm
              key={`${task.id}-${view.capture}`}
              reason={view.capture}
              breaksLeft={view.breaksLeft}
              onCancel={props.onCancelCapture}
              onSubmit={props.onSubmitCapture}
            />
          )}

          <hr style={ruleStyle} />

          <section>
            <h3 className="tt-section-title">Description</h3>
            <div className="tt-card" style={{ fontSize: 13, lineHeight: 1.6, color: "var(--ink-soft)" }}>
              {task.description || <em style={{ color: "var(--ink-faint)" }}>No description provided.</em>}
            </div>
          </section>

          <PlanCard task={task} />

          {task.subtasks && task.subtasks.length > 0 && <Subtasks items={task.subtasks} minutes={task.sessionMinutes} />}

          <Updates task={task} />
        </div>
      </div>
    </aside>
  );
}

/* ── Title ─────────────────────────────────────────────────────────────── */

const STATUS_TONE: Record<string, { bg: string; fg: string }> = {
  Planned: { bg: "var(--surface-sunk)", fg: "var(--ink-soft)" },
  Doing: { bg: "var(--green-wash)", fg: "var(--green-deep)" },
  Review: { bg: "var(--ochre-wash)", fg: "var(--ochre)" },
  Done: { bg: "var(--ok-wash)", fg: "var(--ok)" },
};

function TitleBlock({ task, stage }: { task: TimerTask; stage: TaskTimerView["stage"] }) {
  const status = stage === "reviewing" ? "Reviewing the task" : task.status;
  const tone = stage === "reviewing" ? STATUS_TONE.Done : (STATUS_TONE[task.status] ?? STATUS_TONE.Planned);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <h2 style={titleStyle}>{task.title}</h2>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
        <span style={{ ...chipStyle, background: tone.bg, color: tone.fg, borderColor: "transparent" }}>{status}</span>
        <span style={chipStyle}>
          <BoardIcon />
          {task.workspace} · {task.board}
        </span>
        {task.due && <span style={{ ...chipStyle, background: "transparent" }}>Due {task.due}</span>}
      </div>
    </div>
  );
}

function BlockedNotice({ title, onOpen }: { title: string; onOpen: () => void }) {
  return (
    <div
      role="status"
      style={{
        display: "flex",
        gap: 12,
        alignItems: "flex-start",
        padding: "13px 14px",
        background: "var(--ochre-wash)",
        border: "1px solid var(--ochre)",
        borderRadius: "var(--r-md)",
      }}
    >
      <span style={{ color: "var(--ochre)", marginTop: 1 }}>
        <ClockIcon />
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <strong style={{ display: "block", fontSize: 13.5, color: "var(--ink)" }}>Another task is running</strong>
        <span style={{ display: "block", fontSize: 12.5, lineHeight: 1.5, color: "var(--ink-soft)", marginTop: 3 }}>
          Pause or finish “{title}” first — only one timer runs at a time. A paused task waits for you.
        </span>
      </span>
      <button type="button" onClick={onOpen} style={blockedBtnStyle}>
        Open timer
      </button>
    </div>
  );
}

/* ── Session + timer ───────────────────────────────────────────────────── */

function SessionCard({ view }: { view: TaskTimerView }) {
  const { task } = view;
  const slotTitles = task.subtasks?.filter((s) => s.session === view.session).map((s) => s.title);
  const allowed = task.breaksPerSession;
  return (
    <div className="tt-card" style={{ padding: "12px 14px" }}>
      <div style={{ fontFamily: "var(--serif)", fontSize: 15, fontWeight: 500, color: "var(--ink)", lineHeight: 1.3 }}>
        {slotTitles && slotTitles.length > 0 ? slotTitles.join(" · ") : `Session ${view.session}`}
      </div>
      <div style={{ fontSize: 12, color: "var(--ink-mute)", marginTop: 4 }}>
        Session {view.session} of {task.sessions}
        {slotTitles && slotTitles.length > 0 && ` · ${slotTitles.length} subtask${slotTitles.length === 1 ? "" : "s"}`}
        {allowed > 0 && (
          <span style={{ color: view.breaksLeft > 0 ? "var(--ink-soft)" : "var(--ink-faint)" }}>
            {" "}
            · Breaks {view.breaksLeft}/{allowed}
          </span>
        )}
      </div>
      <div style={{ display: "flex", gap: 4, marginTop: 10 }} aria-hidden="true">
        {Array.from({ length: task.sessions }, (_, i) => {
          const n = i + 1;
          const isCurrent = n === view.session && view.stage !== "ready";
          const fill = n <= view.completed ? 1 : isCurrent ? 1 - view.remainingSeconds / view.totalSeconds : 0;
          return (
            <span key={n} style={{ flex: 1, height: 5, borderRadius: 999, background: "var(--surface-sunk)", overflow: "hidden" }}>
              <span
                style={{
                  display: "block",
                  height: "100%",
                  width: `${Math.round(fill * 100)}%`,
                  background: "var(--green-deep)",
                  transition: "width 0.9s ease",
                }}
              />
            </span>
          );
        })}
      </div>
    </div>
  );
}

function timerFace(view: TaskTimerView): { phase: TimerPhase; caption: string } {
  switch (view.stage) {
    case "expired":
      return { phase: "expired", caption: "time up" };
    case "break":
      return { phase: "paused", caption: "on break" };
    case "ready":
      return { phase: "paused", caption: "ready" };
    default:
      return {
        phase: view.remainingSeconds <= view.totalSeconds * 0.25 ? "warning" : "active",
        caption: "remaining",
      };
  }
}

const EXTRA_CHOICES = [5, 10, 15, 20, 30, 45, 60];

function TimerBlock({ view, onRequestTime }: TaskTimerPanelProps) {
  const [asking, setAsking] = useState(false);
  const [minutes, setMinutes] = useState<number | null>(null);
  const face = timerFace(view);
  const canAsk = view.stage === "running" || view.stage === "expired";
  const { attempt } = view.task;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
      {view.stage === "ready" && view.completed > 0 && (
        <span style={{ fontSize: 13, color: "var(--green-deep)", fontWeight: 600 }}>
          Session {view.completed} complete — ready for session {view.session}
        </span>
      )}
      <TimerRing seconds={view.remainingSeconds} totalSeconds={view.totalSeconds} phase={face.phase} caption={face.caption} />

      {(attempt || canAsk) && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", alignItems: "center" }}>
          {attempt && attempt.n > 1 && (
            <span
              style={{
                ...monoPillStyle,
                background: attempt.n >= attempt.of ? "var(--crit-wash)" : "var(--ochre-wash)",
                color: attempt.n >= attempt.of ? "var(--crit)" : "var(--ochre)",
              }}
            >
              Attempt {attempt.n} of {attempt.of} · {attempt.score}% score
            </span>
          )}
          {canAsk && (
            <button
              type="button"
              onClick={() => setAsking((a) => !a)}
              aria-expanded={asking}
              style={{ ...monoPillStyle, background: "var(--surface)", border: "1px solid var(--rule-strong)", cursor: "pointer" }}
            >
              + Request time
            </button>
          )}
        </div>
      )}

      {asking && canAsk && (
        <div className="tt-card" style={{ width: "100%", display: "flex", flexDirection: "column", gap: 10 }}>
          <span className="tt-eyebrow">Session time</span>
          <span style={{ fontSize: 13, color: "var(--ink-soft)" }}>
            {view.stage === "expired"
              ? "Session time has ended. Add time to keep working on this task."
              : "Add time to this work session."}
          </span>
          {view.extraMinutesLeft > 0 ? (
            <>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {EXTRA_CHOICES.filter((m) => m <= view.extraMinutesLeft).map((m) => (
                  <button
                    key={m}
                    type="button"
                    aria-pressed={minutes === m}
                    onClick={() => setMinutes(m)}
                    style={{
                      ...monoPillStyle,
                      cursor: "pointer",
                      padding: "6px 10px",
                      background: minutes === m ? "var(--green-wash)" : "var(--page)",
                      color: minutes === m ? "var(--green-deep)" : "var(--ink-soft)",
                      border: `1px solid ${minutes === m ? "var(--green)" : "var(--rule)"}`,
                    }}
                  >
                    {m} min
                  </button>
                ))}
              </div>
              <span style={{ fontSize: 11.5, color: "var(--ink-mute)" }}>{view.extraMinutesLeft} min of extra time left for this try.</span>
              <button
                type="button"
                className="btn-primary"
                disabled={minutes === null}
                onClick={() => {
                  if (minutes === null) return;
                  onRequestTime(minutes);
                  setMinutes(null);
                  setAsking(false);
                }}
              >
                Add time
              </button>
            </>
          ) : (
            <span style={{ fontSize: 12.5, color: "var(--ink-mute)" }}>You have used all the extra time for this try.</span>
          )}
        </div>
      )}
    </div>
  );
}

/* ── What to do now ────────────────────────────────────────────────────── */

function Actions({ view, onStart, onResume, onCapture, onViewTask }: TaskTimerPanelProps) {
  const last = view.session >= view.task.sessions;
  const breakBtn =
    view.breaksLeft > 0 ? (
      <button type="button" className="tt-cta tt-cta--outline" onClick={() => onCapture("break")}>
        <PauseIcon /> Take a break
      </button>
    ) : null;

  if (view.blockedBy) {
    return (
      <button type="button" className="tt-cta tt-cta--ochre" onClick={() => onViewTask(view.blockedBy!.id)}>
        <ClockIcon /> Go to running task
      </button>
    );
  }

  switch (view.stage) {
    case "ready":
      return (
        <button type="button" className="tt-cta tt-cta--primary" onClick={onStart}>
          <PlayIcon />
          {view.task.sessions === 1 ? "Start work session" : `Start Session ${view.session} of ${view.task.sessions}`}
        </button>
      );
    case "running":
      return (
        <Stack>
          {last ? (
            <button type="button" className="tt-cta tt-cta--primary" onClick={() => onCapture("final")}>
              <CheckIcon /> Mark task as Done
            </button>
          ) : (
            <button type="button" className="tt-cta tt-cta--primary" onClick={() => onCapture("session")}>
              <CheckIcon /> Session complete
            </button>
          )}
          {breakBtn}
        </Stack>
      );
    case "break":
      return (
        <Stack>
          <p style={{ fontSize: 12.5, color: "var(--ink-mute)", textAlign: "center", margin: 0 }}>
            On break — {formatClock(view.remainingSeconds)} held for when you come back.
            {view.breaksLeft === 0 ? " No breaks left this session." : ` ${view.breaksLeft} break${view.breaksLeft === 1 ? "" : "s"} remaining.`}
          </p>
          <button type="button" className="tt-cta tt-cta--primary" onClick={onResume}>
            <PlayIcon /> Resume session
          </button>
        </Stack>
      );
    case "expired":
      return (
        <button type="button" className="tt-cta tt-cta--crit" onClick={() => onCapture(last ? "final" : "expired")}>
          {last ? "Mark task as Done" : "Share session update"}
        </button>
      );
    case "allDone":
      return (
        <Stack>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontFamily: "var(--serif)", fontSize: 20, color: "var(--ink)" }}>All sessions complete</div>
            <p style={{ fontSize: 13, color: "var(--ink-mute)", margin: "6px 0 0" }}>
              Share your final update and mark the task as done.
            </p>
          </div>
          <button type="button" className="tt-cta tt-cta--primary" onClick={() => onCapture("final")}>
            <CheckIcon /> Mark task as Done
          </button>
        </Stack>
      );
    case "reviewing":
      return (
        <div
          role="status"
          style={{
            display: "flex",
            gap: 10,
            alignItems: "center",
            padding: "14px 16px",
            background: "var(--ok-wash)",
            color: "var(--ok)",
            borderRadius: "var(--r-lg)",
          }}
        >
          <CheckIcon />
          <span>
            <strong style={{ display: "block", fontSize: 14 }}>Reviewing the task</strong>
            <span style={{ fontSize: 12.5, color: "var(--ink-soft)" }}>
              Your final update is with {view.task.acharya.name} for evaluation.
            </span>
          </span>
        </div>
      );
  }
}

/* ── Proof form ────────────────────────────────────────────────────────── */

const CAPTURE_COPY: Record<
  CaptureReason,
  { eyebrow: string; tone: string; heading: string; helper: string; submit: string; required: boolean }
> = {
  session: {
    eyebrow: "Session ended",
    tone: "var(--green-deep)",
    heading: "Session complete — share your progress",
    helper: "Add 1–5 photos and a short completion note — both are required.",
    submit: "Submit update",
    required: true,
  },
  expired: {
    eyebrow: "Session ended",
    tone: "var(--crit)",
    heading: "Time's up — share your progress",
    helper: "Add 1–5 photos and a short completion note — both are required.",
    submit: "Submit update",
    required: true,
  },
  break: {
    eyebrow: "Break time",
    tone: "var(--ochre)",
    heading: "Take a break",
    helper: "A photo or a line on where you stopped helps you pick it back up. Both are optional.",
    submit: "Submit & take break",
    required: false,
  },
  final: {
    eyebrow: "Final update",
    tone: "var(--green-deep)",
    heading: "Mark the task as done",
    helper: "Add 1–5 photos and a note on what you delivered — the acharya evaluates this.",
    submit: "Submit for review",
    required: true,
  },
};

const MAX_PHOTOS = 5;

function CaptureForm({
  reason,
  breaksLeft,
  onCancel,
  onSubmit,
}: {
  reason: CaptureReason;
  breaksLeft: number;
  onCancel: () => void;
  onSubmit: (p: CapturePayload) => void;
}) {
  const copy = CAPTURE_COPY[reason];
  const [text, setText] = useState("");
  const [photos, setPhotos] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const ready = !copy.required || (text.trim().length > 0 && photos > 0);
  const empty = text.trim().length === 0 && photos === 0;

  useEffect(() => {
    ref.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    ref.current?.querySelector("textarea")?.focus({ preventScroll: true });
  }, []);

  return (
    <div
      ref={ref}
      className="tt-card"
      style={{ display: "flex", flexDirection: "column", gap: 12, borderColor: copy.tone, boxShadow: "var(--shadow-md)" }}
    >
      <div>
        <span className="tt-eyebrow" style={{ color: copy.tone }}>
          {copy.eyebrow}
        </span>
        <div style={{ fontFamily: "var(--serif)", fontSize: 18, color: "var(--ink)", marginTop: 4 }}>{copy.heading}</div>
        {reason === "break" && (
          <div style={{ fontSize: 12, color: "var(--ink-mute)", marginTop: 4 }}>
            The clock holds while you are away. {breaksLeft} break{breaksLeft === 1 ? "" : "s"} left this session.
          </div>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6 }}>
        {Array.from({ length: photos }, (_, i) => (
          <span key={i} style={photoTileStyle}>
            <ImageIcon />
            <button
              type="button"
              aria-label={`Remove photo ${i + 1}`}
              onClick={() => setPhotos((n) => n - 1)}
              style={photoRemoveStyle}
            >
              ×
            </button>
          </span>
        ))}
        {photos < MAX_PHOTOS && (
          <button type="button" onClick={() => setPhotos((n) => n + 1)} style={addPhotoStyle}>
            <CameraIcon />
            <span>{photos === 0 ? "Take photo" : `${photos}/${MAX_PHOTOS}`}</span>
          </button>
        )}
      </div>

      <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-soft)" }}>
          {reason === "break" ? "Where did you stop?" : "Describe what you accomplished in this interval"}
        </span>
        <textarea
          className="form-textarea"
          rows={3}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={
            reason === "break" ? "e.g. Webhook handler written, tests next" : "e.g. Order flow wired to Razorpay test keys; refunds next"
          }
        />
      </label>
      <span style={{ fontSize: 11.5, color: "var(--ink-mute)" }}>{copy.helper}</span>

      <Stack>
        <button
          type="button"
          className={`tt-cta ${reason === "expired" ? "tt-cta--crit" : "tt-cta--primary"}`}
          disabled={!ready}
          onClick={() => onSubmit({ text: text.trim(), photos })}
        >
          {reason === "break" && empty ? "Take break" : copy.submit}
        </button>
        {reason === "break" && !empty && (
          <button type="button" className="tt-cta tt-cta--outline" onClick={() => onSubmit({ text: "", photos: 0 })}>
            Take break without proof
          </button>
        )}
        {reason !== "expired" && (
          <button type="button" onClick={onCancel} style={linkBtnStyle}>
            {reason === "break" ? "Keep working" : "Cancel"}
          </button>
        )}
      </Stack>
    </div>
  );
}

/* ── Reference: plan, subtasks, updates ────────────────────────────────── */

function duration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return [h ? `${h} hr` : "", m ? `${m} min` : ""].filter(Boolean).join(" ");
}

function PlanCard({ task }: { task: TimerTask }) {
  const total = duration(task.sessions * task.sessionMinutes);
  const line = task.subtasks?.length
    ? `${task.subtasks.length} subtasks · ${task.sessions} sessions · ${total} total`
    : `${task.sessions} session${task.sessions === 1 ? "" : "s"} (${total}) and ${task.breaksPerSession} break${
        task.breaksPerSession === 1 ? "" : "s"
      } per session`;
  return (
    <div className="tt-card" style={{ display: "flex", gap: 10, alignItems: "flex-start", boxShadow: "var(--shadow-sm)" }}>
      <span style={{ color: "var(--ink-mute)", marginTop: 1 }}>
        <ClockIcon />
      </span>
      <span>
        <span className="tt-eyebrow" style={{ display: "block" }}>
          Sessions
        </span>
        <span style={{ display: "block", fontSize: 14, color: "var(--ink-soft)", marginTop: 3 }}>{line}</span>
      </span>
    </div>
  );
}

const SUBTASK_PILL: Record<TimerSubtask["status"], { label: string; bg: string; fg: string }> = {
  done: { label: "Done", bg: "var(--ok-wash)", fg: "var(--ok)" },
  current: { label: "Current", bg: "var(--green-wash)", fg: "var(--green-deep)" },
  pending: { label: "Pending", bg: "var(--surface-sunk)", fg: "var(--ink-mute)" },
};

function Subtasks({ items, minutes }: { items: TimerSubtask[]; minutes: number }) {
  const slots = [...new Set(items.map((s) => s.session))].sort((a, b) => a - b);
  return (
    <section>
      <h3 className="tt-section-title">Subtasks</h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {slots.map((slot) => {
          const inSlot = items.filter((s) => s.session === slot);
          return (
            <div key={slot} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-mute)" }}>
                Session {slot} ({inSlot.length} subtask{inSlot.length === 1 ? "" : "s"} · {minutes} min)
              </span>
              {inSlot.map((s) => {
                const pill = SUBTASK_PILL[s.status];
                return (
                  <div
                    key={s.id}
                    className="tt-card"
                    style={{
                      padding: "10px 12px",
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      background: s.status === "current" ? "var(--green-wash)" : "var(--surface)",
                    }}
                  >
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: "block", fontSize: 13.5, fontWeight: 700, color: "var(--ink)" }}>{s.title}</span>
                      <span style={{ display: "block", fontSize: 11.5, color: "var(--ink-mute)", marginTop: 2 }}>
                        {s.status === "done" ? "Done in this session" : "Part of this session"}
                      </span>
                    </span>
                    {s.status === "done" && s.workedSeconds && (
                      <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-mute)" }}>
                        {formatClock(s.workedSeconds)}
                      </span>
                    )}
                    <span style={{ ...monoPillStyle, background: pill.bg, color: pill.fg }}>{pill.label}</span>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Updates({ task }: { task: TimerTask }) {
  if (task.updates.length === 0) return null;
  return (
    <section>
      <h3 className="tt-eyebrow" style={{ margin: "0 0 8px", fontWeight: 400 }}>
        Session updates · {task.updates.length}
      </h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {[...task.updates].reverse().map((u, i) => (
          <div key={u.id} className="tt-card" style={{ display: "flex", gap: 10 }}>
            <span style={updateNumStyle}>{task.updates.length - i}</span>
            <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--ink-mute)" }}>
                {u.at} · Session {u.session}
              </span>
              {u.text && <span style={{ fontSize: 13, lineHeight: 1.5, color: "var(--ink-soft)" }}>{u.text}</span>}
              {u.photos > 0 && (
                <span style={{ display: "flex", gap: 5 }}>
                  {Array.from({ length: u.photos }, (_, k) => (
                    <span key={k} style={{ ...photoTileStyle, width: 44, height: 44, aspectRatio: "auto" }}>
                      <ImageIcon />
                    </span>
                  ))}
                </span>
              )}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ── Bits ──────────────────────────────────────────────────────────────── */

function Stack({ children }: { children: ReactNode }) {
  return <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{children}</div>;
}

function Icon({ children, size = 15 }: { children: ReactNode; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
      {children}
    </svg>
  );
}
const ClockIcon = () => (
  <Icon>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </Icon>
);
const PlayIcon = () => (
  <Icon>
    <path d="M7 4.5v15l12-7.5z" fill="currentColor" />
  </Icon>
);
const PauseIcon = () => (
  <Icon>
    <path d="M9 5v14M15 5v14" />
  </Icon>
);
const CheckIcon = () => (
  <Icon>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </Icon>
);
const BoardIcon = () => (
  <Icon size={12}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M9 4v16M15 4v16" />
  </Icon>
);
const ImageIcon = () => (
  <Icon size={16}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <circle cx="9" cy="10" r="1.6" />
    <path d="m21 16-5-5-9 9" />
  </Icon>
);
const CameraIcon = () => (
  <Icon size={16}>
    <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
    <circle cx="12" cy="13" r="3.5" />
  </Icon>
);

const headerStyle: CSSProperties = {
  height: 64,
  flexShrink: 0,
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "0 14px 0 20px",
  borderBottom: "1px solid var(--rule)",
  background: "var(--page)",
};

const avatarStyle: CSSProperties = {
  width: 34,
  height: 34,
  borderRadius: "50%",
  flexShrink: 0,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  background: "var(--green-deep)",
  color: "#f4efdf",
  fontFamily: "var(--serif)",
  fontStyle: "italic",
  fontSize: 13,
};

const acharyaNameStyle: CSSProperties = {
  display: "block",
  fontFamily: "var(--serif)",
  fontStyle: "italic",
  fontSize: 15,
  color: "var(--ink)",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const taskDoneStyle: CSSProperties = {
  flexShrink: 0,
  padding: "7px 12px",
  background: "transparent",
  border: "1px solid var(--green-deep)",
  borderRadius: "var(--r-sm)",
  color: "var(--green-deep)",
  fontSize: 12.5,
  fontWeight: 600,
  cursor: "pointer",
};

const closeStyle: CSSProperties = {
  width: 34,
  height: 34,
  flexShrink: 0,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  background: "transparent",
  border: "1px solid var(--rule)",
  borderRadius: "var(--r-sm)",
  color: "var(--ink-soft)",
  cursor: "pointer",
  padding: 0,
};

const titleStyle: CSSProperties = {
  fontFamily: "var(--serif)",
  fontStyle: "italic",
  fontSize: 24,
  lineHeight: 1.2,
  fontWeight: 500,
  color: "var(--ink)",
};

const chipStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  height: 26,
  padding: "0 9px",
  fontFamily: "var(--mono)",
  fontSize: 10,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--ink-mute)",
  background: "var(--surface-sunk)",
  border: "1px solid var(--rule)",
  borderRadius: "var(--r-sm)",
  maxWidth: "100%",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const monoPillStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "4px 9px",
  fontFamily: "var(--mono)",
  fontSize: 10,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--ink-soft)",
  border: "none",
  borderRadius: 999,
  whiteSpace: "nowrap",
};

const blockedBtnStyle: CSSProperties = {
  flexShrink: 0,
  padding: "6px 10px",
  background: "var(--ochre)",
  color: "#f4efdf",
  border: "none",
  borderRadius: "var(--r-sm)",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
};

const ruleStyle: CSSProperties = { border: "none", borderTop: "1px solid var(--rule)", margin: "4px 0" };

const photoTileStyle: CSSProperties = {
  position: "relative",
  aspectRatio: "1",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: "var(--r-md)",
  color: "var(--ink-faint)",
  background: "repeating-linear-gradient(135deg, var(--surface-sunk) 0 6px, var(--page) 6px 12px)",
  border: "1px solid var(--rule)",
};

const photoRemoveStyle: CSSProperties = {
  position: "absolute",
  top: -6,
  right: -6,
  width: 18,
  height: 18,
  borderRadius: "50%",
  border: "none",
  background: "var(--ink)",
  color: "var(--surface)",
  fontSize: 12,
  lineHeight: 1,
  cursor: "pointer",
  padding: 0,
};

const addPhotoStyle: CSSProperties = {
  aspectRatio: "1",
  display: "inline-flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 3,
  borderRadius: "var(--r-md)",
  border: "1px dashed var(--rule-strong)",
  background: "var(--page)",
  color: "var(--ink-mute)",
  fontSize: 9.5,
  fontWeight: 600,
  cursor: "pointer",
  padding: 0,
};

const linkBtnStyle: CSSProperties = {
  alignSelf: "center",
  background: "transparent",
  border: "none",
  color: "var(--ink-mute)",
  fontSize: 12.5,
  textDecoration: "underline",
  textUnderlineOffset: 2,
  cursor: "pointer",
  padding: 4,
};

const updateNumStyle: CSSProperties = {
  width: 22,
  height: 22,
  flexShrink: 0,
  borderRadius: "50%",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  background: "var(--ochre-wash)",
  color: "var(--ochre)",
  fontFamily: "var(--mono)",
  fontSize: 11,
  fontWeight: 700,
};
