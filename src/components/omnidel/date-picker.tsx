"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { RecurringSelect } from "@/components/omnidel/recurring-select";
import {
  normalizeRecurringDays,
  normalizeRecurringMonthDays,
  recurringDisplayLabel,
  toggleRecurringDay,
  toggleRecurringMonthDay,
} from "@/lib/task-recurring";
import { useTr } from "@/lib/client/language";

// ─── OmniDel DatePicker ──────────────────────────────────────────────────────
// Custom calendar matching OmniDel surfaces (page/surface/green-deep/mono labels).
// Value is always ISO `YYYY-MM-DD` (or "" when cleared).
//
// Optional Trello-style Recurring under the calendar (deadline only):
// ONE shared calendar drives all cadences (no nested month/weekday pickers).
// Marking rules (solid green = marked; never wash for cadence):
//   never      → only the due date is marked
//   daily      → mark all dates from due date forward
//   mon_sat    → mark Mon–Sat from due date forward (not Sunday)
//   weekly     → multi-select weekdays; mark those weekdays from due date forward only
//   monthly    → multi-select days-of-month; mark only selected day numbers (future only)
//   custom     → multi-select dates manually (day-of-month); mark only what user clicked (future only)
// Past dates are NEVER marked for any cadence.

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"] as const;

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function toIso(y: number, m0: number, d: number): string {
  return `${y}-${pad2(m0 + 1)}-${pad2(d)}`;
}

function parseIso(iso: string): { y: number; m0: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec((iso || "").trim());
  if (!m) return null;
  const y = Number(m[1]);
  const m0 = Number(m[2]) - 1;
  const d = Number(m[3]);
  if (m0 < 0 || m0 > 11 || d < 1 || d > 31) return null;
  return { y, m0, d };
}

function formatDisplay(iso: string): string {
  const p = parseIso(iso);
  if (!p) return "";
  return `${pad2(p.d)}-${pad2(p.m0 + 1)}-${p.y}`;
}

