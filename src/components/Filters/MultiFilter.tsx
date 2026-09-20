import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Checkbox } from "../Input/Checkbox";

export interface FilterOption {
  value: string;
  label: string;
  /** Leading dot colour, for status-like options. */
  color?: string;
  /** Result count shown to the right of the option. */
  count?: number;
}

export interface ChecklistSection {
  kind: "checklist";
  key: string;
  label: string;
  options: FilterOption[];
  /** Currently ticked values. */
  selected: string[];
  onChange: (next: string[]) => void;
}

export interface RadioSection {
  kind: "radio";
  key: string;
  label: string;
  options: FilterOption[];
  /** "" means "no choice made". */
  selected: string;
  onChange: (next: string) => void;
}

export interface ToggleSection {
  kind: "toggle";
  key: string;
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}

export type FilterSection = ChecklistSection | RadioSection | ToggleSection;

export interface MultiFilterProps {
  searchInput: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  sections: FilterSection[];
  /** Which edge the popover aligns to. Use "right" at the end of a toolbar. */
  align?: "left" | "right";
  /** AND/OR row at the top of the popover. Omit both props to hide it. */
  matchMode?: "all" | "any";
  onMatchModeChange?: (mode: "all" | "any") => void;
}

const POPOVER_W = 320;

/**
 * Search field with a FILTERS popover — the control above the board and the
 * busier tables.
 *
 * Every section is controlled by the caller: this component holds no filter
 * state, applies nothing, and has no idea what the options mean. It reports
 * changes and shows how many are active.
 *
 * States: idle · searching · popover open · N active · all cleared.
 */
