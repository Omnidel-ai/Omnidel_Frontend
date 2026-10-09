"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Lang } from "@/lib/store";
import { displayTaskTitle } from "@/lib/task-text";
import { t } from "@/lib/i18n/strings";

// Loose task shape — accepts both server KarigarTask (lib/server/omnidel-client)
// and client KarigarTask (lib/store / lib/api/tasks).
interface TaskShape {
  id: string;
  title: string;
  description: string | null;
  statusSlug: string;
  workspaceSlug?: string;
  plannedTime?: string | null;
  acharyaName?: string | null;
  acharyaSlug?: string | null;
  acharyaAvatarUrl?: string | null;
  segmentPlan?: {
    total_planned_seconds: number;
    segment_count: number;
    segment_durations_seconds: number[];
  } | null;
}

// ── TaskQuizTab ────────────────────────────────────────────────────────────────
// Quiz tab body for the per-task Learn surface (/tasks/[id]/learn?tab=quiz).
//
// Ported FSM from arjun-acharya-app/src/app/(app)/quiz/page.tsx.
// Rewired: moduleId → taskId, prompt rewritten in /api/work/quiz route.
// Completed runs POST to /api/work/quiz/submit for dashboard telemetry.

interface QuizQuestion {
  q: string;
  options: [string, string, string, string];
  correct: 0 | 1 | 2 | 3;
  explanation: string;
}

type QuizState = "ready" | "loading" | "active" | "result";

/** Spoken/typed option labels, in render order. */
const OPTION_LETTERS = ["a", "b", "c", "d"] as const;

/**
 * A short buzz on the answer. Two different shapes deliberately: one tap for
 * right, a stutter for wrong, so the phone in a pocket says which happened
 * without being looked at — this app is used in a Vatika, often one-handed.
 *
 * Guarded because `vibrate` is absent on iOS Safari and throws on some
 * Android WebViews when the page has had no user gesture.
 */
function buzz(correct: boolean): void {
  try {
    navigator.vibrate?.(correct ? 18 : [11, 55, 11]);
  } catch {
    /* haptics are a nicety, never a failure */
  }
}

/**
 * Balloons and confetti for a passed quiz. Fixed positions rather than random
 * ones: the same result should look the same twice, and a karigar comparing
 * two runs should not wonder whether the screen meant something different.
 */
const BALLOONS = [
  { left: "8%", tone: "var(--green)", sway: "14px", delay: 0, size: 26 },
  { left: "24%", tone: "var(--ochre)", sway: "-18px", delay: 180, size: 32 },
  { left: "44%", tone: "var(--terracotta)", sway: "12px", delay: 60, size: 28 },
  { left: "64%", tone: "var(--slate)", sway: "-14px", delay: 260, size: 34 },
  { left: "82%", tone: "var(--green-deep)", sway: "16px", delay: 120, size: 24 },
] as const;

const CONFETTI = [
  { left: "14%", tone: "var(--ochre)", dx: "-26px", spin: "220deg", delay: 40 },
  { left: "30%", tone: "var(--green)", dx: "18px", spin: "-180deg", delay: 160 },
  { left: "50%", tone: "var(--terracotta)", dx: "-12px", spin: "300deg", delay: 0 },
  { left: "68%", tone: "var(--slate)", dx: "22px", spin: "-260deg", delay: 220 },
  { left: "86%", tone: "var(--ochre)", dx: "-20px", spin: "160deg", delay: 100 },
] as const;

/**
 * The layer over a passing result. Decorative and inert: `aria-hidden` and
 * `pointer-events: none`, so it can never swallow the Retake tap underneath.
 */
function Celebration() {
  return (
    <span
      className="quiz-celebration"
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        pointerEvents: "none",
      }}
    >
      {CONFETTI.map((piece, i) => (
        <span
          key={`c${i}`}
          className="quiz-confetti"
          style={{
            position: "absolute",
            top: 0,
            left: piece.left,
            width: 7,
            height: 11,
            borderRadius: 2,
            background: piece.tone,
            ["--dx" as string]: piece.dx,
            ["--spin" as string]: piece.spin,
            animationDelay: `${piece.delay}ms`,
          }}
        />
      ))}
      {BALLOONS.map((balloon, i) => (
        <span
          key={`b${i}`}
          className="quiz-balloon"
          style={{
            position: "absolute",
            bottom: 0,
            left: balloon.left,
            width: balloon.size,
            height: Math.round(balloon.size * 1.22),
            ["--sway" as string]: balloon.sway,
            animationDelay: `${balloon.delay}ms`,
          }}
        >
          <span
            style={{
              display: "block",
              width: "100%",
              height: "100%",
              borderRadius: "50% 50% 46% 46%",
              background: balloon.tone,
              opacity: 0.85,
            }}
          />
          {/* The string. Without it they read as floating eggs. */}
          <span
            style={{
              display: "block",
              width: 1,
              height: balloon.size * 0.8,
              margin: "0 auto",
              background: "color-mix(in srgb, var(--ink) 28%, transparent)",
            }}
          />
        </span>
      ))}
    </span>
  );
}

