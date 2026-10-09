"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { DatePicker } from "@/components/omnidel/date-picker";
import { useTr } from "@/lib/client/language";

// ─── MultiFilter ────────────────────────────────────────────────────────────
// Config-driven search + filters popover, extracted from the OmniPulse board
// page's BoardSearchFilter so OmniMart pipeline/operations pages can reuse the
// same look and behavior. A search input renders a FILTERS button that opens
// a document.body portal popover (zIndex 2000, same as CustomSelect) listing
// an ordered set of filter sections. Fully controlled — the caller owns all
// state and passes it back in via `sections`.
//
// Section kinds:
//   "checklist"  — multi-select checkboxes, optionally with a single "toggle"
//                  row above it (e.g. board page's "Assigned to me" above the
//                  Assignees checklist — mutual exclusion is handled here).
//   "radio"      — single-select circle radios over `options`.
//   "daterange"  — single-select circle radios over `options` (defaults to
//                  DATE_RANGE_OPTIONS) plus custom from/to date inputs when
//                  the selected value is "custom".
//   "toggle"     — a single standalone checkbox row.

export type FilterOption = { value: string; label: string };

// ─── Date-range filter types (moved from boards/[id]/page.tsx) ──────────────
export type DateRange = "" | "overdue" | "today" | "last_7" | "this_week" | "next_7" | "no_due_date" | "custom";

export const DATE_RANGE_OPTIONS: { value: DateRange; label: string }[] = [
  { value: "", label: "Any due date" },
  { value: "today", label: "Today" },
  { value: "last_7", label: "Last 7 days" },
  { value: "overdue", label: "Overdue" },
  { value: "this_week", label: "Due this week" },
  { value: "next_7", label: "Next 7 days" },
  { value: "no_due_date", label: "No deadline" },
  { value: "custom", label: "Custom range…" },
];

interface BaseSectionConfig {
  key: string;
  label: string;
  /** Draws a divider above this section. Omit for the first section. */
  divider?: boolean;
}

export interface ChecklistSectionConfig extends BaseSectionConfig {
  type: "checklist";
  options: FilterOption[];
  value: string[];
  onChange: (v: string[]) => void;
  emptyText?: string;
  // Optional single-select toggle rendered above the checklist (board page's
  // "Assigned to me"). Selecting the toggle clears the checklist and vice
  // versa — mirrors the original BoardSearchFilter behavior.
  toggle?: {
    label: string;
    checked: boolean;
    onChange: (v: boolean) => void;
  };
}

export interface RadioSectionConfig extends BaseSectionConfig {
  type: "radio";
  options: FilterOption[];
  value: string;
  onChange: (v: string) => void;
}

export interface DateRangeSectionConfig extends BaseSectionConfig {
  type: "daterange";
  options?: { value: DateRange; label: string }[];
  value: DateRange;
  onChange: (v: DateRange) => void;
  customFrom: string;
  onCustomFromChange: (v: string) => void;
  customTo: string;
  onCustomToChange: (v: string) => void;
}

export interface ToggleSectionConfig extends BaseSectionConfig {
  type: "toggle";
  toggleLabel: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}

export type FilterSectionConfig =
  | ChecklistSectionConfig
  | RadioSectionConfig
  | DateRangeSectionConfig
  | ToggleSectionConfig;

function sectionActiveCount(cfg: FilterSectionConfig): number {
  switch (cfg.type) {
    case "checklist":
      return cfg.value.length + (cfg.toggle?.checked ? 1 : 0);
    case "radio":
      return cfg.value ? 1 : 0;
    case "daterange":
      return cfg.value ? 1 : 0;
    case "toggle":
      return cfg.checked ? 1 : 0;
  }
}

function clearSection(cfg: FilterSectionConfig) {
  switch (cfg.type) {
    case "checklist":
      cfg.onChange([]);
      cfg.toggle?.onChange(false);
      return;
    case "radio":
      cfg.onChange("");
      return;
    case "daterange":
      cfg.onChange("");
      return;
    case "toggle":
      cfg.onChange(false);
      return;
  }
}

/**
 * Case-insensitive match for the shared search box.
 * Matches plain substring (e.g. "test" → "TESTING") and a compact form that
 * ignores spaces/punctuation (e.g. "todo" → "TO-DO").
 */
