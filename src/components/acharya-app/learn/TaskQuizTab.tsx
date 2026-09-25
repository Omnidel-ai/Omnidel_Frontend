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
  const [answers, setAnswers] = useState<Array<{ selected: number; correct: boolean }>>([]);
  const [error, setError] = useState<string | null>(null);
  const submittedRef = useRef(false);
  const lastStartSignalRef = useRef(0);

  // The FSM, mirrored. Voice has to read the current question and report the
  // outcome of an answer inside one tool call; state set in this render is not
  // readable until the next one, so the refs are what `applySelect` / `applyNext`
  // work from and the useState copies are purely for painting.
  const quizStateRef = useRef<QuizState>("ready");
  const questionsRef = useRef<QuizQuestion[]>([]);
  const currentIdxRef = useRef(0);
  const showAnswerRef = useRef(false);
  const scoreRef = useRef(0);

  const startQuiz = useCallback(async () => {
    if (!taskTitle?.trim()) return;
    quizStateRef.current = "loading";
    setQuizState("loading");
    setError(null);
    setAnswers([]);
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
    setAnswers((prev) => [...prev, { selected: optIdx, correct: isCorrect }]);
    if (isCorrect) {
      setScore((s) => s + 1);
    }
    return { correct: isCorrect, index };
  }

  function handleSelect(optIdx: number) {
    applySelect(optIdx);
  }

  useEffect(() => {
    if (quizState !== "result" || submittedRef.current || questions.length === 0) return;
    submittedRef.current = true;
    const passed = score >= Math.ceil(questions.length * 0.7);
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
  }, [quizState, questions, answers, score, task.id, lang]);

  function applyNext(): { finished: boolean; index: number } {
    const total = questionsRef.current.length;
    const index = currentIdxRef.current;
    if (index < total - 1) {
      currentIdxRef.current = index + 1;
      showAnswerRef.current = false;
      setCurrentIdx(index + 1);
      setSelected(null);
      setShowAnswer(false);
      return { finished: false, index: index + 1 };
    }
    quizStateRef.current = "result";
    setQuizState("result");
    return { finished: true, index };
  }

  function handleNext() {
    applyNext();
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

  // Registered once; `applySelect` / `applyNext` only ever touch refs and
  // stable setState functions, so the closure captured here cannot go stale.
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
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "48px 24px",
          gap: 20,
          textAlign: "center",
        }}
      >
        <div
          aria-hidden
          style={{
            width: 80,
            height: 80,
            borderRadius: "50%",
            background: passed ? "var(--ok-wash)" : "var(--terra-wash)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {passed ? <CheckBigIcon /> : <RetryIcon />}
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
            {score}
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
        </div>

        <button
          type="button"
          onClick={() => { void startQuiz(); }}
          style={{
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
          style={{
            fontFamily: "var(--mono)",
            fontSize: 10,
            fontWeight: 600,
            color: "var(--green-deep)",
            whiteSpace: "nowrap",
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

          return (
            <button
              key={i}
              type="button"
              onClick={() => handleSelect(i)}
              disabled={showAnswer}
              aria-pressed={isSelected}
              style={{
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
              <span style={{ lineHeight: 1.45 }}>{opt}</span>
            </button>
          );
        })}
      </div>

      {/* Explanation */}
      {showAnswer && (
        <div
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
      {showAnswer && (
        <button
          type="button"
          onClick={handleNext}
          style={{
            width: "100%",
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
      )}

      <style>{`@keyframes quiz-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
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

function RetryIcon() {
  return (
    <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="var(--terracotta)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="1 4 1 10 7 10" />
      <path d="M3.51 15a9 9 0 1 0 .49-3.1" />
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