/** Not this time. Drawn in this app's line style, not an emoji glyph. */
function SadFaceIcon() {
  return (
    <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="var(--terracotta)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M8.6 15.4a4.4 4.4 0 0 1 6.8 0" />
      <path d="M9 9.6h.01M15 9.6h.01" />
    </svg>
  );
}

/** Fixed offsets, so the burst looks thrown rather than randomly scattered. */
const SPARKS = [
  { dx: -34, dy: -26, size: 7, tone: "var(--ok)" },
  { dx: -12, dy: -38, size: 5, tone: "var(--ochre)" },
  { dx: 14, dy: -35, size: 6, tone: "var(--ok)" },
  { dx: 34, dy: -20, size: 5, tone: "var(--green)" },
  { dx: 40, dy: 6, size: 6, tone: "var(--ochre)" },
  { dx: 26, dy: 28, size: 5, tone: "var(--ok)" },
  { dx: -2, dy: 38, size: 6, tone: "var(--green)" },
  { dx: -28, dy: 26, size: 5, tone: "var(--ochre)" },
  { dx: -42, dy: 2, size: 6, tone: "var(--ok)" },
] as const;

/** The burst thrown by a right answer. Purely decorative, hidden from AT. */
function SparkBurst({ nonce }: { nonce: number }) {
  return (
    <span
      key={nonce}
      className="quiz-burst"
      aria-hidden
      style={{
        position: "absolute",
        right: 22,
        top: "50%",
        width: 0,
        height: 0,
        pointerEvents: "none",
      }}
    >
      {SPARKS.map((spark, i) => (
        <span
          key={i}
          className="quiz-spark"
          style={{
            position: "absolute",
            width: spark.size,
            height: spark.size,
            borderRadius: 999,
            background: spark.tone,
            // Read by the quiz-spark keyframes.
            ["--dx" as string]: `${spark.dx}px`,
            ["--dy" as string]: `${spark.dy}px`,
            animationDelay: `${i * 14}ms`,
          }}
        />
      ))}
    </span>
  );
}

/**
 * Counts from 0 to `target` once `run` is true.
 *
 * The result number used to simply be there. Counting it up is what makes a
 * score feel earned — and it is also the only animation on that screen that
 * carries information rather than decoration, which is why it survives
 * reduced motion as an instant jump instead of being switched off.
 */
function useCountUp(target: number, run: boolean, ms = 620): number {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!run) return;
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced || target <= 0 || ms <= 0) {
      // Reduced motion (or nothing to count): land on the number immediately.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setValue(target);
      return;
    }
    let raf = 0;
    const started = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - started) / ms);
      // Ease out, so it slows into the final number rather than snapping.
      setValue(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, run, ms]);

  return value;
}

/**
 * "Option A" -> 0.
 *
 * The karigar answers out loud, so nothing about the shape of the answer is
 * predictable: a letter, a number, the option read back in full, with or without
 * the word "option". QA answered with "Option A" and the run stopped there —
 * matching the letter is the floor, and matching the text is what makes it work
 * when they simply repeat the option.
 */
function optionIndexFrom(raw: unknown, options: readonly string[]): number | null {
  const spoken = String(raw ?? "").trim().toLowerCase();
  if (!spoken) return null;
  const cleaned = spoken
    .replace(/^(the\s+)?(option|choice|answer)\s*/u, "")
    .replace(/[).:,-]+$/u, "")
    .trim();

  const letter = (OPTION_LETTERS as readonly string[]).indexOf(cleaned);
  if (letter >= 0 && letter < options.length) return letter;

  // 1-based on purpose: the karigar counts from one, and so does the tool
  // description. A bare "0" is a model leaking its own indexing, not an answer.
  const asNumber = Number(cleaned);
  if (Number.isInteger(asNumber) && asNumber >= 1 && asNumber <= options.length) {
    return asNumber - 1;
  }

  const exact = options.findIndex((opt) => opt.trim().toLowerCase() === cleaned);
  if (exact >= 0) return exact;

  const contained = options.findIndex((opt) => {
    const text = opt.trim().toLowerCase();
    return text.length > 2 && (text.includes(cleaned) || cleaned.includes(text));
  });
  return contained >= 0 ? contained : null;
}

/** What a voice tool call gets back — JSON-serialisable, handed straight to the model. */
export type QuizVoiceResult = { ok: boolean } & Record<string, unknown>;