function monthLabel(y: number, m0: number): string {
  try {
    return new Date(y, m0, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  } catch {
    return `${m0 + 1}/${y}`;
  }
}

/** Monday-first day-of-week 0=Mon … 6=Sun */
function mondayFirstDow(date: Date): number {
  return (date.getDay() + 6) % 7;
}

function daysInMonth(y: number, m0: number): number {
  return new Date(y, m0 + 1, 0).getDate();
}

function todayIso(): string {
  const n = new Date();
  return toIso(n.getFullYear(), n.getMonth(), n.getDate());
}

function inRange(iso: string, min?: string, max?: string): boolean {
  if (min && iso < min) return false;
  if (max && iso > max) return false;
  return true;
}

/**
 * Intersection of the viewport with overflow-clipping ancestors.
 * Lets portaled popovers flip/clamp inside modals (overflow:auto/hidden)
 * instead of treating space below the modal shell as free viewport room.
 */
function getCollisionBounds(el: HTMLElement): {
  top: number;
  left: number;
  right: number;
  bottom: number;
} {
  let top = 0;
  let left = 0;
  let right = window.innerWidth;
  let bottom = window.innerHeight;
  let node: HTMLElement | null = el.parentElement;
  while (node && node !== document.documentElement) {
    const style = window.getComputedStyle(node);
    const clipsY = /(auto|scroll|hidden|overlay)/.test(style.overflowY);
    const clipsX = /(auto|scroll|hidden|overlay)/.test(style.overflowX);
    if (clipsY || clipsX) {
      const r = node.getBoundingClientRect();
      if (clipsY) {
        top = Math.max(top, r.top);
        bottom = Math.min(bottom, r.bottom);
      }
      if (clipsX) {
        left = Math.max(left, r.left);
        right = Math.min(right, r.right);
      }
    }
    node = node.parentElement;
  }
  return { top, left, right, bottom };
}

/** Mon-first weekday index → first occurrence ISO (weekly multi-select anchors). */
export type WeekdayStarts = Record<number, string>;

export interface DatePickerRecurringProps {
  value: string;
  days: number[];
  /** Per-weekday first date (weekly): Mon clicked on 27 → only mark Mon from 27 on. */
  weekdayStarts?: WeekdayStarts;
  onChange: (
    recurring: string,
    days: number[],
    weekdayStarts?: WeekdayStarts,
  ) => void;
  includeLegacyValue?: string | null;
  disabled?: boolean;
}

/**
 * Whether a calendar cell is MARKED (solid) for the active recurring cadence.
 * Past dates (before today) are never marked.
 * Weekly: each weekday only marks from its own click-anchor date forward
 * (clicking Mon 27 does NOT mark Mon 20).
 */
function isRecurringMarked(
  cadence: string,
  cellIso: string,
  cell: { y: number; m0: number; d: number; inMonth: boolean },
  dueIso: string,
  days: number[],
  weekdayStarts?: WeekdayStarts,
): boolean {
  if (!cadence) return false;

  // Never mark calendar days before today.
  const today = todayIso();
  if (cellIso < today) return false;

  const monFirst = mondayFirstDow(new Date(cell.y, cell.m0, cell.d));

  switch (cadence) {
    case "daily": {
      const start = dueIso || today;
      return cellIso >= start;
    }
    case "mon_sat": {
      const start = dueIso || today;
      if (cellIso < start) return false;
      return monFirst >= 0 && monFirst <= 5;
    }
    case "weekdays": {
      const start = dueIso || today;
      if (cellIso < start) return false;
      return monFirst >= 0 && monFirst <= 4;
    }
    case "weekly": {
      // Only mark weekdays the user explicitly clicked (no auto-seed from due).
      const weekdays = normalizeRecurringDays(days);
      if (weekdays.length === 0) return false;
      if (!weekdays.includes(monFirst)) return false;
      // Per-weekday anchor: the date clicked to select that weekday.
      // Click Fri 24 → mark Fri 24, 31, … (not before 24).
      const wdStart =
        weekdayStarts?.[monFirst] ||
        weekdayStarts?.[String(monFirst) as unknown as number] ||
        dueIso ||
        today;
      return cellIso >= wdStart;
    }
    case "monthly":
    case "custom": {
      // Only days the user explicitly multi-selected (day-of-month). No auto-fill.
      const monthDays = normalizeRecurringMonthDays(days);
      if (monthDays.length === 0) return false;
      const start = dueIso || today;
      if (cellIso < start) return false;
      return monthDays.includes(cell.d);
    }
    default:
      return false;
  }
}

export function DatePicker({
  value,
  onChange,
  placeholder = "dd-mm-yyyy",
  disabled,
  allowClear = true,
  min,
  max,
  "data-mah": dataMah,
  recurring,
  style,
  splitLabel,
}: {
  value: string;
  onChange: (iso: string) => void;
  placeholder?: string;
  disabled?: boolean;
  allowClear?: boolean;
  min?: string;
  max?: string;
  "data-mah"?: string;
  recurring?: DatePickerRecurringProps;
  /** Merged onto the trigger button (overrides defaults like background/border). */
  style?: CSSProperties;
  /** When a date is set: keep placeholder as a left label, date on the right. */
  splitLabel?: boolean;
}) {
  const tr = useTr();
  const [open, setOpen] = useState(false);
  const parsed = parseIso(value);
  const [viewY, setViewY] = useState(() => parsed?.y ?? new Date().getFullYear());
  const [viewM0, setViewM0] = useState(() => parsed?.m0 ?? new Date().getMonth());

  const ref = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{
    top: number;
    left: number;
    width: number;
    maxHeight: number;
  } | null>(null);

  const showRecurring = !!recurring;
  const cadence = recurring?.value || "";
  const recDays = recurring?.days || [];
  const weekdayStarts: WeekdayStarts = recurring?.weekdayStarts || {};

  const recurringSummary =
    showRecurring && cadence
      ? recurringDisplayLabel(cadence, recDays)
      : null;

  useEffect(() => {
    if (open) return;
    const p = parseIso(value);
    if (p) {
      setViewY(p.y);
      setViewM0(p.m0);
    }
  }, [value, open]);

  useLayoutEffect(() => {
    if (!open || !ref.current) {
      setPos(null);
      return;
    }
    const gap = 4;
    const edge = 8;
    const preferredMax = showRecurring ? 560 : 360;

    function update() {
      if (!ref.current) return;
      const r = ref.current.getBoundingClientRect();
      const bounds = getCollisionBounds(ref.current);

      // Trigger scrolled out of the modal / clip area — close instead of floating off-panel.
      const visiblyInBounds =
        r.bottom > bounds.top + edge &&
        r.top < bounds.bottom - edge &&
        r.right > bounds.left + edge &&
        r.left < bounds.right - edge;
      if (!visiblyInBounds) {
        setOpen(false);
        return;
      }

      const estimatedH = showRecurring ? 420 : 320;
      // Use scrollHeight (full content), not offsetHeight — a maxHeight-clamped
      // downward popover would otherwise report a short height and never flip up.
      const contentH = popoverRef.current?.scrollHeight;
      const popH = contentH && contentH > 0 ? contentH : estimatedH;
      const spaceBelow = bounds.bottom - r.bottom - gap;
      const spaceAbove = r.top - bounds.top - gap;
      // If the full calendar does not fit under the field, open ABOVE it
      // (do not keep a shortened downward dropdown).
      const openUp = popH > spaceBelow && spaceAbove > edge;
      const available = Math.max(120, (openUp ? spaceAbove : spaceBelow) - edge);
      const maxHeight = Math.min(preferredMax, available);
      const usedH = Math.min(popH, maxHeight);
      // Anchor to the trigger; only nudge to stay inside the clip box.
      let top = openUp ? r.top - usedH - gap : r.bottom + gap;
      if (openUp) {
        top = Math.max(bounds.top + edge, top);
      } else {
        top = Math.min(top, bounds.bottom - usedH - edge);
      }

      // Fixed compact width (Assign Date size). Do not stretch to the trigger —
      // Simple Due is full-column wide and aspect-ratio day cells would explode.
      const width = showRecurring ? 300 : 280;
      // Right-align under the field (calendar icon side) so wide triggers
      // (Simple Due) do not leave the popover stranded on the left.
      let left = r.right - width;
      left = Math.min(left, bounds.right - width - edge);
      left = Math.max(bounds.left + edge, left);

      setPos({ top, left, width, maxHeight });
    }
    update();
    requestAnimationFrame(update);
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open, viewY, viewM0, showRecurring, cadence, recDays.length]);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      if (ref.current?.contains(t)) return;
      if (popoverRef.current?.contains(t)) return;
      const el = t as HTMLElement | null;
      // CustomSelect for Recurring portals outside.
      if (el?.closest?.(".custom-select-dropdown")) return;
      if (el?.closest?.(".recurring-select-dropdown")) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const cells = useMemo(() => {
    const first = new Date(viewY, viewM0, 1);
    const startPad = mondayFirstDow(first);
    const dim = daysInMonth(viewY, viewM0);
    const out: { y: number; m0: number; d: number; inMonth: boolean }[] = [];

    for (let i = 0; i < startPad; i++) {
      const dt = new Date(viewY, viewM0, 1 - (startPad - i));
      out.push({ y: dt.getFullYear(), m0: dt.getMonth(), d: dt.getDate(), inMonth: false });
    }
    for (let d = 1; d <= dim; d++) {
      out.push({ y: viewY, m0: viewM0, d, inMonth: true });
    }
    let n = 1;
    while (out.length < 42) {
      const dt = new Date(viewY, viewM0 + 1, n++);
      out.push({ y: dt.getFullYear(), m0: dt.getMonth(), d: dt.getDate(), inMonth: false });
    }
    return out;
  }, [viewY, viewM0]);

  function shiftMonth(delta: number) {
    const dt = new Date(viewY, viewM0 + delta, 1);
    setViewY(dt.getFullYear());
    setViewM0(dt.getMonth());
  }

  /**
   * Calendar day click — behaviour depends on recurring cadence.
   * Past dates cannot be multi-selected for weekly / monthly / custom.
   */
  function pick(y: number, m0: number, d: number) {
    const iso = toIso(y, m0, d);
    if (!inRange(iso, min, max)) return;

    if (showRecurring && recurring && !recurring.disabled) {
      const floor = value || todayIso();

      // Monthly + Custom: manual multi-select of day-of-month only (no auto weekday fill).
      if (cadence === "monthly" || cadence === "custom") {
        // Do not allow selecting past dates for multi-select.
        if (iso < floor && value) {
          // Still allow changing the primary due date if clicking a new due.
          // For multi modes, ignore past cells entirely when a due already exists.
          return;
        }
        const next = toggleRecurringMonthDay(normalizeRecurringMonthDays(recDays), d);
        recurring.onChange(cadence, next, {});
        if (next.length === 0) {
          onChange(iso);
        } else if (!value || !next.includes(parseIso(value)?.d ?? -1)) {
          onChange(iso);
        } else if (!next.includes(d) && value) {
          const keep = next[0];
          const base = parseIso(value) || { y, m0, d };
          const dim = daysInMonth(base.y, base.m0);
          onChange(toIso(base.y, base.m0, Math.min(keep, dim)));
        }
        return;
      }

      // Weekly: multi-select weekdays by clicking any non-past date.
      // - First click → select weekday from that date onward (24 → also 31, 7, …).
      // - Click again on that weekday → uncheck (and clear due if due was that weekday,
      //   otherwise the due-date cell stays solid and looks "stuck").
      if (cadence === "weekly") {
        if (iso < todayIso()) return;

        const monFirst = mondayFirstDow(new Date(y, m0, d));
        const base = normalizeRecurringDays(recDays);
        // Normalize keys (JSON may store "4" instead of 4).
        const starts: WeekdayStarts = {};
        for (const [k, v] of Object.entries(weekdayStarts || {})) {
          const n = Number(k);
          if (Number.isInteger(n) && n >= 0 && n <= 6 && typeof v === "string") {
            starts[n] = v;
          }
        }

        const already = base.includes(monFirst);

        if (already) {
          // Uncheck this weekday.
          const nextDays = base.filter((w) => w !== monFirst);
          delete starts[monFirst];
          recurring.onChange("weekly", nextDays, starts);

          // Due date often equals the first clicked day (e.g. 24). If we leave it,
          // that cell stays solid green and looks like uncheck failed.
          if (value) {
            const dueP = parseIso(value);
            if (dueP) {
              const dueDow = mondayFirstDow(new Date(dueP.y, dueP.m0, dueP.d));
              if (dueDow === monFirst) {
                const nextDue =
                  nextDays
                    .map((w) => starts[w])
                    .filter((s): s is string => typeof s === "string" && s.length >= 10)
                    .sort()[0] || "";
                onChange(nextDue);
              }
            }
          }
        } else {
          // Select weekday; mark this date and all later same weekdays.
          const nextDays = [...base, monFirst].sort((a, b) => a - b);
          starts[monFirst] = iso;
          recurring.onChange("weekly", nextDays, starts);
          // Use first weekly pick as due when empty, or when due was cleared.
          if (!value) onChange(iso);
        }
        return;
      }
    }

    // never / daily / mon_sat / default: single due date
    onChange(iso);
    // Switching due date with leftover multi-days can look sticky — clear days for Never.
    if (showRecurring && recurring && !cadence) {
      recurring.onChange("", [], {});
    }
    if (!showRecurring) setOpen(false);
  }

  const display = value ? formatDisplay(value) : "";
  const today = todayIso();

  const hintText = (() => {
    if (!showRecurring || !cadence) return null;
    switch (cadence) {
      case "daily":
        return "All dates from the due date onward are marked.";
      case "weekly":
        return "Click a date to select that weekday (later weeks mark too). Click it again to uncheck — solid green = selected, not just the due date.";
      case "mon_sat":
        return "Monday–Saturday from the due date onward are marked (Sundays excluded).";
      case "monthly":
        return "Click dates to multi-select days of the month (no past dates).";
      case "custom":
        return "Click dates to select them manually — only chosen dates are marked.";
      default:
        return null;
    }
  })();

  return (
    <div ref={ref} style={{ width: "100%", height: style?.height === "100%" ? "100%" : undefined }}>
      <button
        type="button"
        data-mah={dataMah}
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          setOpen((o) => !o);
        }}
        style={{
          ...triggerStyle,
          width: "100%",
          opacity: disabled ? 0.6 : 1,
          cursor: disabled ? "not-allowed" : "pointer",
          color: display ? "var(--ink-soft)" : "var(--ink-mute)",
          ...style,
        }}
        title={splitLabel && display ? `${placeholder}: ${display}` : undefined}
      >
        {splitLabel && display ? (
          <span style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            gap: 10, flex: 1, minWidth: 0,
          }}>
            <span style={{ color: "var(--ink-mute)", fontWeight: 500, flexShrink: 0, whiteSpace: "nowrap" }}>
              {placeholder}
            </span>
            <span style={{
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              minWidth: 0, textAlign: "right", color: "var(--ink-soft)", fontWeight: 600,
            }}>
              {display}
              {recurringSummary && recurringSummary !== "Never" ? (
                <span style={{ color: "var(--ink-mute)", fontWeight: 500 }}>
                  {" · "}
                  {recurringSummary}
                </span>
              ) : null}
            </span>
          </span>
        ) : (
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0, flex: 1 }}>
            {display || placeholder}
            {recurringSummary && recurringSummary !== "Never" ? (
              <span style={{ color: "var(--ink-mute)", fontWeight: 500 }}>
                {" · "}
                {recurringSummary}
              </span>
            ) : null}
          </span>
        )}
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
          style={{ flexShrink: 0, color: "var(--ink-mute)" }}
        >
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      </button>

      {open && pos && typeof document !== "undefined" && createPortal(
        <div
          ref={popoverRef}
          role="dialog"
          aria-label={showRecurring ? "Due date and recurring" : "Choose date"}
          style={{
            position: "fixed",
            top: pos.top,
            left: pos.left,
            width: pos.width,
            zIndex: 2500,
            background: "var(--surface)",
            border: "1px solid var(--rule)",
            borderRadius: "var(--r-md)",
            boxShadow: "var(--shadow-md)",
            fontFamily: "var(--sans)",
            maxHeight: pos.maxHeight,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {/* Scrollable month/grid/(recurring) — Clear/Today stay pinned below. */}
          <div style={{ flex: "1 1 auto", minHeight: 0, overflowY: "auto", padding: "12px 12px 0" }}>
          {/* Month header */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            marginBottom: 10, gap: 8,
          }}>
            <span style={{
              fontFamily: "var(--mono)", fontSize: 12, fontWeight: 600,
              color: "var(--ink)", letterSpacing: "0.02em",
            }}>
              {monthLabel(viewY, viewM0)}
            </span>
            <div style={{ display: "flex", gap: 4 }}>
              <button type="button" onClick={() => shiftMonth(-1)} aria-label={tr("Previous month")} style={navBtnStyle}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
              </button>
              <button type="button" onClick={() => shiftMonth(1)} aria-label={tr("Next month")} style={navBtnStyle}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
              </button>
            </div>
          </div>

          {/* Weekday headers */}
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2,
            marginBottom: 4,
          }}>
            {WEEKDAYS.map((w) => (
              <div
                key={w}
                style={{
                  textAlign: "center",
                  fontFamily: "var(--mono)",
                  fontSize: 10,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: "var(--ink-mute)",
                  padding: "4px 0",
                }}
              >
                {w}
              </div>
            ))}
          </div>

          {/* Day grid — single calendar for due date + all recurring patterns */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
            {cells.map((c) => {
              const iso = toIso(c.y, c.m0, c.d);
              const dueSelected = value === iso;
              const isToday = today === iso;
              const blocked = !inRange(iso, min, max);
              const monFirst = mondayFirstDow(new Date(c.y, c.m0, c.d));

              // Solid mark for cadence (never past; never when cadence is empty).
              const recMarked =
                showRecurring && cadence
                  ? isRecurringMarked(cadence, iso, c, value, recDays, weekdayStarts)
                  : false;

              // Weekly / monthly / custom: solid = multi-select only.
              // Due date alone must NOT stay solid after uncheck (that was the bug:
              // unchecking Fri still left 24 green because it is the due date).
              const multiMode =
                cadence === "weekly" || cadence === "monthly" || cadence === "custom";
              const filled = multiMode ? recMarked : dueSelected || recMarked;
              // Outline-only for due date when it is not part of the weekly selection.
              const dueOutline = multiMode && dueSelected && !recMarked;

              return (
                <button
                  key={`${c.y}-${c.m0}-${c.d}-${c.inMonth ? "m" : "o"}`}
                  type="button"
                  disabled={blocked}
                  title={
                    cadence === "monthly" || cadence === "custom"
                      ? `Day ${c.d}`
                      : cadence === "weekly"
                        ? WEEKDAYS[monFirst]
                        : iso
                  }
                  onClick={() => pick(c.y, c.m0, c.d)}
                  style={{
                    aspectRatio: "1",
                    border:
                      filled
                        ? "1px solid var(--green-deep)"
                        : dueOutline || (isToday && !blocked)
                          ? "1px solid var(--green-deep)"
                          : "1px solid transparent",
                    borderRadius: "var(--r-sm)",
                    background: filled ? "var(--green-deep)" : "transparent",
                    color: filled
                      ? "var(--surface)"
                      : blocked
                        ? "var(--ink-faint)"
                        : c.inMonth
                          ? "var(--ink-soft)"
                          : "var(--ink-faint)",
                    fontFamily: "var(--sans)",
                    fontSize: 12,
                    fontWeight: filled || isToday || dueOutline ? 600 : 400,
                    cursor: blocked ? "not-allowed" : "pointer",
                    opacity: blocked ? 0.4 : c.inMonth ? 1 : 0.55,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: 0,
                  }}
                  onMouseEnter={(e) => {
                    if (!filled && !blocked) {
                      e.currentTarget.style.background = "var(--green-wash)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!filled) {
                      e.currentTarget.style.background = "transparent";
                    }
                  }}
                >
                  {c.d}
                </button>
              );
            })}
          </div>

          {/* Recurring cadence only (no nested calendars) */}
          {showRecurring && recurring && (
            <div
              style={{
                marginTop: 12,
                paddingTop: 10,
                borderTop: "1px solid var(--rule)",
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: "0.04em",
                  color: "var(--ink-mute)",
                  marginBottom: 6,
                  textTransform: "uppercase",
                  fontFamily: "var(--sans)",
                }}
              >
                {tr("Recurring")}
              </div>
              <RecurringSelect
                value={recurring.value}
                days={recurring.days}
                includeLegacyValue={recurring.includeLegacyValue}
                disabled={recurring.disabled || disabled}
                onChange={(nextCadence, nextDays, nextStarts) => {
                  // Do not auto-seed weekdays from due date — user clicks calendar
                  // to choose weekdays (click Fri 24 + Sat 25 → Fri 31 also marks).
                  recurring.onChange(nextCadence, nextDays, nextStarts || {});
                }}
              />
              {hintText && (
                <div
                  style={{
                    marginTop: 8,
                    fontSize: 11,
                    color: "var(--ink-mute)",
                    fontFamily: "var(--sans)",
                    lineHeight: 1.35,
                  }}
                >
                  {hintText}
                </div>
              )}
            </div>
          )}
          </div>

          {/* Footer — always visible (Assign Date pattern): Clear / Today [/ Done] */}
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            flexShrink: 0,
            padding: "8px 12px 10px",
            borderTop: "1px solid var(--rule)",
            gap: 8,
            background: "var(--surface)",
          }}>
            {allowClear ? (
              <button
                type="button"
                onClick={() => {
                  onChange("");
                  if (recurring && !recurring.disabled) {
                    recurring.onChange("", [], {});
                  }
                  if (!showRecurring) setOpen(false);
                }}
                style={footerLinkStyle}
              >
                {tr("Clear")}
              </button>
            ) : (
              <span />
            )}
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button
                type="button"
                onClick={() => {
                  const t = todayIso();
                  if (!inRange(t, min, max)) return;
                  const p = parseIso(t)!;
                  setViewY(p.y);
                  setViewM0(p.m0);
                  // Today as due date; seed multi-select for monthly/custom/weekly.
                  if ((cadence === "monthly" || cadence === "custom") && recurring) {
                    recurring.onChange(cadence, toggleRecurringMonthDay([], p.d), {});
                    onChange(t);
                  } else if (cadence === "weekly" && recurring) {
                    const mf = mondayFirstDow(new Date(p.y, p.m0, p.d));
                    recurring.onChange("weekly", [mf], { [mf]: t });
                    onChange(t);
                  } else {
                    onChange(t);
                  }
                  if (!showRecurring) setOpen(false);
                }}
                disabled={!inRange(today, min, max)}
                style={{
                  ...footerLinkStyle,
                  fontWeight: 600,
                  color: "var(--green-deep)",
                  opacity: inRange(today, min, max) ? 1 : 0.4,
                  cursor: inRange(today, min, max) ? "pointer" : "not-allowed",
                }}
              >
                {tr("Today")}
              </button>
              {showRecurring && (
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  style={{
                    ...footerLinkStyle,
                    fontWeight: 600,
                    background: "var(--green-deep)",
                    color: "var(--surface)",
                    borderRadius: "var(--r-sm)",
                    padding: "6px 12px",
                  }}
                >
                  {tr("Done")}
                </button>
              )}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}

const triggerStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
  width: "100%",
  padding: "7px 9px",
  fontSize: 12,
  background: "var(--page)",
  border: "1px solid var(--rule-strong)",
  borderRadius: "var(--r-sm)",
  fontFamily: "var(--sans)",
  textAlign: "left",
  boxSizing: "border-box",
};

const navBtnStyle: CSSProperties = {
  width: 28,
  height: 28,
  padding: 0,
  border: "1px solid var(--rule)",
  borderRadius: "var(--r-sm)",
  background: "var(--page)",
  color: "var(--ink-soft)",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};

const footerLinkStyle: CSSProperties = {
  border: "none",
  background: "transparent",
  padding: "4px 6px",
  fontFamily: "var(--sans)",
  fontSize: 12,
  color: "var(--ink-soft)",
  cursor: "pointer",
};
