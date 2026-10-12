/**
 * Shared limits for the multi-attempt task flow.
 *
 * Isomorphic on purpose (no "use client", no server-only): the routes enforce
 * these and the UI has to display the same numbers. Two copies of "60 minutes"
 * is how the button offers an option the route then rejects.
 */

/** Attempts a karigar gets per task: the first plus two retries. */
export const MAX_ATTEMPTS = 3;

/**
 * Grace after the session deadline before an idle attempt is auto-closed.
 * Pushed forward by activity and by every granted extension.
 */
export const INACTIVITY_GRACE_SECONDS = 30 * 60;

/** Ceiling on total extension per attempt. Also the per-request ceiling. */
export const MAX_EXTENSION_SECONDS = 60 * 60;

/** Options offered in the request-time sheet, in minutes. */
export const EXTENSION_OPTIONS_MINUTES = [5, 10, 15, 20, 30, 45, 60] as const;

/** close_reason written when the inactivity sweep closes an attempt. */
export const INACTIVITY_CLOSE_REASON = "inactivity_timeout";

/** Attempt statuses that still belong to the karigar and may be extended. */
export const EXTENDABLE_STATUSES = ["running", "paused"] as const;

/**
 * The moment an idle attempt becomes due for auto-close.
 *
 * GREATEST(deadline_at, last_activity_at) + grace. The grace only starts once
 * the session deadline has passed, and any interaction after that pushes it
 * forward — so a karigar still working past the deadline is never closed, and
 * one who walked away is closed 30 minutes after their last touch.
 *
 * This is the ONLY implementation of that rule. The expression index in
 * migration 20260915000013 mirrors the ANCHOR — the GREATEST(...) part, without
 * the grace term, because `timestamptz + interval` is STABLE and Postgres will
 * not index it. The sweep applies the grace on the query side instead. If the
 * anchor changes here, that index has to change with it.
 */
export function attemptCloseDueAt(attempt: {
  deadline_at: string;
  last_activity_at?: string | null;
  started_at?: string | null;
}): number {
  const deadline = Date.parse(attempt.deadline_at);
  const activity = attempt.last_activity_at
    ? Date.parse(attempt.last_activity_at)
    : attempt.started_at
      ? Date.parse(attempt.started_at)
      : Number.NaN;

  const anchor = Number.isNaN(activity) ? deadline : Math.max(deadline, activity);
  return anchor + INACTIVITY_GRACE_SECONDS * 1000;
}

/** True when the attempt has been idle past its grace and should be closed. */
export function isAttemptInactivityDue(
  attempt: { deadline_at: string; last_activity_at?: string | null; started_at?: string | null },
  now: number = Date.now(),
): boolean {
  return now >= attemptCloseDueAt(attempt);
}