/**
 * The quiz, driven by voice.
 *
 * There was no way to answer a quiz by speaking: `create_quiz` opened one and
 * nothing else was bound, so the karigar's "Option A" reached a model with no
 * tool for it. This is the surface the `answer_quiz` / `next_quiz_question`
 * handlers in TaskDetailClient call.
 *
 * Synchronous by design — the tool result has to state what actually happened,
 * so both methods act on refs and report back in the same tick rather than
 * waiting for a render.
 */
export type QuizVoiceApi = {
  answer: (spokenOption: unknown) => QuizVoiceResult;
  next: () => QuizVoiceResult;
};

interface Props {
  task: TaskShape;
  workspaceSlug: string;
  lang: Lang;
  /**
   * Grounds the generated MCQs in this acharya's persona + Learn course rather
   * than the timer UX (main-only fix #ccd776a / #5d06cee -- the server route
   * reads it, so dropping it here silently un-grounds the quiz).
   */
  acharyaSlug?: string | null;
  startSignal?: number;
  /**
   * Publishes the imperative handle above (and `null` on unmount) so the screen
   * that owns the voice tools can reach the quiz on screen.
   */
  onVoiceApi?: (api: QuizVoiceApi | null) => void;
  /**
   * Context note for the live acharya. The model cannot see the screen: without
   * the question and its options it has nothing to run the quiz with, and no way
   * to tell an answer from a question.
   */
  onVoiceNote?: (note: string) => void;
}

