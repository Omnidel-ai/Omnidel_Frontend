export type TimerPhase = "active" | "warning" | "expired" | "paused";

export interface TimerRingProps {
  /** Seconds shown in the face — remaining for a countdown, elapsed for a count-up. */
  seconds: number;
  /** Full length of the interval; the arc is `seconds / totalSeconds`. Omit for a count-up. */
  totalSeconds?: number;
  phase: TimerPhase;
  /** Word under the numerals: "remaining", "elapsed", "time up", "on break". */
  caption?: string;
  size?: "default" | "compact";
  ariaLabel?: string;
}

const SIZE = {
  default: { radius: 90, stroke: 7, fontSize: 52 },
  compact: { radius: 68, stroke: 6, fontSize: 40 },
} as const;

/** A count-up arc goes round once an hour — a soft cycle, not a deadline. */
const SOFT_CYCLE = 3600;

const RING: Record<TimerPhase, { ring: string; track: string; ink: string }> = {
  active: { ring: "var(--green-deep)", track: "var(--green-wash)", ink: "var(--ink)" },
  warning: { ring: "var(--ochre)", track: "var(--ochre-wash)", ink: "var(--ochre)" },
  expired: { ring: "var(--crit)", track: "var(--crit-wash)", ink: "var(--crit)" },
  paused: { ring: "var(--ink-faint)", track: "var(--surface-sunk)", ink: "var(--ink-mute)" },
};

/** 754 → "12:34"; 4000 → "1:06:40". */
export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${String(m).padStart(2, "0")}:${sec}`;
}

/**
 * Circular countdown — ported from the Acharya app's `timer-ring.tsx`.
 *
 * The numerals are the product: serif, light, tabular. Colour moves with the
 * phase (green → ochre at a quarter left → crit when time is up) on a slow
 * transition so it reads as a mood rather than an event; `paused` greys the
 * ring out while a break runs. Presentation only — the caller owns the clock.
 */
export function TimerRing({ seconds, totalSeconds, phase, caption, size = "default", ariaLabel }: TimerRingProps) {
  const { radius, stroke, fontSize } = SIZE[size];
  const circumference = 2 * Math.PI * radius;
  const fraction = totalSeconds
    ? Math.max(0, Math.min(1, seconds / totalSeconds))
    : (Math.max(0, seconds) % SOFT_CYCLE) / SOFT_CYCLE;
  const view = (radius + stroke) * 2 + 8;
  const c = view / 2;
  const tone = RING[phase];
  const long = seconds >= 3600;

  return (
    <div
      role="timer"
      aria-label={ariaLabel ?? `${formatClock(seconds)} ${caption ?? ""}`.trim()}
      style={{ position: "relative", width: view, height: view, flexShrink: 0 }}
    >
      <svg
        viewBox={`0 0 ${view} ${view}`}
        width={view}
        height={view}
        aria-hidden="true"
        style={{ transform: "rotate(-90deg)", display: "block" }}
      >
        <circle cx={c} cy={c} r={radius} fill="none" stroke={tone.track} strokeWidth={stroke} style={{ transition: "stroke 0.8s ease" }} />
        <circle
          cx={c}
          cy={c}
          r={radius}
          fill="none"
          stroke={tone.ring}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - fraction)}
          style={{ transition: "stroke-dashoffset 0.9s cubic-bezier(0.45, 0, 0.55, 1), stroke 0.8s ease" }}
        />
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 4,
          pointerEvents: "none",
        }}
      >
        <span
          className={phase === "expired" ? "timer-expired-pulse" : undefined}
          style={{
            fontFamily: "var(--serif)",
            fontSize: long ? Math.round(fontSize * 0.7) : fontSize,
            fontWeight: 300,
            letterSpacing: "-0.04em",
            lineHeight: 1,
            color: tone.ink,
            fontVariantNumeric: "tabular-nums",
            transition: "color 0.8s ease",
          }}
        >
          {formatClock(seconds)}
        </span>
        {caption && (
          <span
            style={{
              fontFamily: "var(--mono)",
              fontSize: size === "compact" ? 9 : 10,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: phase === "expired" ? "var(--crit)" : "var(--ink-faint)",
            }}
          >
            {caption}
          </span>
        )}
      </div>
    </div>
  );
}
