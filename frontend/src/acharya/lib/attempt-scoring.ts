import { MAX_ATTEMPTS } from "./attempt-limits";

/**
 * Attempt-based scoring policy.
 *
 * A karigar who finishes on the first go keeps the full score; each retry costs
 * 20 points of the multiplier. Mirrored in SQL by
 * omnidel.get_attempt_score_multiplier() (migration 20260915000013) so the
 * evaluator can apply the same policy server-side — change one and you must
 * change both.
 *
 * Isomorphic: no "use client", no server-only. Routes, the evaluator bridge and
 * the badge all read the policy from here.
 */

/** 1st attempt 1.00 · 2nd 0.80 · 3rd and beyond 0.60. */
export function getAttemptScoreMultiplier(attemptNumber: number): number {
  if (!Number.isFinite(attemptNumber) || attemptNumber <= 1) return 1.0;
  if (attemptNumber === 2) return 0.8;
  return 0.6;
}

/**
 * Applying the multiplier lives in ONE place: `scoreAndRecordCompletion`
 * (`lib/server/task-scoring.ts`), which does
 * `Math.round(raw * multiplier * 100) / 100`.
 *
 * There used to be a `calculateAttemptScore()` helper here that did
 * `Math.round(baseScore * multiplier)` — no `* 100 / 100`. Scores in this
 * codebase are 0–1 fractions (`EvaluationRecord.score`, `final_score`), so a
 * second attempt scoring 0.85 would have come out as `Math.round(0.68)` = **1**,
 * i.e. a penalised retry scoring HIGHER than the raw result. It had no callers,
 * so it never ran — but it sat next to the correct implementation looking like
 * the obvious thing to reach for. Removed rather than fixed: two functions that
 * apply the same policy are how the two drift apart.
 *
 * If a client ever needs the penalised number, read it off the `/complete`
 * response (`score` + `rawScore` + `attemptMultiplier`) rather than recomputing.
 */

/** Retries still available after the current attempt. */
export function getRemainingRetries(
  attemptNumber: number,
  maxAttempts: number = MAX_ATTEMPTS,
): number {
  return Math.max(0, maxAttempts - attemptNumber);
}

/** True when this attempt is the karigar's last chance at the task. */
export function isFinalAttempt(
  attemptNumber: number,
  maxAttempts: number = MAX_ATTEMPTS,
): boolean {
  return attemptNumber >= maxAttempts;
}

/**
 * The attempt number a restart should be recorded as.
 *
 * Kept here rather than inline at the call site because "what counts as the
 * next attempt" is policy, and the start route, any admin re-open and the
 * board's retry affordance all have to agree on it.
 */
export function nextAttemptNumber(previousAttemptNumber: number | null | undefined): number {
  const prev = Number(previousAttemptNumber);
  if (!Number.isFinite(prev) || prev < 1) return 1;
  return prev + 1;
}