function labelMatchesQuery(label: string, query: string): boolean {
  if (!query) return true;
  const hay = label.toLowerCase();
  if (hay.includes(query)) return true;
  const compact = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");
  const hq = compact(query);
  return hq.length > 0 && compact(label).includes(hq);
}

/**
 * Narrow filter options by the shared search text. Always keep currently
 * selected values visible so an active filter never disappears mid-type.
 */
function filterOptionsBySearch<T extends { value: string; label: string }>(
  options: T[],
  selectedValues: Iterable<string>,
  query: string,
): T[] {
  if (!query) return options;
  const selected = new Set(selectedValues);
  return options.filter(
    (opt) => selected.has(opt.value) || labelMatchesQuery(opt.label, query),
  );
}

/** Whether a filter section still has anything to show for the given search. */
function sectionMatchesSearch(cfg: FilterSectionConfig, query: string): boolean {
  if (!query) return true;
  // Section title itself counts (e.g. typing "label" surfaces the Label block).
  if (labelMatchesQuery(cfg.label, query)) return true;
  switch (cfg.type) {
    case "checklist": {
      if (cfg.toggle && (
        cfg.toggle.checked || labelMatchesQuery(cfg.toggle.label, query)
      )) return true;
      // Keep section if any selected option remains (they stay visible under search).
      if (cfg.value.length > 0) return true;
      return cfg.options.some((o) => labelMatchesQuery(o.label, query));
    }
    case "radio": {
      if (cfg.value) return true;
      return cfg.options.some((o) => labelMatchesQuery(o.label, query));
    }
    case "daterange": {
      if (cfg.value) return true;
      const options = cfg.options ?? DATE_RANGE_OPTIONS;
      return options.some((o) => labelMatchesQuery(o.label, query));
    }
    case "toggle":
      return cfg.checked || labelMatchesQuery(cfg.toggleLabel, query);
  }
}