export function TaskQuizTab({
  task, workspaceSlug, lang, acharyaSlug, startSignal = 0, onVoiceApi, onVoiceNote,
}: Props) {
  const s = t(lang);
  const taskTitle = displayTaskTitle(task.title, lang);
  const [quizState, setQuizState] = useState<QuizState>("ready");
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [score, setScore] = useState(0);
  /**
   * Keyed by question index, not appended in order.
   *
   * Previous means a question can be visited twice, and an append-only list
   * cannot tell a revisit from a second answer — it would have grown a
   * duplicate entry every time the karigar stepped back and forward again.
   * The submitted payload is still the same ordered array; it is derived at
   * submit time, and every index is filled because Next only exists once a
   * question has been answered.
   */
  const [answersByIdx, setAnswersByIdx] = useState<Record<number, { selected: number; correct: boolean }>>({});
  const [error, setError] = useState<string | null>(null);
  /**
   * The last answer's outcome, with a nonce so answering again re-runs the
   * animations — a CSS animation on an element that never unmounts will not
   * replay on its own, and `key={nonce}` is what forces it to.
   */
  const [feedback, setFeedback] = useState<{ nonce: number; correct: boolean } | null>(null);
  const submittedRef = useRef(false);
  const lastStartSignalRef = useRef(0);
  /**
   * Monotonic, not a clock. The nonce only has to DIFFER from the last one so
   * React remounts the answered option and its animation replays; `Date.now()`
   * would do that too, but it is an impure read on a path the lint rules treat
   * as render-adjacent, and nothing here wants a timestamp.
   */
  const feedbackNonceRef = useRef(0);

  // Declared here, not in the result branch: that branch sits behind three
  // early returns, and a hook called from inside one only runs on some renders.
  const shownScore = useCountUp(score, quizState === "result");

  // The FSM, mirrored. Voice has to read the current question and report the
  // outcome of an answer inside one tool call; state set in this render is not
  // readable until the next one, so the refs are what `applySelect` / `applyNext`
  // work from and the useState copies are purely for painting.
  const quizStateRef = useRef<QuizState>("ready");
  const questionsRef = useRef<QuizQuestion[]>([]);
  const currentIdxRef = useRef(0);
  const showAnswerRef = useRef(false);
  const scoreRef = useRef(0);
  const answersByIdxRef = useRef<Record<number, { selected: number; correct: boolean }>>({});

  const startQuiz = useCallback(async () => {
    if (!taskTitle?.trim()) return;
    quizStateRef.current = "loading";
    setQuizState("loading");
    setError(null);
    answersByIdxRef.current = {};
    setAnswersByIdx({});
    submittedRef.current = false;

    try {
      const res = await fetch("/api/work/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspace: workspaceSlug,
          taskId: task.id,
          lang,
          acharyaSlug: (acharyaSlug || task.acharyaSlug || "").trim() || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(
          (data as { error?: string } | null)?.error ?? `Quiz API error: ${res.status}`
        );
      }

      const data = await res.json() as { questions?: unknown[] };
      const qs = data.questions;

      if (
        Array.isArray(qs) &&
        qs.length >= 1 &&
        qs.every(
          (q) =>
            q !== null &&
            typeof q === "object" &&
            "q" in q && typeof (q as QuizQuestion).q === "string" &&
            "options" in q && Array.isArray((q as QuizQuestion).options) && (q as QuizQuestion).options.length >= 2 &&
            "correct" in q && typeof (q as QuizQuestion).correct === "number"
        )
      ) {
        questionsRef.current = qs as QuizQuestion[];
        currentIdxRef.current = 0;
        showAnswerRef.current = false;
        scoreRef.current = 0;
        quizStateRef.current = "active";
        setQuestions(qs as QuizQuestion[]);
        setCurrentIdx(0);
        setScore(0);
        setSelected(null);
        setShowAnswer(false);
        setFeedback(null);
        setQuizState("active");
      } else {
        throw new Error("Invalid quiz format returned by server.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Quiz failed. Please try again.");
      quizStateRef.current = "ready";
      setQuizState("ready");
    }
  }, [acharyaSlug, lang, task.acharyaSlug, task.id, taskTitle, workspaceSlug]);

  useEffect(() => {
    if (!startSignal || startSignal <= lastStartSignalRef.current) return;
    lastStartSignalRef.current = startSignal;
    void startQuiz();
  }, [startSignal, startQuiz]);

  /**
   * Record an answer. ONE path for the tap and for the spoken answer — a second
   * implementation of "what happens when an option is chosen" is how the two
   * drift apart.
   */
  function applySelect(optIdx: number): { correct: boolean; index: number } | null {
    const question = questionsRef.current[currentIdxRef.current];
    if (!question || showAnswerRef.current) return null;
    const isCorrect = optIdx === question.correct;
    const index = currentIdxRef.current;
    showAnswerRef.current = true;
    if (isCorrect) scoreRef.current += 1;
    setSelected(optIdx);
    setShowAnswer(true);
    answersByIdxRef.current = {
      ...answersByIdxRef.current,
      [index]: { selected: optIdx, correct: isCorrect },
    };
    setAnswersByIdx(answersByIdxRef.current);
    if (isCorrect) {
      setScore((s) => s + 1);
    }
    // Here rather than in the tap handler on purpose: an answer given by VOICE
    // has to feel the same as one given by thumb, and this is the one place
    // both of them go through.
    feedbackNonceRef.current += 1;
    setFeedback({ nonce: feedbackNonceRef.current, correct: isCorrect });
    buzz(isCorrect);
    return { correct: isCorrect, index };
  }

  function handleSelect(optIdx: number) {
    applySelect(optIdx);
  }

  useEffect(() => {
    if (quizState !== "result" || submittedRef.current || questions.length === 0) return;
    submittedRef.current = true;
    const passed = score >= Math.ceil(questions.length * 0.7);
    // Back to the ordered array the route has always been sent. Every index is
    // filled — the result is only reachable through Next, which only exists
    // once the question on screen has been answered.
    const answers = questions.map((_, i) => answersByIdx[i]).filter(Boolean);
    void fetch("/api/work/quiz/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        taskId: task.id,
        lang,
        questions,
        answers,
        score,
        total: questions.length,
        passed,
      }),
    }).catch(() => null);
  }, [quizState, questions, answersByIdx, score, task.id, lang]);

  /**
   * Move to a question and show whatever state it is already in. One function
   * for both directions: stepping BACK onto an answered question and stepping
   * forward onto one the karigar had already answered before going back are
   * the same job, and writing it twice is how the two drift.
   *
   * `setFeedback(null)` because merely walking to a question is not an answer
   * — the pop, the shake and the burst belong to the moment one lands.
   */
  function goToQuestion(index: number) {
    const prior = answersByIdxRef.current[index] ?? null;
    currentIdxRef.current = index;
    showAnswerRef.current = Boolean(prior);
    setCurrentIdx(index);
    setSelected(prior ? prior.selected : null);
    setShowAnswer(Boolean(prior));
    setFeedback(null);
  }

  function applyNext(): { finished: boolean; index: number } {
    const total = questionsRef.current.length;
    const index = currentIdxRef.current;
    if (index < total - 1) {
      goToQuestion(index + 1);
      return { finished: false, index: index + 1 };
    }
    quizStateRef.current = "result";
    setQuizState("result");
    return { finished: true, index };
  }

  function handleNext() {
    applyNext();
  }

  /**
   * Back one question, read-only.
   *
   * The earlier answer is shown as it was given and cannot be changed —
   * `applySelect` already refuses once a question is answered. Allowing a
   * re-answer would mean unwinding a score that has already been counted and
   * an `answersByIdx` entry that has already been recorded, for a feature
   * whose point is "what did I say to that one?".
   */
  function handlePrev() {
    const index = currentIdxRef.current;
    if (index <= 0) return;
    goToQuestion(index - 1);
  }

  // -- Voice ---------------------------------------------------------------

  /** The question on screen, spelled out for a model that cannot see it. */
  const describeQuestion = useCallback((index: number): Record<string, unknown> | null => {
    const question = questionsRef.current[index];
    if (!question) return null;
    return {
      question_number: index + 1,
      total: questionsRef.current.length,
      question: question.q,
      options: question.options.map(
        (opt, i) => `${OPTION_LETTERS[i]?.toUpperCase() ?? i + 1}) ${opt}`,
      ),
    };
  }, []);

  // Registered once; `applySelect` / `applyNext` / `goToQuestion` only ever
  // touch refs and stable setState functions, so the closure captured here
  // cannot go stale. Listing them as deps would re-register the handle on
  // every render — `onVoiceApi(null)` then `onVoiceApi(api)` — which is the
  // churn this effect exists to avoid.
  useEffect(() => {
    if (!onVoiceApi) return;
    const api: QuizVoiceApi = {
      answer: (spokenOption) => {
        if (quizStateRef.current === "loading") return { ok: false, error: "quiz_still_loading" };
        if (quizStateRef.current !== "active" || questionsRef.current.length === 0) {
          return { ok: false, error: "quiz_not_started" };
        }
        // Already showing the last answer: the karigar has moved on even if the
        // screen has not, so advance and take this as the next question's answer
        // rather than dropping it the way the tap handler does.
        if (showAnswerRef.current) {
          const advanced = applyNext();
          if (advanced.finished) {
            return {
              ok: true,
              finished: true,
              score: scoreRef.current,
              total: questionsRef.current.length,
              note: "the quiz was already on its last answer - it is finished now",
            };
          }
        }
        const question = questionsRef.current[currentIdxRef.current];
        const optIdx = optionIndexFrom(spokenOption, question.options);
        if (optIdx == null) {
          return {
            ok: false,
            error: "option_not_understood",
            ...(describeQuestion(currentIdxRef.current) ?? {}),
          };
        }
        const outcome = applySelect(optIdx);
        if (!outcome) return { ok: false, error: "already_answered" };
        const isLast = outcome.index >= questionsRef.current.length - 1;
        return {
          ok: true,
          question_number: outcome.index + 1,
          total: questionsRef.current.length,
          chosen: `${OPTION_LETTERS[optIdx]?.toUpperCase() ?? optIdx + 1}) ${question.options[optIdx]}`,
          correct: outcome.correct,
          correct_option: `${OPTION_LETTERS[question.correct]?.toUpperCase() ?? question.correct + 1}) ${question.options[question.correct]}`,
          explanation: question.explanation,
          has_next: !isLast,
        };
      },
      next: () => {
        if (quizStateRef.current !== "active" || questionsRef.current.length === 0) {
          return { ok: false, error: "quiz_not_started" };
        }
        const advanced = applyNext();
        if (advanced.finished) {
          return {
            ok: true,
            finished: true,
            score: scoreRef.current,
            total: questionsRef.current.length,
          };
        }
        return { ok: true, finished: false, ...(describeQuestion(advanced.index) ?? {}) };
      },
    };
    onVoiceApi(api);
    return () => onVoiceApi(null);
    // Registered once on purpose — see the note above this effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onVoiceApi, describeQuestion]);

  // Tell the acharya what is on screen. Without this it can hear "Option A" but
  // has no idea which question that answers, or that a quiz is running at all.
  useEffect(() => {
    if (!onVoiceNote) return;
    if (quizState === "active" && !showAnswer) {
      const described = describeQuestion(currentIdx);
      if (!described) return;
      onVoiceNote(
        `(context: quiz question ${described.question_number} of ${described.total} is on screen - ` +
          `"${described.question}"; options: ${(described.options as string[]).join("; ")}. ` +
          `When the karigar answers, call answer_quiz with the option they said.)`,
      );
      return;
    }
    if (quizState === "result") {
      onVoiceNote(
        `(context: the quiz is finished - ${scoreRef.current} of ${questionsRef.current.length} correct)`,
      );
    }
  }, [quizState, currentIdx, showAnswer, describeQuestion, onVoiceNote]);

  // ── Ready state ────────────────────────────────────────────────────────

  if (quizState === "ready") {
    const canStart = Boolean(taskTitle?.trim());
    return (
      <div
        style={{
          padding: "20px 20px 32px",
          maxWidth: 640,
          margin: "0 auto",
          width: "100%",
        }}
      >
        <section
          style={{
            padding: "18px 16px",
            borderRadius: "var(--r-md)",
            background: "var(--surface)",
            borderWidth: 1,
            borderStyle: "solid",
            borderColor: "var(--rule)",
            boxShadow: "var(--shadow-sm)",
            textAlign: "left",
          }}
        >
          <p
            style={{
              fontFamily: "var(--mono)",
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "var(--green-deep)",
              margin: "0 0 8px",
            }}
          >
            {s.quiz}
          </p>
          <h3
            style={{
              fontFamily: "var(--serif)",
              fontStyle: "italic",
              fontSize: 22,
              fontWeight: 500,
              color: "var(--ink)",
              margin: "0 0 8px",
              lineHeight: 1.25,
            }}
          >
            {s.quizReadyTitle}
          </h3>
          <p style={{ fontSize: 13, color: "var(--ink-mute)", lineHeight: 1.5, margin: "0 0 16px" }}>
            {s.quizReadySubtitle}
          </p>

          <div
            style={{
              padding: "14px",
              background: "var(--surface-sunk)",
              borderRadius: "var(--r-md)",
              borderWidth: 1,
              borderStyle: "solid",
              borderColor: "var(--rule)",
              width: "100%",
              marginBottom: 18,
            }}
          >
            <p
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "var(--ink-mute)",
                margin: "0 0 10px",
              }}
            >
              {s.quizScopeTitle}
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {[s.task, s.lesson, s.session].map((label) => (
                <span
                  key={label}
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: 12.5,
                    fontWeight: 500,
                    padding: "5px 12px",
                    borderRadius: 999,
                    background: "var(--surface-sunk)",
                    color: "var(--ink-soft)",
                  }}
                >
                  {label}
                </span>
              ))}
            </div>
          </div>

          {error && (
            <div
              style={{
                padding: "10px 14px",
                background: "var(--crit-wash)",
                borderRadius: "var(--r-md)",
                borderWidth: 1,
                borderStyle: "solid",
                borderColor: "color-mix(in srgb, var(--crit) 25%, transparent)",
                marginBottom: 14,
              }}
            >
              <p style={{ fontSize: 12, color: "var(--crit)", margin: 0 }}>{error}</p>
            </div>
          )}

          <button
            type="button"
            className="press"
            onClick={() => { void startQuiz(); }}
            disabled={!canStart}
            aria-disabled={!canStart}
            style={{
              minHeight: 48,
              width: "100%",
              padding: "12px 32px",
              borderRadius: "var(--r-md)",
              background: canStart ? "var(--green-deep)" : "var(--surface-sunk)",
              color: canStart ? "#f4efdf" : "var(--ink-mute)",
              fontFamily: "var(--sans)",
              fontSize: 14,
              fontWeight: 700,
              border: "none",
              cursor: canStart ? "pointer" : "not-allowed",
              transition: "background .15s",
            }}
          >
            {s.startQuiz}
          </button>
        </section>
      </div>
    );
  }

  // ── Loading state ──────────────────────────────────────────────────────

  if (quizState === "loading") {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "64px 24px",
          gap: 16,
        }}
      >
        <div
          aria-label="Generating quiz questions"
          style={{
            width: 32,
            height: 32,
            borderRadius: "50%",
            borderWidth: 2,
            borderStyle: "solid",
            borderColor: "var(--green-deep)",
            borderTopColor: "transparent",
            animation: "quiz-spin 0.7s linear infinite",
          }}
        />
        <p style={{ fontSize: 13, color: "var(--ink-mute)", margin: 0 }}>
          Generating questions…
        </p>
        <style>{`@keyframes quiz-spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // ── Result state ──────────────────────────────────────────────────────

  if (quizState === "result") {
    const pct = Math.round((score / questions.length) * 100);
    const passed = pct >= 70;
    return (
      <div
        style={{
          position: "relative",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "48px 24px",
          gap: 20,
          textAlign: "center",
        }}
      >
        {/* Balloons and confetti, for a pass only. A celebration over "keep
            practising" would read as the app enjoying the karigar's failure —
            a miss gets commiseration instead: the face shakes its head once
            and settles. */}
        {passed ? <Celebration /> : null}

        <div
          aria-hidden
          className={passed ? "quiz-medal" : "quiz-console"}
          style={{
            position: "relative",
            width: 80,
            height: 80,
            borderRadius: "50%",
            background: passed ? "var(--ok-wash)" : "var(--terra-wash)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span className={passed ? undefined : "quiz-headshake"} style={{ display: "flex" }}>
            {passed ? <CheckBigIcon /> : <SadFaceIcon />}
          </span>
          {passed ? <SparkBurst nonce={questions.length} /> : null}
        </div>

        <div>
          <p
            style={{
              fontFamily: "var(--mono)",
              fontSize: 10,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "var(--ink-mute)",
              margin: "0 0 6px",
            }}
          >
            Quiz result
          </p>
          <p
            style={{
              fontFamily: "var(--serif)",
              fontSize: 56,
              fontWeight: 500,
              color: passed ? "var(--ok)" : "var(--terracotta)",
              lineHeight: 1,
              margin: "0 0 4px",
            }}
          >
            {shownScore}
            <span style={{ fontSize: 28, color: "var(--ink-mute)" }}>/{questions.length}</span>
          </p>
          <span
            style={{
              display: "inline-block",
              fontFamily: "var(--mono)",
              fontSize: 11,
              fontWeight: 600,
              padding: "3px 10px",
              borderRadius: 999,
              background: passed ? "var(--ok-wash)" : "var(--terra-wash)",
              color: passed ? "var(--ok)" : "var(--terracotta)",
              marginTop: 4,
            }}
          >
            {pct}%{passed ? " — Passed" : " — Keep practising"}
          </span>
          <p
            style={{
              margin: "10px 0 0",
              fontFamily: "var(--serif)",
              fontStyle: "italic",
              fontSize: 17,
              color: passed ? "var(--ok)" : "var(--ink-soft)",
            }}
          >
            {passed ? s.quizWellDone : s.quizTryAgainSoon}
          </p>
        </div>

        <button
          type="button"
          onClick={() => { void startQuiz(); }}
          style={{
            position: "relative",
            minHeight: 48,
            padding: "12px 28px",
            borderRadius: "var(--r-md)",
            background: "var(--green-deep)",
            color: "#f4efdf",
            fontFamily: "var(--sans)",
            fontSize: 14,
            fontWeight: 700,
            border: "none",
            cursor: "pointer",
          }}
        >
          Retake quiz
        </button>
      </div>
    );
  }

  // ── Active quiz ──────────────────────────────────────────────────────

  const q = questions[currentIdx];
  const progress = ((currentIdx + 1) / questions.length) * 100;

  return (
    <div style={{ padding: "16px 16px 32px", maxWidth: 640, margin: "0 auto", width: "100%" }}>
      {/* Progress bar + counter */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <div
          role="progressbar"
          aria-valuenow={currentIdx + 1}
          aria-valuemin={1}
          aria-valuemax={questions.length}
          aria-label={`Question ${currentIdx + 1} of ${questions.length}`}
          style={{
            flex: 1,
            height: 4,
            borderRadius: 999,
            background: "var(--surface-sunk)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${progress}%`,
              background: "var(--green-deep)",
              borderRadius: 999,
              transition: "width 300ms ease",
            }}
          />
        </div>
        <span
          style={{
            fontFamily: "var(--mono)",
            fontSize: 10,
            letterSpacing: "0.1em",
            color: "var(--ink-mute)",
            whiteSpace: "nowrap",
          }}
        >
          {currentIdx + 1} / {questions.length}
        </span>
        <span
          // Re-keyed on the score so the bump replays every time it rises.
          key={`pts-${score}`}
          className={feedback?.correct ? "quiz-score-bump" : undefined}
          style={{
            fontFamily: "var(--mono)",
            fontSize: 10,
            fontWeight: 600,
            color: "var(--green-deep)",
            whiteSpace: "nowrap",
            display: "inline-block",
          }}
        >
          {score} pts
        </span>
      </div>

      {/* Question card */}
      <div
        style={{
          padding: "16px 18px",
          background: "var(--surface)",
          borderWidth: 1,
          borderStyle: "solid",
          borderColor: "var(--rule)",
          borderRadius: "var(--r-md)",
          marginBottom: 12,
          boxShadow: "var(--shadow-sm)",
        }}
      >
        <p
          style={{
            fontFamily: "var(--serif)",
            fontSize: 16,
            lineHeight: 1.55,
            color: "var(--ink)",
            margin: 0,
          }}
        >
          {q.q}
        </p>
      </div>

      {/* Options */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
        {q.options.map((opt, i) => {
          const isCorrect = i === q.correct;
          const isSelected = i === selected;

          let bg = "var(--surface)";
          let borderColor = "var(--rule)";
          let textColor = "var(--ink)";
          let fontWeight: number | undefined;

          if (showAnswer) {
            if (isCorrect) {
              bg = "var(--ok-wash)";
              borderColor = "var(--ok)";
              textColor = "var(--ok)";
              fontWeight = 600;
            } else if (isSelected) {
              bg = "var(--terra-wash)";
              borderColor = "var(--terracotta)";
              textColor = "var(--terracotta)";
            } else {
              bg = "var(--surface-sunk)";
              textColor = "var(--ink-mute)";
            }
          }

          // Three reactions, one per outcome: the option they got right swells
          // and throws a burst, the one they got wrong shakes, and — only when
          // they were wrong — the option that WAS right rings a beat later to
          // answer "then which one?".
          const answeredRight = showAnswer && isSelected && isCorrect;
          const answeredWrong = showAnswer && isSelected && !isCorrect;
          const teaching = showAnswer && isCorrect && !isSelected;
          const animation = answeredRight
            ? "quiz-opt-right"
            : answeredWrong
              ? "quiz-opt-wrong"
              : teaching
                ? "quiz-opt-teach"
                : "";

          return (
            <button
              // The nonce re-mounts the answered option so its animation runs
              // again on the next question — a CSS animation on a surviving
              // element does not replay by itself.
              key={showAnswer && isSelected ? `${i}-${feedback?.nonce ?? 0}` : i}
              type="button"
              onClick={() => handleSelect(i)}
              disabled={showAnswer}
              aria-pressed={isSelected}
              className={animation}
              style={{
                position: "relative",
                display: "flex",
                alignItems: "flex-start",
                gap: 12,
                padding: "12px 16px",
                borderRadius: "var(--r-md)",
                background: bg,
                borderWidth: 1,
                borderStyle: "solid",
                borderColor,
                color: textColor,
                fontFamily: "var(--sans)",
                fontSize: 14,
                fontWeight: fontWeight ?? 400,
                textAlign: "left",
                cursor: showAnswer ? "default" : "pointer",
                transition: "background .12s, border-color .12s, color .12s",
                minHeight: 48,
              }}
            >
              <span
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: 11,
                  fontWeight: 700,
                  flexShrink: 0,
                  marginTop: 1,
                }}
              >
                {String.fromCharCode(65 + i)}
              </span>
              <span style={{ lineHeight: 1.45, flex: 1 }}>{opt}</span>

              {/* The verdict, on the option itself — the karigar is looking at
                  what they just tapped, not at the panel below it. */}
              {showAnswer && (isSelected || isCorrect) ? (
                <span className="quiz-mark" aria-hidden style={markStyle(isCorrect)}>
                  {isCorrect ? <TickIcon /> : <CrossIcon />}
                </span>
              ) : null}

              {answeredRight && feedback ? <SparkBurst nonce={feedback.nonce} /> : null}
            </button>
          );
        })}
      </div>

      {/* Explanation */}
      {showAnswer && (
        <div
          key={`why-${feedback?.nonce ?? 0}`}
          className="quiz-reveal"
          style={{
            padding: "12px 14px",
            background: selected === q.correct ? "var(--ok-wash)" : "var(--terra-wash)",
            borderRadius: "var(--r-md)",
            marginBottom: 16,
            borderWidth: 1,
            borderStyle: "solid",
            borderColor: selected === q.correct
              ? "color-mix(in srgb, var(--ok) 25%, transparent)"
              : "color-mix(in srgb, var(--terracotta) 25%, transparent)",
          }}
        >
          <p
            style={{
              fontFamily: "var(--mono)",
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: selected === q.correct ? "var(--ok)" : "var(--terracotta)",
              margin: "0 0 6px",
            }}
          >
            {selected === q.correct ? "Correct" : "Incorrect"}
          </p>
          <p style={{ fontSize: 13, color: "var(--ink)", lineHeight: 1.5, margin: 0 }}>
            {q.explanation}
          </p>
        </div>
      )}

      {/* Next / Finish button */}
      {/* Previous sits beside Next, as the reference has it. It is offered
          from the second question on and only once the current one has been
          answered — there is nothing to step back to before that, and a
          disabled button on question one is a dead control the karigar has to
          learn to ignore. */}
      {showAnswer && (
        <div
          key={`nav-${feedback?.nonce ?? 0}`}
          className="quiz-reveal"
          style={{ display: "flex", gap: 10, animationDelay: "90ms" }}
        >
          {currentIdx > 0 ? (
            <button
              type="button"
              onClick={handlePrev}
              style={{
                minHeight: 48,
                padding: "12px 18px",
                borderRadius: "var(--r-md)",
                background: "var(--surface)",
                color: "var(--ink)",
                fontFamily: "var(--sans)",
                fontSize: 14,
                fontWeight: 700,
                borderWidth: 1,
                borderStyle: "solid",
                borderColor: "var(--rule-strong)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                flexShrink: 0,
              }}
            >
              <ArrowLeftIcon />
              {s.quizPrevious}
            </button>
          ) : null}
          <button
            type="button"
            onClick={handleNext}
            style={{
              flex: 1,
              minHeight: 48,
              padding: "12px 24px",
              borderRadius: "var(--r-md)",
              background: "var(--green-deep)",
              color: "#f4efdf",
              fontFamily: "var(--sans)",
              fontSize: 14,
              fontWeight: 700,
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            {currentIdx < questions.length - 1 ? "Next question" : "See results"}
            <ArrowRightIcon />
          </button>
        </div>
      )}

      <style>{`@keyframes quiz-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ── Verdict mark ──────────────────────────────────────────────────────────────

/** The disc the tick or cross lands in, at the end of the answered option. */
function markStyle(correct: boolean): React.CSSProperties {
  return {
    flexShrink: 0,
    width: 22,
    height: 22,
    marginTop: 1,
    borderRadius: 999,
    display: "grid",
    placeItems: "center",
    background: correct ? "var(--ok)" : "var(--terracotta)",
    color: "var(--surface)",
  };
}

function TickIcon() {
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m5 12.5 4.5 4.5L19 7" />
    </svg>
  );
}

function CrossIcon() {
  return (
    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden>
      <path d="M7 7l10 10M17 7 7 17" />
    </svg>
  );
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function CheckBigIcon() {
  return (
    <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="var(--ok)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function ArrowLeftIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M19 12H5M12 5l-7 7 7 7" />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  );
}
