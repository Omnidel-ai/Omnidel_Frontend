import { useEffect, useState } from "react";
import { Badge } from "../components/common";

export interface ScoreDecisionValue {
  /** Whether the acharya's score stands, or the reviewer's replaces it. */
  mode: "accept" | "revise";
  /** The reviewer's score, out of ten. Only meaningful when revising. */
  score: number;
  feedback: string;
}

export interface ScoreDecisionProps {
  /** What the acharya gave it, 0–1 as the application stores it. Null when it did not score. */
  acharyaScore: number | null;
  /**
   * A task the acharya never scored.
   *
   * There is no score to accept, so the choice collapses to one option and the
   * reviewer enters their own. The application calls these simple tasks.
   */
  isSimpleTask: boolean;
  value: ScoreDecisionValue;
  onChange: (next: ScoreDecisionValue) => void;
  feedbackMax?: number;
  disabled?: boolean;
}

/** 0.92 → "9.2/10". The application's own presentation of a score. */
export function formatScoreOutOfTen(score: number | null | undefined): string {
  if (typeof score !== "number" || Number.isNaN(score)) return "—";
  return `${(score * 10).toFixed(1)}/10`;
}

/** A score carries its band in text as well as colour. */
export function scoreTone(score: number | null | undefined): "ok" | "amber" | "crit" | "neutral" {
  if (typeof score !== "number") return "neutral";
  if (score >= 0.7) return "ok";
  if (score >= 0.4) return "amber";
  return "crit";
}

/**
 * The decision: take the acharya's score, or give your own.
 *
 * The whole screen exists for this one choice, so it is one row — the score
 * the acharya gave, and two buttons — rather than a form to fill in. Choosing
 * "Enter my score" reveals the input beside it; nothing else moves.
 *
 * What the arrangement is saying: **the acharya's score is the default, and
 * overriding it is a deliberate act.** The reviewer reads the evidence, agrees
 * or does not, and the shorter path is agreement. Feedback is optional either
 * way, because a reviewer who agrees usually has nothing to add and should not
 * have to type something to get past the form.
 *
 * A task the acharya never scored has nothing to accept, so the choice
 * collapses and the input is there from the start.
 */
export function ScoreDecision({
  acharyaScore,
  isSimpleTask,
  value,
  onChange,
  feedbackMax = 200,
  disabled = false,
}: ScoreDecisionProps) {
  const revising = isSimpleTask || value.mode === "revise";
  const [scoreText, setScoreText] = useState(() => String(value.score));

  // The caller may reset the decision when a different submission opens.
  useEffect(() => {
    setScoreText(String(value.score));
    // Keyed on the score the caller holds, which is what a reset changes.
  }, [value.score]);

  const parsed = Number(scoreText);
  const outOfRange = scoreText !== "" && (!Number.isFinite(parsed) || parsed < 0 || parsed > 10);

  function setScore(text: string) {
    setScoreText(text);
    const n = Number(text);
    if (Number.isFinite(n)) onChange({ ...value, mode: "revise", score: n });
  }

  return (
    <div className="decision">
      <div className="decision__row" role="group" aria-label="Score choice">
        {isSimpleTask ? (
          <span className="decision__note">
            The acharya did not score this one — enter yours.
          </span>
        ) : (
          <>
            <span className="decision__acharya">
              <span className="decision__label">Acharya score</span>
              <Badge tone={scoreTone(acharyaScore)}>{formatScoreOutOfTen(acharyaScore)}</Badge>
            </span>
            <button
              type="button"
              className={value.mode === "accept" ? "decision__toggle decision__toggle--on" : "decision__toggle"}
              aria-pressed={value.mode === "accept"}
              disabled={disabled}
              onClick={() => onChange({ ...value, mode: "accept" })}
            >
              Use Acharya
            </button>
          </>
        )}

        <button
          type="button"
          className={revising ? "decision__toggle decision__toggle--on" : "decision__toggle"}
          aria-pressed={revising}
          disabled={disabled || isSimpleTask}
          onClick={() => onChange({ ...value, mode: "revise" })}
        >
          Enter my score
        </button>

        {revising && (
          <span className="decision__input">
            <input
              type="number"
              className="form-input"
              min={0}
              max={10}
              step={0.1}
              value={scoreText}
              disabled={disabled}
              aria-label="Your score, out of ten"
              aria-invalid={outOfRange || undefined}
              onChange={(e) => setScore(e.target.value)}
            />
            <span className="decision__outof">/ 10</span>
          </span>
        )}
      </div>

      {outOfRange && (
        <p className="decision__error" role="alert">
          A score is between 0 and 10.
        </p>
      )}

      <div className="decision__feedback">
        <label className="form-label" htmlFor="decision-feedback">
          Feedback <span className="decision__optional">optional</span>
        </label>
        <textarea
          id="decision-feedback"
          className="form-input"
          rows={2}
          maxLength={feedbackMax}
          disabled={disabled}
          placeholder="A note for the karigar — what was good, what to do differently."
          value={value.feedback}
          onChange={(e) => onChange({ ...value, feedback: e.target.value.slice(0, feedbackMax) })}
        />
        <span className="decision__count">
          {value.feedback.length}/{feedbackMax}
        </span>
      </div>
    </div>
  );
}

/**
 * Whether a decision can be submitted, and why not.
 *
 * Kept beside the control rather than in the screen, so a second screen that
 * uses this control cannot disagree about what a valid decision is.
 */
export function decisionProblem(value: ScoreDecisionValue, isSimpleTask: boolean): string | null {
  if (value.mode === "accept" && !isSimpleTask) return null;
  if (!Number.isFinite(value.score) || value.score < 0 || value.score > 10) {
    return "A score is between 0 and 10.";
  }
  return null;
}
