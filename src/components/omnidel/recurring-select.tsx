"use client";

import { CustomSelect } from "@/components/omnidel/custom-select";
import {
  normalizeRecurringDays,
  normalizeRecurringMonthDays,
  recurringDisplayLabel,
  recurringSelectOptions,
} from "@/lib/task-recurring";
import type { WeekdayStarts } from "@/components/omnidel/date-picker";
import { useTr } from "@/lib/client/language";

interface RecurringSelectProps {
  value: string;
  /**
   * Day selection for the active cadence (owned by parent calendar):
   * - weekly: Mon-first weekdays 0–6 (multi)
   * - monthly / custom: days of month 1–31 (multi)
   */
  days: number[];
  onChange: (
    recurring: string,
    days: number[],
    weekdayStarts?: WeekdayStarts,
  ) => void;
  disabled?: boolean;
  /** Include a legacy stored value that is not in the primary options list. */
  includeLegacyValue?: string | null;
}

/**
 * Simple cadence dropdown only (Never / Daily / … / Custom).
 * Day multi-select and pattern marking live on the parent DatePicker calendar.
 */
export function RecurringSelect({
  value,
  days,
  onChange,
  disabled = false,
  includeLegacyValue,
}: RecurringSelectProps) {
  const tr = useTr();
  const options = recurringSelectOptions(includeLegacyValue ?? value);

  return (
    <CustomSelect
      value={value}
      disabled={disabled}
      options={options}
      placeholder={tr("Never")}
      onChange={(next) => {
        if (next === value) return;
        // Switching cadence clears multi-select + weekday anchors.
        if (next === "weekly") {
          onChange("weekly", normalizeRecurringDays([]), {});
          return;
        }
        if (next === "monthly" || next === "custom") {
          onChange(next, normalizeRecurringMonthDays([]), {});
          return;
        }
        onChange(next, [], {});
      }}
    />
  );
}

export { monthDayFromIso, monthDaysFromTask };

function monthDayFromIso(iso: string | null | undefined): number | null {
  if (!iso || iso.length < 10) return null;
  const d = Number(iso.slice(8, 10));
  if (!Number.isFinite(d) || d < 1 || d > 31) return null;
  return d;
}

function monthDaysFromTask(
  recurring: string | null | undefined,
  days: number[] | null | undefined,
  dueDate?: string | null,
): number[] {
  if (recurring !== "monthly") return [];
  const multi = normalizeRecurringMonthDays(days);
  if (multi.length > 0) return multi;
  const one = monthDayFromIso(dueDate);
  return one != null ? [one] : [];
}

/** Trigger/read-only helper re-export for labels. */
export function formatRecurringTrigger(
  recurring: string | null | undefined,
  days?: number[] | null,
): string {
  return recurringDisplayLabel(recurring, days);
}
