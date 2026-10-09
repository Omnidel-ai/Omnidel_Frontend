"use client";

import { useCallback, useState } from "react";
import { useStrings } from "@/lib/i18n/useLang";
import { EXTENSION_OPTIONS_MINUTES, MAX_EXTENSION_SECONDS } from "@/lib/attempt-limits";

const MAX_EXTENSION_MINUTES = MAX_EXTENSION_SECONDS / 60;

/**
 * RequestTimeButton
 *
 * Lets the karigar add time to the running session, capped at 60 minutes per
 * attempt. No approval step — a field worker who needs another twenty minutes
 * should not have to wait on a manager.
 *
 * Deliberately NOT gated on the session having time left: the point is that it
 * still works after the timer reaches zero, during the inactivity grace
 * window, which is when a karigar actually discovers they need more. The
 * button only retires when the 60 minutes are genuinely spent.
 */
export function RequestTimeButton({
  taskId,
  attemptId,
  deadlinePassed,
  onExtended,
  disabled = false,
}: {
  taskId: string;
  attemptId: string;
  /** Session clock has hit zero; copy shifts to the grace-window wording. */
  deadlinePassed?: boolean;
  /** Receives the new deadline ISO string so the timer can re-anchor. */
  onExtended?: (deadlineAt: string) => void;
  disabled?: boolean;
}) {
  const s = useStrings();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usedMinutes, setUsedMinutes] = useState(0);
  const [remainingMinutes, setRemainingMinutes] = useState(MAX_EXTENSION_MINUTES);
  const [picked, setPicked] = useState<number | null>(null);

  // The cap is re-read from the server when the sheet opens rather than kept in
  // component state: the karigar may have extended from another tab, or this
  // mount may be a reload part-way through the session.
  const loadRemaining = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/work/tasks/${taskId}/attempts/${attemptId}/activity`,
        { cache: "no-store" },
      );
      if (!res.ok) return;
      const data = (await res.json()) as {
        extensionUsedMinutes?: number;
        extensionRemainingMinutes?: number;
      };
      if (typeof data.extensionUsedMinutes === "number") {
        setUsedMinutes(data.extensionUsedMinutes);
      }
      if (typeof data.extensionRemainingMinutes === "number") {
        setRemainingMinutes(data.extensionRemainingMinutes);
      }
    } catch {
      // Non-fatal: the route re-checks the cap and rejects an over-ask anyway.
    }
  }, [taskId, attemptId]);

  // Opening the sheet is what triggers the read — an effect keyed on `open`
  // would setState straight out of render and cascade.
  const openSheet = useCallback(() => {
    setOpen(true);
    void loadRemaining();
  }, [loadRemaining]);

  const options = EXTENSION_OPTIONS_MINUTES.filter((m) => m <= remainingMinutes);
  const effective = picked ?? options[0] ?? null;
  const allSpent = remainingMinutes <= 0;

  const submit = useCallback(async (minutes: number) => {
    if (!minutes) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/work/tasks/${taskId}/attempts/${attemptId}/extend-time`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ additional_minutes: minutes }),
        },
      );
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        deadlineAt?: string;
      };
      if (!res.ok) {
        setError(data.error || s.requestTimeFailed);
        // Re-read the cap: a 400 usually means another tab spent the balance.
        void loadRemaining();
        return;
      }
      if (data.deadlineAt) onExtended?.(data.deadlineAt);
      setOpen(false);
      setPicked(null);
    } catch {
      setError(s.requestTimeFailed);
    } finally {
      setBusy(false);
    }
  }, [taskId, attemptId, onExtended, loadRemaining, s.requestTimeFailed]);

  return (
    <>
      <button
        type="button"
        className="press"
        onClick={openSheet}
        disabled={disabled || allSpent}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "8px 14px",
          borderRadius: 9999,
          border: "1px solid var(--rule-strong)",
          background: "var(--surface)",
          color: "var(--ink-soft)",
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          cursor: disabled || allSpent ? "default" : "pointer",
          opacity: disabled || allSpent ? 0.45 : 1,
        }}
      >
        {/* Inline glyph — this project carries no icon dependency. */}
        <span aria-hidden style={{ fontSize: 13, lineHeight: 1 }}>
          +
        </span>
        {s.requestTime}
      </button>

      {open ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 60,
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
          }}
          aria-modal="true"
          role="dialog"
          aria-label={s.requestTimeTitle}
        >
          <button
            type="button"
            aria-label={s.cancel}
            onClick={busy ? undefined : () => setOpen(false)}
            className="fade-in"
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(35, 29, 20, 0.52)",
              border: "none",
              cursor: busy ? "default" : "pointer",
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
              maxHeight: "82vh",
              display: "flex",
              flexDirection: "column",
              boxShadow: "var(--shadow-lg)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                paddingTop: 12,
                paddingBottom: 6,
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 4,
                  borderRadius: 9999,
                  background: "var(--rule-strong)",
                }}
              />
            </div>

            <div style={{ padding: "6px 20px 14px" }}>
              <p
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                  color: deadlinePassed ? "var(--crit)" : "var(--ink-mute)",
                  margin: 0,
                }}
              >
                {s.requestTimeEyebrow}
              </p>
              <h2
                style={{
                  fontFamily: "var(--font-serif)",
                  fontSize: 19,
                  fontWeight: 400,
                  color: "var(--ink)",
                  margin: "5px 0 0",
                }}
              >
                {s.requestTimeTitle}
              </h2>
              <p
                style={{
                  fontSize: 13,
                  color: "var(--ink-mute)",
                  margin: "6px 0 0",
                  lineHeight: 1.45,
                }}
              >
                {deadlinePassed ? s.requestTimeBodyExpired : s.requestTimeBody}
              </p>
            </div>

            <div style={{ padding: "0 20px", overflowY: "auto" }}>
              {error ? (
                <p
                  role="alert"
                  style={{
                    background: "var(--crit-wash)",
                    color: "var(--crit)",
                    borderRadius: "var(--r-lg)",
                    padding: "10px 12px",
                    fontSize: 13,
                    margin: "0 0 12px",
                  }}
                >
                  {error}
                </p>
              ) : null}

              {allSpent ? (
                <p style={{ fontSize: 13, color: "var(--ink-mute)", margin: "0 0 12px" }}>
                  {s.requestTimeAllUsed}
                </p>
              ) : (
                <div
                  role="radiogroup"
                  aria-label={s.requestTimeTitle}
                  style={{ display: "flex", flexWrap: "wrap", gap: 8 }}
                >
                  {options.map((m) => {
                    const on = effective === m;
                    return (
                      <button
                        key={m}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        onClick={() => setPicked(m)}
                        disabled={busy}
                        className="press"
                        style={{
                          minWidth: 68,
                          padding: "12px 10px",
                          borderRadius: "var(--r-lg)",
                          border: `1px solid ${on ? "var(--green)" : "var(--rule)"}`,
                          background: on ? "var(--green-wash)" : "var(--surface-sunk)",
                          color: on ? "var(--green-deep)" : "var(--ink-soft)",
                          cursor: busy ? "default" : "pointer",
                          textAlign: "center",
                        }}
                      >
                        <span
                          style={{
                            display: "block",
                            fontFamily: "var(--font-serif)",
                            fontSize: 20,
                            lineHeight: 1.1,
                          }}
                        >
                          {m}
                        </span>
                        <span
                          style={{
                            display: "block",
                            fontFamily: "var(--font-mono)",
                            fontSize: 9,
                            letterSpacing: "0.1em",
                            textTransform: "uppercase",
                            marginTop: 2,
                          }}
                        >
                          {s.minutesShort}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {usedMinutes > 0 ? (
                <p
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 10,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    color: "var(--ink-faint)",
                    margin: "12px 0 0",
                  }}
                >
                  {usedMinutes} / {MAX_EXTENSION_MINUTES} {s.minutesShort} —{" "}
                  {s.requestTimeUsedLabel}
                </p>
              ) : null}
            </div>

            <div style={{ display: "flex", gap: 10, padding: "16px 20px 0" }}>
              <button
                type="button"
                className="press"
                onClick={() => setOpen(false)}
                disabled={busy}
                style={{
                  flex: 1,
                  padding: "13px 16px",
                  borderRadius: "var(--r-lg)",
                  border: "1px solid var(--rule-strong)",
                  background: "var(--surface)",
                  color: "var(--ink-soft)",
                  fontSize: 14,
                  cursor: busy ? "default" : "pointer",
                }}
              >
                {s.cancel}
              </button>
              <button
                type="button"
                className="press"
                onClick={effective ? () => void submit(effective) : undefined}
                disabled={busy || allSpent || !effective}
                style={{
                  flex: 2,
                  padding: "13px 16px",
                  borderRadius: "var(--r-lg)",
                  border: "none",
                  background: "var(--green-deep)",
                  color: "var(--surface)",
                  fontSize: 14,
                  cursor: busy || allSpent ? "default" : "pointer",
                  opacity: busy || allSpent || !effective ? 0.5 : 1,
                }}
              >
                {busy
                  ? "…"
                  : effective
                    ? `${s.requestTimeApply} · ${effective} ${s.minutesShort}`
                    : s.requestTimeApply}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