export function MultiFilter({
  searchInput, onSearchChange, searchPlaceholder = "Search tasks & filters...",
  sections, align = "left",
  matchMode, onMatchModeChange,
  autoOpenOnSearch = false,
}: {
  searchInput: string;
  onSearchChange: (v: string) => void;
  searchPlaceholder?: string;
  sections: FilterSectionConfig[];
  // Which edge the filters popover aligns to (right when the control sits at
  // the right end of the toolbar, so the dropdown stays on-screen).
  align?: "left" | "right";
  // AND/OR toggle rendered at the top of the popover. Omit both props to hide
  // it entirely (board page doesn't pass these — no visual change there).
  matchMode?: "all" | "any";
  onMatchModeChange?: (v: "all" | "any") => void;
  /** When true, typing a query that matches filter options opens the FILTERS
   *  popover. Default false — panel opens only via the FILTERS button so it
   *  never covers search results while typing. */
  autoOpenOnSearch?: boolean;
}) {
  const tr = useTr();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  // Portal the popover to <body> so it escapes the DashboardShell stacking
  // context — otherwise its z-index loses to the fixed MahAcharya chat widget
  // (z-60) and it renders underneath. Same pattern as CustomSelect / LeadPicker.
  const popoverRef = useRef<HTMLDivElement>(null);
  // The FILTERS toggle button — focus returns here when the popover closes via
  // Escape, so keyboard users aren't dumped at the top of the document.
  const triggerRef = useRef<HTMLButtonElement>(null);
  const POPOVER_W = 320;
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number; maxHeight: number } | null>(null);

  useLayoutEffect(() => {
    if (!open || !ref.current) {
      setPopoverPos(null);
      return;
    }
    const anchor = ref.current;
    function updatePos() {
      const r = anchor.getBoundingClientRect();
      const top = r.bottom + 4;
      // align "right": pin the popover's right edge to the control; else left.
      const left = align === "right" ? Math.max(8, r.right - POPOVER_W) : r.left;
      const maxHeight = Math.min(460, window.innerHeight - top - 12);
      setPopoverPos({ top, left, maxHeight });
    }
    updatePos();
    window.addEventListener("scroll", updatePos, true);
    window.addEventListener("resize", updatePos);
    // The toolbar reflows when the task-count chip changes, filters wrap to a
    // second line, or sibling controls resize — scroll/resize listeners don't
    // catch those. Observe the anchor itself so the popover re-pins on any
    // layout shift, not just window-level events.
    const ro = new ResizeObserver(updatePos);
    ro.observe(anchor);
    return () => {
      window.removeEventListener("scroll", updatePos, true);
      window.removeEventListener("resize", updatePos);
      ro.disconnect();
    };
  }, [open, align]);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      if (ref.current && ref.current.contains(t)) return;
      // The popover lives in a portal (outside `ref`) — don't close on clicks in it.
      if (popoverRef.current && popoverRef.current.contains(t)) return;
      setOpen(false);
    }
    // Escape closes the popover and returns focus to the FILTERS trigger.
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    if (open) {
      document.addEventListener("mousedown", onDown);
      document.addEventListener("keydown", onKey);
    }
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const activeCount = sections.reduce((sum, cfg) => sum + sectionActiveCount(cfg), 0);
  // Shared search box also narrows filter options (labels, assignees, priority…).
  // Task-card search stays owned by the parent via onSearchChange → API `q`.
  // Use live searchInput (not the debounced task `q`) so options filter on every keystroke.
  const optionQuery = searchInput.trim().toLowerCase();
  const visibleSections = !optionQuery
    ? sections
    : sections.filter((cfg) => sectionMatchesSearch(cfg, optionQuery));

  // When the shared search matches filter options, optionally open the popover
  // so the narrowed list is visible without an extra FILTERS click. Disabled
  // on pages where the dropdown covers table search results (Media).
  useEffect(() => {
    if (!autoOpenOnSearch) return;
    if (!optionQuery) return;
    if (visibleSections.length === 0) return;
    setOpen(true);
  }, [autoOpenOnSearch, optionQuery, visibleSections.length]);

  function clearAll() {
    sections.forEach(clearSection);
  }

  /** After picking a filter via search-narrowed options, clear the search box
   *  so the board isn't still filtered by the typed text (e.g. "Khushi"). */
  function clearSearchAfterPick() {
    if (searchInput) onSearchChange("");
  }

  return (
    <div ref={ref} className="multi-filter" style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
      <div className="multi-filter__field" style={{ position: "relative" }}>
        {/* Search icon */}
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
          stroke="var(--ink-mute)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
          style={{ position: "absolute", left: 10, top: 11, pointerEvents: "none" }}
          aria-hidden="true">
          <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
        </svg>
        <input
          type="text"
          value={searchInput}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          aria-label={tr("Search tasks and filter options")}
          title={tr("Searches task cards and narrows filter options (labels, assignees, priority, …)")}
          className="multi-filter__search"
          style={{
            width: 320, maxWidth: "100%", padding: "8px 96px 8px 32px", fontSize: 13,
            background: "var(--surface)",
            borderWidth: 1, borderStyle: "solid", borderColor: "var(--rule)",
            borderRadius: "var(--r-sm)", color: "var(--ink)",
            outline: "none", fontFamily: "var(--sans)",
          }}
        />
        <button
          type="button"
          ref={triggerRef}
          onClick={() => setOpen((o) => !o)}
          aria-label={tr("Filters")}
          aria-expanded={open}
          style={{
            position: "absolute", right: 4, top: 4, bottom: 4,
            display: "inline-flex", alignItems: "center", gap: 4,
            padding: "0 10px", fontSize: 11, fontFamily: "var(--mono)",
            letterSpacing: "0.06em", textTransform: "uppercase",
            background: activeCount > 0 ? "var(--green-wash)" : "var(--surface-sunk)",
            color: activeCount > 0 ? "var(--green-deep)" : "var(--ink-soft)",
            borderWidth: 0,
            borderLeftWidth: 1, borderLeftStyle: "solid", borderLeftColor: "var(--rule)",
            cursor: "pointer",
          }}
        >
          {tr("FILTERS")}
          {activeCount > 0 && (
            <span style={{
              minWidth: 18, height: 18, padding: "0 5px", borderRadius: 999,
              background: "var(--green-deep)", color: "var(--surface)",
              fontSize: 10, fontFamily: "var(--mono)", fontWeight: 600,
              display: "inline-flex", alignItems: "center", justifyContent: "center",
            }}>{activeCount}</span>
          )}
          <svg width="9" height="6" viewBox="0 0 10 6" fill="none" aria-hidden="true">
            <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {open && popoverPos && typeof document !== "undefined" && createPortal(
        <div
          ref={popoverRef}
          className="custom-select-dropdown"
          style={{
            position: "fixed",
            top: popoverPos.top,
            left: popoverPos.left,
            width: POPOVER_W,
            background: "var(--surface)",
            borderWidth: 1, borderStyle: "solid", borderColor: "var(--rule)",
            borderRadius: "var(--r-sm)", boxShadow: "var(--shadow-md)",
            // Above the fixed MahAcharya chat widget (z-60); matches CustomSelect.
            zIndex: 2000,
            // Cap to viewport space below the toolbar so the popover never runs
            // off the bottom of the board; it scrolls internally past that.
            maxHeight: popoverPos.maxHeight, overflowY: "auto",
            padding: "12px 14px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{
              fontFamily: "var(--mono)", fontSize: 10, letterSpacing: "0.12em",
              textTransform: "uppercase", color: "var(--ink-mute)",
            }}>{tr("Filters")}</span>
            <button
              type="button"
              onClick={clearAll}
              disabled={activeCount === 0}
              title={tr("Uncheck all filters")}
              style={{
                fontFamily: "var(--mono)", fontSize: 10, letterSpacing: "0.06em",
                textTransform: "uppercase",
                background: "transparent",
                color: activeCount > 0 ? "var(--green-deep)" : "var(--ink-mute)",
                borderWidth: 0, padding: 0,
                cursor: activeCount > 0 ? "pointer" : "default",
                opacity: activeCount > 0 ? 1 : 0.5,
              }}
            >{tr("Uncheck all")}</button>
          </div>

          {optionQuery ? (
            <div style={{
              marginBottom: 10, padding: "6px 8px",
              background: "var(--green-wash)", borderRadius: "var(--r-sm)",
              fontSize: 11, fontFamily: "var(--sans)", color: "var(--green-deep)",
            }}>
              {tr("Showing filter options matching “")}{searchInput.trim()}&rdquo;
            </div>
          ) : null}

          {onMatchModeChange && (
            <FilterSection label={tr("Match")}>
              <div style={{ display: "flex", gap: 4 }}>
                {(["all", "any"] as const).map((m) => {
                  const isSelected = m === matchMode;
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => onMatchModeChange(m)}
                      style={{
                        flex: 1, textAlign: "center",
                        padding: "6px 8px", fontSize: 12, fontFamily: "var(--sans)",
                        background: isSelected ? "var(--green-wash)" : "transparent",
                        color: isSelected ? "var(--green-deep)" : "var(--ink-soft)",
                        fontWeight: isSelected ? 600 : 400,
                        borderWidth: 1, borderStyle: "solid",
                        borderColor: isSelected ? "var(--green-deep)" : "var(--rule)",
                        borderRadius: "var(--r-sm)", cursor: "pointer",
                      }}
                    >
                      {tr("Match")} {m === "all" ? "all" : "any"}
                    </button>
                  );
                })}
              </div>
            </FilterSection>
          )}

          {visibleSections.length === 0 ? (
            <div style={{ padding: "10px 4px", fontSize: 12, color: "var(--ink-mute)" }}>
              {tr("No filters match “")}{searchInput.trim()}&rdquo;
            </div>
          ) : (
            visibleSections.map((cfg) => (
              // Key includes query so option lists remount when search changes
              // (avoids stale portal content when narrowing options).
              <FilterSectionRenderer
                key={`${cfg.key}:${optionQuery}`}
                cfg={cfg}
                optionQuery={optionQuery}
                onOptionPicked={clearSearchAfterPick}
              />
            ))
          )}
        </div>,
        document.body,
      )}
    </div>
  );
}

