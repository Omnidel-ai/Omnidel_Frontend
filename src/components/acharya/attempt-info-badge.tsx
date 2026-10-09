"use client";

import { useStrings } from "@/lib/i18n/useLang";
import { MAX_ATTEMPTS } from "@/lib/attempt-limits";
import { getAttemptScoreMultiplier } from "@/lib/attempt-scoring";

/**
 * AttemptInfoBadge
 *
 * "Attempt 2 of 3 · 80% score" — the karigar's standing on this task.
 *
 * Shown only from the SECOND attempt on. On a first attempt there is no
 * penalty and no retry history, so the badge would be noise on a screen whose
 * whole design intent is that the timer is the screen.
 */
export function AttemptInfoBadge({
  attemptNumber,
  maxAttempts = MAX_ATTEMPTS,
}: {
  attemptNumber: number;
  maxAttempts?: number;
}) {
  const s = useStrings();

  if (!attemptNumber || attemptNumber < 2) return null;

  const multiplier = getAttemptScoreMultiplier(attemptNumber);
  const scorePct = Math.round(multiplier * 100);
  const isLast = attemptNumber >= maxAttempts;

  // Ochre while a retry remains, crit on the last one — the same warning
  // vocabulary the timer ring uses, so the two read as one system. The paired
  // -wash token carries the fill; color-mix() would need Chrome 111+ and this
  // app has to render on low-end Android.
  const tone = isLast ? "var(--crit)" : "var(--ochre)";
  const wash = isLast ? "var(--crit-wash)" : "var(--ochre-wash)";

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "4px 10px",
        borderRadius: 9999,
        border: `1px solid ${tone}`,
        background: wash,
        fontFamily: "var(--font-mono)",
        fontSize: 10,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        color: tone,
        whiteSpace: "nowrap",
      }}
    >
      <span>
        {s.attemptWord} {attemptNumber} {s.attemptOfWord} {maxAttempts}
      </span>
      <span aria-hidden style={{ opacity: 0.45 }}>·</span>
      <span>
        {scorePct}% {s.attemptScorePenalty}
      </span>
    </div>
  );
}