export function MultiFilter({
  searchInput,
  onSearchChange,
  searchPlaceholder = "Search & filter…",
  sections,
  align = "left",
  matchMode,
  onMatchModeChange,
}: MultiFilterProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; maxHeight: number } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const activeCount = useMemo(
    () =>
      sections.reduce((n, s) => {
        if (s.kind === "checklist") return n + s.selected.length;
        if (s.kind === "radio") return n + (s.selected ? 1 : 0);
        return n + (s.checked ? 1 : 0);
      }, 0),
    [sections],
  );

  const place = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const left = align === "right" ? r.right - POPOVER_W : r.left;
    setPos({
      top: r.bottom + 6,
      left: Math.max(8, Math.min(left, window.innerWidth - POPOVER_W - 8)),
      maxHeight: Math.max(180, window.innerHeight - r.bottom - 24),
    });
  }, [align]);

  useLayoutEffect(() => {
    if (open) place();
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const onMove = () => place();
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      if (wrapRef.current?.contains(t) || popoverRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, place]);

  function clearAll() {
    for (const s of sections) {
      if (s.kind === "checklist") s.onChange([]);
      else if (s.kind === "radio") s.onChange("");
      else s.onChange(false);
    }
  }

  return (
    <div className="multi-filter" ref={wrapRef} style={{ display: "inline-block", maxWidth: "100%" }}>
      <div className="multi-filter__field" style={{ position: "relative" }}>
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--ink-mute)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          style={{ position: "absolute", left: 10, top: 11, pointerEvents: "none" }}
        >
          <circle cx="11" cy="11" r="8" />
          <path d="M21 21l-4.35-4.35" />
        </svg>
        <input
          type="text"
          className="multi-filter__search"
          value={searchInput}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          aria-label={searchPlaceholder}
          style={{
            width: 320,
            maxWidth: "100%",
            padding: "8px 96px 8px 32px",
            fontSize: 13,
            background: "var(--surface)",
            border: "1px solid var(--rule)",
            borderRadius: "var(--r-sm)",
            color: "var(--ink)",
            outline: "none",
            fontFamily: "var(--sans)",
          }}
        />
        <button
          type="button"
          ref={triggerRef}
          onClick={() => setOpen((o) => !o)}
          aria-label="Filters"
          aria-expanded={open}
          style={{
            position: "absolute",
            right: 4,
            top: 4,
            bottom: 4,
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            padding: "0 10px",
            fontSize: 11,
            fontFamily: "var(--mono)",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            background: activeCount > 0 ? "var(--green-wash)" : "var(--surface-sunk)",
            color: activeCount > 0 ? "var(--green-deep)" : "var(--ink-soft)",
            border: "none",
            borderLeft: "1px solid var(--rule)",
            cursor: "pointer",
          }}
        >
          Filters
          {activeCount > 0 && (
            <span
              style={{
                minWidth: 18,
                height: 18,
                padding: "0 5px",
                borderRadius: 999,
                background: "var(--green-deep)",
                color: "var(--surface)",
                fontSize: 10,
                fontFamily: "var(--mono)",
                fontWeight: 600,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {activeCount}
            </span>
          )}
          <svg width="9" height="6" viewBox="0 0 10 6" fill="none" aria-hidden="true">
            <path
              d="M1 1l4 4 4-4"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>

      {open &&
        pos &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={popoverRef}
            className="custom-select-dropdown"
            style={{
              position: "fixed",
              top: pos.top,
              left: pos.left,
              width: POPOVER_W,
              background: "var(--surface)",
              border: "1px solid var(--rule)",
              borderRadius: "var(--r-sm)",
              boxShadow: "var(--shadow-md)",
              // Matches --z-popover in global.css.
              zIndex: 2000,
              maxHeight: pos.maxHeight,
              overflowY: "auto",
              padding: "12px 14px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 8,
              }}
            >
              <span
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: 10,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: "var(--ink-mute)",
                }}
              >
                Filters
              </span>
              <button
                type="button"
                onClick={clearAll}
                disabled={activeCount === 0}
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: 10,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  background: "transparent",
                  color: activeCount > 0 ? "var(--green-deep)" : "var(--ink-mute)",
                  border: "none",
                  padding: 0,
                  cursor: activeCount > 0 ? "pointer" : "default",
                  opacity: activeCount > 0 ? 1 : 0.5,
                }}
              >
                Uncheck all
              </button>
            </div>

            {onMatchModeChange && (
              <Section label="Match">
                <div style={{ display: "flex", gap: 4 }}>
                  {(["all", "any"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => onMatchModeChange(m)}
                      style={{
                        padding: "4px 12px",
                        fontSize: 11,
                        fontFamily: "var(--mono)",
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                        borderRadius: "var(--r-sm)",
                        border: "1px solid var(--rule)",
                        cursor: "pointer",
                        background: m === matchMode ? "var(--green-deep)" : "transparent",
                        color: m === matchMode ? "var(--surface)" : "var(--ink-soft)",
                      }}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </Section>
            )}

            {sections.map((s) => (
              <Section key={s.key} label={s.label}>
                {s.kind === "toggle" ? (
                  <Checkbox
                    checked={s.checked}
                    onChange={(e) => s.onChange(e.target.checked)}
                    label={s.label}
                  />
                ) : s.kind === "checklist" ? (
                  s.options.map((o) => (
                    <OptionRow key={o.value} option={o}>
                      <Checkbox
                        checked={s.selected.includes(o.value)}
                        onChange={(e) =>
                          s.onChange(
                            e.target.checked
                              ? [...s.selected, o.value]
                              : s.selected.filter((v) => v !== o.value),
                          )
                        }
                        label={
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                            {o.color && <Dot color={o.color} />}
                            {o.label}
                          </span>
                        }
                      />
                    </OptionRow>
                  ))
                ) : (
                  s.options.map((o) => (
                    <OptionRow key={o.value} option={o}>
                      <label
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          fontSize: 13,
                          cursor: "pointer",
                          minWidth: 0,
                        }}
                      >
                        <input
                          type="radio"
                          name={s.key}
                          checked={s.selected === o.value}
                          onChange={() => s.onChange(o.value)}
                          style={{ accentColor: "var(--green-deep)", flexShrink: 0 }}
                        />
                        <span className="picker-truncate">{o.label}</span>
                      </label>
                    </OptionRow>
                  ))
                )}
              </Section>
            ))}
          </div>,
          document.body,
        )}
    </div>
  );
}

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div
        style={{
          fontFamily: "var(--mono)",
          fontSize: 10,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "var(--ink-mute)",
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>{children}</div>
    </div>
  );
}

function OptionRow({ option, children }: { option: FilterOption; children: ReactNode }) {
  return (
    <div
      style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, minWidth: 0 }}
    >
      {children}
      {option.count != null && (
        <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-mute)" }}>
          {option.count}
        </span>
      )}
    </div>
  );
}

function Dot({ color }: { color: string }) {
  return (
    <span
      aria-hidden="true"
      style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }}
    />
  );
}
