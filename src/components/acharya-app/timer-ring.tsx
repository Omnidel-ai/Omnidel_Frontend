"use client";

/**
 * TimerRing — animated circular countdown (or elapsed count-up) for work intervals.
 *
 * Design intent (Emil Kowalski principles applied):
 *   - The numerals ARE the product. They sit at 52px Fraunces, tabular, negative
 *     tracking so they read as a single unit, not two numbers and a colon.
 *   - The ring is generous (RADIUS 90) so the face breathes. Stroke is slightly
 *     thicker (7px) — thin rings read as decorative; this one is functional.
 *   - Phase transitions (active → warning → expired) are slow (800ms) — color
 *     shifts should feel like a mood, not an event.
 *   - The progress arc uses ease-in-out so the tick feels deliberate; linear feels
 *     mechanical on a motivational timer.
 *   - Expired state: the pulse animates opacity only (no scale) — scale + opacity
 *     together create too much visual anxiety. One axis is enough.
 *   - Reduced motion: all keyframes collapse to opacity-only, no translate/scale.
 *   - `compact` shrinks the ring for the Acharya shell active session so the
 *     screen fits without a scrollbar.
 *   - `mode: "elapsed"` counts up from 00:00 (Simple tasks); arc uses a soft
 *     hourly cycle, not remaining/total.
 */

type Phase = "active" | "warning" | "expired";
type RingSize = "default" | "compact";
type RingMode = "countdown" | "elapsed";

interface Props {
  totalSeconds?: number;
  remainingSeconds?: number;
  /** Elapsed seconds when mode is "elapsed". */
  elapsedSeconds?: number;
  mode?: RingMode;
  phase: Phase;
  /** Accessible label for the ring (e.g. "32 minutes remaining"). */
  ariaLabel?: string;
  size?: RingSize;
}

const SIZE: Record<RingSize, { radius: number; stroke: number; fontSize: number; labelMt: number }> = {
  default: { radius: 90, stroke: 7, fontSize: 52, labelMt: 6 },
  compact: { radius: 68, stroke: 6, fontSize: 40, labelMt: 4 },
};

/** Soft visual cycle for count-up (not a hard deadline). */
const ELAPSED_SOFT_CYCLE_SECONDS = 3600;

function ringColor(phase: Phase): string {
  if (phase === "expired") return "var(--crit)";
  if (phase === "warning") return "var(--ochre)";
  return "var(--green-deep)";
}

function trackColor(phase: Phase): string {
  if (phase === "expired") return "var(--crit-wash)";
  if (phase === "warning") return "var(--ochre-wash)";
  return "var(--green-wash)";
}

function formatTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  }
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

function numericColor(phase: Phase): string {
  if (phase === "expired") return "var(--crit)";
  if (phase === "warning") return "var(--ochre)";
  return "var(--ink)";
}

export function TimerRing({
  totalSeconds = 2700,
  remainingSeconds = 0,
  elapsedSeconds = 0,
  mode = "countdown",
  phase,
  ariaLabel,
  size = "default",
}: Props) {
  const { radius, stroke, fontSize, labelMt } = SIZE[size];
  const circumference = 2 * Math.PI * radius;
  const isElapsed = mode === "elapsed";
  const displaySeconds = isElapsed ? elapsedSeconds : remainingSeconds;
  const fraction = isElapsed
    ? (ELAPSED_SOFT_CYCLE_SECONDS > 0
        ? (Math.max(0, elapsedSeconds) % ELAPSED_SOFT_CYCLE_SECONDS) / ELAPSED_SOFT_CYCLE_SECONDS
        : 0)
    : totalSeconds > 0
      ? Math.max(0, Math.min(1, remainingSeconds / totalSeconds))
      : 0;

  const dashOffset = circumference * (1 - fraction);
  const viewSize = (radius + stroke) * 2 + 8;
  const center = viewSize / 2;

  const label = ariaLabel
    ?? (isElapsed
      ? `${Math.floor(displaySeconds / 60)} minutes ${displaySeconds % 60} seconds elapsed`
      : `${Math.floor(remainingSeconds / 60)} minutes ${remainingSeconds % 60} seconds remaining`);

  return (
    <div
      role="timer"
      aria-label={label}
      aria-live="polite"
      aria-atomic="true"
      style={{ display: "flex", flexDirection: "column", alignItems: "center" }}
    >
      <div style={{ position: "relative", width: viewSize, height: viewSize }}>
        <svg
          viewBox={`0 0 ${viewSize} ${viewSize}`}
          width={viewSize}
          height={viewSize}
          aria-hidden="true"
          style={{ transform: "rotate(-90deg)", display: "block" }}
        >
          {/* Track ring */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={trackColor(phase)}
            strokeWidth={stroke}
            style={{ transition: "stroke 0.8s var(--ease-out, ease)" }}
          />
          {/* Progress ring */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={ringColor(phase)}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            style={{
              transition: "stroke-dashoffset 0.9s cubic-bezier(0.45, 0, 0.55, 1), stroke 0.8s var(--ease-out, ease)",
            }}
          />
        </svg>

        {/* Numerals — the visual anchor of the whole screen */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 2,
            pointerEvents: "none",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-serif, Georgia, serif)",
              fontSize: isElapsed && displaySeconds >= 3600
                ? (size === "compact" ? 28 : 36)
                : fontSize,
              fontWeight: 300,
              letterSpacing: "-0.04em",
              lineHeight: 1,
              color: numericColor(phase),
              fontVariantNumeric: "tabular-nums",
              transition: "color 0.8s var(--ease-out, ease)",
              animation: phase === "expired" ? "timerExpiredPulse 1.4s ease-in-out infinite" : "none",
              display: "block",
            }}
          >
            {formatTime(displaySeconds)}
          </span>
          <span
            style={{
              fontFamily: "var(--font-mono, ui-monospace, monospace)",
              fontSize: size === "compact" ? 9 : 10,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: phase === "expired" ? "var(--crit)" : "var(--ink-faint)",
              transition: "color 0.8s var(--ease-out, ease)",
              marginTop: labelMt,
              display: "block",
            }}
          >
            {isElapsed ? "elapsed" : phase === "expired" ? "time up" : "remaining"}
          </span>
        </div>
      </div>

      {/* Keyframes injected once. Reduced motion respects the media query below. */}
      <style>{`
        @keyframes timerExpiredPulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.45; }
        }
        @media (prefers-reduced-motion: reduce) {
          @keyframes timerExpiredPulse {
            0%, 100% { opacity: 1; }
            50%       { opacity: 0.7; }
          }
        }
      `}</style>
    </div>
  );
}
