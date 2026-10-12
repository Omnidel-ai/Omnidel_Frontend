"use client";

/**
 * /tasks/[id]/active — Active Task Session Page
 *
 * Loaded after the user taps "Start Task" on the task detail page.
 * Expects a query param: ?attemptId=<uuid>  (set by the task detail page after
 * POST /api/omnipulse/tasks/[id]/attempts returns 201).
 *
 * Architecture:
 *   - Fully client-side: timer, beep, sheet open/close.
 *   - On mount: fetches attempt via GET /api/omnipulse/tasks/[id]/attempts/[attemptId]
 *     (routed through omnidel-acharya proxy → OmniDel omnipulse routes).
 *     Computes remaining = 45*60 - (now - started_at) seconds.
 *     If remaining ≤ 0 on load → triggers expired flow immediately.
 *   - Tick: setInterval(1s) re-reads the wall clock against a LOCALLY ANCHORED
 *     deadline (NOT remaining-1). Mobile browsers freeze/throttle intervals when the
 *     screen blanks; decrementing by 1 would stall the timer. Deadline-based sync
 *     keeps time advancing while the phone is locked, and visibilitychange/pageshow
 *     re-syncs on unlock.
 *     The anchor is `Date.now() + remaining_seconds * 1000`, i.e. the server's
 *     remaining DURATION — never the absolute `deadline_at` timestamp. Comparing a
 *     server timestamp against the device clock would make the countdown wrong by
 *     the handset's clock skew; anchoring locally measures only ELAPSED device time,
 *     which is skew-free. Field phones drift, so this matters.
 *   - On session end: timer reaches 0 → plays beep, opens UpdateCaptureSheet.
 *   - On update submit: POST with context segment_end only.
 *   - Task Done (top-right): opens final submission sheet (photo + note). Remaining
 *     checklist items are closed on /complete so OmniDel does not 409.
 *
 * NOTE ON PROXY ROUTES:
 *   The omnipulse routes live in OmniDel, not this app. This page calls them at
 *   the path they exist on OmniDel. In development with OMNIDEL_API_URL set,
 *   these calls are resolved through the omnidel-acharya proxy pattern.
 *   If direct client access to OmniDel is not available, a backend-agent task is
 *   needed to add proxy routes for:
 *     GET/POST  /api/work/tasks/[id]/attempts
 *     GET       /api/work/tasks/[id]/attempts/[attemptId]
 *     POST      /api/work/tasks/[id]/attempts/[attemptId]/updates
 *     POST      /api/work/tasks/[id]/complete
 *   Until those proxies exist, this page calls /api/work/... paths which are
 *   expected to be added by the backend-agent.
 *
 * Design intent (Emil Kowalski principles applied):
 *   - The timer ring + numerals ARE the screen. Everything else steps back.
 *   - Background phase transition uses a 1.2s ease — slow enough to feel like a
 *     mood shift, not a jarring state flash. At expired it uses a distinct
 *     transition-timing to signal urgency.
 *   - Buttons carry .press for tactile scale. CTA button and "Task Done" carry
 *     active:scale through the .press class defined in globals.css.
 *   - The interval label under the ring disappears when expired — "45-minute
 *     interval" is irrelevant once the alarm fires; the expired message replaces it.
 *   - Toast stays tight: dark pill, centered, enters on fade-up, no progress bar.
 *   - Loading spinner uses the same timing as .press transitions.
 *
 * MANUAL VERIFICATION REQUIRED:
 *   - Timer counts down 45:00 → 00:00 correctly
 *   - At ~25% remaining, ring and numerals shift to ochre. At ~10%, to crit/terracotta.
 *   - Background stays var(--page); warning/expired color lives on the ring + numerals only
 *   - At 00:00: beep plays, sheet opens (no full-surface wash)
 *   - Image upload flow: select image → submit → toast → timer resets to 45:00
 *   - Text update flow: type → submit → toast → timer resets
 *   - "Task Done" → completion sheet → success → navigate to /tasks
 *   - If page reloaded mid-session: timer resumes from correct remaining time
 *   - Screen lock / blank: timer keeps advancing (wall-clock vs the locally
 *     anchored deadline, seeded from the server's remaining duration)
 *   - .press class applies scale(0.97) on active tap for all interactive buttons
 *   - Reduced motion: background still transitions, but all transforms/scales are off
 *   - On very low-end Android: serif numerals load with swap (no FOIT)
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useInstantNav } from "@/components/acharya/shell/instant-nav";
import { ActiveSkeleton } from "@/components/acharya/shell/nav-skeletons";
import { ghostIconButtonStyle } from "@/components/acharya/ui/ghost-icon-button";
import { TimerRing } from "@/components/acharya/tasks/timer-ring";
import {
  MAX_PROOF_IMAGES,
  UpdateCaptureSheet,
  uploadProofImages,
  prepareProofFiles,
  type UpdatePayload,
} from "@/components/acharya/tasks/update-capture-sheet";
import { ProofConversationMic } from "@/components/acharya/voice/ProofConversationMic";
import { useProofVoiceAssist } from "@/acharya/hooks/useProofVoiceAssist";
import { sessionDurationSeconds, SESSION_DURATION_SECONDS } from "@/acharya/lib/planned-time";
import {
  coerceSessionSlot,
  completedSessionSlotCount,
  clampRemainingToSharedSlot,
  hasIncompleteOutsideSlot,
  isSlotTimingModel,
  normalizeSlotTimingRollup,
  sharedSlotRemainingFromRollup,
  type TimingRollup,
} from "@/acharya/lib/karigar-timing-types";
import { notifyActiveAttemptChanged } from "@/acharya/lib/active-attempt-events";
import { blobViewUrl } from "@/acharya/lib/blob-url";
import {
  clearProofPhase,
  dataUrlToFile,
  dismissProofPhase,
  filesToDraftImages,
  loadProofDraft,
  loadProofPhase,
  saveProofDraft,
  saveProofPhase,
  type ProofPhaseReason,
} from "@/acharya/lib/active-session-phase";
import { useStrings } from "@/acharya/lib/i18n/useLang";
import { useInactivityTimeout } from "@/acharya/hooks/useInactivityTimeout";
import { AttemptInfoBadge } from "@/components/acharya/tasks/attempt-info-badge";
import { RequestTimeButton } from "@/components/acharya/tasks/request-time-button";
import { isSimpleTaskType } from "@/acharya/lib/simple-task";

/* ── Attempt shape from GET /api/work/tasks/[id]/attempts/[attemptId] ─────── */
interface AttemptItem {
  id: string;
  task_id: string;
  started_at: string;
  deadline_at: string;
  status: "running" | "paused" | "finished" | "expired" | "abandoned";
  interval_seconds: number;
  segment_index: number;
  remaining_seconds: number;
  paused_remaining_seconds?: number | null;
  breaks_allowed_current_segment?: number;
  breaks_used_current_segment?: number;
  breaks_remaining_current_segment?: number;
  checklist_item_id?: string | null;
  segment_plan: {
    total_planned_seconds: number;
    segment_count: number;
    segment_durations_seconds: number[];
    break_allowance_per_segment?: number[];
    break_allowance_total?: number;
  } | null;
}

function breakQuotaFromAttempt(attempt: AttemptItem): { allowed: number; remaining: number } {
  const allowed =
    attempt.breaks_allowed_current_segment ??
    attempt.segment_plan?.break_allowance_per_segment?.[attempt.segment_index - 1] ??
    0;
  const remaining = attempt.breaks_remaining_current_segment ?? allowed;
  return { allowed, remaining };
}

function safeSeconds(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.max(0, Math.floor(value));
}

function secondsUntil(deadlineAt: string | null | undefined): number {
  if (!deadlineAt) return 0;
  const deadlineMs = new Date(deadlineAt).getTime();
  if (!Number.isFinite(deadlineMs)) return 0;
  return Math.max(0, Math.floor((deadlineMs - Date.now()) / 1000));
}

function resolveAttemptRemaining(attempt: AttemptItem): number {
  if (attempt.status === "paused") {
    const pausedRemaining = safeSeconds(attempt.paused_remaining_seconds);
    if (pausedRemaining != null) return pausedRemaining;
    return safeSeconds(attempt.remaining_seconds) ?? 0;
  }

  if (attempt.status === "running") {
    // Prefer a positive server duration (skew-free local anchor). Missing or
    // zero `remaining_seconds` used to win over a still-future `deadline_at`
    // (stripAttempt historically coerced omit → 0), which flashed 00:00 and
    // auto-expired — especially painful on multi-session tasks. Fall back to
    // deadline_at only when the duration field is absent/zero.
    const serverRemaining = safeSeconds(attempt.remaining_seconds);
    const fromDeadline = secondsUntil(attempt.deadline_at);
    if (serverRemaining != null && serverRemaining > 0) return serverRemaining;
    if (fromDeadline > 0) return fromDeadline;
    return 0;
  }

  return 0;
}

function resolveTaskSubtask(rollup: TimingRollup | null | undefined, preferredId?: string | null) {
  if (!rollup?.subtasks?.length) return null;
  const sorted = [...rollup.subtasks].sort((a, b) => {
    const slotA = coerceSessionSlot(a.session_slot, 1);
    const slotB = coerceSessionSlot(b.session_slot, 1);
    if (slotA !== slotB) return slotA - slotB;
    return 0;
  });
  if (preferredId) {
    const exact = sorted.find((sub) => sub.id === preferredId);
    // Never stick on a completed preferred item — advance to the next open subtask.
    if (exact && exact.status !== "completed") return exact;
  }
  return sorted.find((sub) => sub.status === "active") || sorted.find((sub) => sub.status === "pending") || null;
}

function incompleteSubtaskCount(rollup: TimingRollup | null | undefined): number {
  if (!rollup?.subtasks?.length) return 0;
  return rollup.subtasks.filter((sub) => sub.status !== "completed").length;
}

function slotMateTitles(
  rollup: TimingRollup | null | undefined,
  sessionSlot: number,
): string[] {
  if (!rollup?.subtasks?.length) return [];
  const slot = coerceSessionSlot(sessionSlot, 1);
  return rollup.subtasks
    .filter((s) => coerceSessionSlot(s.session_slot, 1) === slot)
    .map((s) => s.title.trim())
    .filter(Boolean);
}

function absorbRollup(
  rollup: TimingRollup | null | undefined,
  taskSessionCount?: number | null,
): TimingRollup | null {
  return normalizeSlotTimingRollup(rollup ?? null, taskSessionCount);
}

function sharedRemainingStorageKey(taskId: string, sessionSlot: number): string {
  return `acharya:sharedSessionRemaining:${taskId}:${sessionSlot}`;
}

function stashSharedSessionRemaining(taskId: string, sessionSlot: number, seconds: number) {
  if (typeof window === "undefined") return;
  const safe = Math.min(SESSION_DURATION_SECONDS, Math.max(0, Math.floor(seconds)));
  if (safe <= 0) {
    try {
      sessionStorage.removeItem(sharedRemainingStorageKey(taskId, sessionSlot));
    } catch {
      /* ignore */
    }
    return;
  }
  try {
    sessionStorage.setItem(sharedRemainingStorageKey(taskId, sessionSlot), String(safe));
  } catch {
    /* ignore quota */
  }
}

function readSharedSessionRemaining(taskId: string, sessionSlot: number): number | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(sharedRemainingStorageKey(taskId, sessionSlot));
    if (!raw) return null;
    const n = Math.floor(Number(raw));
    if (!Number.isFinite(n) || n <= 0) return null;
    return Math.min(SESSION_DURATION_SECONDS, n);
  } catch {
    return null;
  }
}

function clearSharedSessionRemaining(taskId: string, sessionSlot: number) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(sharedRemainingStorageKey(taskId, sessionSlot));
  } catch {
    /* ignore */
  }
}

function goToTaskDetails(backPath: string) {
  const sep = backPath.includes("?") ? "&" : "?";
  window.location.assign(`${backPath}${sep}fresh=1`);
}

type Phase = "active" | "warning" | "expired";

/** Play a 1kHz sine beep via Web Audio API. Soft if warning, loud+repeating if expired. */
function playBeep(ctx: AudioContext, type: "soft" | "alarm") {
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.connect(gain);
  gain.connect(ctx.destination);
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(1000, ctx.currentTime);
  if (type === "soft") {
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.3);
  } else {
    // alarm: three pulses
    gain.gain.setValueAtTime(0, ctx.currentTime);
    for (let i = 0; i < 3; i++) {
      const t = ctx.currentTime + i * 0.5;
      gain.gain.setValueAtTime(0.55, t);
      gain.gain.setValueAtTime(0.001, t + 0.3);
    }
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 1.6);
  }
}

/* ── Completion sheet ─────────────────────────────────────────────────────── */
/**
 * Inline completion sheet — mirrors UpdateCaptureSheet but posts to /complete.
 * Kept in this file to minimise surface area; the spec's CompleteTaskSheet can
 * be extracted later.
 */
