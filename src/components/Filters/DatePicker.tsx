import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

export interface DatePickerProps {
  /** ISO date, "YYYY-MM-DD". Empty string means no date. */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Inclusive bounds, both ISO dates. */
  min?: string;
  max?: string;
  disabled?: boolean;
  /** Show the "Clear" action in the footer. */
  clearable?: boolean;
  error?: boolean;
  ariaLabel?: string;
}

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** Local-time ISO — `toISOString()` would shift the day either side of UTC. */
function toISO(d: Date): string {
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function parseISO(iso: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDisplay(iso: string): string {
  const d = parseISO(iso);
  if (!d) return "";
  return `${`${d.getDate()}`.padStart(2, "0")} ${MONTHS[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`;
}

/** Monday-first grid of the visible month, padded with the neighbouring days. */
function buildMonth(view: Date): Date[] {
  const first = new Date(view.getFullYear(), view.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7;
  const start = new Date(first);
  start.setDate(first.getDate() - offset);
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

/**
 * Single-date field with a month-grid popover.
 *
 * Value in, value out — an ISO string. No timezone opinions beyond reading the
 * browser's local day, and no knowledge of what the date is for.
 *
 * States: empty · selected · open · today · out of range · disabled · error.
 */
export function DatePicker({
  value,
  onChange,
  placeholder = "Pick a date",
  min,
  max,
  disabled = false,
  clearable = true,
  error = false,
  ariaLabel = "Date",
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const selected = parseISO(value);
  const [view, setView] = useState<Date>(() => selected ?? new Date());
  const wrapRef = useRef<HTMLDivElement>(null);

  // Follow the selected day, not the parsed Date object — `selected` is a new
  // instance on every render, so depending on it would loop.
  useEffect(() => {
    const d = parseISO(value);
    if (d) setView(d);
  }, [value]);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (wrapRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const days = useMemo(() => buildMonth(view), [view]);
  const todayISO = toISO(new Date());

  function outOfRange(iso: string) {
    if (min && iso < min) return true;
    if (max && iso > max) return true;
    return false;
  }

  return (
    <div className="picker-field" ref={wrapRef}>
      <button
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-invalid={error || undefined}
        onClick={() => !disabled && setOpen((o) => !o)}
        style={{
          width: "100%",
          padding: "10px 32px 10px 12px",
          fontSize: 13,
          fontFamily: "var(--sans)",
          background: "var(--page)",
          color: value ? "var(--ink-soft)" : "var(--ink-mute)",
          border: `1px solid ${error ? "var(--crit)" : "var(--rule-strong)"}`,
          borderRadius: "var(--r-sm)",
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.6 : 1,
          textAlign: "left",
          position: "relative",
        }}
      >
        <span className="picker-truncate">{value ? formatDisplay(value) : placeholder}</span>
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--ink-mute)"
          strokeWidth="1.5"
          aria-hidden="true"
          style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)" }}
        >
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M3 10h18M8 2v4M16 2v4" />
        </svg>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={`${ariaLabel} calendar`}
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            zIndex: 20,
            width: 252,
            padding: 10,
            background: "var(--surface)",
            border: "1px solid var(--rule-strong)",
            borderRadius: "var(--r-sm)",
            boxShadow: "var(--shadow-md)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 8,
            }}
          >
            <NavBtn
              label="Previous month"
              onClick={() => setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))}
            >
              ‹
            </NavBtn>
            <span style={{ fontSize: 12, fontFamily: "var(--sans)", fontWeight: 600 }}>
              {MONTHS[view.getMonth()]} {view.getFullYear()}
            </span>
            <NavBtn
              label="Next month"
              onClick={() => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))}
            >
              ›
            </NavBtn>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
            {WEEKDAYS.map((w, i) => (
              <div
                key={`${w}-${i}`}
                aria-hidden="true"
                style={{
                  textAlign: "center",
                  fontFamily: "var(--mono)",
                  fontSize: 9,
                  letterSpacing: "0.06em",
                  color: "var(--ink-mute)",
                  paddingBottom: 4,
                }}
              >
                {w}
              </div>
            ))}
            {days.map((d) => {
              const iso = toISO(d);
              const isCurrentMonth = d.getMonth() === view.getMonth();
              const isSelected = iso === value;
              const isToday = iso === todayISO;
              const blocked = outOfRange(iso);
              return (
                <button
                  key={iso}
                  type="button"
                  disabled={blocked}
                  aria-current={isToday ? "date" : undefined}
                  aria-pressed={isSelected}
                  onClick={() => {
                    onChange(iso);
                    setOpen(false);
                  }}
                  style={{
                    padding: "6px 0",
                    fontSize: 12,
                    fontFamily: "var(--sans)",
                    borderRadius: "var(--r-sm)",
                    border: isToday && !isSelected ? "1px solid var(--rule-strong)" : "1px solid transparent",
                    background: isSelected ? "var(--green-deep)" : "transparent",
                    color: isSelected
                      ? "var(--surface)"
                      : blocked
                        ? "var(--ink-faint)"
                        : isCurrentMonth
                          ? "var(--ink)"
                          : "var(--ink-faint)",
                    cursor: blocked ? "not-allowed" : "pointer",
                    opacity: blocked ? 0.5 : 1,
                  }}
                >
                  {d.getDate()}
                </button>
              );
            })}
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginTop: 8,
              paddingTop: 8,
              borderTop: "1px solid var(--rule)",
            }}
          >
            <FooterBtn
              onClick={() => {
                onChange(todayISO);
                setOpen(false);
              }}
            >
              Today
            </FooterBtn>
            {clearable && (
              <FooterBtn
                onClick={() => {
                  onChange("");
                  setOpen(false);
                }}
                tone="mute"
              >
                Clear
              </FooterBtn>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const navBtnStyle: CSSProperties = {
  width: 24,
  height: 24,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  background: "transparent",
  border: "1px solid var(--rule)",
  borderRadius: "var(--r-sm)",
  color: "var(--ink-soft)",
  cursor: "pointer",
  fontSize: 14,
  lineHeight: 1,
};

function NavBtn({
  children,
  label,
  onClick,
}: {
  children: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button type="button" aria-label={label} onClick={onClick} style={navBtnStyle}>
      {children}
    </button>
  );
}

function FooterBtn({
  children,
  onClick,
  tone = "green",
}: {
  children: string;
  onClick: () => void;
  tone?: "green" | "mute";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: "transparent",
        border: "none",
        padding: 0,
        cursor: "pointer",
        fontFamily: "var(--mono)",
        fontSize: 10,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: tone === "green" ? "var(--green-deep)" : "var(--ink-mute)",
      }}
    >
      {children}
    </button>
  );
}