function FilterSectionRenderer({
  cfg,
  optionQuery,
  onOptionPicked,
}: {
  cfg: FilterSectionConfig;
  optionQuery: string;
  onOptionPicked?: () => void;
}) {
  const tr = useTr();
  if (cfg.type === "checklist") {
    const handleToggleClick = () => {
      if (!cfg.toggle) return;
      const next = !cfg.toggle.checked;
      cfg.toggle.onChange(next);
      if (next) {
        cfg.onChange([]);
        onOptionPicked?.();
      }
    };
    const handleChecklistChange = (next: string[]) => {
      if (cfg.toggle && next.length > 0 && cfg.toggle.checked) cfg.toggle.onChange(false);
      const added = next.some((v) => !cfg.value.includes(v));
      cfg.onChange(next);
      if (added) onOptionPicked?.();
    };
    const filteredOptions = filterOptionsBySearch(cfg.options, cfg.value, optionQuery);
    // Hide the "Assigned to me" style toggle when search doesn't match its label
    // (unless it is already on — active filters always stay visible).
    const showToggle = !!cfg.toggle && (
      !optionQuery
      || cfg.toggle.checked
      || labelMatchesQuery(cfg.toggle.label, optionQuery)
    );
    return (
      <FilterSection label={cfg.label} divider={cfg.divider}>
        {showToggle && cfg.toggle && (
          <button
            type="button"
            onClick={handleToggleClick}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              width: "100%", textAlign: "left",
              padding: "6px 8px", fontSize: 12, fontFamily: "var(--sans)",
              background: cfg.toggle.checked ? "var(--green-wash)" : "transparent",
              color: cfg.toggle.checked ? "var(--green-deep)" : "var(--ink-soft)",
              fontWeight: cfg.toggle.checked ? 600 : 500,
              borderWidth: 0, cursor: "pointer", marginBottom: 4,
            }}
          >
            <span style={{
              width: 14, height: 14, flexShrink: 0,
              borderWidth: 1, borderStyle: "solid",
              borderColor: cfg.toggle.checked ? "var(--green-deep)" : "var(--rule-strong)",
              background: cfg.toggle.checked ? "var(--green-deep)" : "transparent",
              borderRadius: 3,
              display: "inline-flex", alignItems: "center", justifyContent: "center",
            }}>
              {cfg.toggle.checked && (
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                  <path d="M2 5l2 2 4-4" stroke="#f4efdf" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </span>
            {tr(cfg.toggle.label)}
          </button>
        )}
        <CheckList
          values={cfg.value}
          onChange={handleChecklistChange}
          options={filteredOptions}
          emptyText={
            optionQuery && cfg.options.length > 0
              ? `No options match “${optionQuery}”`
              : cfg.emptyText
          }
        />
      </FilterSection>
    );
  }

  if (cfg.type === "radio") {
    const filteredOptions = filterOptionsBySearch(
      cfg.options,
      cfg.value ? [cfg.value] : [],
      optionQuery,
    );
    return (
      <FilterSection label={cfg.label} divider={cfg.divider}>
        <RadioList
          value={cfg.value}
          onChange={(v) => {
            cfg.onChange(v);
            onOptionPicked?.();
          }}
          options={filteredOptions}
        />
      </FilterSection>
    );
  }

  if (cfg.type === "daterange") {
    const options = cfg.options ?? DATE_RANGE_OPTIONS;
    const filteredOptions = filterOptionsBySearch(
      options,
      cfg.value ? [cfg.value] : [],
      optionQuery,
    );
    return (
      <FilterSection label={cfg.label} divider={cfg.divider}>
        <RadioList
          value={cfg.value}
          onChange={(v) => {
            cfg.onChange(v);
            onOptionPicked?.();
          }}
          options={filteredOptions}
        />
        {cfg.value === "custom" && (
          <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <DatePicker
                value={cfg.customFrom}
                onChange={cfg.onCustomFromChange}
                max={cfg.customTo || undefined}
                placeholder={tr("From")}
              />
            </div>
            <span style={{ fontSize: 11, color: "var(--ink-mute)", flexShrink: 0 }}>to</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <DatePicker
                value={cfg.customTo}
                onChange={cfg.onCustomToChange}
                min={cfg.customFrom || undefined}
                placeholder={tr("To")}
              />
            </div>
          </div>
        )}
      </FilterSection>
    );
  }

  // cfg.type === "toggle"
  return (
    <FilterSection label={cfg.label} divider={cfg.divider}>
      <button
        type="button"
        onClick={() => {
          const next = !cfg.checked;
          cfg.onChange(next);
          if (next) onOptionPicked?.();
        }}
        style={{
          display: "flex", alignItems: "center", gap: 8,
          width: "100%", textAlign: "left",
          padding: "6px 8px", fontSize: 12, fontFamily: "var(--sans)",
          background: cfg.checked ? "var(--green-wash)" : "transparent",
          color: cfg.checked ? "var(--green-deep)" : "var(--ink-soft)",
          fontWeight: cfg.checked ? 600 : 500,
          borderWidth: 0, cursor: "pointer",
        }}
      >
        <span style={{
          width: 14, height: 14, flexShrink: 0,
          borderWidth: 1, borderStyle: "solid",
          borderColor: cfg.checked ? "var(--green-deep)" : "var(--rule-strong)",
          background: cfg.checked ? "var(--green-deep)" : "transparent",
          borderRadius: 3,
          display: "inline-flex", alignItems: "center", justifyContent: "center",
        }}>
          {cfg.checked && (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
              <path d="M2 5l2 2 4-4" stroke="#f4efdf" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </span>
        {tr(cfg.toggleLabel)}
      </button>
    </FilterSection>
  );
}

function RadioList<T extends string>({
  value, onChange, options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  const tr = useTr();
  return (
    <div style={{ display: "grid", gap: 2 }}>
      {options.map((opt) => {
        const isSelected = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              width: "100%", textAlign: "left",
              padding: "6px 8px", fontSize: 12, fontFamily: "var(--sans)",
              background: isSelected ? "var(--green-wash)" : "transparent",
              color: isSelected ? "var(--green-deep)" : "var(--ink-soft)",
              fontWeight: isSelected ? 600 : 400,
              borderWidth: 0, cursor: "pointer",
            }}
          >
            <span style={{
              width: 12, height: 12, borderRadius: "50%", flexShrink: 0,
              borderWidth: 1, borderStyle: "solid",
              borderColor: isSelected ? "var(--green-deep)" : "var(--rule-strong)",
              background: isSelected ? "var(--green-deep)" : "transparent",
            }} />
            {tr(opt.label)}
          </button>
        );
      })}
    </div>
  );
}

