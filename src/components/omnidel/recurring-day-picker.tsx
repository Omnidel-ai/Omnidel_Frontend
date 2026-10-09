"use client";

// UNUSED — Page audit 2026-09-16: nothing in src/ imports this module.
// No importers.
// Deletion candidate. See docs/architecture/page-audit-2026-09-16.md.

import {
  RECURRING_WEEKDAY_CHIPS,
  toggleRecurringDay,
  normalizeRecurringDays,
} from "@/lib/task-recurring";
import { useTr } from "@/lib/client/language";

interface RecurringDayPickerProps {
  /** Mon-first day indices 0–6 (selected). */
  value: number[];
  onChange: (days: number[]) => void;
  disabled?: boolean;
  /** Optional label above the chips. */
  hint?: string;
}

/**
 * Seven circular day chips (M Tu We Th Fri Sa Su) for Custom recurrence.
 * Matches the product mock: filled blue when selected.
 */
export function RecurringDayPicker({
  value,
  onChange,
  disabled = false,
  hint = "Repeat on",
}: RecurringDayPickerProps) {
  const tr = useTr();
  const selected = new Set(normalizeRecurringDays(value));

  return (
    <div style={{ marginTop: 8 }}>
      {hint ? (
        <div
          style={{
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: "0.04em",
            color: "var(--ink-mute)",
            marginBottom: 8,
            textTransform: "uppercase",
            fontFamily: "var(--sans)",
          }}
        >
          {hint}
        </div>
      ) : null}
      <div
        role="group"
        aria-label={tr("Custom repeat days")}
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          alignItems: "center",
        }}
      >
        {RECURRING_WEEKDAY_CHIPS.map((chip) => {
          const on = selected.has(chip.value);
          return (
            <button
              key={chip.value}
              type="button"
              disabled={disabled}
              title={chip.label}
              aria-pressed={on}
              aria-label={chip.label}
              onClick={() => {
                if (disabled) return;
                onChange(toggleRecurringDay([...selected], chip.value));
              }}
              style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                border: on ? "none" : "1px solid var(--rule)",
                background: on ? "var(--green-deep)" : "var(--surface-sunk)",
                color: on ? "var(--surface)" : "var(--ink-mute)",
                fontSize: 11,
                fontWeight: 600,
                lineHeight: 1,
                cursor: disabled ? "not-allowed" : "pointer",
                opacity: disabled ? 0.55 : 1,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 0,
                flexShrink: 0,
                fontFamily: "var(--sans)",
              }}
            >
              {chip.short}
            </button>
          );
        })}
      </div>
    </div>
  );
}
