"use client";
import WorkSymbol from "@/components/acharya/tasks/WorkSymbol";
import { JourneyIcon, type JourneyIconName } from "@/components/acharya/tasks/WorkProgressOverview";
import { taskCategory } from "@/acharya/lib/task-category";
import dynamic from "next/dynamic";
import { useState, useRef, useEffect, useCallback, type ReactNode, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import type { KarigarTask } from "@/acharya/lib/server/omnidel-client";
import { summariseTaskForVoice } from "@/acharya/lib/voice/task-voice-summary";
import { describeScreen } from "@/acharya/lib/voice/screen-state";
import { TaskDescription } from "@/components/acharya/tasks/TaskDescription";
import { formatSegmentPreview, formatSessionDetailLine, formatTimingRollupLabel } from "@/acharya/lib/planned-time";
import {
  normalizeSlotTimingRollup,
  sharedSlotRemainingFromRollup,
  nextTaskSegmentIndex,
  type AttemptSegmentRow,
} from "@/acharya/lib/karigar-timing-types";
import { isSimpleTaskType } from "@/acharya/lib/simple-task";
import { useStartTask, resolveRunningAttemptId, activeTaskUrl } from "@/acharya/lib/useStartTask";
import { ACTIVE_ATTEMPT_CHANGED_EVENT } from "@/acharya/lib/active-attempt-events";
import { useLang, useStrings } from "@/acharya/lib/i18n/useLang";
import { statusLabelFor } from "@/acharya/lib/i18n/strings";
import { displayTaskTitle, resolveTaskDescription } from "@/acharya/lib/task-text";
import { type ChipTone } from "@/components/acharya/shell/AcharyaHeader";
import { useAcharyaShell } from "@/components/acharya/shell/AcharyaShell";
import type { QuizVoiceApi } from "@/components/acharya/learn/TaskQuizTab";
import { useInstantNav } from "@/components/acharya/shell/instant-nav";
import { LearnSkeleton } from "@/components/acharya/shell/nav-skeletons";
import { ghostIconOnMediaStyle } from "@/components/acharya/ui/ghost-icon-button";
import {
  MAX_PROOF_IMAGES,
  prepareProofFiles,
  uploadProofImages,
} from "@/components/acharya/tasks/update-capture-sheet";

const loadTaskQuizTab = () =>
  import("@/components/acharya/learn/TaskQuizTab").then((m) => ({ default: m.TaskQuizTab }));
const loadTaskChatTab = () =>
  import("@/components/acharya/learn/TaskChatTab").then((m) => ({ default: m.TaskChatTab }));
const loadTaskLearnTab = () =>
  import("@/components/acharya/learn/TaskLearnTab").then((m) => ({ default: m.TaskLearnTab }));
const loadTaskCommentsTab = () =>
  import("@/components/acharya/learn/TaskCommentsTab").then((m) => ({ default: m.TaskCommentsTab }));

const TaskQuizTab = dynamic(loadTaskQuizTab, {
  loading: () => <LearnSkeleton />,
});
const TaskChatTab = dynamic(loadTaskChatTab, {
  loading: () => <LearnSkeleton />,
});
const TaskLearnTab = dynamic(loadTaskLearnTab, {
  loading: () => <LearnSkeleton />,
});
const TaskCommentsTab = dynamic(loadTaskCommentsTab, {
  loading: () => <LearnSkeleton />,
  // Avoid SSR for this tab — HMR after notes/toast edits can leave a stale
  // webpack factory (`undefined.call`) that crashes server render.
  ssr: false,
});

// ── Status display config ────────────────────────────────────────────────────
// Status slug → AcharyaHeader chip tone. Legacy slugs fold onto the canonical
// planned/doing/done triad; anything unmapped (e.g. blocked) reads as muted.
const STATUS_TONE: Record<string, ChipTone> = {
  planned: "planned",
  open: "planned",
  doing: "doing",
  in_progress: "doing",
  done: "done",
};

const BODY_STATUS_STYLE: Record<ChipTone, CSSProperties> = {
  doing: { background: "var(--ochre-wash)", color: "var(--ochre)" },
  planned: { background: "var(--terra-wash)", color: "var(--terracotta)" },
  done: { background: "var(--ok-wash)", color: "var(--ok)" },
  muted: { background: "var(--surface-sunk)", color: "var(--ink-mute)" },
};

export type TaskSection = "task" | "chat" | "quiz" | "learn" | "comments";

// ── Evaluation result shape from the complete endpoint ───────────────────────
interface EvaluationResult {
  approved: boolean;
  score: number | null;
  notes: string | null;
  review_status?: string | null;
  acharya_score?: number | null;
  final_score?: number | null;
}

// ── CompleteTaskSheet ────────────────────────────────────────────────────────
// Bottom-sheet modal for submitting task-done evidence (image or text).

type CaptureTab = "image" | "text";

interface CompleteTaskSheetProps {
  open: boolean;
  taskId: string;
  onClose: () => void;
  onEvaluated: (result: EvaluationResult) => void;
  /**
   * Simple tasks are manual-review-only — no Acharya AI reads the submission, so a
   * photo + note has nothing to feed. Allows Submit with neither filled in.
   */
  proofOptional?: boolean;
}

function CompleteTaskSheet({ open, taskId, onClose, onEvaluated, proofOptional = false }: CompleteTaskSheetProps) {
  const s = useStrings();
  const [activeTab, setActiveTab] = useState<CaptureTab>("image");
  const [textValue, setTextValue] = useState("");
  const [images, setImages] = useState<Array<{ file: File; preview: string }>>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

    function clearDraft() {
    setActiveTab("image");
    setTextValue("");
    setImages((prev) => {
      for (const item of prev) {
        try { URL.revokeObjectURL(item.preview); } catch { /* ignore */ }
      }
      return [];
    });
    setError(null);
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  }

  // Keep draft across backdrop close; only reset when switching tasks.
  useEffect(() => {
    clearDraft();
    setSubmitting(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    // Reset first so re-picking the same file still fires a change event.
    if (cameraInputRef.current) cameraInputRef.current.value = "";
    if (picked.length === 0) return;

    // Shared vetting — names the file and its size instead of failing at submit.
    const { accepted, error: pickError } = await prepareProofFiles(picked, images.length);
    setError(pickError);
    if (accepted.length === 0) return;

    setImages((prev) => [
      ...prev,
      ...accepted.map((file) => ({ file, preview: URL.createObjectURL(file) })),
    ]);
  }

  function removeImage(index: number) {
    setImages((prev) => {
      const target = prev[index];
      if (target) {
        try { URL.revokeObjectURL(target.preview); } catch { /* ignore */ }
      }
      return prev.filter((_, i) => i !== index);
    });
  }

  async function handleSubmit() {
    const trimmedText = textValue.trim();
    // Simple tasks may submit with neither photo nor note (proofOptional).
    if (!proofOptional && (images.length === 0 || !trimmedText)) {
      setError("Add 1–5 photos and a short note of what you completed.");
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      const attachments = images.length > 0
        ? await uploadProofImages(images.map((i) => i.file))
        : [];
      const first = attachments[0];
      // Build defensively: with no photo `first` is undefined, and reading
      // first.url would throw before the request was ever made.
      const payload: {
        kind: "image" | "text";
        text?: string;
        blob_url?: string;
        blob_mime?: string;
        attachments?: Array<{ url: string; mime: string }>;
        attempt_id?: string;
      } = {
        // OmniDel's enum is image | text | voice. No photo → "text".
        kind: attachments.length > 0 ? "image" : "text",
        attachments,
      };
      if (trimmedText) payload.text = trimmedText;
      if (first) {
        payload.blob_url = first.url;
        payload.blob_mime = first.mime;
      }
      const activeAttemptId = await resolveRunningAttemptId(taskId);
      if (activeAttemptId) payload.attempt_id = activeAttemptId;

      const r = await fetch(`/api/work/tasks/${taskId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!r.ok) {
        const data = await r.json().catch(() => null);
        throw new Error(data?.error || `Server error ${r.status}`);
      }

      const data = await r.json() as { evaluation?: EvaluationResult };
      const evaluation: EvaluationResult = data.evaluation ?? {
        approved: false,
        score: null,
        notes: "Submitted — waiting for your team manager to review.",
        review_status: "pending_review",
      };

      onEvaluated(evaluation);
      clearDraft();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const TABS: Array<{ key: CaptureTab; label: string }> = [
    { key: "image", label: "Photo" },
    { key: "text",  label: "Write" },
  ];
  const canAddMore = images.length < MAX_PROOF_IMAGES;

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center"
      aria-modal="true"
      role="dialog"
      aria-labelledby="complete-sheet-title"
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-ink/40 backdrop-blur-sm fade-in"
      />

      {/* Sheet */}
      <div
        className="relative w-full max-w-lg bg-surface rounded-t-xl border border-line slide-up flex flex-col"
        style={{ boxShadow: "var(--shadow-lg)", maxHeight: "90dvh" }}
      >
        {/* Handle bar */}
        <div className="shrink-0 flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full" style={{ background: "var(--rule-strong)" }} />
        </div>

        {/* Header */}
        <div className="shrink-0 px-5 pb-3 border-b border-line">
          <p
            id="complete-sheet-title"
            className="font-mono text-[10px] tracking-[0.18em] uppercase"
            style={{ color: "var(--ink-mute)" }}
          >
            Task done
          </p>
          <h3
            className="font-serif italic text-xl leading-tight mt-0.5"
            style={{ color: "var(--ink)", fontWeight: 500 }}
          >
            Share what you did
          </h3>
          <p className="text-[13px] mt-1" style={{ color: "var(--ink-soft)" }}>
            Add 1–5 photos and a short note — both are required for review.
          </p>
        </div>

        {/* Tab bar */}
        <div className="shrink-0 flex border-b border-line px-5 gap-1 pt-3">
          {TABS.map(({ key, label }) => {
            const isActive = activeTab === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setActiveTab(key)}
                className="press px-4 py-2 text-sm font-medium rounded-t transition-colors"
                style={{
                  background: isActive ? "var(--surface-sunk)" : "transparent",
                  color: isActive ? "var(--green-deep)" : "var(--ink-soft)",
                  borderBottom: isActive ? "2px solid var(--green-deep)" : "2px solid transparent",
                  cursor: "pointer",
                }}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 hide-scrollbar">
          {submitting ? (
            <div
              className="fade-in rounded-lg px-4 py-8 text-center"
              style={{
                background: "var(--ochre-wash)",
                border: "1px solid var(--ochre)",
              }}
            >
              <p className="font-serif text-lg" style={{ color: "var(--ink)" }}>
                Evaluating your work…
              </p>
              <p className="text-sm mt-2 leading-relaxed" style={{ color: "var(--ink-soft)" }}>
                Your Acharya is reviewing your photos and notes, scoring the task, then sending it for manager review.
              </p>
              <div
                className="mx-auto mt-5 w-7 h-7 rounded-full border-2 animate-spin"
                style={{ borderColor: "var(--ochre)", borderTopColor: "transparent" }}
                aria-hidden
              />
            </div>
          ) : (
          <>
          {activeTab === "image" && (
            <div className="flex flex-col gap-3">
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                multiple
                capture="environment"
                className="sr-only"
                aria-label={s.proofTakePhoto}
                onChange={handleImageChange}
              />
              {images.length > 0 && (
                <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))" }}>
                  {images.map((item, index) => (
                    <div key={item.preview} className="relative rounded overflow-hidden" style={{ border: "1px solid var(--rule)" }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={item.preview}
                        alt={`Selected evidence photo ${index + 1}`}
                        className="w-full object-cover aspect-square"
                      />
                      <button
                        type="button"
                        onClick={() => removeImage(index)}
                        className="press absolute top-1 right-1"
                        style={ghostIconOnMediaStyle}
                        aria-label={`Remove photo ${index + 1}`}
                      >
                        <CloseIcon />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {canAddMore ? (
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="press w-full flex flex-col items-center justify-center gap-2 rounded-lg py-8"
                  style={{
                    background: "var(--surface-sunk)",
                    borderWidth: 1,
                    borderStyle: "dashed",
                    borderColor: "var(--rule-strong)",
                    color: "var(--ink-mute)",
                    minHeight: images.length > 0 ? 88 : 120,
                  }}
                >
                  <CameraIcon />
                  <span className="text-sm font-medium">
                    {images.length === 0
                      ? s.proofTakePhoto
                      : s.proofAddAnother(images.length, MAX_PROOF_IMAGES)}
                  </span>
                </button>
              ) : (
                <p className="text-xs" style={{ color: "var(--ink-mute)" }}>
                  {s.proofMaxPhotos(MAX_PROOF_IMAGES)}
                </p>
              )}
            </div>
          )}

          {activeTab === "text" && (
            <textarea
              value={textValue}
              onChange={(e) => setTextValue(e.target.value)}
              placeholder="Describe what you completed — what did you do, what did you make?"
              rows={6}
              className="w-full rounded p-3 text-sm resize-none"
              style={{
                background: "var(--surface-sunk)",
                borderWidth: 1,
                borderStyle: "solid",
                borderColor: "var(--rule)",
                color: "var(--ink)",
                outline: "none",
                fontFamily: "var(--font-sans)",
                lineHeight: 1.6,
              }}
              aria-label="Describe what you completed"
            />
          )}

          {error && (
            <p
              className="mt-3 text-sm rounded px-3 py-2"
              role="alert"
              style={{
                background: "var(--crit-wash)",
                color: "var(--crit)",
                borderWidth: 1,
                borderStyle: "solid",
                borderColor: "color-mix(in srgb, var(--crit) 20%, transparent)",
              }}
            >
              {error}
            </p>
          )}
          </>
          )}
        </div>

        {/* Footer */}
        <div
          className="shrink-0 px-4 py-4 border-t border-line pb-safe flex gap-3"
        >
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="press flex-1 px-4 py-3 rounded text-sm font-semibold transition-colors"
            style={{
              background: "transparent",
              borderWidth: 1,
              borderStyle: "solid",
              borderColor: "var(--rule)",
              color: "var(--ink-soft)",
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => { void handleSubmit(); }}
            disabled={submitting || (!proofOptional && (images.length === 0 || !textValue.trim()))}
            className="press flex-[2] px-4 py-3 rounded text-sm font-bold transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            style={{
              background: "var(--green-deep)",
              color: "#f4efdf",
            }}
          >
            {submitting ? (
              <>
                <span
                  className="w-4 h-4 rounded-full border-2 animate-spin"
                  style={{ borderColor: "#f4efdf", borderTopColor: "transparent" }}
                />
                Evaluating…
              </>
            ) : (
              "Submit for review"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── EvaluationResultCard ─────────────────────────────────────────────────────
// Shown after the evaluator returns. Green check + score bar + notes.

interface EvaluationResultCardProps {
  result: EvaluationResult;
  onDone: () => void;
}

function EvaluationResultCard({ result, onDone }: EvaluationResultCardProps) {
  const displayScore = result.acharya_score ?? result.score;
  const scorePercent = displayScore != null ? Math.round(displayScore * 100) : 0;
  const pending = !result.approved && (result.review_status === "pending_review" || result.review_status == null);
  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center"
      aria-modal="true"
      role="dialog"
      aria-labelledby="eval-result-title"
    >
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm fade-in" />
      <div
        className="relative w-full max-w-lg bg-surface rounded-t-xl border border-line slide-up flex flex-col"
        style={{ boxShadow: "var(--shadow-lg)" }}
      >
        {/* Handle */}
        <div className="shrink-0 flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full" style={{ background: "var(--rule-strong)" }} />
        </div>

        <div className="px-6 pt-2 pb-6 flex flex-col gap-4">
          {/* Icon + heading */}
          <div className="flex items-center gap-3">
            <span
              className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
              style={{ background: result.approved ? "var(--ok-wash)" : "var(--ochre-wash)" }}
              aria-hidden
            >
              {result.approved ? <CheckIcon color="var(--ok)" /> : <HoldIcon color="var(--ochre)" />}
            </span>
            <div>
              <p
                id="eval-result-title"
                className="font-serif italic text-lg leading-tight"
                style={{ color: "var(--ink)", fontWeight: 500 }}
              >
                {result.approved
                  ? "Score approved"
                  : pending && displayScore != null
                    ? "Acharya scored — sent for review"
                    : "Submitted for review"}
              </p>
              <p className="text-xs mt-0.5" style={{ color: "var(--ink-mute)" }}>
                {result.approved
                  ? "Your team manager approved the final score"
                  : "Your Acharya evaluated the proof; a manager will confirm in OmniPulse Review"}
              </p>
            </div>
          </div>

          {/* Score bar — Acharya provisional while pending, final after manager review */}
          {displayScore != null ? (
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium" style={{ color: "var(--ink-soft)" }}>
                {result.approved ? "Final score" : "Acharya score"}
              </span>
              <span className="font-mono text-sm font-bold" style={{ color: "var(--green-deep)" }}>
                {(displayScore * 10).toFixed(1)}/10
              </span>
            </div>
            <div
              className="w-full rounded-full overflow-hidden"
              style={{ height: 8, background: "var(--surface-sunk)", border: "1px solid var(--rule)" }}
              role="progressbar"
              aria-valuenow={scorePercent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Score: ${(displayScore * 10).toFixed(1)}/10`}
            >
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${scorePercent}%`,
                  background: scorePercent >= 70 ? "var(--ok)" : scorePercent >= 40 ? "var(--ochre)" : "var(--crit)",
                }}
              />
            </div>
          </div>
          ) : null}

          {/* Notes */}
          {result.notes && (
            <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "var(--ink-soft)" }}>
              {result.notes}
            </p>
          )}

          {/* Done CTA */}
          <button
            type="button"
            onClick={onDone}
            className="press w-full py-3.5 rounded text-sm font-bold"
            style={{ background: "var(--green-deep)", color: "#f4efdf" }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

// ── TaskDetailClient ─────────────────────────────────────────────────────────
// Main client component for the task detail page.
// Receives the pre-fetched task from the Server Component.

interface Props {
  task: KarigarTask & { missionName?: string | null };
  workspaceSlug: string;
  /** Acharya slug from the route params — owns all in-shell navigation. */
  acharyaSlug: string;
  /** Allows nested /learn?tab=... links to hydrate into the same task surface. */
  initialSection?: TaskSection;
  /** Allows the Acharya create_quiz tool to open the page and immediately start generation. */
  initialQuizStart?: boolean;
}

const taskTabRail: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
  gap: 6,
  padding: 4,
  borderRadius: "var(--r-md)",
  background: "var(--surface-sunk)",
  border: "1px solid var(--rule)",
  marginBottom: 16,
};

const taskTabButton: CSSProperties = {
  minHeight: 36,
  borderRadius: "var(--r-sm)",
  border: "none",
  background: "transparent",
  color: "var(--ink-mute)",
  fontFamily: "var(--sans)",
  fontSize: 12,
  fontWeight: 700,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  textDecoration: "none",
};

const taskTabActive: CSSProperties = {
  background: "var(--surface)",
  color: "var(--green-deep)",
  boxShadow: "0 1px 0 color-mix(in srgb, var(--ink) 8%, transparent)",
};

const taskTitleDivider: CSSProperties = {
  height: 1,
  margin: "6px 12px 16px",
  background: "color-mix(in srgb, var(--rule) 82%, transparent)",
};

const detailPanel: CSSProperties = {
  padding: "13px 14px",
  borderRadius: "var(--r-md)",
  background: "var(--surface)",
  border: "1px solid var(--rule)",
  color: "var(--ink)",
};

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h3
      style={{
        fontFamily: "var(--font-serif)",
        fontSize: 14,
        margin: 0,
        marginBottom: 10,
        color: "var(--ink)",
      }}
    >
      {children}
    </h3>
  );
}

function formatSubtaskElapsed(
  workedSeconds: number | null | undefined,
  startedAt: string | null | undefined,
  completedAt: string | null | undefined,
): string | null {
  // Prefer work-only seconds from the server (excludes voluntary-break pauses).
  if (typeof workedSeconds === "number" && Number.isFinite(workedSeconds) && workedSeconds > 0) {
    const totalSec = Math.max(0, Math.floor(workedSeconds));
    const minutes = Math.floor(totalSec / 60);
    const seconds = totalSec % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  // Fallback for older rollups without worked_seconds.
  if (!startedAt || !completedAt) return null;
  const startMs = Date.parse(startedAt);
  const endMs = Date.parse(completedAt);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) return null;
  const totalSec = Math.max(0, Math.floor((endMs - startMs) / 1000));
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function DI({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="journey-session-info"
      style={{
        padding: "12px 13px",
        borderRadius: "var(--r-md)",
        background: "var(--surface)",
        border: "1px solid var(--rule)",
        boxShadow: "0 1px 0 color-mix(in srgb, var(--ink) 6%, transparent)",
      }}
    >
      <span className="journey-session-icon"><JourneyIcon name="clock" /></span>
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "var(--ink-mute)",
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: 14,
          color: "var(--ink-soft)",
          lineHeight: 1.5,
          wordBreak: "break-word",
        }}
      >
        {value ?? "—"}
      </div>
    </div>
  );
}

// workspaceSlug is part of the component's public interface and may be used
// in future mutations (e.g. when Learn surface adds status write-back).
export default function TaskDetailClient({
  task: initialTask,
  workspaceSlug,
  acharyaSlug,
  initialSection = "task",
  initialQuizStart = false,
}: Props) {
  const router = useRouter();
  const nav = useInstantNav();
  const [task, setTask] = useState(initialTask);
  const boardHref = `/acharyas/${acharyaSlug}`;
  const taskHref = `/acharyas/${acharyaSlug}/tasks/${task.id}`;
  const learnHref = `${taskHref}/learn`;
  const { setHeader, setScreenHandlers, setActiveTaskContext, notify, acharyaName: shellAcharyaName, acharyaAvatarUrl: shellAvatar, acharyaPersonaSummary: shellPersona } = useAcharyaShell();
  const lang = useLang();
  const s = useStrings();
  const taskTitle = displayTaskTitle(task.title, lang);
  // Keeps the manager's line breaks / bullets (TaskDescription renders them).
  const taskDescription = resolveTaskDescription(task.description, lang);
  const acharyaName = task.acharyaName?.trim() || shellAcharyaName || "Acharya";

  const [showCompleteSheet, setShowCompleteSheet] = useState(false);
  const [evaluation, setEvaluation] = useState<EvaluationResult | null>(null);
  const [activeSection, setActiveSection] = useState<TaskSection>(initialSection);
  const [visitedSections, setVisitedSections] = useState<ReadonlySet<TaskSection>>(
    () => new Set(["task", initialSection])
  );
  const [quizStartSignal, setQuizStartSignal] = useState(() => (initialQuizStart ? 1 : 0));

  useEffect(() => {
    setActiveSection(initialSection);
    setVisitedSections((prev) => new Set(prev).add(initialSection));
  }, [initialSection]);

  // Keep local task in sync when the server re-renders with a new prop.
  useEffect(() => {
    setTask(initialTask);
  }, [initialTask]);

  /** Pull live checklist/timing from OmniDel (bypasses Acharya 120s cache). */
  const refreshTaskFresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/work/tasks/${initialTask.id}?fresh=1`, { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json() as { item?: typeof initialTask };
      if (data.item) {
        setTask((prev) => ({
          ...data.item!,
          workspaceSlug: data.item!.workspaceSlug ?? prev.workspaceSlug,
          acharyaInitial: (data.item!.acharyaName?.trim()[0] || prev.acharyaInitial || "·").toUpperCase(),
          missionName: (data.item as { missionName?: string | null }).missionName ?? prev.missionName,
        }));
      }
    } catch {
      // Best-effort — keep showing last known task.
    }
  }, [initialTask.id]);

  // When the karigar returns to the app/tab, pick up OmniDel checklist edits.
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === "visible") {
        void refreshTaskFresh();
      }
    }
    function onFocus() {
      void refreshTaskFresh();
    }
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onFocus);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onFocus);
    };
  }, [refreshTaskFresh]);

  const timingRollup = normalizeSlotTimingRollup(task.timingRollup, task.sessionCount);
  const isSimpleTask =
    task.isSimpleTask
    || task.timingMode === "simple"
    || isSimpleTaskType({ id: task.taskTypeId, slug: task.taskTypeSlug, name: task.taskTypeName });
  const isSubtaskTiming = !isSimpleTask && task.timingMode === "subtasks" && !!timingRollup;

  // ── Task-level multi-session progress ──────────────────────────────────────
  // A task with session_count > 1 and NO checklist rows keeps its progress ONLY
  // in the attempt ledger: buildTimingRollup is built from checklist rows and
  // returns null when there are none, so the task payload says nothing about how
  // many sessions are done. This page used to hardcode "session 1" as a result,
  // which restarted the 45:00 timer every time and — because each start inserts
  // another segment_index = 1 attempt row — left the task impossible to finish.
  //
  // One fetch drives both the CTA copy and the segment we request. While it is
  // in flight the value stays null, and useStartTask resolves it on tap, so a
  // slow ledger delays the label, never the work.
  const taskLevelSessionCount = Math.max(1, Math.floor(Number(task.sessionCount ?? 0) || 1));
  const needsLedgerSegment = !isSimpleTask && !isSubtaskTiming && taskLevelSessionCount > 1;
  const [ledgerSegment, setLedgerSegment] = useState<number | null>(null);
  // Bumped whenever an attempt opens or closes. Without this the label is
  // resolved once per mount, so a soft return from a finished session leaves the
  // CTA reading the session that was just completed. The tap always resolves
  // correctly regardless — only the copy would lie.
  const [ledgerNonce, setLedgerNonce] = useState(0);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const bump = () => setLedgerNonce((n) => n + 1);
    window.addEventListener(ACTIVE_ATTEMPT_CHANGED_EVENT, bump);
    return () => window.removeEventListener(ACTIVE_ATTEMPT_CHANGED_EVENT, bump);
  }, []);
  useEffect(() => {
    if (!needsLedgerSegment) {
      setLedgerSegment(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const r = await fetch(`/api/work/tasks/${task.id}/attempts`, { cache: "no-store" });
        if (!r.ok) return;
        const d = (await r.json()) as { items?: AttemptSegmentRow[] };
        if (!cancelled) setLedgerSegment(nextTaskSegmentIndex(d.items));
      } catch {
        // Best effort — the Start handler resolves it again on tap.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [needsLedgerSegment, task.id, task.statusSlug, ledgerNonce]);
  // Already sorted by session_slot in normalizeSlotTimingRollup; keep that order.
  const subtasks = timingRollup?.subtasks ?? [];
  // First incomplete in work order (session then list order) — not a stale "active".
  const currentSubtask = subtasks.find((s) => s.status === "active")
    || subtasks.find((s) => s.status === "pending")
    || null;
  const allSubtasksComplete = isSubtaskTiming && subtasks.length > 0 && subtasks.every((s) => s.status === "completed");
  const [forceAllComplete, setForceAllComplete] = useState(false);
  const effectiveAllSubtasksComplete = allSubtasksComplete || forceAllComplete;
  // Shared start-attempt flow (also used by the Learn surface). Owns the
  // POST → navigate-to-/active logic and 409-already-running handling.
  const {
    startTask: handleStartTask,
    startingTask,
    startError,
    clearStartError,
    hasActiveAttempt,
    activeAttemptStatus,
    activeBreaksRemaining,
    otherActiveTask,
  } =
    useStartTask(task.id, {
      returnTo: taskHref,
      doneReturnTo: boardHref,
      acharyaName,
      acharyaSlug,
    });

  // Subtask timing carries progress in `sessions_completed`. Task-level timing
  // does not, so hand over the ledger-resolved value — or `undefined`, which
  // makes useStartTask resolve it rather than falling back to session 1.
  const nextSegmentIndex = isSubtaskTiming && currentSubtask
    ? Math.min(currentSubtask.sessions_completed + 1, Math.max(1, currentSubtask.session_count))
    : (ledgerSegment ?? undefined);

  function openActiveSession() {
    // Paint ActiveSkeleton on the same tap — attemptId resolve can take a beat.
    nav.begin(`/acharyas/${acharyaSlug}/tasks/${task.id}/active`);
    void resolveRunningAttemptId(task.id).then((id) => {
      const params = new URLSearchParams();
      if (id) params.set("attemptId", id);
      params.set("returnTo", taskHref);
      params.set("doneReturnTo", boardHref);
      nav.push(`/acharyas/${acharyaSlug}/tasks/${task.id}/active?${params.toString()}`);
    });
  }

  // Header text is shell state → updates without the persistent header remounting.
  useEffect(() => {
    setHeader({
      showBack: true,
    });
  }, [setHeader]);

  useEffect(() => {
    setActiveTaskContext({
      taskId: task.id,
      taskTitle,
      chatHref: `${taskHref}?tab=chat`,
    });
    return () => setActiveTaskContext(null);
  }, [setActiveTaskContext, task.id, taskTitle, learnHref]);

  const handleSectionChange = useCallback(
    (section: TaskSection) => {
      setActiveSection(section);
      setVisitedSections((prev) => new Set(prev).add(section));
      clearStartError();
      if (section === "task") {
        window.history.replaceState(null, "", taskHref);
        void refreshTaskFresh();
      } else {
        window.history.replaceState(null, "", `${learnHref}?tab=${section}`);
      }
    },
    [learnHref, taskHref, clearStartError, refreshTaskFresh],
  );

  // Start Learn-course prebuild ASAP on task open (does not block UI). Old tasks
  // with no ops_task_courses row otherwise pay ~15s the first time Learn opens.
  useEffect(() => {
    void fetch("/api/work/course", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        taskId: task.id,
        acharyaSlug,
        lang,
        warm: true,
      }),
    }).catch(() => {
      /* best-effort prebuild */
    });
  }, [task.id, acharyaSlug, lang]);

  // Warm learn-tab JS chunks only when idle — eager Promise.all on mount was
  // competing with layout/CSS chunks and making Fast Refresh / first paint slow.
  useEffect(() => {
    let cancelled = false;
    const warmChunks = () => {
      if (cancelled) return;
      void loadTaskChatTab();
      void loadTaskLearnTab();
    };
    const ric = window.requestIdleCallback?.(warmChunks, { timeout: 4000 });
    const fallback = ric == null ? window.setTimeout(warmChunks, 2500) : null;
    return () => {
      cancelled = true;
      if (ric != null) window.cancelIdleCallback?.(ric);
      if (fallback != null) window.clearTimeout(fallback);
    };
  }, []);

  useEffect(() => {
    const openTaskChat = (event: Event) => {
      const detail = (event as CustomEvent<{ taskId?: string }>).detail;
      if (detail?.taskId && detail.taskId !== task.id) return;
      handleSectionChange("chat");
    };
    window.addEventListener("acharya:open-task-chat", openTaskChat);
    return () => window.removeEventListener("acharya:open-task-chat", openTaskChat);
  }, [handleSectionChange, task.id]);

  const handleVoiceTabChange = useCallback(
    async (args: { tab?: unknown }, fallback: TaskSection = "chat") => {
      const tab = typeof args.tab === "string" ? args.tab : "";
      handleSectionChange(
        tab === "task" || tab === "quiz" || tab === "learn" || tab === "chat" || tab === "comments" ? tab : fallback
      );
      return { ok: true };
    },
    [handleSectionChange],
  );

  const createQuizFromAcharya = useCallback(async () => {
    handleSectionChange("quiz");
    setQuizStartSignal((value) => value + 1);
    return { ok: true };
  }, [handleSectionChange]);

  // The quiz on screen, reachable from a tool call. `create_quiz` could open a
  // quiz and nothing could answer one: the karigar's spoken "Option A" reached a
  // model with no tool for it, so the run stopped at the first question. Held in
  // a ref, not state — publishing it must not re-render the task screen, and the
  // handlers below read it at call time.
  const quizVoiceRef = useRef<QuizVoiceApi | null>(null);
  const handleQuizVoiceApi = useCallback((api: QuizVoiceApi | null) => {
    quizVoiceRef.current = api;
  }, []);
  const handleQuizVoiceNote = useCallback((note: string) => notify(note), [notify]);

  useEffect(() => {
    const createQuiz = (event: Event) => {
      const detail = (event as CustomEvent<{ taskId?: string }>).detail;
      if (detail?.taskId && detail.taskId !== task.id) return;
      void createQuizFromAcharya();
    };
    window.addEventListener("acharya:create-quiz", createQuiz);
    return () => window.removeEventListener("acharya:create-quiz", createQuiz);
  }, [createQuizFromAcharya, task.id]);

  // This screen's tools layer onto the shell's base tools (open_task/go_back/
  // end_conversation). Swapping them does NOT re-mint the acharya session.
  async function beginWorkSession() {
    const slot = currentSubtask
      ? Math.max(1, Math.floor(Number(currentSubtask.session_slot) || 1))
      : null;
    const leftover =
      slot != null
        ? sharedSlotRemainingFromRollup(timingRollup, slot, {
            excludeItemId: currentSubtask?.id ?? null,
          })
        : null;
    const outcome = await handleStartTask({
      segmentIndex: nextSegmentIndex,
      checklistItemId: currentSubtask?.id ?? null,
      sessionSlot: slot,
      remainingSeconds: leftover,
    });
    if (outcome.ok && outcome.allComplete) {
      // Mark-as-done is timer-only; refresh so pending_review / rollup catch up.
      void refreshTaskFresh();
    }
    return outcome;
  }

  useEffect(() => {
    setScreenHandlers({
      // Answers from the task this screen already holds — no fetch, and it is
      // the same record the karigar is looking at. The shell's fallback covers
      // every other screen (see AcharyaShell.get_task_details).
      get_task_details: async () => ({
        ok: true,
        task: summariseTaskForVoice(task),
        now_showing:
          typeof window !== "undefined"
            ? describeScreen(window.location.pathname, window.location.search)
            : undefined,
      }),
      start_task: async () => {
        try {
          const slot = currentSubtask
            ? Math.max(1, Math.floor(Number(currentSubtask.session_slot) || 1))
            : null;
          const leftover =
            slot != null
              ? sharedSlotRemainingFromRollup(timingRollup, slot, {
                  excludeItemId: currentSubtask?.id ?? null,
                })
              : null;
          // Same opts as beginWorkSession — hook navigates to /active itself.
          const res = await handleStartTask({
            segmentIndex: nextSegmentIndex,
            checklistItemId: currentSubtask?.id ?? null,
            sessionSlot: slot,
            remainingSeconds: leftover,
          });
          // Voice must never claim a start that did not happen — surface the
          // one-task-at-a-time block back to the acharya verbatim.
          if (!res.ok) return { ok: false, error: res.message };
          return { ok: true };
        } catch (e) {
          return { ok: false, error: String(e) };
        }
      },
      open_learn: (args) => handleVoiceTabChange(args, "learn"),
      switch_tab: (args) => handleVoiceTabChange(args, "chat"),
      create_quiz: createQuizFromAcharya,
      // Answering out loud. `no_quiz_on_screen` when the quiz tab is not mounted
      // is a real answer the acharya can act on ("shall I open the quiz?") —
      // unlike the hook's "unhandled", which it can only apologise for.
      answer_quiz: async (args) => {
        const api = quizVoiceRef.current;
        if (!api) return { ok: false, error: "no_quiz_on_screen" };
        return api.answer(args.option ?? args.answer ?? args.choice);
      },
      next_quiz_question: async () => {
        const api = quizVoiceRef.current;
        if (!api) return { ok: false, error: "no_quiz_on_screen" };
        return api.next();
      },
    });
    return () => setScreenHandlers(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- beginWorkSession closes over latest start helpers
  }, [setScreenHandlers, task, handleStartTask, handleVoiceTabChange, createQuizFromAcharya, nextSegmentIndex, currentSubtask?.id, currentSubtask?.session_slot, timingRollup]);
  const isDone = task.statusSlug === "done";
  const isPendingReview =
    task.reviewStatus === "pending_review" ||
    evaluation?.review_status === "pending_review" ||
    (evaluation != null && evaluation.approved === false && evaluation.review_status !== "reviewed");
  // Board status stays "doing" until a manager approves — surface that clearly
  // so the worker does not think they still need to start another session.
  const statusText = isPendingReview
    ? s.reviewingTask
    : isDone
      ? s.completed
      : statusLabelFor(task.statusSlug, lang);
  const statusTone: ChipTone = isPendingReview
    ? "done"
    : isDone
      ? "done"
      : (STATUS_TONE[task.statusSlug] ?? "muted");
  const sessionCount = isSubtaskTiming
    ? (timingRollup?.total_sessions ?? 0)
    : (task.sessionCount ?? task.segmentPlan?.segment_count ?? 0);
  const breaksPerSession =
    task.breaksPerSession ??
    task.segmentPlan?.break_allowance_per_segment?.[0] ??
    (typeof task.breakAllowanceTotal === "number" ? task.breakAllowanceTotal : 1);
  const canStart = isSimpleTask
    ? true
    : isSubtaskTiming
      ? !!currentSubtask && !effectiveAllSubtasksComplete && currentSubtask.session_count >= 1
      : sessionCount >= 1;
  const sessionPreview = isSimpleTask
    ? null
    : isSubtaskTiming && timingRollup
    ? formatTimingRollupLabel(
        subtasks.length,
        timingRollup.total_sessions,
        timingRollup.total_planned_seconds,
        lang,
      )
    : sessionCount >= 1
      ? formatSessionDetailLine(sessionCount, breaksPerSession, lang)
      : task.segmentPlan
        ? formatSegmentPreview(task.segmentPlan, lang)
        : null;
  const currentSessionSlot = Math.max(1, Math.floor(Number(currentSubtask?.session_slot) || 1));
  // Task-level sessions name the ledger-resolved session, not a hardcoded 1 —
  // a worker three sessions in was being told "Start Session 1".
  const taskSessionLabel =
    ledgerSegment != null && taskLevelSessionCount > 1
      ? `Start Session ${Math.min(ledgerSegment, taskLevelSessionCount)} of ${taskLevelSessionCount}`
      : null;
  const startAriaLabel = isSimpleTask
    ? "Start task"
    : isSubtaskTiming && currentSubtask
    ? `Start Session ${currentSessionSlot}`
    : taskSessionLabel
      ?? (sessionCount >= 1 ? "Start work session" : "Start task session");
  const startButtonLabel = isSimpleTask
    ? "Start task"
    : isSubtaskTiming && currentSubtask
    ? `Start Session ${currentSessionSlot}`
    : taskSessionLabel ?? s.startTask;

  function handleEvaluated(result: EvaluationResult) {
    setShowCompleteSheet(false);
    setEvaluation(result);
  }

  function handleEvalDone() {
    setEvaluation(null);
    nav.push(boardHref);
    router.refresh();
  }

  const bodyScrollClass =
    activeSection === "task"
      ? "overflow-y-auto pb-40"
      : activeSection === "chat"
        ? "overflow-hidden pb-0"
        : "overflow-y-auto pb-8";

  return (
    <div
      className="flex flex-col journey-task-detail"
      style={{ flex: 1, minHeight: 0, background: "var(--page)" }}
    >
      {/* Header + voice live in the persistent AcharyaShell; this screen only
          feeds it text via setHeader and tools via setScreenHandlers. */}

      {/* ── Scrollable body ─────────────────────────────────────────────── */}
      <main
        className={`flex-1 hide-scrollbar px-5 pt-5 ${bodyScrollClass}`}
        // Read by work-journey.css: every tab but Chat lets its sections keep
        // their natural height so THIS element scrolls; Chat keeps a fixed-height
        // column because its thread is the scroller and the composer sits under it.
        data-section={activeSection}
        style={{
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
        }}
      >
        <nav className="journey-task-sections" aria-label="Task sections" style={taskTabRail}>
          <button
            type="button"
            aria-current={activeSection === "task" ? "page" : undefined}
            onClick={() => handleSectionChange("task")}
            className="press"
            style={{ ...taskTabButton, ...(activeSection === "task" ? taskTabActive : null) }}
          >
            <JourneyIcon name="work" /><span>{s.task}</span>
          </button>
          {[
            { label: s.chat, tab: "chat", icon: "chat" },
            { label: s.quiz, tab: "quiz", icon: "quiz" },
            { label: s.learnTab, tab: "learn", icon: "learn" },
            { label: s.comments, tab: "comments", icon: "chat" },
          ].map((item) => {
            const tab = item.tab as Exclude<TaskSection, "task">;
            const isActive = activeSection === tab;
            return (
            <button
              key={item.tab}
              aria-current={isActive ? "page" : undefined}
              type="button"
              onClick={() => handleSectionChange(tab)}
              className="press"
              style={{ ...taskTabButton, ...(isActive ? taskTabActive : null) }}
            >
              <JourneyIcon name={item.icon as JourneyIconName} /><span>{item.label}</span>
            </button>
            );
          })}
        </nav>

        {/* Title + symbol belong to the Task tab alone. Chat, Quiz, Learn and
            Comments each open with their own heading — Learn printed the task
            name twice in a row — and on Chat the block was pure vertical cost
            on a screen that has to fit the keyboard. The status / board chips
            below stay on every tab: they are context, not a second title. */}
        {activeSection === "task" && (
        <div className="journey-task-heading"><WorkSymbol category={taskCategory(task)} />
        <h1
          className="font-serif italic text-2xl leading-tight mb-3"
          style={{ color: "var(--ink)", fontWeight: 500 }}
        >
          {taskTitle}
        </h1></div>
        )}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              minHeight: 30,
              padding: "0 10px",
              borderRadius: "var(--r-sm)",
              fontFamily: "var(--mono)",
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              ...BODY_STATUS_STYLE[statusTone],
            }}
          >
            {statusText}
          </span>
          {isSimpleTask && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                minHeight: 30,
                padding: "0 10px",
                borderRadius: "var(--r-sm)",
                background: "var(--green-wash)",
                border: "1px solid var(--green-deep)",
                color: "var(--green-deep)",
                fontFamily: "var(--mono)",
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
              }}
            >
              {task.taskTypeName?.trim() || "Simple task"}
            </span>
          )}
          {task.isHabit && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                fontSize: 11,
                fontFamily: "var(--mono)",
                letterSpacing: "0.04em",
                padding: "3px 8px",
                borderRadius: 999,
                background: "var(--surface-sunk)",
                color: "var(--ink-soft)",
                border: "1px solid var(--rule)",
              }}
            >
              <span aria-hidden>⚡</span>
              {s.habit}
              {task.countsTowardScore === false && (
                <span style={{ color: "var(--ink-mute)", fontSize: 10 }}>· {s.noScoreImpact}</span>
              )}
            </span>
          )}
          {(task.workspaceName || task.boardName) && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                minHeight: 30,
                padding: "0 10px",
                borderRadius: "var(--r-sm)",
                background: "var(--surface-sunk)",
                border: "1px solid var(--rule)",
                color: "var(--ink-mute)",
                fontFamily: "var(--mono)",
                fontSize: 10,
                letterSpacing: "0.04em",
              }}
            >
              <BoardIcon />
              {[task.workspaceName, task.boardName].filter(Boolean).join("  ·  ")}
            </span>
          )}
        </div>
        <div aria-hidden style={taskTitleDivider} />

        {activeSection === "task" ? (
          /* Details — full width, left-aligned, two-column field grids */
          <div style={{ display: "flex", flexDirection: "column", gap: 20, width: "100%" }}>
            <section>
              <SectionTitle>{s.description}</SectionTitle>
              <div className="journey-task-description" style={detailPanel}>
                {taskDescription ? (
                  <TaskDescription text={taskDescription} lang={lang} />
                ) : (
                  <p className="text-[13.5px] italic" style={{ color: "var(--ink-faint)", margin: 0 }}>
                    {s.noDescription}
                  </p>
                )}
              </div>
            </section>

            {!isSimpleTask && (
            <section>
              <DI
                label={s.sessions}
                value={
                  isSubtaskTiming && timingRollup
                    ? formatTimingRollupLabel(
                        subtasks.length,
                        timingRollup.total_sessions,
                        timingRollup.total_planned_seconds,
                        lang,
                      )
                    : sessionCount >= 1
                      ? formatSessionDetailLine(sessionCount, breaksPerSession, lang)
                      : sessionPreview ?? "—"
                }
              />
            </section>
            )}

            {!isSimpleTask && isSubtaskTiming && subtasks.length > 0 && (
              <section>
                <SectionTitle>Subtasks</SectionTitle>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {(() => {
                    const bySlot = new Map<number, typeof subtasks>();
                    for (const sub of subtasks) {
                      const slot = Math.max(1, Math.floor(Number(sub.session_slot) || 1));
                      const list = bySlot.get(slot) ?? [];
                      list.push(sub);
                      bySlot.set(slot, list);
                    }
                    const slots = [...bySlot.keys()].sort((a, b) => a - b);
                    return slots.map((slot) => {
                      const slotItems = bySlot.get(slot) ?? [];
                      return (
                        <div key={`session-${slot}`} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          <div
                            style={{
                              fontFamily: "var(--mono)",
                              fontSize: 11,
                              fontWeight: 700,
                              letterSpacing: "0.08em",
                              textTransform: "uppercase",
                              color: "var(--ink-mute)",
                            }}
                          >
                            Session {slot}
                            <span style={{ fontWeight: 500, marginLeft: 6 }}>
                              ({slotItems.length} subtask{slotItems.length === 1 ? "" : "s"} · 45 min)
                            </span>
                          </div>
                          {slotItems.map((subtask) => {
                            const isCurrent = currentSubtask?.id === subtask.id;
                            const multiInSlot = slotItems.length > 1;
                            const elapsedLabel =
                              multiInSlot && subtask.status === "completed"
                                ? formatSubtaskElapsed(
                                    subtask.worked_seconds,
                                    subtask.started_at,
                                    subtask.completed_at,
                                  )
                                : null;
                            const statusLabel =
                              subtask.status === "completed"
                                ? "Done"
                                : isCurrent
                                  ? "Current"
                                  : "Pending";
                            const statusStyle =
                              subtask.status === "completed"
                                ? { background: "var(--ok-wash)", color: "var(--ok)" }
                                : isCurrent
                                  ? { background: "var(--green-wash)", color: "var(--green-deep)" }
                                  : { background: "var(--surface-sunk)", color: "var(--ink-mute)" };

                            return (
                              <div
                                key={subtask.id}
                                style={{
                                  padding: "12px 14px",
                                  borderRadius: "var(--r-md)",
                                  border: "1px solid var(--rule)",
                                  background: isCurrent ? "var(--green-wash)" : "var(--surface)",
                                }}
                              >
                                <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                                  <div style={{ minWidth: 0, flex: 1 }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                      <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", margin: 0 }}>
                                        {subtask.title}
                                      </h3>
                                      <span
                                        style={{
                                          ...statusStyle,
                                          borderRadius: 999,
                                          padding: "2px 8px",
                                          fontFamily: "var(--mono)",
                                          fontSize: 10,
                                          fontWeight: 800,
                                          letterSpacing: "0.06em",
                                          textTransform: "uppercase",
                                          display: "inline-flex",
                                          alignItems: "center",
                                          gap: 6,
                                        }}
                                      >
                                        {statusLabel}
                                        {elapsedLabel ? (
                                          <span style={{ fontWeight: 600, letterSpacing: "0.02em" }}>
                                            {elapsedLabel}
                                          </span>
                                        ) : null}
                                      </span>
                                    </div>
                                    <div style={{ fontSize: 12, color: "var(--ink-mute)", marginTop: 5 }}>
                                      {subtask.status === "completed"
                                        ? "Done in this session"
                                        : "Part of this session"}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    });
                  })()}
                </div>
              </section>
            )}
            {hasActiveAttempt && !isPendingReview && (
              <div
                className="rounded-lg px-4 py-3 flex items-center gap-3"
                style={{ background: "var(--green-wash)", border: "1px solid var(--green-soft)" }}
                role="status"
              >
                <span style={{ color: "var(--green-deep)" }}>
                  <TimerIcon />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold" style={{ color: "var(--green-deep)" }}>
                    {activeAttemptStatus === "paused" ? s.sessionPaused : s.attemptRunning}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--green)" }}>
                    {activeAttemptStatus === "paused"
                      ? `${s.attemptPaused}${typeof activeBreaksRemaining === "number" ? ` ${s.breaksRemaining(activeBreaksRemaining)}` : ""}`
                      : s.attemptActive}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={openActiveSession}
                  className="press px-3 py-1.5 rounded text-xs font-bold transition-colors"
                  style={{ background: "var(--green-deep)", color: "#f4efdf" }}
                >
                  {s.openTimer}
                </button>
              </div>
            )}

            {!hasActiveAttempt && otherActiveTask && (
              <div
                className="rounded-lg px-4 py-3 flex items-center gap-3"
                style={{ background: "var(--ochre-wash)", border: "1px solid var(--ochre)" }}
                role="status"
              >
                <span style={{ color: "var(--ochre)" }}>
                  <TimerIcon />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>
                    {s.anotherTaskActive}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--ink-soft)" }}>
                    {s.anotherTaskActiveDetail(otherActiveTask.taskTitle)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => { nav.push(activeTaskUrl(otherActiveTask)); }}
                  className="press px-3 py-1.5 rounded text-xs font-bold transition-colors"
                  style={{ background: "var(--ochre)", color: "#f4efdf" }}
                >
                  {s.openTimer}
                </button>
              </div>
            )}

            {startError && (
              <p className="text-sm" role="alert" style={{ color: "var(--crit)" }}>
                {startError}
              </p>
            )}
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              // Chat is sized to the screen (its thread scrolls); the others
              // grow with their content so the page itself scrolls.
              flex: activeSection === "chat" ? 1 : "1 0 auto",
              minHeight: activeSection === "chat" ? 0 : undefined,
            }}
          >
            {(["chat", "quiz", "learn", "comments"] as const).map((section) => {
              if (!visitedSections.has(section)) return null;
              const isActive = activeSection === section;
              return (
                <section
                  key={section}
                  hidden={!isActive}
                  style={{
                    display: isActive ? "flex" : "none",
                    flexDirection: "column",
                    flex: section === "chat" ? 1 : "1 0 auto",
                    minHeight: section === "chat" ? 0 : undefined,
                  }}
                >
                  {section === "chat" && (
                    <TaskChatTab
                      task={task}
                      workspaceSlug={workspaceSlug}
                      lang={lang}
                      returnTo={taskHref}
                      doneReturnTo={boardHref}
                    />
                  )}
                  {section === "quiz" && (
                    <TaskQuizTab
                      task={task}
                      workspaceSlug={workspaceSlug}
                      acharyaSlug={acharyaSlug}
                      lang={lang}
                      startSignal={quizStartSignal}
                      onVoiceApi={handleQuizVoiceApi}
                      onVoiceNote={handleQuizVoiceNote}
                    />
                  )}
                  {section === "learn" && (
                    <TaskLearnTab
                      task={task}
                      workspaceSlug={workspaceSlug}
                      acharyaSlug={acharyaSlug}
                      lang={lang}
                    />
                  )}
                  {section === "comments" && (
                    <TaskCommentsTab
                      taskId={task.id}
                      reviewStatus={
                        evaluation?.review_status === "reviewed" ||
                        evaluation?.approved
                          ? "reviewed"
                          : evaluation?.review_status === "pending_review" ||
                              task.reviewStatus === "pending_review"
                            ? "pending_review"
                            : task.reviewStatus ?? null
                      }
                      finalScore={
                        evaluation?.approved
                          ? (evaluation.final_score ?? evaluation.score ?? task.finalScore ?? null)
                          : (task.finalScore ?? null)
                      }
                      acharyaScore={
                        evaluation?.acharya_score ??
                        (!evaluation?.approved ? evaluation?.score : null) ??
                        task.acharyaScore ??
                        null
                      }
                    />
                  )}
                </section>
              );
            })}
          </div>
        )}
      </main>

      {/* ── Fixed bottom CTA area ────────────────────────────────────────── */}
      {activeSection === "task" && (
      <div
        className="fixed bottom-0 left-0 right-0 z-20 px-5 pb-safe journey-task-actions"
        style={{ background: "color-mix(in srgb, var(--page) 97%, transparent)", backdropFilter: "blur(12px)" }}
      >
        {/* Divider */}
        <div style={{ height: 1, background: "var(--rule)", marginBottom: 16 }} />

        {/* Primary CTAs */}
        <div className="flex gap-3 mb-4">
          {/* Another task is live — only one task may run at a time, so the
              only action here is to go finish that one. */}
          {!isDone && !hasActiveAttempt && otherActiveTask && (
            <button
              type="button"
              onClick={() => { nav.push(activeTaskUrl(otherActiveTask)); }}
              className="press flex-[2] flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-bold transition-colors"
              style={{ background: "var(--ochre)", color: "#f4efdf", minHeight: 52 }}
              aria-label={s.goToRunningTask}
            >
              <TimerIcon />
              {s.goToRunningTask}
            </button>
          )}

          {/* Pending OmniPulse review — Mark task as Done lives only on the timer.
              Prefer this over a stale "Open timer" chip when /complete left an
              attempt row running. */}
          {!otherActiveTask && isPendingReview && (
            <div
              className="flex-[2] flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-semibold"
              style={{
                background: "var(--ok-wash)",
                color: "var(--ok)",
                minHeight: 52,
              }}
              aria-label={s.reviewingTask}
              role="status"
            >
              <CheckIcon color="var(--ok)" />
              {s.reviewingTask}
            </div>
          )}

          {/* Start Task — primary when work remains */}
          {!isDone && !hasActiveAttempt && !otherActiveTask && !isPendingReview && !effectiveAllSubtasksComplete && (
            <button
              type="button"
              onClick={() => {
                void beginWorkSession();
              }}
              disabled={startingTask || !canStart}
              className="press flex-[2] flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-bold transition-colors disabled:opacity-60"
              style={{
                background: "var(--green-deep)",
                color: "#f4efdf",
                minHeight: 52,
              }}
              aria-label={startAriaLabel}
            >
              {startingTask ? (
                <>
                  <span
                    className="w-4 h-4 rounded-full border-2 animate-spin"
                    style={{ borderColor: "#f4efdf", borderTopColor: "transparent" }}
                  />
                  {s.starting}
                </>
              ) : (
                <>
                  <PlayIcon />
                  <span
                    style={{
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      maxWidth: "100%",
                    }}
                  >
                    {startButtonLabel}
                  </span>
                </>
              )}
            </button>
          )}

          {/* Resume / open the full-screen active session */}
          {!isDone && hasActiveAttempt && !isPendingReview && (
            <button
              type="button"
              onClick={openActiveSession}
              className="press flex-[2] flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-bold transition-colors"
              style={{ background: "var(--green-deep)", color: "#f4efdf", minHeight: 52 }}
            >
              <TimerIcon />
              {s.goToTimer}
            </button>
          )}

          {/* Task is done (manager-reviewed or terminal without pending review) */}
          {isDone && !isPendingReview && (
            <div
              className="flex-[2] flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-semibold"
              style={{
                background: "var(--ok-wash)",
                color: "var(--ok)",
                minHeight: 52,
              }}
              aria-label="Task completed"
            >
              <CheckIcon color="var(--ok)" />
              {s.completed}
            </div>
          )}
        </div>
      </div>
      )}

      {/* ── Complete task sheet ──────────────────────────────────────────── */}
      <CompleteTaskSheet
        open={showCompleteSheet}
        taskId={task.id}
        proofOptional={isSimpleTask}
        onClose={() => setShowCompleteSheet(false)}
        onEvaluated={handleEvaluated}
      />

      {/* ── Evaluation result card ───────────────────────────────────────── */}
      {evaluation && (
        <EvaluationResultCard
          result={evaluation}
          onDone={handleEvalDone}
        />
      )}
    </div>
  );
}

// ── Icons ────────────────────────────────────────────────────────────────────

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

function CameraIcon() {
  return (
    <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

function BoardIcon() {
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
      <line x1="9" x2="9" y1="3" y2="21" />
      <line x1="15" x2="15" y1="3" y2="21" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden>
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  );
}

function TimerIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 15 15" />
    </svg>
  );
}

function CheckIcon({ color = "currentColor" }: { color?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function HoldIcon({ color = "currentColor" }: { color?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden>
      <rect x="6.5" y="5" width="3.5" height="14" rx="1" fill={color} />
      <rect x="14" y="5" width="3.5" height="14" rx="1" fill={color} />
    </svg>
  );
}