function CompleteSheet({
  open,
  taskId,
  attemptId,
  taskTitle,
  onClose,
  onSuccess,
  /** When parent already ran /complete (reuse proof), show this result. */
  prefetchedEvaluation = null,
  /** Parent is calling /complete — show Evaluating UI instead of the form. */
  isPrefetching = false,
  /** Simple tasks skip Acharya score UI — submit then leave. */
  skipEvalUi = false,
  /**
   * Simple tasks are manual-review-only: no Acharya AI reads the submission, so a
   * photo + note has nothing to feed. Allows Submit with neither filled in.
   *
   * Deliberately a separate prop from `skipEvalUi` rather than reusing it — one
   * controls which UI is shown, this one controls VALIDATION, and a future reader
   * should not have to work out why an "eval UI" flag changes what submits.
   */
  proofOptional = false,
}: {
  open: boolean;
  taskId: string;
  attemptId: string | null;
  taskTitle?: string | null;
  onClose: () => void;
  onSuccess: (approved: boolean) => void;
  prefetchedEvaluation?: {
    approved: boolean;
    score: number | null;
    notes: string | null;
    review_status?: string | null;
    acharya_score?: number | null;
  } | null;
  isPrefetching?: boolean;
  skipEvalUi?: boolean;
  proofOptional?: boolean;
}) {
  const [tab, setTab] = useState<"image" | "text">("image");
  const [text, setText] = useState("");
  const [images, setImages] = useState<Array<{ file: File; preview: string }>>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [textFocused, setTextFocused] = useState(false);
  const [evaluation, setEvaluation] = useState<{
    approved: boolean;
    score: number | null;
    notes: string | null;
    review_status?: string | null;
    acharya_score?: number | null;
  } | null>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [draftHydrated, setDraftHydrated] = useState(false);
  const s = useStrings();

  const onShowTab = useCallback((next: "text" | "image") => {
    setTab(next);
  }, []);

  const proofVoice = useProofVoiceAssist({
    open,
    reason: "complete",
    taskTitle,
    onShowTab,
    onSetText: setText,
    currentText: text,
  });

  function clearDraft() {
    setTab("image");
    setText("");
    setImages((prev) => {
      for (const item of prev) {
        try { URL.revokeObjectURL(item.preview); } catch { /* ignore */ }
      }
      return [];
    });
    setError(null);
    setTextFocused(false);
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  }

  // New task → empty draft. Do NOT wipe text/photos when the sheet merely
  // closes (backdrop / Cancel) — reopening must restore what they entered.
  useEffect(() => {
    clearDraft();
    setBusy(false);
    setEvaluation(null);
    setDraftHydrated(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only reset when the task changes
  }, [taskId]);

  useEffect(() => {
    if (!open) return;
    setBusy(false);
    setError(null);
    setTextFocused(false);
    if (prefetchedEvaluation) {
      setEvaluation(prefetchedEvaluation);
    }
  }, [open, prefetchedEvaluation]);

  useEffect(() => {
    if (!open || !prefetchedEvaluation) return;
    setEvaluation(prefetchedEvaluation);
  }, [open, prefetchedEvaluation]);

  // Restore text + photos after reload. Do not persist until this finishes,
  // or an empty form would overwrite the saved draft in IndexedDB.
  useEffect(() => {
    if (!open || !attemptId) {
      setDraftHydrated(false);
      return;
    }
    let cancelled = false;
    setDraftHydrated(false);
    saveProofPhase(taskId, attemptId, { phase: "complete", evaluating: false });
    (async () => {
      const draft = await loadProofDraft(taskId, attemptId);
      if (cancelled) return;
      if (draft?.tab === "image" || draft?.tab === "text") setTab(draft.tab);
      if (typeof draft?.text === "string") setText(draft.text);
      if (draft?.images?.length) {
        const restored: Array<{ file: File; preview: string }> = [];
        for (const img of draft.images) {
          try {
            const file = await dataUrlToFile(img.dataUrl, img.name, img.type);
            restored.push({ file, preview: URL.createObjectURL(file) });
          } catch {
            /* skip */
          }
        }
        if (!cancelled && restored.length > 0) {
          setImages((prev) => {
            for (const item of prev) {
              try { URL.revokeObjectURL(item.preview); } catch { /* ignore */ }
            }
            return restored;
          });
        }
      }
      if (!cancelled) setDraftHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, taskId, attemptId]);

  // Persist draft (text + photos) so reload does not wipe the form.
  useEffect(() => {
    if (!open || !attemptId || evaluation || !draftHydrated) return;
    if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    persistTimerRef.current = setTimeout(() => {
      void (async () => {
        const draftImages = await filesToDraftImages(images);
        await saveProofDraft(taskId, attemptId, {
          phase: "complete",
          evaluating: (busy || isPrefetching) && !evaluation,
          text,
          tab,
          images: draftImages,
        });
      })();
    }, 100);
    return () => {
      if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    };
  }, [open, attemptId, taskId, busy, isPrefetching, evaluation, text, tab, images, draftHydrated]);

  // Flush draft on reload/navigate — debounce alone can lose the last keystroke/photo.
  useEffect(() => {
    if (!open || !attemptId) return;
    const flush = () => {
      void (async () => {
        const draftImages = await filesToDraftImages(images);
        await saveProofDraft(taskId, attemptId, {
          phase: "complete",
          evaluating: (busy || isPrefetching) && !evaluation,
          text,
          tab,
          images: draftImages,
        });
      })();
    };
    window.addEventListener("pagehide", flush);
    window.addEventListener("beforeunload", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      window.removeEventListener("beforeunload", flush);
    };
  }, [open, attemptId, taskId, busy, isPrefetching, evaluation, text, tab, images]);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
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
    if (evaluation) { onSuccess(Boolean(evaluation.approved)); return; }
    setError(null);
    const trimmedText = text.trim();
    // Simple tasks may submit with neither photo nor note (proofOptional / skipEvalUi).
    if (!proofOptional && !skipEvalUi) {
      if (images.length === 0) {
        setError("Please upload at least one image proof of the completed task.");
        return;
      }
      if (!trimmedText) {
        setError("Please describe what was completed.");
        return;
      }
    }
    setBusy(true);
    try {
      const attachments = images.length > 0
        ? await uploadProofImages(images.map((i) => i.file))
        : [];
      const first = attachments[0];

      // Build defensively: with no photo `first` is undefined, and reading
      // first.url would throw before the request was ever made.
      const body: Record<string, unknown> = {
        // OmniDel's enum is image | text | voice. No photo → "text".
        kind: attachments.length > 0 ? "image" : "text",
        attachments,
      };
      if (trimmedText) body.text = trimmedText;
      if (first) {
        body.blob_url = first.url;
        body.blob_mime = first.mime;
      }
      if (attemptId) body.attempt_id = attemptId;

      const r = await fetch(`/api/work/tasks/${taskId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => null);
        throw new Error(d?.error || `Complete failed (${r.status})`);
      }
      const result = await r.json() as {
        evaluation?: {
          approved: boolean;
          score: number | null;
          notes: string | null;
          review_status?: string | null;
          acharya_score?: number | null;
          evaluator?: string | null;
        };
      };
      clearDraft();
      clearProofPhase(taskId, attemptId);
      if (skipEvalUi) {
        onSuccess(false);
        return;
      }
      setEvaluation(
        result.evaluation ?? {
          approved: false,
          score: null,
          notes: "Submitted — waiting for your team manager to review.",
          review_status: "pending_review",
        },
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  // Simple tasks may submit with no photo/note (proofOptional / skipEvalUi).
  const hasProof = images.length > 0 && text.trim().length > 0;
  const canSubmit =
    !busy && !isPrefetching && (proofOptional || skipEvalUi || hasProof);
  const canAddMore = images.length < MAX_PROOF_IMAGES;
  const showEvaluating = (busy || isPrefetching) && !evaluation;

  if (!open) return null;

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 70, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}
      aria-modal="true"
      role="dialog"
      aria-label="Mark task done"
    >
      <button
        type="button"
        aria-label="Cancel"
        onClick={onClose}
        disabled={showEvaluating}
        className="fade-in"
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(35,29,20,0.52)",
          border: "none",
          cursor: showEvaluating ? "wait" : "pointer",
          backdropFilter: "blur(3px)",
          WebkitBackdropFilter: "blur(3px)",
        }}
      />
      <div
        className="slide-up"
        style={{
          position: "relative",
          background: "var(--surface)",
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          borderTop: "1px solid var(--rule)",
          paddingBottom: "max(env(safe-area-inset-bottom), 20px)",
          maxHeight: "85vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "var(--shadow-lg)",
        }}
      >
        {/* Handle */}
        <div style={{ display: "flex", justifyContent: "center", paddingTop: 12, paddingBottom: 6 }}>
          <div style={{ width: 40, height: 4, borderRadius: 9999, background: "var(--rule-strong)" }} />
        </div>

        {/* Header */}
        <div style={{ padding: "6px 20px 14px", borderBottom: "1px solid var(--rule)" }}>
          <p style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: "var(--ok)",
            margin: 0,
          }}>
            {showEvaluating
              ? (skipEvalUi ? "submitting" : "evaluating")
              : evaluation
                ? (skipEvalUi ? "submitted" : "evaluation")
                : "mark as done"}
          </p>
          <h2 style={{
            fontFamily: "var(--font-serif)",
            fontSize: 19,
            fontWeight: 400,
            color: "var(--ink)",
            margin: "5px 0 0",
            lineHeight: 1.25,
            letterSpacing: "-0.01em",
          }}>
            {showEvaluating
              ? (skipEvalUi ? "Sending for review" : "Your Acharya is evaluating")
              : evaluation
                ? (skipEvalUi ? "Submitted for review" : "Evaluation result")
                : "Share what you accomplished"}
          </h2>
          {!evaluation && !showEvaluating && (
            <ProofConversationMic
              available={proofVoice.available}
              status={proofVoice.status}
              onStart={() => void proofVoice.start()}
              onEnd={proofVoice.end}
            />
          )}
          {!evaluation && !showEvaluating && skipEvalUi ? (
            <p style={{
              margin: "10px 0 0",
              fontSize: 13,
              lineHeight: 1.45,
              color: "var(--ink-soft)",
            }}>
              Photos and a note are optional for this task — you can submit without them.
            </p>
          ) : null}
        </div>

        {/* Simple tasks accept an empty submission — say so, or the photo/note UI
            reads as mandatory and the karigar hunts for a camera they don't need. */}
        {proofOptional && !evaluation && !showEvaluating && (
          <p style={{
            margin: "8px 20px 0",
            fontSize: 12,
            lineHeight: 1.45,
            color: "var(--ink-mute)",
          }}>
            {s.proofHelperOptional}
          </p>
        )}

        {showEvaluating ? (
          <div style={{ flex: 1, overflowY: "auto", padding: "28px 20px 8px" }}>
            <div
              className="fade-in"
              style={{
                padding: "20px 16px",
                borderRadius: "var(--r-lg)",
                background: "var(--ochre-wash)",
                border: "1px solid var(--ochre)",
                textAlign: "center",
              }}
            >
              <p style={{
                fontFamily: "var(--font-serif)",
                fontSize: 17,
                color: "var(--ink)",
                margin: "0 0 8px",
              }}>
                {skipEvalUi ? "Submitting your work…" : "Evaluating your work…"}
              </p>
              <p style={{
                fontSize: 13.5,
                color: "var(--ink-soft)",
                lineHeight: 1.6,
                margin: 0,
              }}>
                {skipEvalUi
                  ? "Sending your work for manager review."
                  : "Reviewing your photos and notes, scoring the task, then sending it for manager review."}
              </p>
              <div
                aria-hidden
                style={{
                  margin: "18px auto 0",
                  width: 28,
                  height: 28,
                  borderRadius: 9999,
                  border: "2px solid var(--ochre)",
                  borderTopColor: "transparent",
                  animation: "spin 0.9s linear infinite",
                }}
              />
            </div>
          </div>
        ) : evaluation ? (
          /* Result card */
          <div style={{ flex: 1, overflowY: "auto", padding: "20px 20px 0" }}>
            {(() => {
              const displayScore = skipEvalUi
                ? null
                : (evaluation.acharya_score ?? evaluation.score);
              const pending =
                !evaluation.approved &&
                (evaluation.review_status === "pending_review" || evaluation.review_status == null);
              const tone = evaluation.approved
                ? { wash: "var(--ok-wash)", ink: "var(--ok)", icon: <CheckIcon /> }
                : pending
                  ? { wash: "var(--ochre-wash)", ink: "var(--ochre)", icon: <HoldIcon /> }
                  : { wash: "var(--crit-wash)", ink: "var(--crit)", icon: <XSmallIcon /> };
              const title = evaluation.approved
                ? "Task approved"
                : pending
                  ? displayScore != null
                    ? "Acharya scored — sent for review"
                    : "Submitted for review"
                  : "Not approved";
              const subtitle = evaluation.approved && displayScore != null
                ? `Final score: ${Math.round(displayScore * 100)}%`
                : pending && displayScore != null
                  ? `Acharya score: ${Math.round(displayScore * 100)}% · Pending manager review`
                  : pending
                    ? "Pending manager review"
                    : "Review complete";
              return (
            <div
              className="fade-in"
              style={{
                padding: "16px",
                borderRadius: "var(--r-lg)",
                background: tone.wash,
                borderWidth: 1,
                borderStyle: "solid",
                borderColor: tone.ink,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                <div style={{
                  width: 32,
                  height: 32,
                  borderRadius: 9999,
                  background: tone.ink,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}>
                  {tone.icon}
                </div>
                <div>
                  <p style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: tone.ink,
                    fontFamily: "var(--font-sans)",
                    margin: 0,
                    letterSpacing: "0.01em",
                  }}>
                    {title}
                  </p>
                  <p style={{
                    fontSize: 11.5,
                    color: "var(--ink-soft)",
                    fontFamily: "var(--font-mono)",
                    margin: 0,
                    letterSpacing: "0.04em",
                  }}>
                    {subtitle}
                  </p>
                </div>
              </div>
              {pending && displayScore != null ? (
                <div style={{ marginBottom: 12 }}>
                  <div style={{
                    height: 8,
                    borderRadius: 9999,
                    background: "var(--surface-sunk)",
                    border: "1px solid var(--rule)",
                    overflow: "hidden",
                  }}>
                    <div style={{
                      height: "100%",
                      width: `${Math.round(displayScore * 100)}%`,
                      background: displayScore >= 0.7 ? "var(--ok)" : displayScore >= 0.4 ? "var(--ochre)" : "var(--crit)",
                    }} />
                  </div>
                </div>
              ) : null}
              <p style={{
                fontSize: 13.5,
                color: "var(--ink-soft)",
                fontFamily: "var(--font-sans)",
                lineHeight: 1.65,
                margin: 0,
                whiteSpace: "pre-wrap",
              }}>
                {evaluation.notes || (pending
                  ? "Your task has been submitted for review to your manager."
                  : "")}
              </p>
              {pending ? (
                <p style={{
                  fontSize: 11,
                  color: "var(--ink-faint)",
                  fontFamily: "var(--font-sans)",
                  marginTop: 12,
                  fontStyle: "italic",
                }}>
                  A team manager will confirm the final score in OmniPulse Review.
                </p>
              ) : evaluation.approved ? (
                <p style={{
                  fontSize: 11,
                  color: "var(--ink-faint)",
                  fontFamily: "var(--font-sans)",
                  marginTop: 12,
                  fontStyle: "italic",
                }}>
                  Reviewed by your team manager
                </p>
              ) : null}
            </div>
              );
            })()}
          </div>
        ) : (
          <div style={{ flex: 1, overflowY: "auto", padding: "0 20px" }}>
            {/* Tabs */}
            <div style={{ display: "flex", gap: 6, padding: "14px 0" }}>
              {(["text", "image"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  aria-pressed={tab === t}
                  className="press"
                  style={{
                    padding: "6px 18px",
                    borderRadius: "var(--r-md)",
                    fontSize: 13,
                    fontWeight: tab === t ? 600 : 400,
                    borderWidth: tab === t ? 0 : 1,
                    borderStyle: "solid",
                    borderColor: "var(--rule)",
                    background: tab === t ? "var(--green-deep)" : "transparent",
                    color: tab === t ? "#f4efdf" : "var(--ink-soft)",
                    cursor: "pointer",
                    minHeight: 36,
                    transition: "background 0.15s ease, color 0.15s ease",
                    outline: "none",
                  }}
                >
                  {t === "text" ? "Text" : "Image"}
                </button>
              ))}
            </div>

            {tab === "text" && (
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Describe what you completed..."
                rows={4}
                maxLength={2000}
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  borderRadius: "var(--r-lg)",
                  borderWidth: 1,
                  borderStyle: "solid",
                  borderColor: textFocused ? "var(--green-deep)" : "var(--rule)",
                  background: "var(--surface-sunk)",
                  fontFamily: "var(--font-sans)",
                  fontSize: 14,
                  color: "var(--ink)",
                  lineHeight: 1.65,
                  resize: "none",
                  minHeight: 110,
                  boxSizing: "border-box",
                  outline: "none",
                  transition: "border-color 0.15s ease",
                }}
                onFocus={() => setTextFocused(true)}
                onBlur={() => setTextFocused(false)}
              />
            )}

            {tab === "image" && (
              <div>
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  capture="environment"
                  onChange={handleFile}
                  style={{ display: "none" }}
                  id="complete-image-camera"
                  aria-label={s.proofTakePhoto}
                />
                {images.length > 0 && (
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))",
                    gap: 8,
                    marginBottom: 12,
                  }}>
                    {images.map((item, index) => (
                      <div key={item.preview} style={{ position: "relative" }} className="fade-in">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={item.preview}
                          alt={`Task completion photo ${index + 1}`}
                          style={{
                            width: "100%",
                            aspectRatio: "1",
                            objectFit: "cover",
                            borderRadius: "var(--r-md)",
                            borderWidth: 1,
                            borderStyle: "solid",
                            borderColor: "var(--rule)",
                            display: "block",
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => removeImage(index)}
                          aria-label={`Remove image ${index + 1}`}
                          className="press"
                          style={{
                            position: "absolute",
                            top: 6,
                            right: 6,
                            width: 26,
                            height: 26,
                            borderRadius: 9999,
                            background: "rgba(35,29,20,0.65)",
                            border: "none",
                            color: "#f4efdf",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <XSmallIcon />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {canAddMore ? (
                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    className="press"
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 10,
                      width: "100%",
                      minHeight: images.length > 0 ? 88 : 120,
                      borderWidth: 1,
                      borderStyle: "dashed",
                      borderColor: "var(--rule-strong)",
                      borderRadius: "var(--r-lg)",
                      cursor: "pointer",
                      background: "var(--surface-sunk)",
                      fontFamily: "var(--font-sans)",
                      color: "var(--ink-mute)",
                      fontSize: 13,
                    }}
                  >
                    {images.length === 0
                      ? s.proofTakePhoto
                      : s.proofAddAnother(images.length, MAX_PROOF_IMAGES)}
                  </button>
                ) : (
                  <p style={{ fontSize: 12, color: "var(--ink-mute)", fontFamily: "var(--font-sans)", margin: 0 }}>
                    {s.proofMaxPhotos(MAX_PROOF_IMAGES)}
                  </p>
                )}
              </div>
            )}

            {error && (
              <p style={{ fontSize: 12.5, color: "var(--crit)", marginTop: 10, fontFamily: "var(--font-sans)" }}>
                {error}
              </p>
            )}
          </div>
        )}

        <div style={{ padding: "16px 20px 0" }}>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={showEvaluating || (!evaluation && !canSubmit)}
            className={evaluation || canSubmit ? "press" : undefined}
            style={{
              width: "100%",
              padding: "15px",
              borderRadius: "var(--r-lg)",
              border: "none",
              background: evaluation || canSubmit ? "var(--green-deep)" : "var(--surface-sunk)",
              color: evaluation || canSubmit ? "#f4efdf" : "var(--ink-faint)",
              fontFamily: "var(--font-sans)",
              fontSize: 15,
              fontWeight: 700,
              cursor: evaluation || canSubmit ? "pointer" : "not-allowed",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              minHeight: 52,
              transition: "background 0.18s ease, color 0.18s ease",
              outline: "none",
              letterSpacing: "0.01em",
            }}
          >
            {showEvaluating
              ? (skipEvalUi ? "Submitting…" : "Evaluating…")
              : evaluation
                ? "Back to tasks"
                : "Submit for review"}
          </button>
          {!evaluation && !showEvaluating && (
            <button
              type="button"
              onClick={onClose}
              className="press"
              style={{
                width: "100%",
                marginTop: 10,
                padding: "13px",
                borderRadius: "var(--r-lg)",
                borderWidth: 1,
                borderStyle: "solid",
                borderColor: "var(--rule)",
                background: "transparent",
                color: "var(--ink-soft)",
                fontFamily: "var(--font-sans)",
                fontSize: 14,
                fontWeight: 500,
                cursor: "pointer",
                minHeight: 48,
                outline: "none",
              }}
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Main page ────────────────────────────────────────────────────────────── */

interface ActiveTaskSessionProps {
  taskId: string;
  initialAttemptId?: string | null;
  initialChecklistItemId?: string | null;
  /** Compact embed inside task detail (legacy). Prefer `shell` for the Acharya box. */
  inline?: boolean;
  /** Renders inside AcharyaShell — keeps the shared Acharya header; fills the content box. */
  shell?: boolean;
  acharyaSlug?: string | null;
  returnTo?: string;
  doneReturnTo?: string;
  onAttemptChange?: (attemptId: string) => void;
  onExit?: () => void;
}

export function ActiveTaskSession({
  taskId,
  initialAttemptId = null,
  initialChecklistItemId = null,
  inline = false,
  shell = false,
  acharyaSlug = null,
  returnTo,
  doneReturnTo,
  onAttemptChange,
  onExit,
}: ActiveTaskSessionProps) {
  const router = useRouter();
  const nav = useInstantNav();
  const inBox = shell || inline;

  const queryAttemptId = initialAttemptId;
  const queryChecklistItemId = initialChecklistItemId;
  const backPath = returnTo ?? `/tasks/${taskId}`;
  const donePath = doneReturnTo ?? "/tasks?tab=done&fresh=1";
  const activeUrl = useCallback(
    (nextAttemptId: string) => {
      const query = new URLSearchParams();
      query.set("attemptId", nextAttemptId);
      if (returnTo) query.set("returnTo", returnTo);
      if (doneReturnTo) query.set("doneReturnTo", doneReturnTo);
      if (acharyaSlug) {
        return `/acharyas/${acharyaSlug}/tasks/${taskId}/active?${query.toString()}`;
      }
      return `/tasks/${taskId}/active?${query.toString()}`;
    },
    [taskId, returnTo, doneReturnTo, acharyaSlug],
  );
  // Resilient attempt-id resolution: prefer ?attemptId= from the URL; if it's
  // missing (hard refresh, deep link, or 409 fallthrough where we couldn't
  // include the existing id) we fetch GET /attempts and use the running one.
  // The URL is then router.replace'd with the resolved id so reloads stick.
  const [resolvedAttemptId, setResolvedAttemptId] = useState<string | null>(null);
  const attemptId = queryAttemptId ?? resolvedAttemptId;
  useEffect(() => {
    if (queryAttemptId) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`/api/work/tasks/${taskId}/attempts`, { cache: "no-store" });
        if (!r.ok) return;
        const d = await r.json() as { items?: Array<{ id: string; status: string }> };
        const active = (d.items || []).find((a) => a.status === "running" || a.status === "paused");
        if (!cancelled && active?.id) {
          setResolvedAttemptId(active.id);
          onAttemptChange?.(active.id);
          if (!inBox) {
            window.setTimeout(() => {
              router.replace(activeUrl(active.id));
            }, 0);
          }
        }
      } catch { /* fall through to the empty-state below */ }
    })();
    return () => { cancelled = true; };
  }, [taskId, queryAttemptId, router, inBox, onAttemptChange, activeUrl]);

  const [remaining, setRemaining] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [isSimpleTask, setIsSimpleTask] = useState(false);
  const [simpleProofPromptOpen, setSimpleProofPromptOpen] = useState(false);
  const [simpleBareSubmitting, setSimpleBareSubmitting] = useState(false);
  const [intervalSeconds, setIntervalSeconds] = useState(0);
  const [segmentIndex, setSegmentIndex] = useState(1);
  const [sessionCount, setSessionCount] = useState(1);
  const [pendingNextSession, setPendingNextSession] = useState<number | null>(null);
  const [taskTitle, setTaskTitle] = useState<string | null>(null);
  // Description + due date — surfaced via the "View details" pop-up at the
  // top of the active surface. We don't render them inline because the
  // timer is the primary focus of this screen.
  const [taskDescription, setTaskDescription] = useState<string | null>(null);
  const [taskDueDate, setTaskDueDate] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  // Past break artifacts for the current attempt — rendered below the
  // timer as a "Lapses so far" list. Each entry is one task_update row.
  const [pastUpdates, setPastUpdates] = useState<Array<{
    id: string;
    kind: string;
    text_payload: string | null;
    blob_url: string | null;
    attachments?: Array<{ url: string; mime?: string | null }> | null;
    captured_at: string;
  }>>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isExpired, setIsExpired] = useState(false);
  const [serverPaused, setServerPaused] = useState(false);
  const [sessionComplete, setSessionComplete] = useState(false);
  const [autoCompleted, setAutoCompleted] = useState(false);
  const [breaksAllowed, setBreaksAllowed] = useState(0);
  const [breaksRemaining, setBreaksRemaining] = useState(0);
  const [checklistItemId, setChecklistItemId] = useState<string | null>(queryChecklistItemId);
  const [subtaskTitle, setSubtaskTitle] = useState<string | null>(null);
  const [subtaskSessionCount, setSubtaskSessionCount] = useState<number | null>(null);
  const [subtaskCompletedSessions, setSubtaskCompletedSessions] = useState(0);
  const [subtaskOrdinal, setSubtaskOrdinal] = useState<number | null>(null);
  const [sessionSlot, setSessionSlot] = useState<number | null>(null);
  const [timingRollup, setTimingRollup] = useState<TimingRollup | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetReason, setSheetReason] = useState<"break" | "expired" | "session" | "subtask">("expired");
  const [completeSheetOpen, setCompleteSheetOpen] = useState(false);
  const [completePrefetching, setCompletePrefetching] = useState(false);
  const [completePrefetchedEvaluation, setCompletePrefetchedEvaluation] = useState<{
    approved: boolean;
    score: number | null;
    notes: string | null;
    review_status?: string | null;
    acharya_score?: number | null;
  } | null>(null);
  const [submittingUpdate, setSubmittingUpdate] = useState(false);
  const [completingSubtask, setCompletingSubtask] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  /** Absolute end time for the running interval — source of truth while ticking. */
  const deadlineAtMsRef = useRef<number | null>(null);
  /** Simple-task count-up: wall-clock start of the attempt. */
  const elapsedStartMsRef = useRef<number | null>(null);
  const softBeepedRef = useRef(false);
  const remainingRef = useRef(remaining);
  const intervalSecondsRef = useRef(intervalSeconds);
  const serverPausedRef = useRef(serverPaused);
  const sessionCompleteRef = useRef(sessionComplete);
  const isExpiredRef = useRef(isExpired);
  const triggerExpiredRef = useRef<(
    rollup?: TimingRollup | null,
    itemId?: string | null,
  ) => void>(() => {});

  useEffect(() => { remainingRef.current = remaining; }, [remaining]);
  useEffect(() => { intervalSecondsRef.current = intervalSeconds; }, [intervalSeconds]);
  useEffect(() => { serverPausedRef.current = serverPaused; }, [serverPaused]);
  useEffect(() => { sessionCompleteRef.current = sessionComplete; }, [sessionComplete]);
  useEffect(() => { isExpiredRef.current = isExpired; }, [isExpired]);

  function clearTick() {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
  }

  /** Recompute remaining from wall clock. Used by the 1s interval AND on unlock. */
  function syncRemainingFromDeadline(): number | null {
    const deadlineMs = deadlineAtMsRef.current;
    if (deadlineMs == null) return null;
    const next = Math.max(0, Math.floor((deadlineMs - Date.now()) / 1000));
    remainingRef.current = next;
    setRemaining(next);
    return next;
  }

  function startTick(initialRemaining: number, deadlineAt?: string | null) {
    clearTick();

    // Anchor from the server's remaining DURATION first — see the file header.
    // Ticking against a locally-anchored deadline measures elapsed device time
    // only, so a skewed handset clock cannot distort the countdown.
    let deadlineMs: number | null = null;
    if (Number.isFinite(initialRemaining) && initialRemaining > 0) {
      deadlineMs = Date.now() + Math.floor(initialRemaining) * 1000;
    }
    // Keep an existing deadline when restarting after a cancelled break sheet.
    if (deadlineMs == null) deadlineMs = deadlineAtMsRef.current;
    // Last resort: the absolute server timestamp. Skew-sensitive, so only used
    // when no duration is available from either source above.
    if (deadlineMs == null && deadlineAt) {
      const parsed = new Date(deadlineAt).getTime();
      if (Number.isFinite(parsed)) deadlineMs = parsed;
    }
    deadlineAtMsRef.current = deadlineMs;
    softBeepedRef.current = false;

    const rem =
      deadlineMs != null
        ? Math.max(0, Math.floor((deadlineMs - Date.now()) / 1000))
        : Math.max(0, initialRemaining);

    remainingRef.current = rem;
    setRemaining(rem);

    if (rem <= 0) {
      triggerExpiredRef.current();
      return;
    }

    tickRef.current = setInterval(() => {
      const next = syncRemainingFromDeadline();
      if (next == null) return;
      if (next <= 0) {
        clearTick();
        triggerExpiredRef.current();
        return;
      }
      const total = intervalSecondsRef.current;
      // Wall-clock ticks can skip the exact 10% second after a screen-off gap.
      if (!softBeepedRef.current && total > 0 && next <= Math.floor(total * 0.1)) {
        softBeepedRef.current = true;
        const ctx = getAudioCtx();
        if (ctx) playBeep(ctx, "soft");
      }
    }, 1000);
  }

  /** Count-up timer for Simple tasks — no expire / beep. */
  function startElapsedTick(startedAtIso: string) {
    clearTick();
    deadlineAtMsRef.current = null;
    const startedMs = new Date(startedAtIso).getTime();
    elapsedStartMsRef.current = Number.isFinite(startedMs) ? startedMs : Date.now();
    softBeepedRef.current = true; // never soft-beep on count-up
    const sync = () => {
      const start = elapsedStartMsRef.current;
      if (start == null) return;
      const next = Math.max(0, Math.floor((Date.now() - start) / 1000));
      setElapsed(next);
    };
    sync();
    tickRef.current = setInterval(sync, 1000);
  }

  function getAudioCtx(): AudioContext | null {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioContext();
      }
      return audioCtxRef.current;
    } catch {
      console.warn("[ActiveTaskPage] Web Audio API unavailable");
      return null;
    }
  }

  /**
   * True when finishing THIS session should open whole-task Done (evaluation).
   *
   * Pass `rollup` / `itemId` from the load effect — React state is still stale
   * there. A missing rollup must NEVER mean "task is done" (that showed
   * Mark Done at 00:00 when opening Sub 6 before rollup applied).
   */
  function isWholeTaskFinalSession(
    rollup: TimingRollup | null = timingRollup,
    itemId: string | null = checklistItemId,
  ): boolean {
    if (!rollup?.subtasks?.length) return false;

    const incomplete = rollup.subtasks.filter((s) => s.status !== "completed");
    if (itemId) {
      // Any other open subtask (e.g. Sub 3–5 while on Sub 6) → not final.
      return !incomplete.some((s) => s.id !== itemId);
    }

    if (isSlotTimingModel(rollup)) {
      const slot = sessionSlot ?? 1;
      if (hasIncompleteOutsideSlot(rollup, slot)) return false;
      return incomplete.filter(
        (s) => coerceSessionSlot(s.session_slot, 1) === slot,
      ).length <= 1;
    }

    const totalSessions = Math.max(1, subtaskSessionCount ?? sessionCount);
    if (segmentIndex < totalSessions) return false;
    return incomplete.length === 0;
  }

  function triggerExpired(
    rollup: TimingRollup | null = timingRollup,
    itemId: string | null = checklistItemId,
  ) {
    setIsExpired(true);
    setRemaining(0);
    deadlineAtMsRef.current = null;
    clearTick();
    // Last incomplete subtask → final proof sheet (→ /complete + evaluation).
    // Mid-task (Sub 6 while later slots remain) → segment_end / share update only.
    if (isWholeTaskFinalSession(rollup, itemId)) {
      openManualCompleteSheet();
    } else {
      openUpdateSheet("expired");
    }
    const ctx = getAudioCtx();
    if (ctx) {
      playBeep(ctx, "alarm");
    }
  }
  triggerExpiredRef.current = () => triggerExpired();

  /** POST /complete with the proof the worker already captured (no second form). */
  async function submitFinalTaskProof(payload: UpdatePayload): Promise<{
    approved: boolean;
    score: number | null;
    notes: string | null;
    review_status?: string | null;
    acharya_score?: number | null;
  }> {
    if (!taskId) throw new Error("Missing task ID.");
    const r = await fetch(`/api/work/tasks/${taskId}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: payload.kind,
        text: payload.text,
        blob_url: payload.blob_url,
        blob_mime: payload.blob_mime,
        attachments: payload.attachments,
        attempt_id: attemptId,
      }),
    });
    if (!r.ok) {
      const d = await r.json().catch(() => null);
      throw new Error(d?.error || `Complete failed (${r.status})`);
    }
    const result = await r.json() as {
      evaluation?: {
        approved: boolean;
        score: number | null;
        notes: string | null;
        review_status?: string | null;
        acharya_score?: number | null;
      };
    };
    return (
      result.evaluation ?? {
        approved: false,
        score: null,
        notes: "Submitted — waiting for your team manager to review.",
        review_status: "pending_review",
      }
    );
  }

  /** Open the evaluation sheet while /complete runs, then show Acharya score. */
  async function runFinalEvaluationWithSheet(payload: UpdatePayload) {
    setCompletePrefetchedEvaluation(null);
    setCompletePrefetching(true);
    setCompleteSheetOpen(true);
    saveProofPhase(taskId, attemptId, { phase: "complete", evaluating: true });
    try {
      const evaluation = await submitFinalTaskProof(payload);
      setCompletePrefetchedEvaluation(evaluation);
      saveProofPhase(taskId, attemptId, { phase: "complete", evaluating: false });
    } catch (err) {
      setCompleteSheetOpen(false);
      setCompletePrefetching(false);
      setCompletePrefetchedEvaluation(null);
      clearProofPhase(taskId, attemptId);
      throw err;
    } finally {
      setCompletePrefetching(false);
    }
  }

  function leaveAfterTaskSubmitted() {
    clearProofPhase(taskId, attemptId);
    setCompleteSheetOpen(false);
    setCompletePrefetching(false);
    setCompletePrefetchedEvaluation(null);
    if (inline && !shell) {
      onExit?.();
      return;
    }
    const sep = backPath.includes("?") ? "&" : "?";
    window.location.assign(`${backPath}${sep}fresh=1`);
  }

  function stopLocalTick() {
    clearTick();
  }

  function openManualCompleteSheet() {
    clearTick();
    setCompletePrefetchedEvaluation(null);
    setCompletePrefetching(false);
    setCompleteSheetOpen(true);
    saveProofPhase(taskId, attemptId, { phase: "complete", evaluating: false });
  }

  /** Simple only: ask Yes → proof sheet, No → submit with no note/photos. */
  function openSimpleSubmitPrompt() {
    clearTick();
    setSimpleProofPromptOpen(true);
  }

  async function submitSimpleWithoutProof() {
    if (!taskId || simpleBareSubmitting) return;
    setSimpleBareSubmitting(true);
    setSimpleProofPromptOpen(false);
    try {
      const body: Record<string, unknown> = {
        kind: "text",
        text: "",
        attachments: [],
      };
      if (attemptId) body.attempt_id = attemptId;
      const r = await fetch(`/api/work/tasks/${taskId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => null);
        throw new Error(d?.error || `Submit failed (${r.status})`);
      }
      clearProofPhase(taskId, attemptId);
      leaveAfterTaskSubmitted();
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Submit failed. Try again.");
      if (!serverPaused) {
        const start = elapsedStartMsRef.current;
        if (start != null) startElapsedTick(new Date(start).toISOString());
      }
    } finally {
      setSimpleBareSubmitting(false);
    }
  }

  function openUpdateSheet(reason: ProofPhaseReason) {
    clearTick();
    setSheetReason(reason);
    setSheetOpen(true);
    saveProofPhase(taskId, attemptId, { phase: "update", reason, evaluating: false });
  }

  useEffect(() => {
    const onBreak = () => openUpdateSheet("break");
    const onComplete = () => setCompleteSheetOpen(true);
    window.addEventListener("acharya:voice-take-break", onBreak);
    window.addEventListener("acharya:voice-open-complete", onComplete);
    return () => {
      window.removeEventListener("acharya:voice-take-break", onBreak);
      window.removeEventListener("acharya:voice-open-complete", onComplete);
    };
  });

  // Load attempt on mount
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        if (!taskId) throw new Error("Missing task ID.");
        if (!attemptId) {
          // Still resolving from /attempts list — don't fail; keep loading=true.
          return;
        }
        // Fetch task, attempt state, and the past update history in parallel.
        // The history feeds the "Lapses so far" strip below the timer.
        const [taskRes, attemptRes, updatesRes] = await Promise.all([
          fetch(`/api/work/tasks/${taskId}?fresh=1`),
          fetch(`/api/work/tasks/${taskId}/attempts/${attemptId}`),
          fetch(`/api/work/tasks/${taskId}/attempts/${attemptId}/updates`),
        ]);

        if (!taskRes.ok) throw new Error(`Task not found (${taskRes.status})`);
        if (!attemptRes.ok) {
          const attemptErr = await attemptRes.json().catch(() => null) as { error?: string } | null;
          const detail = attemptErr?.error?.trim();
          if (attemptRes.status === 503) {
            throw new Error(
              detail
                || "Cannot reach OmniDel (port 5000). Start the OmniDel app, then reload this page.",
            );
          }
          if (attemptRes.status === 404) {
            throw new Error(detail || "This work session was not found. Go back and start the task again.");
          }
          throw new Error(detail || `Could not load session (${attemptRes.status})`);
        }

        let updates: Array<{
          id: string;
          kind: string;
          text_payload: string | null;
          blob_url: string | null;
          attachments?: Array<{ url: string; mime?: string | null }> | null;
          captured_at: string;
        }> = [];
        if (updatesRes.ok) {
          const d = await updatesRes.json() as { items?: typeof updates };
          updates = d.items || [];
          if (!cancelled) setPastUpdates(updates);
        }

        const taskData = await taskRes.json() as {
          item: {
            title: string;
            description?: string | null;
            dueDate?: string | null;
            sessionCount?: number;
            timingMode?: "task" | "subtasks" | "simple";
            timingRollup?: TimingRollup | null;
            segmentPlan?: AttemptItem["segment_plan"];
            reviewStatus?: "pending_review" | "reviewed" | null;
            isSimpleTask?: boolean;
            timerMode?: "count_up" | "countdown";
            taskTypeId?: string | null;
            taskTypeSlug?: string | null;
            taskTypeName?: string | null;
          };
        };
        const attemptData = await attemptRes.json() as { item: AttemptItem };

        if (cancelled) return;

        setTaskTitle(taskData.item?.title ?? "Task");
        setTaskDescription(taskData.item?.description ?? null);
        setTaskDueDate(taskData.item?.dueDate ?? null);
        const simple =
          Boolean(taskData.item?.isSimpleTask)
          || taskData.item?.timingMode === "simple"
          || taskData.item?.timerMode === "count_up"
          || isSimpleTaskType({
            id: taskData.item?.taskTypeId,
            slug: taskData.item?.taskTypeSlug,
            name: taskData.item?.taskTypeName,
          });
        setIsSimpleTask(simple);

        const attempt = attemptData.item;
        if (!attempt) throw new Error("Attempt not found");

        // Already submitted / under manager review — never restart the timer.
        // Best-effort: close a leftover running/paused attempt so it cannot
        // keep blocking every other task via ANOTHER_TASK_ACTIVE.
        const reviewStatus = taskData.item?.reviewStatus ?? null;
        if (reviewStatus === "pending_review" || reviewStatus === "reviewed") {
          clearProofPhase(taskId, attemptId);
          if (attempt.status === "running" || attempt.status === "paused") {
            void fetch(`/api/work/tasks/${taskId}/attempts/${attemptId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "abandon" }),
            })
              .then(() => notifyActiveAttemptChanged())
              .catch(() => { /* non-fatal */ });
          }
          setLoading(false);
          const sep = backPath.includes("?") ? "&" : "?";
          window.location.replace(`${backPath}${sep}fresh=1`);
          return;
        }

        const hasCompleteProof = updates.some((u) => String(u.kind || "").startsWith("complete_"));
        const savedPhase = loadProofPhase(taskId, attemptId);

        // /complete already finished the attempt (or Evaluating mid-flight).
        if (
          attempt.status === "finished" &&
          (hasCompleteProof || savedPhase?.evaluating || savedPhase?.phase === "complete")
        ) {
          clearProofPhase(taskId, attemptId);
          setLoading(false);
          const sep = backPath.includes("?") ? "&" : "?";
          window.location.replace(`${backPath}${sep}fresh=1`);
          return;
        }

        const rollup = absorbRollup(
          taskData.item?.timingRollup ?? null,
          taskData.item?.sessionCount,
        );
        setTimingRollup(rollup);
        const subtask = resolveTaskSubtask(
          rollup,
          attempt.checklist_item_id ?? queryChecklistItemId ?? null,
        );
        setChecklistItemId(subtask?.id ?? attempt.checklist_item_id ?? queryChecklistItemId ?? null);
        if (subtask) {
          setSubtaskTitle(subtask.title);
          setSubtaskSessionCount(subtask.session_count);
          setSubtaskCompletedSessions(subtask.sessions_completed);
          setSessionSlot(coerceSessionSlot(subtask.session_slot, 1));
          const ord = rollup?.subtasks?.findIndex((s) => s.id === subtask.id) ?? -1;
          setSubtaskOrdinal(ord >= 0 ? ord + 1 : null);
        } else {
          setSubtaskTitle(null);
          setSubtaskSessionCount(null);
          setSubtaskCompletedSessions(0);
          setSubtaskOrdinal(null);
          setSessionSlot(null);
        }

        const plan = attempt.segment_plan ?? subtask?.segment_plan ?? taskData.item?.segmentPlan ?? null;
        const count = isSlotTimingModel(rollup)
          ? (rollup?.total_sessions ?? taskData.item?.sessionCount ?? 1)
          : (subtask?.session_count
            ?? taskData.item?.sessionCount
            ?? plan?.segment_count
            ?? 1);
        const secs = attempt.interval_seconds
          || sessionDurationSeconds(attempt.segment_index, plan ?? undefined);
        setIntervalSeconds(secs);
        setSegmentIndex(attempt.segment_index);
        setSessionCount(count);
        const quota = breakQuotaFromAttempt(attempt);
        setBreaksAllowed(quota.allowed);
        setBreaksRemaining(quota.remaining);

        // Restore proof sheet after refresh — do not startTick while submitting.
        if (
          savedPhase?.phase === "complete" &&
          (attempt.status === "running" || attempt.status === "paused")
        ) {
          setServerPaused(attempt.status === "paused");
          if (simple) {
            startElapsedTick(attempt.started_at);
          } else {
            setRemaining(resolveAttemptRemaining(attempt));
          }
          // Never fake an in-flight Evaluating UI — if /complete already finished
          // the attempt we redirected above. Reopen the proof form instead.
          setCompletePrefetching(false);
          setCompletePrefetchedEvaluation(null);
          setCompleteSheetOpen(true);
          setLoading(false);
          return;
        }
        if (
          savedPhase?.phase === "update" &&
          (attempt.status === "running" || attempt.status === "paused" || attempt.status === "expired")
        ) {
          if (simple) {
            // Simple tasks do not use mid-session update sheets — go to Submit.
            setServerPaused(attempt.status === "paused");
            if (attempt.status === "running") startElapsedTick(attempt.started_at);
            setCompleteSheetOpen(true);
            setLoading(false);
            return;
          }
          setServerPaused(attempt.status === "paused");
          const rem = resolveAttemptRemaining(attempt);
          setRemaining(rem);
          if (savedPhase.reason === "expired" || rem <= 0) {
            setIsExpired(true);
            setRemaining(0);
          }
          setSheetReason(savedPhase.reason || "expired");
          setSheetOpen(true);
          setLoading(false);
          return;
        }

        if (attempt.status === "paused") {
          setServerPaused(true);
          deadlineAtMsRef.current = null;
          const loadedItemId =
            subtask?.id ?? attempt.checklist_item_id ?? queryChecklistItemId ?? null;
          const slot = coerceSessionSlot(subtask?.session_slot, 1);
          if (simple) {
            // v1: Simple tasks hide breaks; if somehow paused, freeze elapsed.
            const rem = resolveAttemptRemaining(attempt);
            const openSecs = attempt.interval_seconds || rem;
            setElapsed(Math.max(0, openSecs - rem));
            setRemaining(rem);
            setLoading(false);
            return;
          }
          const rem = clampRemainingToSharedSlot(
            resolveAttemptRemaining(attempt),
            rollup,
            slot,
            {
              excludeItemId: loadedItemId,
              attemptBudgetSeconds: attempt.interval_seconds,
            },
          );
          setRemaining(rem);
        } else if (attempt.status === "running") {
          if (simple) {
            startElapsedTick(attempt.started_at);
            setLoading(false);
            return;
          }
          const remRaw = resolveAttemptRemaining(attempt);
          // Use the rollup/item resolved in this effect — setState has not flushed.
          const loadedItemId =
            subtask?.id ?? attempt.checklist_item_id ?? queryChecklistItemId ?? null;
          const slot = coerceSessionSlot(subtask?.session_slot, 1);
          // Acharya often talks to remote OmniDel (omnidel-dev) which still
          // starts shared-slot mates with a fresh 45:00 — clamp here.
          const rem = clampRemainingToSharedSlot(remRaw, rollup, slot, {
            excludeItemId: loadedItemId,
            attemptBudgetSeconds: attempt.interval_seconds,
          });
          const attemptItemAlreadyDone = Boolean(
            attempt.checklist_item_id
            && rollup?.subtasks?.some(
              (s) => s.id === attempt.checklist_item_id && s.status === "completed",
            ),
          );
          // Stale timer for a finished subtask (e.g. opened Sub 6 but landed on
          // an expired Sub 2 attempt via 409) — bounce to details to start next.
          if (rem <= 0 && attemptItemAlreadyDone && incompleteSubtaskCount(rollup) > 0) {
            clearProofPhase(taskId, attemptId);
            setLoading(false);
            const sep = backPath.includes("?") ? "&" : "?";
            window.location.replace(`${backPath}${sep}fresh=1`);
            return;
          }
          if (rem <= 0) triggerExpired(rollup, loadedItemId);
          else startTick(rem, rem === remRaw ? attempt.deadline_at : null);
        } else {
          // Attempt already closed. If more sessions/subtasks remain, offer
          // starting the next one — do NOT treat mid-task close as Mark Done.
          const nextSubtask = resolveTaskSubtask(rollup);
          if (nextSubtask && nextSubtask.status !== "completed") {
            setChecklistItemId(nextSubtask.id);
            setSubtaskTitle(nextSubtask.title);
            setSubtaskSessionCount(nextSubtask.session_count);
            setSubtaskCompletedSessions(nextSubtask.sessions_completed);
            setSessionSlot(coerceSessionSlot(nextSubtask.session_slot, 1));
            const ord = rollup?.subtasks?.findIndex((s) => s.id === nextSubtask.id) ?? -1;
            setSubtaskOrdinal(ord >= 0 ? ord + 1 : null);
            setSessionCount(isSlotTimingModel(rollup) ? (rollup?.total_sessions ?? 1) : nextSubtask.session_count);
            const nextSeg = isSlotTimingModel(rollup)
              ? 1
              : Math.min(
                  Math.max(1, nextSubtask.sessions_completed + 1),
                  Math.max(1, nextSubtask.session_count),
                );
            setPendingNextSession(nextSeg);
            setSessionComplete(false);
            setAutoCompleted(false);
            setRemaining(0);
          } else if (!rollup?.subtasks?.length && attempt.segment_index < count) {
            // Task-level multi-session (no checklist): session N of M finished.
            setPendingNextSession(attempt.segment_index + 1);
            setSessionComplete(false);
            setAutoCompleted(false);
            setRemaining(0);
          } else {
            setSessionComplete(true);
            setAutoCompleted(incompleteSubtaskCount(rollup) === 0 && (rollup?.subtasks?.length ?? 0) > 0);
            setRemaining(0);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : "Failed to load session.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      clearTick();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId, attemptId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearTick();
      audioCtxRef.current?.close().catch(() => null);
    };
  }, []);

  // Screen lock / tab background freezes setInterval. On unlock, jump remaining
  // to wall-clock vs deadline so the timer never "stops" while blanked.
  useEffect(() => {
    const resyncAfterBackground = () => {
      if (document.visibilityState === "hidden") return;
      if (serverPausedRef.current || sessionCompleteRef.current || isExpiredRef.current) return;
      // Simple count-up: recompute elapsed from started_at.
      if (elapsedStartMsRef.current != null && deadlineAtMsRef.current == null) {
        const next = Math.max(0, Math.floor((Date.now() - elapsedStartMsRef.current) / 1000));
        setElapsed(next);
        if (!tickRef.current) {
          startElapsedTick(new Date(elapsedStartMsRef.current).toISOString());
        }
        return;
      }
      if (deadlineAtMsRef.current == null) return;
      const next = syncRemainingFromDeadline();
      if (next == null) return;
      if (next <= 0) {
        clearTick();
        triggerExpiredRef.current();
        return;
      }
      // Interval may have been suspended — ensure a tick is scheduled again.
      if (!tickRef.current) {
        startTick(next);
      }
    };
    document.addEventListener("visibilitychange", resyncAfterBackground);
    window.addEventListener("pageshow", resyncAfterBackground);
    window.addEventListener("focus", resyncAfterBackground);
    return () => {
      document.removeEventListener("visibilitychange", resyncAfterBackground);
      window.removeEventListener("pageshow", resyncAfterBackground);
      window.removeEventListener("focus", resyncAfterBackground);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }, []);

  const strings = useStrings();

  // ── Inactivity auto-close + time extension ──────────────────────────────
  // The hook only heartbeats and relays the server's verdict; the route decides
  // whether the grace window has run out (see auto-close/route.ts). Disabled on
  // simple tasks, which count UP and have no deadline to run past.
  const handleAutoClosed = useCallback(() => {
    showToast(strings.inactivityClosedBody);
    // Long enough to read the toast before the screen changes under them.
    setTimeout(() => nav.push("/acharyas"), 2200);
  }, [showToast, strings.inactivityClosedBody, nav]);

  const { status: inactivity, noteExtended } = useInactivityTimeout({
    taskId,
    attemptId: attemptId ?? "",
    enabled: Boolean(taskId) && Boolean(attemptId) && !isSimpleTask,
    onAutoClosed: handleAutoClosed,
  });

  // Re-anchor the countdown on the extended deadline. `remaining` is a duration
  // measured against a LOCAL anchor, never a server timestamp (see the header
  // comment on clock skew), so the new deadline is converted to a duration here
  // rather than stored as an absolute.
  const handleTimeExtended = useCallback((deadlineAt: string) => {
    const secs = Math.max(0, Math.round((Date.parse(deadlineAt) - Date.now()) / 1000));
    if (Number.isFinite(secs)) setRemaining(secs);
    noteExtended();
    showToast(strings.requestTimeTitle);
  }, [noteExtended, showToast, strings.requestTimeTitle]);

  async function refreshPastUpdates() {
    if (!taskId || !attemptId) return;
    try {
      const lr = await fetch(`/api/work/tasks/${taskId}/attempts/${attemptId}/updates`, { cache: "no-store" });
      if (lr.ok) {
        const d = await lr.json() as { items?: Array<{ id: string; kind: string; text_payload: string | null; blob_url: string | null; attachments?: Array<{ url: string; mime?: string | null }> | null; captured_at: string }> };
        setPastUpdates(d.items || []);
      }
    } catch { /* best-effort */ }
  }

  async function startSessionAtIndex(nextIndex: number) {
    if (!taskId) return;
    setPendingNextSession(null);
    const body: Record<string, unknown> = { segment_index: nextIndex };
    if (checklistItemId) body.checklist_item_id = checklistItemId;
    const slot = sessionSlot
      ?? coerceSessionSlot(
        timingRollup?.subtasks.find((s) => s.id === checklistItemId)?.session_slot,
        nextIndex,
      );
    const fromRollup = sharedSlotRemainingFromRollup(timingRollup, slot, {
      excludeItemId: checklistItemId,
    });
    const carried = fromRollup ?? readSharedSessionRemaining(taskId, slot);
    if (carried != null) body.remaining_seconds = carried;
    const r = await fetch(`/api/work/tasks/${taskId}/attempts/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      const d = await r.json().catch(() => null);
      throw new Error(d?.error || `Failed to start session ${nextIndex} (${r.status})`);
    }
    const data = await r.json() as { item: AttemptItem };
    const newAttempt = data.item;
    let activeSubtask = null as TimingRollup["subtasks"][number] | null;
    let latestRollup: TimingRollup | null = timingRollup;
    try {
      const taskRes = await fetch(`/api/work/tasks/${taskId}?fresh=1`, { cache: "no-store" });
      if (taskRes.ok) {
        const taskData = await taskRes.json() as { item?: { timingRollup?: TimingRollup | null; sessionCount?: number } };
        latestRollup = absorbRollup(taskData.item?.timingRollup ?? null, taskData.item?.sessionCount);
        activeSubtask = resolveTaskSubtask(latestRollup, newAttempt.checklist_item_id ?? null);
        setTimingRollup(latestRollup);
        if (activeSubtask) {
          const ord = latestRollup?.subtasks?.findIndex((s) => s.id === activeSubtask!.id) ?? -1;
          setSubtaskOrdinal(ord >= 0 ? ord + 1 : null);
          setSessionSlot(coerceSessionSlot(activeSubtask.session_slot, 1));
        }
      }
    } catch {
      activeSubtask = null;
    }
    setResolvedAttemptId(newAttempt.id);
    onAttemptChange?.(newAttempt.id);
    if (!inBox) router.replace(activeUrl(newAttempt.id));
    setChecklistItemId(activeSubtask?.id ?? newAttempt.checklist_item_id ?? checklistItemId);
    setSubtaskTitle(activeSubtask?.title ?? subtaskTitle);
    setSubtaskSessionCount(activeSubtask?.session_count ?? subtaskSessionCount);
    setSubtaskCompletedSessions(activeSubtask?.sessions_completed ?? subtaskCompletedSessions);
    if (activeSubtask) setSessionSlot(coerceSessionSlot(activeSubtask.session_slot, 1));
    const plan = newAttempt.segment_plan;
    const secs = newAttempt.interval_seconds
      || sessionDurationSeconds(newAttempt.segment_index, plan ?? undefined);
    setIntervalSeconds(secs);
    setSegmentIndex(newAttempt.segment_index);
    setSessionCount(
      isSlotTimingModel(latestRollup)
        ? Math.max(1, latestRollup?.total_sessions ?? sessionCount)
        : (activeSubtask?.session_count ?? subtaskSessionCount ?? plan?.segment_count ?? sessionCount),
    );
    const quota = breakQuotaFromAttempt(newAttempt);
    setBreaksAllowed(quota.allowed);
    setBreaksRemaining(quota.remaining);
    setServerPaused(false);
    setIsExpired(false);
    setAutoCompleted(false);
    setPastUpdates([]);
    const remRaw = resolveAttemptRemaining(newAttempt);
    const startedSlot = coerceSessionSlot(activeSubtask?.session_slot, nextIndex);
    const rem = clampRemainingToSharedSlot(remRaw, latestRollup, startedSlot, {
      excludeItemId: activeSubtask?.id ?? newAttempt.checklist_item_id ?? checklistItemId,
      attemptBudgetSeconds: newAttempt.interval_seconds,
    });
    startTick(rem, rem === remRaw ? newAttempt.deadline_at : null);
    clearSharedSessionRemaining(taskId, startedSlot);
    showToast(`Session ${startedSlot} started.`);
  }

  async function handleResumeSession() {
    if (!taskId || !attemptId) return;
    try {
      const r = await fetch(`/api/work/tasks/${taskId}/attempts/${attemptId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "resume" }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => null) as { error?: string } | null;
        // Already running (or stale paused UI) — resync from server instead of toasting 409.
        if (r.status === 409) {
          const attemptRes = await fetch(`/api/work/tasks/${taskId}/attempts/${attemptId}`, {
            cache: "no-store",
          });
          if (attemptRes.ok) {
            const attemptData = await attemptRes.json() as { item: AttemptItem };
            const item = attemptData.item;
            if (item?.status === "running") {
              setServerPaused(false);
              setIsExpired(false);
              const quota = breakQuotaFromAttempt(item);
              setBreaksAllowed(quota.allowed);
              setBreaksRemaining(quota.remaining);
              startTick(resolveAttemptRemaining(item), item.deadline_at);
              showToast("Session already running.");
              return;
            }
            if (item?.status === "paused") {
              setServerPaused(true);
              deadlineAtMsRef.current = null;
              showToast(d?.error || "Still on break — try again.");
              return;
            }
          }
        }
        throw new Error(d?.error || `Resume failed (${r.status})`);
      }
      const data = await r.json() as { item: AttemptItem };
      setServerPaused(false);
      setIsExpired(false);
      const quota = breakQuotaFromAttempt(data.item);
      setBreaksAllowed(quota.allowed);
      setBreaksRemaining(quota.remaining);
      startTick(resolveAttemptRemaining(data.item), data.item.deadline_at);
      showToast("Session resumed.");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to resume session.");
    }
  }

  const canTakeVoluntaryBreak =
    breaksRemaining > 0 && !serverPaused && !isExpired && !sessionComplete && !pendingNextSession;

  async function handleSubtaskProofSubmit(payload: UpdatePayload) {
    if (!checklistItemId || completingSubtask) return;
    setCompletingSubtask(true);
    setSubmittingUpdate(true);
    try {
      if (deadlineAtMsRef.current != null) syncRemainingFromDeadline();
      const leftover = Math.max(0, remainingRef.current);
      const slotForCarry = sessionSlot
        ?? coerceSessionSlot(
          timingRollup?.subtasks.find((s) => s.id === checklistItemId)?.session_slot,
          1,
        );

      if (attemptId) {
        const updateRes = await fetch(`/api/work/tasks/${taskId}/attempts/${attemptId}/updates`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kind: payload.kind,
            text: payload.text,
            blob_url: payload.blob_url,
            blob_mime: payload.blob_mime,
            attachments: payload.attachments,
            context: "segment_end",
            remaining_seconds: leftover,
          }),
        });
        // 409 = attempt already closed (prior submit / segment_end) — still finish checklist.
        if (!updateRes.ok && updateRes.status !== 409) {
          const d = await updateRes.json().catch(() => null);
          throw new Error(d?.error || `Proof upload failed (${updateRes.status})`);
        }
        if (updateRes.ok) {
          const result = await updateRes.json().catch(() => null) as {
            shared_session_remaining_seconds?: number | null;
          } | null;
          const carried =
            typeof result?.shared_session_remaining_seconds === "number"
              ? result.shared_session_remaining_seconds
              : leftover;
          const fromRollup = sharedSlotRemainingFromRollup(timingRollup, slotForCarry, {
            excludeItemId: checklistItemId,
          });
          const attemptBudget = intervalSecondsRef.current || SESSION_DURATION_SECONDS;
          const workThis = Math.max(0, attemptBudget - leftover);
          const stashValue =
            fromRollup != null ? Math.max(0, fromRollup - workThis) : carried;
          if (stashValue > 0) stashSharedSessionRemaining(taskId, slotForCarry, stashValue);
          else clearSharedSessionRemaining(taskId, slotForCarry);
        } else if (leftover > 0) {
          // Already finished — keep local leftover so the next start can continue.
          const fromRollup = sharedSlotRemainingFromRollup(timingRollup, slotForCarry, {
            excludeItemId: checklistItemId,
          });
          const attemptBudget = intervalSecondsRef.current || SESSION_DURATION_SECONDS;
          const workThis = Math.max(0, attemptBudget - leftover);
          const stashValue =
            fromRollup != null ? Math.max(0, fromRollup - workThis) : leftover;
          if (stashValue > 0) stashSharedSessionRemaining(taskId, slotForCarry, stashValue);
        }
      }

      const r = await fetch(`/api/work/tasks/${taskId}/subtasks/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          checklist_item_id: checklistItemId,
          attempt_id: attemptId,
        }),
      });
      const data = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) {
        const msg = data.error || `Error ${r.status}`;
        // segment_end may already have completed the checklist item.
        const alreadyDone =
          r.status === 400 && /nothing to update|already/i.test(msg);
        if (!alreadyDone && r.status !== 409) throw new Error(msg);
      }
      notifyActiveAttemptChanged();
      setSheetOpen(false);
      clearTick();
      deadlineAtMsRef.current = null;

      // Last subtask → reuse this proof for /complete (evaluation). Avoids a
      // second Text+Image form after the worker already submitted once.
      try {
        const taskRes = await fetch(`/api/work/tasks/${taskId}?fresh=1`, { cache: "no-store" });
        if (taskRes.ok) {
          const taskData = await taskRes.json() as { item?: { timingRollup?: TimingRollup | null; sessionCount?: number } };
          const rollup = absorbRollup(taskData.item?.timingRollup ?? null, taskData.item?.sessionCount);
          setTimingRollup(rollup);
          const remaining = (rollup?.subtasks ?? []).filter((s) => s.status !== "completed");
          if (remaining.length === 0) {
            clearSharedSessionRemaining(taskId, slotForCarry);
            setSessionComplete(true);
            setRemaining(0);
            try {
              await runFinalEvaluationWithSheet(payload);
              setCompletingSubtask(false);
              setSubmittingUpdate(false);
              return;
            } catch (completeErr) {
              setAutoCompleted(true);
              setCompletePrefetchedEvaluation(null);
              setCompletePrefetching(false);
              setCompleteSheetOpen(true);
              showToast(
                completeErr instanceof Error
                  ? completeErr.message
                  : "All subtasks complete. Submit final proof.",
              );
              setCompletingSubtask(false);
              setSubmittingUpdate(false);
              return;
            }
          }
        }
      } catch {
        // Fall through to task detail if rollup refresh fails.
      }

      // Always return to task details after a subtask — never leave the timer at 00:00.
      goToTaskDetails(backPath);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to complete subtask");
      setCompletingSubtask(false);
      setSubmittingUpdate(false);
    }
  }

  async function handleSubtaskComplete() {
    if (!checklistItemId || completingSubtask) return;
    openUpdateSheet("subtask");
  }

  /** Slot model: end the whole session (all mates in session_slot). Legacy: mid-subtask segment only. */
  function handleSessionComplete() {
    if (completingSubtask || submittingUpdate) return;
    openUpdateSheet("session");
  }

  /** Pause the attempt with no image/text — break proof is optional. */
  async function takeBreakWithoutProof() {
    if (!taskId || !attemptId || submittingUpdate) return;
    setSubmittingUpdate(true);
    setSheetOpen(false);
    // Catch up wall-clock before snapshotting remaining for the pause.
    if (deadlineAtMsRef.current != null) syncRemainingFromDeadline();
    try {
      const r = await fetch(`/api/work/tasks/${taskId}/attempts/${attemptId}/updates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "text",
          context: "voluntary_break",
          remaining_seconds: remainingRef.current,
        }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => null);
        if (r.status === 409) {
          setBreaksRemaining(0);
          throw new Error(d?.error || "No breaks left in this session.");
        }
        throw new Error(d?.error || `Break failed (${r.status})`);
      }
      const result = await r.json() as { item?: AttemptItem };
      clearTick();
      deadlineAtMsRef.current = null;
      const pausedRemaining = result.item ? resolveAttemptRemaining(result.item) : remainingRef.current;
      setRemaining(pausedRemaining);
      setServerPaused(true);
      if (result.item) {
        const quota = breakQuotaFromAttempt(result.item);
        setBreaksAllowed(quota.allowed);
        setBreaksRemaining(quota.remaining);
      }
      showToast("Break started. Resume when you're ready.");
      await refreshPastUpdates();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to take break. Try again.");
      if (!serverPaused && remainingRef.current > 0) startTick(remainingRef.current);
    } finally {
      setSubmittingUpdate(false);
    }
  }

  async function handleUpdateSubmit(payload: UpdatePayload) {
    if (sheetReason === "subtask") {
      await handleSubtaskProofSubmit(payload);
      return;
    }

    if (!taskId || !attemptId) return;
    const isSegmentEnd = sheetReason === "expired" || sheetReason === "session";
    setSubmittingUpdate(true);
    try {
      if (deadlineAtMsRef.current != null) syncRemainingFromDeadline();
      const leftover = Math.max(0, remainingRef.current);
      const slotForCarry = sessionSlot
        ?? coerceSessionSlot(
          timingRollup?.subtasks.find((s) => s.id === checklistItemId)?.session_slot,
          1,
        );

      const body: Record<string, unknown> = {
        kind: payload.kind,
        text: payload.text,
        blob_url: payload.blob_url,
        blob_mime: payload.blob_mime,
        attachments: payload.attachments,
        context: isSegmentEnd ? "segment_end" : "voluntary_break",
        remaining_seconds: leftover,
      };

      const r = await fetch(`/api/work/tasks/${taskId}/attempts/${attemptId}/updates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => null) as { error?: string } | null;
        // Segment-end retry after a successful first submit — recover instead of blocking.
        if (r.status === 409 && isSegmentEnd) {
          if (leftover > 0) stashSharedSessionRemaining(taskId, slotForCarry, leftover);
          clearProofPhase(taskId, attemptId);
          setSheetOpen(false);
          setIsExpired(false);
          clearTick();
          deadlineAtMsRef.current = null;
          notifyActiveAttemptChanged();
          goToTaskDetails(backPath);
          return;
        }
        if (r.status === 409 && !isSegmentEnd) {
          setBreaksRemaining(0);
          throw new Error(d?.error || "No breaks left in this session.");
        }
        throw new Error(d?.error || `Submit failed (${r.status})`);
      }

      const result = await r.json() as {
        item?: AttemptItem;
        task_completed?: boolean;
        shared_session_remaining_seconds?: number | null;
        already_finished?: boolean;
      };
      clearProofPhase(taskId, attemptId);
      setSheetOpen(false);
      setIsExpired(false);
      clearTick();
      deadlineAtMsRef.current = null;

      if (!isSegmentEnd) {
        const pausedRemaining = result.item ? resolveAttemptRemaining(result.item) : leftover;
        setRemaining(pausedRemaining);
        setServerPaused(true);
        if (result.item) {
          const quota = breakQuotaFromAttempt(result.item);
          setBreaksAllowed(quota.allowed);
          setBreaksRemaining(quota.remaining);
        }
        showToast("Break logged. Resume when you're ready.");
        await refreshPastUpdates();
        return;
      }

      const carried =
        typeof result.shared_session_remaining_seconds === "number"
          ? result.shared_session_remaining_seconds
          : leftover;
      // Prefer rollup-based leftover (45 − work done). fromRollup excludes the
      // current (still incomplete) item; subtract this attempt's work too.
      const fromRollup = sharedSlotRemainingFromRollup(timingRollup, slotForCarry, {
        excludeItemId: checklistItemId,
      });
      const attemptBudget = intervalSecondsRef.current || SESSION_DURATION_SECONDS;
      const workThis = Math.max(0, attemptBudget - leftover);
      const stashValue =
        fromRollup != null
          ? Math.max(0, fromRollup - workThis)
          : carried;

      // Session complete: finish every remaining mate in this session_slot.
      // Clear shared leftover — the session is over.
      const finishingWholeSlot = sheetReason === "session";
      if (finishingWholeSlot) {
        clearSharedSessionRemaining(taskId, slotForCarry);
        const slotRes = await fetch(`/api/work/tasks/${taskId}/subtasks/complete-session`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            session_slot: slotForCarry,
            attempt_id: attemptId,
          }),
        });
        if (!slotRes.ok) {
          const d = await slotRes.json().catch(() => null) as { error?: string } | null;
          throw new Error(
            d?.error
              || (slotRes.status === 404
                ? "Session complete API missing on OmniDel — point Acharya at local OmniDel on feat/checklist-session-slot."
                : `Failed to complete session (${slotRes.status})`),
          );
        }
      } else if (isSlotTimingModel(timingRollup)) {
        if (stashValue > 0) stashSharedSessionRemaining(taskId, slotForCarry, stashValue);
        else clearSharedSessionRemaining(taskId, slotForCarry);
      }

      await refreshPastUpdates();
      notifyActiveAttemptChanged();

      // Slot model: after subtask/session proof, return to task details so the
      // next "Start Session M" can resume (or start the next slot).
      if (isSlotTimingModel(timingRollup) && !result.task_completed) {
        if (finishingWholeSlot) {
          try {
            const taskRes = await fetch(`/api/work/tasks/${taskId}?fresh=1`, { cache: "no-store" });
            if (taskRes.ok) {
              const taskData = await taskRes.json() as {
                item?: { timingRollup?: TimingRollup | null; sessionCount?: number };
              };
              const rollup = absorbRollup(
                taskData.item?.timingRollup ?? null,
                taskData.item?.sessionCount,
              );
              setTimingRollup(rollup);
              const remaining = (rollup?.subtasks ?? []).filter((s) => s.status !== "completed");
              if (remaining.length === 0) {
                setSessionComplete(true);
                setRemaining(0);
                try {
                  await runFinalEvaluationWithSheet(payload);
                } catch (completeErr) {
                  setAutoCompleted(true);
                  setCompletePrefetchedEvaluation(null);
                  setCompletePrefetching(false);
                  setCompleteSheetOpen(true);
                  showToast(
                    completeErr instanceof Error
                      ? completeErr.message
                      : "All subtasks complete. Submit final proof.",
                  );
                }
                return;
              }
            }
          } catch {
            // Fall through to task detail.
          }
        }
        goToTaskDetails(backPath);
        return;
      }

      if (result.task_completed) {
        // Re-check rollup — server allCompleted can race activate-next.
        try {
          const taskRes = await fetch(`/api/work/tasks/${taskId}?fresh=1`, { cache: "no-store" });
          if (taskRes.ok) {
            const taskData = await taskRes.json() as { item?: { timingRollup?: TimingRollup | null; sessionCount?: number } };
            const rollup = absorbRollup(taskData.item?.timingRollup ?? null, taskData.item?.sessionCount);
            setTimingRollup(rollup);
            const nextSubtask = resolveTaskSubtask(rollup);
            if (nextSubtask && nextSubtask.status !== "completed") {
              goToTaskDetails(backPath);
              return;
            }
          }
        } catch {
          // Fall through to final complete.
        }
        // Reuse the proof already on this form — no second Text+Image sheet.
        setSessionComplete(true);
        setRemaining(0);
        try {
          await runFinalEvaluationWithSheet(payload);
        } catch (completeErr) {
          setAutoCompleted(true);
          setCompletePrefetchedEvaluation(null);
          setCompletePrefetching(false);
          setCompleteSheetOpen(true);
          showToast(
            completeErr instanceof Error
              ? completeErr.message
              : "All subtasks complete. Submit final proof.",
          );
        }
        return;
      }

      // Legacy: same checklist item still has more of its own sessions.
      if (
        !isSlotTimingModel(timingRollup)
        && segmentIndex < (subtaskSessionCount ?? sessionCount)
      ) {
        setSubtaskCompletedSessions((prev) => Math.min(subtaskSessionCount ?? sessionCount, prev + 1));
        setPendingNextSession(segmentIndex + 1);
        setSessionComplete(false);
        setAutoCompleted(false);
        setRemaining(0);
        showToast(`Session ${segmentIndex} complete. Start session ${segmentIndex + 1} when ready.`);
        return;
      }

      if (taskId) {
        try {
          const taskRes = await fetch(`/api/work/tasks/${taskId}?fresh=1`, { cache: "no-store" });
          if (taskRes.ok) {
            const taskData = await taskRes.json() as { item?: { timingRollup?: TimingRollup | null; sessionCount?: number } };
            const rollup = absorbRollup(taskData.item?.timingRollup ?? null, taskData.item?.sessionCount);
            setTimingRollup(rollup);
            const nextSubtask = resolveTaskSubtask(rollup);
            if (nextSubtask && nextSubtask.status !== "completed") {
              goToTaskDetails(backPath);
              return;
            }
          }
        } catch {
          // Best effort: fall through to the final complete state.
        }
      }

      // Last session of a non-subtask task (or last subtask session): the worker
      // already uploaded text+image for segment_end. Reuse it for /complete so
      // they are NOT stuck on "All sessions complete / Mark task as Done".
      setSessionComplete(true);
      setRemaining(0);
      try {
        await runFinalEvaluationWithSheet(payload);
      } catch (completeErr) {
        setAutoCompleted(true);
        setCompletePrefetchedEvaluation(null);
        setCompletePrefetching(false);
        setCompleteSheetOpen(true);
        showToast(
          completeErr instanceof Error
            ? completeErr.message
            : "Session saved. Submit final proof to finish.",
        );
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to save update. Try again.");
    } finally {
      setSubmittingUpdate(false);
    }
  }

  function handleCompleteSuccess(_approved: boolean) {
    leaveAfterTaskSubmitted();
  }

  function goBackFromSession() {
    if (inline && !shell) {
      onExit?.();
      return;
    }
    if (sessionComplete && incompleteSubtaskCount(timingRollup) === 0) {
      nav.push(donePath);
      return;
    }
    // Prefer a history back so the task detail comes back from the router cache
    // (no re-fetch, no skeleton flash); replace() when we did not come from it.
    nav.back(backPath);
  }

  const remainingSubtasks = incompleteSubtaskCount(timingRollup);
  const canMarkTaskDone = sessionComplete && remainingSubtasks === 0;
  const slotModel = isSlotTimingModel(timingRollup);
  const displaySessionSlot = sessionSlot
    ?? (slotModel ? coerceSessionSlot(segmentIndex, 1) : Math.min(segmentIndex, Math.max(1, subtaskSessionCount ?? sessionCount)));
  const displayTotalSessions = slotModel
    ? Math.max(1, timingRollup?.total_sessions ?? sessionCount)
    : Math.max(1, subtaskSessionCount ?? sessionCount);
  const matesInSession = slotMateTitles(timingRollup, displaySessionSlot);
  const sessionTitle = matesInSession.length > 1
    ? matesInSession.join(" · ")
    : (subtaskTitle?.trim()
      || (subtaskOrdinal != null ? `Subtask ${subtaskOrdinal}` : null)
      || `Session ${displaySessionSlot}`);
  const totalSessionsForSubtask = Math.max(1, subtaskSessionCount ?? sessionCount);
  const matesPendingInSlot = slotModel && timingRollup
    ? timingRollup.subtasks.filter(
        (s) =>
          coerceSessionSlot(s.session_slot, 1) === displaySessionSlot
          && s.status !== "completed"
          && s.id !== checklistItemId,
      ).length
    : 0;
  const isLastInSharedSlot = !slotModel || matesPendingInSlot === 0;
  const isLastSessionOfSubtask = slotModel
    ? isLastInSharedSlot
    : segmentIndex >= totalSessionsForSubtask;
  const nextPendingSessionSlot = (() => {
    if (!timingRollup?.subtasks?.length) return displaySessionSlot;
    const next = [...timingRollup.subtasks]
      .sort((a, b) => {
        const slotA = coerceSessionSlot(a.session_slot, 1);
        const slotB = coerceSessionSlot(b.session_slot, 1);
        if (slotA !== slotB) return slotA - slotB;
        return 0;
      })
      .find((s) => s.status !== "completed");
    return next ? coerceSessionSlot(next.session_slot, displaySessionSlot) : displaySessionSlot;
  })();
  const startNextLabel = slotModel
    ? `Start Session ${nextPendingSessionSlot}`
    : `Start Session ${pendingNextSession}`;
  // Never treat "rollup not loaded yet" as final — that was Mark Done at 00:00 on Sub 6.
  // Slot model: never short-circuit to Mark-task-Done while a subtask is still active —
  // show Session complete / Subtask complete instead; final eval runs after the last item.
  //
  // Task-level timing (no checklist): there is no timingRollup. Still treat the last
  // segment as final so the bottom CTA is not empty when breaks are already used.
  const isFinalTaskSession =
    !slotModel &&
    !sessionComplete &&
    !pendingNextSession &&
    !isExpired &&
    !serverPaused &&
    (checklistItemId
      ? isWholeTaskFinalSession()
      : segmentIndex >= Math.max(1, sessionCount));
  const sessionProgressPct = slotModel
    ? (!sessionComplete && !pendingNextSession
        ? Math.min(
            100,
            Math.round(
              ((SESSION_DURATION_SECONDS - Math.min(SESSION_DURATION_SECONDS, Math.max(0, remaining))) /
                SESSION_DURATION_SECONDS) *
                100,
            ),
          )
        : Math.min(
            100,
            Math.round((completedSessionSlotCount(timingRollup) / displayTotalSessions) * 100),
          ))
    : Math.min(
        100,
        Math.round(
          ((subtaskSessionCount != null ? subtaskCompletedSessions : Math.max(0, segmentIndex - 1)) /
            Math.max(1, subtaskSessionCount ?? sessionCount)) *
            100,
        ),
      );

  const phase: Phase = isSimpleTask
    ? "active"
    : isExpired
    ? "expired"
    : intervalSeconds > 0 && remaining <= intervalSeconds * 0.25
    ? "warning"
    : "active";

  // Timer phase colors live on the ring/numerals only — the surface stays
  // page cream (matches Acharya shell box / reference screens).
  const bgColor = "var(--page)";
  const ctaPad = shell ? "12px" : "16px";
  const ctaMinH = shell ? 48 : 56;
  const ctaFont = shell ? 15 : 16;
  const secondaryPad = shell ? "10px" : "13px";
  const secondaryMinH = shell ? 42 : 48;

  if (loading) {
    return (
      <div
        style={{
          minHeight: inBox ? "100%" : "100svh",
          height: inBox ? "100%" : undefined,
          flex: shell ? 1 : undefined,
          background: "var(--page)",
        }}
        aria-busy="true"
        aria-label="Loading session…"
      >
        <ActiveSkeleton />
      </div>
    );
  }

  if (loadError) {
    return (
      <div style={{
        minHeight: inBox ? "100%" : "100svh",
        height: inBox ? "100%" : undefined,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 28px",
        background: "var(--page)",
        textAlign: "center",
        gap: 8,
      }}>
        <p style={{ fontFamily: "var(--font-serif)", fontSize: 18, color: "var(--ink)", letterSpacing: "-0.01em" }}>
          Couldn&apos;t load session
        </p>
        <p style={{ fontFamily: "var(--font-sans)", fontSize: 13, color: "var(--ink-mute)" }}>
          {loadError}
        </p>
        <button
          type="button"
          onClick={() => (inline && !shell) ? onExit?.() : nav.replace(backPath)}
          className="press"
          style={{
            marginTop: 12,
            padding: "10px 28px",
            borderRadius: "var(--r-md)",
            borderWidth: 1,
            borderStyle: "solid",
            borderColor: "var(--rule)",
            background: "transparent",
            fontFamily: "var(--font-sans)",
            fontSize: 14,
            color: "var(--ink-soft)",
            cursor: "pointer",
            minHeight: 44,
            outline: "none",
          }}
        >
          Go back
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: inBox ? 0 : "100svh",
        height: inBox ? "100%" : undefined,
        flex: shell ? 1 : undefined,
        minWidth: 0,
        display: "flex",
        flexDirection: "column",
        // Fit one viewport while the timer is live. After session complete the
        // ring is hidden and content is laid out to fit; only the updates list
        // scrolls if it has many entries (avoids a page-level scrollbar).
        overflowY: shell && (sessionComplete || pastUpdates.length === 0) ? "hidden" : "auto",
        WebkitOverflowScrolling: "touch",
        paddingTop: inBox ? 0 : "max(env(safe-area-inset-top), 0px)",
        paddingBottom: inBox ? 0 : "max(env(safe-area-inset-bottom), 0px)",
        background: bgColor,
      }}
    >
      {/* ── Top bar: back · ACTIVE SESSION · Task Done ─── */}
      <header style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: shell ? "6px 14px" : inline ? "10px 12px" : "12px 16px",
        flexShrink: 0,
        gap: 8,
      }}>
        <button
          type="button"
          onClick={goBackFromSession}
          aria-label="Back to task"
          className="press"
          style={{ ...ghostIconButtonStyle, color: "var(--ink-soft)", outline: "none" }}
        >
          <BackIcon />
        </button>

        <p style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: "var(--ink-faint)",
          flex: 1,
          textAlign: "center",
          margin: 0,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}>
          active session
        </p>

        {isSimpleTask ? (
          // Spacer so "active session" stays centered (matches back button width).
          <div aria-hidden style={{ width: shell ? 36 : 40, flexShrink: 0 }} />
        ) : (
          <button
            type="button"
            onClick={() => {
              // Task Done = whole task finished → open final submission (photo + note).
              // Remaining checklist items are closed server-side on /complete submit.
              openManualCompleteSheet();
            }}
            className="press"
            style={{
              padding: shell ? "6px 12px" : "8px 14px",
              borderRadius: "var(--r-md)",
              borderWidth: 1,
              borderStyle: "solid",
              borderColor: "var(--green-deep)",
              background: "transparent",
              fontFamily: "var(--font-sans)",
              fontSize: 13,
              fontWeight: 600,
              color: "var(--green-deep)",
              cursor: "pointer",
              minHeight: shell ? 36 : 40,
              whiteSpace: "nowrap",
              outline: "none",
              letterSpacing: "0.01em",
              flexShrink: 0,
            }}
          >
            Task Done
          </button>
        )}
      </header>

      {/* ── Task title + meta strip ─────────────────────────────────
          Compact: title centered, due date + "View details" pill below.
          Description hides behind the pill so the timer stays the focus. */}
      {(shell || !inline) && taskTitle && (
        <div style={{
          width: "100%",
          maxWidth: 352,
          margin: "0 auto",
          padding: shell ? "6px 16px 0" : "4px 28px 0",
          flexShrink: 0,
        }}>
          <h1 style={{
            fontFamily: "var(--font-serif)",
            fontSize: shell ? 16 : 18,
            fontWeight: 400,
            color: "var(--ink-soft)",
            lineHeight: 1.3,
            textAlign: "center",
            margin: 0,
            letterSpacing: "-0.01em",
          }}>
            {taskTitle}
          </h1>
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            gap: 8, marginTop: 4, flexWrap: "wrap",
          }}>
            {taskDueDate && (
              <span style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                color: "var(--ink-mute)",
                letterSpacing: "0.04em",
              }}>
                Due {new Date(taskDueDate).toLocaleDateString(undefined, {
                  weekday: "short", day: "numeric", month: "short",
                })}
              </span>
            )}
            {(taskDescription || taskDueDate) && (
              <button
                type="button"
                onClick={() => setDetailsOpen(true)}
                className="press"
                style={{
                  display: "inline-flex", alignItems: "center", gap: 4,
                  padding: "3px 9px",
                  background: "transparent",
                  borderWidth: 1, borderStyle: "solid", borderColor: "var(--rule)",
                  borderRadius: 999,
                  fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 500,
                  color: "var(--ink-soft)",
                  cursor: "pointer",
                }}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 8h.01M11 12h1v4h1" />
                </svg>
                View details
              </button>
            )}
          </div>

          {/* Keep task and current-session context as one visual group. */}
          {!isSimpleTask && (subtaskSessionCount != null || sessionCount > 0) && (
            <div
              style={{
                width: "100%",
                marginTop: shell ? 12 : 18,
                padding: shell ? "8px 12px" : "14px 14px 12px",
                borderRadius: "var(--r-md)",
                border: "1px solid var(--rule)",
                background: "var(--surface)",
              }}
            >
              <div
                style={{
                  fontFamily: "var(--font-serif)",
                  fontSize: shell ? 14 : 18,
                  fontWeight: 500,
                  color: "var(--ink)",
                  lineHeight: 1.25,
                  letterSpacing: "-0.01em",
                  marginBottom: 2,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {sessionTitle}
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  flexWrap: "wrap",
                  marginBottom: shell ? 7 : 12,
                  fontFamily: "var(--font-sans)",
                  fontSize: shell ? 11 : 12,
                  color: "var(--ink-mute)",
                }}
              >
                <span>
                  {`Session ${displaySessionSlot} of ${displayTotalSessions}`}
                  {matesInSession.length > 1 ? ` · ${matesInSession.length} subtasks` : ""}
                </span>
                {breaksAllowed > 0 && (
                  <span style={{ color: breaksRemaining > 0 ? "var(--ink-soft)" : "var(--ink-faint)" }}>
                    · Breaks {breaksRemaining}/{breaksAllowed}
                  </span>
                )}
              </div>
              <div
                style={{
                  height: shell ? 4 : 6,
                  borderRadius: 999,
                  background: "var(--surface-sunk)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${sessionProgressPct}%`,
                    background: "var(--green-deep)",
                    borderRadius: 999,
                    transition: "width 200ms ease",
                  }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Timer ring — primary focus ───────────────────────────
          Hidden once the session is complete: the fixed-size ring overflows
          a shrunk flex slot in the Acharya shell and paints over the
          "All sessions complete" / Mark-done CTAs below. */}
      {!sessionComplete && (
      <div style={{
        flex: "1 1 auto",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: shell ? "12px 20px 6px" : "24px 24px 8px",
        gap: 0,
        minHeight: shell ? 0 : 320,
        overflow: "hidden",
      }}>
        {pendingNextSession && (
          <p style={{
            fontFamily: "var(--font-sans)",
            fontSize: 13,
            color: "var(--green-deep)",
            textAlign: "center",
            marginBottom: 10,
          }}>
            {slotModel
              ? `Ready for ${startNextLabel}`
              : `Session ${segmentIndex} complete — ready for session ${pendingNextSession}`}
          </p>
        )}

        <TimerRing
          mode={isSimpleTask ? "elapsed" : "countdown"}
          totalSeconds={
            // Shared session_slot: ring is always against the 45:00 session bucket
            // even when this attempt's interval_seconds is a carry leftover.
            (slotModel ? SESSION_DURATION_SECONDS : intervalSeconds) || 1
          }
          remainingSeconds={remaining}
          elapsedSeconds={elapsed}
          phase={phase}
          size={shell ? "compact" : "default"}
          ariaLabel={
            isSimpleTask
              ? `${Math.floor(elapsed / 60)} minutes ${elapsed % 60} seconds elapsed`
              : `${Math.floor(remaining / 60)} minutes ${remaining % 60} seconds remaining in this interval`
          }
        />
      </div>
      )}

      {/* ── Attempt standing + request-time ──────────────────────
          Sits under the ring, which is where the karigar looks when the
          numerals run out. The badge self-hides on a first attempt, and the
          button stays available AFTER the deadline — the grace window is
          exactly when someone realises they need longer. */}
      {!isSimpleTask && attemptId && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexWrap: "wrap",
            gap: 8,
            padding: shell ? "2px 16px 0" : "4px 24px 0",
            flexShrink: 0,
          }}
        >
          <AttemptInfoBadge attemptNumber={inactivity?.attemptNumber ?? 1} />
          <RequestTimeButton
            taskId={taskId}
            attemptId={attemptId}
            deadlinePassed={inactivity?.deadlinePassed ?? isExpired}
            onExtended={handleTimeExtended}
          />
          {/* Only once the grace window is genuinely counting down, and only
              inside the last ten minutes — a warning shown for the full thirty
              becomes wallpaper. */}
          {inactivity?.deadlinePassed
            && inactivity.msUntilAutoClose > 0
            && inactivity.msUntilAutoClose < 10 * 60_000 && (
            <p
              role="status"
              style={{
                width: "100%",
                textAlign: "center",
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "var(--crit)",
                margin: "6px 0 0",
              }}
            >
              {strings.inactivityWarning}
            </p>
          )}
        </div>
      )}

      {/* ── Break / session-complete CTA ───────────────────────── */}
      <div style={{
        // Longhands only — mixing `padding` + `paddingBottom` triggers a React warning.
        paddingTop: shell ? (sessionComplete ? 8 : 10) : 20,
        paddingLeft: shell ? (sessionComplete ? 16 : 20) : 24,
        paddingRight: shell ? (sessionComplete ? 16 : 20) : 24,
        paddingBottom: shell
          ? "max(env(safe-area-inset-bottom, 12px), 12px)"
          : "max(env(safe-area-inset-bottom, 20px), 24px)",
        flexShrink: 0,
      }}>
        {isSimpleTask ? (
          <div style={{ display: "flex", flexDirection: "column", gap: shell ? 8 : 12 }}>
            <button
              type="button"
              onClick={() => openSimpleSubmitPrompt()}
              disabled={simpleBareSubmitting}
              className="press"
              style={{
                width: "100%",
                padding: ctaPad,
                borderRadius: "var(--r-lg)",
                border: "none",
                background: "var(--green-deep)",
                color: "#f4efdf",
                fontFamily: "var(--font-sans)",
                fontSize: ctaFont,
                fontWeight: 700,
                cursor: simpleBareSubmitting ? "not-allowed" : "pointer",
                minHeight: ctaMinH,
                opacity: simpleBareSubmitting ? 0.7 : 1,
              }}
            >
              {simpleBareSubmitting ? "Submitting…" : "Submit"}
            </button>
          </div>
        ) : sessionComplete && canMarkTaskDone ? (
          <div style={{ textAlign: "center" }}>
            <p style={{
              fontFamily: "var(--font-serif)",
              fontSize: shell ? 15 : 16,
              color: "var(--green-deep)",
              fontWeight: 400,
              margin: "0 0 6px",
              letterSpacing: "-0.01em",
            }}>
              All sessions complete
            </p>
            <p style={{
              fontFamily: "var(--font-sans)",
              fontSize: 13,
              color: "var(--ink-soft)",
              margin: shell ? "0 0 12px" : "0 0 20px",
            }}>
              {autoCompleted
                ? "All subtasks are complete. Submit final text and image proof for evaluation."
                : "Share your final update and mark the task as done."}
            </p>
            <button
              type="button"
              onClick={() => openManualCompleteSheet()}
              className="press"
              style={{
                width: "100%",
                padding: shell ? "12px" : "16px",
                borderRadius: "var(--r-lg)",
                border: "none",
                background: "var(--green-deep)",
                color: "#f4efdf",
                fontFamily: "var(--font-sans)",
                fontSize: shell ? 15 : 16,
                fontWeight: 700,
                cursor: "pointer",
                minHeight: shell ? 48 : 56,
              }}
            >
              {autoCompleted ? "Submit final proof" : "Mark task as Done"}
            </button>
            <button
              type="button"
              onClick={goBackFromSession}
              className="press"
              style={{
                width: "100%",
                marginTop: shell ? 8 : 12,
                padding: shell ? "10px" : "13px",
                borderRadius: "var(--r-lg)",
                borderWidth: 1,
                borderStyle: "solid",
                borderColor: "var(--rule)",
                background: "transparent",
                color: "var(--ink-soft)",
                fontFamily: "var(--font-sans)",
                fontSize: 14,
                fontWeight: 500,
                cursor: "pointer",
                minHeight: shell ? 42 : 48,
              }}
            >
              Back to tasks
            </button>
          </div>
        ) : pendingNextSession ? (
          <button
            type="button"
            onClick={() => { void startSessionAtIndex(pendingNextSession).catch((e) => showToast(String(e))); }}
            className="press"
            style={{
              width: "100%",
              padding: "16px",
              borderRadius: "var(--r-lg)",
              border: "none",
              background: "var(--green-deep)",
              color: "#f4efdf",
              fontFamily: "var(--font-sans)",
              fontSize: 16,
              fontWeight: 700,
              cursor: "pointer",
              minHeight: 56,
            }}
          >
            {startNextLabel}
          </button>
        ) : sessionComplete && remainingSubtasks > 0 ? (
          <div style={{ textAlign: "center" }}>
            <p style={{
              fontFamily: "var(--font-serif)",
              fontSize: 16,
              color: "var(--green-deep)",
              fontWeight: 400,
              margin: "0 0 8px",
              letterSpacing: "-0.01em",
            }}>
              {subtaskTitle ? `${subtaskTitle} ready` : "Next subtask ready"}
            </p>
            <p style={{
              fontFamily: "var(--font-sans)",
              fontSize: 13,
              color: "var(--ink-soft)",
              margin: "0 0 20px",
            }}>
              {remainingSubtasks} subtask{remainingSubtasks === 1 ? "" : "s"} still open. Start the next one, or go back to the task.
            </p>
            <button
              type="button"
              onClick={() => {
                void startSessionAtIndex(1).catch((e) => showToast(String(e)));
              }}
              className="press"
              style={{
                width: "100%",
                padding: "16px",
                borderRadius: "var(--r-lg)",
                border: "none",
                background: "var(--green-deep)",
                color: "#f4efdf",
                fontFamily: "var(--font-sans)",
                fontSize: 16,
                fontWeight: 700,
                cursor: "pointer",
                minHeight: 56,
              }}
            >
              {subtaskTitle
                ? `Start with ${subtaskTitle}`
                : "Start next subtask"}
            </button>
            <button
              type="button"
              onClick={goBackFromSession}
              className="press"
              style={{
                width: "100%",
                marginTop: 12,
                padding: "13px",
                borderRadius: "var(--r-lg)",
                borderWidth: 1,
                borderStyle: "solid",
                borderColor: "var(--rule)",
                background: "transparent",
                color: "var(--ink-soft)",
                fontFamily: "var(--font-sans)",
                fontSize: 14,
                fontWeight: 500,
                cursor: "pointer",
                minHeight: 48,
              }}
            >
              Back to task
            </button>
          </div>
        ) : isExpired ? (
          <button
            type="button"
            onClick={() => {
              // Final session of the task → Task Done sheet (evaluation), not a
              // mid-session update that leaves "Mark as Done" as a second step.
              if (isWholeTaskFinalSession()) {
                openManualCompleteSheet();
              } else {
                openUpdateSheet("expired");
              }
            }}
            className="press"
            style={{
              width: "100%",
              padding: "16px",
              borderRadius: "var(--r-lg)",
              border: "none",
              background: "var(--crit)",
              color: "#f4efdf",
              fontFamily: "var(--font-sans)",
              fontSize: 16,
              fontWeight: 700,
              cursor: "pointer",
              minHeight: 56,
            }}
          >
            {isWholeTaskFinalSession() ? "Mark task as Done" : "Share session update"}
          </button>
        ) : serverPaused ? (
          <button
            type="button"
            onClick={() => { void handleResumeSession(); }}
            className="press"
            style={{
              width: "100%",
              padding: "16px",
              borderRadius: "var(--r-lg)",
              border: "none",
              background: "var(--green-deep)",
              color: "#f4efdf",
              fontFamily: "var(--font-sans)",
              fontSize: 16,
              fontWeight: 700,
              cursor: "pointer",
              minHeight: 56,
            }}
          >
            Resume session
          </button>
        ) : isFinalTaskSession && !slotModel ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <button
              type="button"
              onClick={() => openManualCompleteSheet()}
              className="press"
              style={{
                width: "100%",
                padding: "16px",
                borderRadius: "var(--r-lg)",
                border: "none",
                background: "var(--green-deep)",
                color: "#f4efdf",
                fontFamily: "var(--font-sans)",
                fontSize: 16,
                fontWeight: 700,
                cursor: "pointer",
                minHeight: 56,
              }}
            >
              Mark task as Done
            </button>
            {canTakeVoluntaryBreak ? (
              <button
                type="button"
                onClick={() => openUpdateSheet("break")}
                className="press"
                style={{
                  width: "100%",
                  padding: "13px",
                  borderRadius: "var(--r-lg)",
                  borderWidth: 1,
                  borderStyle: "solid",
                  borderColor: "var(--rule)",
                  background: "transparent",
                  color: "var(--ink-soft)",
                  fontFamily: "var(--font-sans)",
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: "pointer",
                  minHeight: 48,
                }}
              >
                Take a break
              </button>
            ) : null}
          </div>
        ) : checklistItemId && !sessionComplete && !pendingNextSession && !isExpired ? (
            <div style={{ display: "flex", flexDirection: "column", gap: shell ? 8 : 12 }}>
              <button
                type="button"
                onClick={() => handleSessionComplete()}
                disabled={completingSubtask || submittingUpdate}
                className="press"
                style={{
                  width: "100%",
                  padding: ctaPad,
                  borderRadius: "var(--r-lg)",
                  border: "none",
                  background: "var(--green-deep)",
                  color: "#f4efdf",
                  fontFamily: "var(--font-sans)",
                  fontSize: ctaFont,
                  fontWeight: 700,
                  cursor: completingSubtask || submittingUpdate ? "wait" : "pointer",
                  minHeight: ctaMinH,
                  opacity: completingSubtask || submittingUpdate ? 0.7 : 1,
                }}
              >
                {completingSubtask || submittingUpdate ? "Completing…" : "Session complete"}
              </button>
              <div style={{ display: "flex", gap: 8, width: "100%" }}>
                <button
                  type="button"
                  onClick={() => { void handleSubtaskComplete(); }}
                  disabled={completingSubtask || submittingUpdate}
                  className="press"
                  style={{
                    flex: 1,
                    padding: secondaryPad,
                    borderRadius: "var(--r-lg)",
                    borderWidth: 1,
                    borderStyle: "solid",
                    borderColor: "var(--rule)",
                    background: "transparent",
                    color: "var(--ink-soft)",
                    fontFamily: "var(--font-sans)",
                    fontSize: 14,
                    fontWeight: 500,
                    cursor: completingSubtask || submittingUpdate ? "wait" : "pointer",
                    minHeight: secondaryMinH,
                    opacity: completingSubtask || submittingUpdate ? 0.7 : 1,
                  }}
                >
                  Subtask complete
                </button>
                {canTakeVoluntaryBreak ? (
                  <button
                    type="button"
                    onClick={() => openUpdateSheet("break")}
                    className="press"
                    style={{
                      flex: 1,
                      padding: secondaryPad,
                      borderRadius: "var(--r-lg)",
                      borderWidth: 1,
                      borderStyle: "solid",
                      borderColor: "var(--rule)",
                      background: "transparent",
                      color: "var(--ink-soft)",
                      fontFamily: "var(--font-sans)",
                      fontSize: 14,
                      fontWeight: 500,
                      cursor: "pointer",
                      minHeight: secondaryMinH,
                    }}
                  >
                    Take a break
                  </button>
                ) : null}
              </div>
            </div>
        ) : !checklistItemId && !sessionComplete && !pendingNextSession && !isExpired && !serverPaused ? (
          // Task-level sessions (no subtasks): never leave the timer with an empty CTA.
          // Final segment → Mark Done; earlier segments → Session complete (segment_end proof).
          <div style={{ display: "flex", flexDirection: "column", gap: shell ? 8 : 12 }}>
            <button
              type="button"
              onClick={() => {
                if (segmentIndex >= Math.max(1, sessionCount)) {
                  openManualCompleteSheet();
                } else {
                  handleSessionComplete();
                }
              }}
              disabled={submittingUpdate}
              className="press"
              style={{
                width: "100%",
                padding: ctaPad,
                borderRadius: "var(--r-lg)",
                border: "none",
                background: "var(--green-deep)",
                color: "#f4efdf",
                fontFamily: "var(--font-sans)",
                fontSize: ctaFont,
                fontWeight: 700,
                cursor: submittingUpdate ? "wait" : "pointer",
                minHeight: ctaMinH,
                opacity: submittingUpdate ? 0.7 : 1,
              }}
            >
              {segmentIndex >= Math.max(1, sessionCount) ? "Mark task as Done" : "Session complete"}
            </button>
            {canTakeVoluntaryBreak ? (
              <button
                type="button"
                onClick={() => openUpdateSheet("break")}
                className="press"
                style={{
                  width: "100%",
                  padding: secondaryPad,
                  borderRadius: "var(--r-lg)",
                  borderWidth: 1,
                  borderStyle: "solid",
                  borderColor: "var(--rule)",
                  background: "transparent",
                  color: "var(--ink-soft)",
                  fontFamily: "var(--font-sans)",
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: "pointer",
                  minHeight: secondaryMinH,
                }}
              >
                Take a break
              </button>
            ) : null}
          </div>
        ) : canTakeVoluntaryBreak ? (
          <button
            type="button"
            onClick={() => openUpdateSheet("break")}
            className="press"
            style={{
              width: "100%",
              padding: ctaPad,
              borderRadius: "var(--r-lg)",
              borderWidth: 1,
              borderStyle: "solid",
              borderColor: "var(--rule-strong)",
              background: "var(--green-deep)",
              color: "#f4efdf",
              fontFamily: "var(--font-sans)",
              fontSize: ctaFont,
              fontWeight: 700,
              cursor: "pointer",
              minHeight: ctaMinH,
            }}
          >
            Take a break
          </button>
        ) : null}
      </div>

      {/* ── Lapses so far — past break artifacts for this attempt ─── */}
      {pastUpdates.length > 0 && (
        <section
          style={{
            padding: shell
              ? "6px 16px max(12px, env(safe-area-inset-bottom, 0px))"
              : "8px 20px max(28px, env(safe-area-inset-bottom, 0px))",
            flexShrink: sessionComplete ? 1 : 0,
            flex: sessionComplete ? "1 1 auto" : undefined,
            minHeight: sessionComplete ? 0 : undefined,
            overflowY: sessionComplete ? "auto" : undefined,
            WebkitOverflowScrolling: sessionComplete ? "touch" : undefined,
          }}
        >
          <h2 style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "var(--ink-mute)",
            margin: "0 0 10px",
            fontWeight: 600,
          }}>
            Session updates &middot; {pastUpdates.length}
          </h2>
          <ol style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
            {pastUpdates.map((u, i) => (
              <li key={u.id} style={{
                display: "flex", gap: 12, padding: 12,
                background: "var(--surface)",
                borderWidth: 1, borderStyle: "solid", borderColor: "var(--rule)",
                borderRadius: "var(--r-md)",
              }}>
                <div style={{
                  width: 24, height: 24, flexShrink: 0,
                  borderRadius: "50%",
                  background: "var(--ochre-wash)",
                  color: "var(--ochre)",
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700,
                }}>{i + 1}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontFamily: "var(--font-mono)", fontSize: 10,
                    letterSpacing: "0.08em", textTransform: "uppercase",
                    color: "var(--ink-mute)", marginBottom: 4,
                  }}>
                    {new Date(u.captured_at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                  </div>
                  {u.text_payload && (
                    <p style={{
                      margin: 0, fontSize: 13, lineHeight: 1.5,
                      color: "var(--ink-soft)",
                      fontFamily: "var(--font-sans)",
                    }}>
                      {u.text_payload}
                    </p>
                  )}
                  {(() => {
                    const urls = (() => {
                      const fromAtt = Array.isArray(u.attachments)
                        ? u.attachments.map((a) => a?.url).filter((url): url is string => !!url)
                        : [];
                      if (fromAtt.length > 0) return fromAtt;
                      return u.blob_url ? [u.blob_url] : [];
                    })();
                    if (urls.length === 0) return null;
                    return (
                      <div style={{
                        display: "grid",
                        gridTemplateColumns: urls.length === 1 ? "1fr" : "repeat(auto-fill, minmax(96px, 1fr))",
                        gap: 8,
                        marginTop: u.text_payload ? 8 : 0,
                      }}>
                        {urls.map((url, imgIdx) => (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            key={`${u.id}-${imgIdx}`}
                            src={blobViewUrl(url)}
                            alt={`Update ${i + 1} photo ${imgIdx + 1}`}
                            style={{
                              width: "100%",
                              maxHeight: urls.length === 1 ? 180 : undefined,
                              aspectRatio: urls.length === 1 ? undefined : "1",
                              borderRadius: "var(--r-sm)",
                              objectFit: "cover",
                              display: "block",
                            }}
                          />
                        ))}
                      </div>
                    );
                  })()}
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* ── Details modal — opened by the "View details" pill ─────── */}
      {detailsOpen && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setDetailsOpen(false)}
          style={{
            position: "fixed", inset: 0, zIndex: 60,
            background: "rgba(0,0,0,0.5)",
            display: "flex", alignItems: "flex-end", justifyContent: "center",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%", maxWidth: 480,
              background: "var(--page)",
              borderTopLeftRadius: "var(--r-lg)",
              borderTopRightRadius: "var(--r-lg)",
              padding: "20px 20px calc(20px + env(safe-area-inset-bottom))",
              maxHeight: "80vh",
              overflowY: "auto",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
              <h3 style={{
                fontFamily: "var(--font-serif)",
                fontSize: 18, fontWeight: 500, margin: 0,
                color: "var(--ink)",
              }}>
                Task details
              </h3>
              <button
                type="button"
                onClick={() => setDetailsOpen(false)}
                aria-label="Close details"
                style={{
                  width: 32, height: 32, padding: 0,
                  background: "transparent", border: "none",
                  cursor: "pointer", color: "var(--ink-mute)",
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            {taskTitle && (
              <p style={{
                margin: "0 0 8px", fontFamily: "var(--font-serif)",
                fontSize: 16, lineHeight: 1.4,
                color: "var(--ink-soft)",
              }}>
                {taskTitle}
              </p>
            )}
            {taskDueDate && (
              <p style={{
                margin: "0 0 12px", fontFamily: "var(--font-mono)",
                fontSize: 11, color: "var(--ink-mute)",
                letterSpacing: "0.04em",
              }}>
                Due {new Date(taskDueDate).toLocaleDateString(undefined, {
                  weekday: "long", day: "numeric", month: "long", year: "numeric",
                })}
              </p>
            )}
            {taskDescription ? (
              <p style={{
                margin: 0, fontSize: 14, lineHeight: 1.6,
                color: "var(--ink-soft)",
                fontFamily: "var(--font-sans)",
                whiteSpace: "pre-wrap",
              }}>
                {taskDescription}
              </p>
            ) : (
              <p style={{
                margin: 0, fontSize: 13, color: "var(--ink-mute)",
                fontFamily: "var(--font-sans)", fontStyle: "italic",
              }}>
                No description.
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── Session-end capture sheet ─────────────────────────────── */}
      <UpdateCaptureSheet
        open={sheetOpen}
        reason={sheetReason}
        taskTitle={taskTitle}
        onCancel={() => {
          // Break: Cancel = pause without image/text (proof is optional).
          if (sheetReason === "break") {
            clearProofPhase(taskId, attemptId);
            void takeBreakWithoutProof();
            return;
          }
          if (sheetReason !== "expired") {
            clearProofPhase(taskId, attemptId);
            setSheetOpen(false);
            if (!serverPaused && !sessionComplete && remaining > 0) {
              startTick(remaining);
            }
          }
        }}
        onSubmit={(payload) => void handleUpdateSubmit(payload)}
        uploading={submittingUpdate}
      />

      {/* ── Simple Submit: optional proof prompt ─────────────────── */}
      {simpleProofPromptOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 75,
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            padding: "0 12px 12px",
          }}
          aria-modal="true"
          role="dialog"
          aria-label="Add images or text?"
        >
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => {
              setSimpleProofPromptOpen(false);
              if (!serverPaused) {
                const start = elapsedStartMsRef.current;
                if (start != null) startElapsedTick(new Date(start).toISOString());
              }
            }}
            style={{
              position: "absolute",
              inset: 0,
              border: "none",
              background: "rgba(35, 29, 20, 0.4)",
              cursor: "pointer",
            }}
          />
          <div
            className="slide-up"
            style={{
              position: "relative",
              width: "100%",
              maxWidth: 420,
              background: "var(--surface)",
              borderRadius: "var(--r-lg)",
              border: "1px solid var(--rule)",
              boxShadow: "var(--shadow-md)",
              padding: "20px 18px 14px",
            }}
          >
            <p style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: "var(--ink-mute)",
              margin: 0,
            }}>
              Confirm
            </p>
            <h3 style={{
              fontFamily: "var(--font-serif)",
              fontSize: 20,
              fontWeight: 400,
              color: "var(--ink)",
              margin: "8px 0 0",
              lineHeight: 1.3,
            }}>
              Do you want to add some images or text regarding this task?
            </h3>
            <p style={{
              fontSize: 13.5,
              color: "var(--ink-soft)",
              lineHeight: 1.5,
              margin: "10px 0 0",
            }}>
              Photos and notes are optional. Choose Yes to add them, or No to submit for review now.
            </p>
            <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
              <button
                type="button"
                className="press"
                disabled={simpleBareSubmitting}
                onClick={() => void submitSimpleWithoutProof()}
                style={{
                  flex: 1,
                  padding: "12px 14px",
                  borderRadius: "var(--r-md)",
                  border: "1px solid var(--rule)",
                  background: "var(--surface)",
                  color: "var(--ink-soft)",
                  fontFamily: "var(--font-sans)",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: simpleBareSubmitting ? "not-allowed" : "pointer",
                }}
              >
                No
              </button>
              <button
                type="button"
                className="press"
                disabled={simpleBareSubmitting}
                onClick={() => {
                  setSimpleProofPromptOpen(false);
                  openManualCompleteSheet();
                }}
                style={{
                  flex: 1,
                  padding: "12px 14px",
                  borderRadius: "var(--r-md)",
                  border: "none",
                  background: "var(--green-deep)",
                  color: "#f4efdf",
                  fontFamily: "var(--font-sans)",
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: simpleBareSubmitting ? "not-allowed" : "pointer",
                }}
              >
                Yes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Task completion sheet ─────────────────────────────────── */}
      <CompleteSheet
        open={completeSheetOpen}
        taskId={taskId}
        attemptId={attemptId}
        taskTitle={taskTitle}
        prefetchedEvaluation={completePrefetchedEvaluation}
        isPrefetching={completePrefetching}
        skipEvalUi={isSimpleTask}
        proofOptional={isSimpleTask}
        onClose={() => {
          if (completePrefetching) return;
          // Keep text/photos in IndexedDB; only dismiss auto-reopen flag.
          dismissProofPhase(taskId, attemptId);
          setCompleteSheetOpen(false);
          setCompletePrefetchedEvaluation(null);
          if (isSimpleTask) {
            if (!serverPaused) {
              const start = elapsedStartMsRef.current;
              if (start != null) startElapsedTick(new Date(start).toISOString());
            }
            return;
          }
          // Resume wall-clock remaining if they backed out of Mark Done.
          if (!serverPaused && !sessionComplete && !isExpired && remainingRef.current > 0) {
            void (async () => {
              try {
                if (!attemptId) {
                  startTick(remainingRef.current);
                  return;
                }
                const r = await fetch(`/api/work/tasks/${taskId}/attempts/${attemptId}`, {
                  cache: "no-store",
                });
                if (!r.ok) {
                  startTick(remainingRef.current);
                  return;
                }
                const d = await r.json() as { item?: AttemptItem };
                if (d.item?.status === "running") {
                  const rem = resolveAttemptRemaining(d.item);
                  if (rem > 0) startTick(rem);
                  else triggerExpired();
                }
              } catch {
                startTick(remainingRef.current);
              }
            })();
          }
        }}
        onSuccess={handleCompleteSuccess}
      />

      {/* ── Toast ─────────────────────────────────────────────────── */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: "fixed",
            bottom: "max(env(safe-area-inset-bottom), 24px)",
            left: "50%",
            transform: "translateX(-50%)",
            background: "var(--ink)",
            color: "var(--surface)",
            padding: "10px 20px",
            borderRadius: 9999,
            fontFamily: "var(--font-sans)",
            fontSize: 13,
            fontWeight: 500,
            zIndex: 100,
            whiteSpace: "nowrap",
            boxShadow: "var(--shadow-md)",
            animation: "fade-up 220ms var(--ease-out) both",
            letterSpacing: "0.01em",
          }}
        >
          {toast}
        </div>
      )}
    </div>
  );
}

/* ── Icons ──────────────────────────────────────────────────────────────── */

function BackIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M19 12H5M11 6l-6 6 6 6"/>
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#f4efdf" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  );
}

/** Pause / hold mark — pending manager review (not a rejection). */
function HoldIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden="true">
      <rect x="6.5" y="5" width="3.5" height="14" rx="1" fill="#f4efdf" />
      <rect x="14" y="5" width="3.5" height="14" rx="1" fill="#f4efdf" />
    </svg>
  );
}

function XSmallIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#f4efdf" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18"/>
      <line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  );
}