// ─── FilterSection ────────────────────────────────────────────────────────────
export function FilterSection({
  label, divider, children,
}: {
  label: string;
  divider?: boolean;
  children: React.ReactNode;
}) {
  const tr = useTr();
  return (
    <div style={{ marginBottom: 10 }}>
      {divider && (
        <div style={{
          borderTopWidth: 1, borderTopStyle: "solid", borderTopColor: "var(--rule)",
          margin: "0 -14px 10px -14px",
        }} />
      )}
      <div style={{
        fontFamily: "var(--mono)", fontSize: 10, letterSpacing: "0.08em",
        textTransform: "uppercase", color: "var(--ink-mute)", marginBottom: 4,
      }}>
        {tr(label)}
      </div>
      {children}
    </div>
  );
}

// ─── CheckList ────────────────────────────────────────────────────────────────
export function CheckList({
  values, onChange, options, emptyText,
}: {
  values: string[];
  onChange: (v: string[]) => void;
  options: { value: string; label: string }[];
  emptyText?: string;
}) {
  const tr = useTr();
  function toggle(v: string) {
    if (values.includes(v)) onChange(values.filter((x) => x !== v));
    else onChange([...values, v]);
  }

  if (options.length === 0) {
    return (
      <div style={{ padding: "6px 4px", fontSize: 12, color: "var(--ink-mute)" }}>
        {emptyText || tr("No options")}
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 2, maxHeight: 160, overflowY: "auto" }}>
      {options.map((opt) => {
        const isSelected = values.includes(opt.value);
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => toggle(opt.value)}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              width: "100%", textAlign: "left",
              padding: "6px 8px", fontSize: 12, fontFamily: "var(--sans)",
              background: isSelected ? "var(--green-wash)" : "transparent",
              color: isSelected ? "var(--green-deep)" : "var(--ink-soft)",
              fontWeight: isSelected ? 600 : 400,
              borderWidth: 0, cursor: "pointer",
            }}
          >
            <span style={{
              width: 14, height: 14, flexShrink: 0,
              borderWidth: 1, borderStyle: "solid",
              borderColor: isSelected ? "var(--green-deep)" : "var(--rule-strong)",
              background: isSelected ? "var(--green-deep)" : "transparent",
              borderRadius: 3,
              display: "inline-flex", alignItems: "center", justifyContent: "center",
            }}>
              {isSelected && (
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                  <path d="M2 5l2 2 4-4" stroke="#f4efdf" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </span>
            {tr(opt.label)}
          </button>
        );
      })}
    </div>
  );
}
