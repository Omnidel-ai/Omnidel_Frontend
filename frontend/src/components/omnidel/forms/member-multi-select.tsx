"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { useTr } from "@/lib/client/language";

/** Matches `TaskFormUserOption.role` from GET /api/omnipulse/tasks/options. */
export type MemberRole = {
  id: string;
  slug: string;
  name: string;
};

/**
 * Member option for the multi-select.
 * Task callers may pass only `{ id, name }`. Project create / guest editors pass
 * the real tasks/options fields: primary_workspace_id/name + role.
 */
export interface MemberOption {
  id: string;
  name: string;
  primary_workspace_id?: string | null;
  primary_workspace_name?: string | null;
  role?: MemberRole | null;
}

/** Shape of `optionsData.users[]` from GET /api/omnipulse/tasks/options. */
export type MemberOptionInput = {
  id: string;
  name?: string | null;
  primary_workspace_id?: string | null;
  primary_workspace_name?: string | null;
  role?: MemberRole | null;
};

export const NO_PRIMARY_TEAM_LABEL = "No primary team";
const NO_PRIMARY_TEAM_KEY = "__no_primary_team__";
const MISSING_META = "—";

/** Map API user rows into MemberOption (real Backend Phase 1 fields). */
export function normalizeMemberOption(raw: MemberOptionInput): MemberOption {
  const role =
    raw.role && typeof raw.role === "object" && raw.role.id
      ? {
          id: raw.role.id,
          slug: raw.role.slug || "",
          name: raw.role.name || "",
        }
      : null;
  return {
    id: raw.id,
    name: (raw.name || "").trim() || "Unknown user",
    primary_workspace_id: raw.primary_workspace_id || null,
    primary_workspace_name: raw.primary_workspace_name?.trim() || null,
    role,
  };
}

export function normalizeMemberOptions(raw: MemberOptionInput[] | undefined | null): MemberOption[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((u) => !!u?.id).map(normalizeMemberOption);
}

type MemberGroup = {
  key: string;
  label: string;
  members: MemberOption[];
};

function primaryTeamGroupKey(o: MemberOption): string {
  return o.primary_workspace_id || NO_PRIMARY_TEAM_KEY;
}

function primaryTeamGroupLabel(o: MemberOption): string {
  if (!o.primary_workspace_id) return NO_PRIMARY_TEAM_LABEL;
  return o.primary_workspace_name?.trim() || MISSING_META;
}

function roleLabel(o: MemberOption): string {
  const name = o.role?.name?.trim();
  if (name) return name;
  const slug = o.role?.slug?.trim();
  if (slug) return slug;
  return MISSING_META;
}

/** Tooltip / aria full string: `name · team · role` (em dashes when missing). */
export function formatMemberRowLabel(o: MemberOption): string {
  return `${o.name} · ${formatMemberRowMeta(o)}`;
}

/**
 * Compact row meta (right side): `primary_workspace_name · role`
 * (`— · role` / `team · —` / `— · —` when parts missing).
 */
export function formatMemberRowMeta(o: MemberOption): string {
  const team = o.primary_workspace_name?.trim() || MISSING_META;
  return `${team} · ${roleLabel(o)}`;
}

/**
 * Unique non-empty selected ids — single source of truth for chips + sticky count.
 * Defensive against duplicate / empty entries from parent state.
 */
export function uniqueSelectedIds(value: string[] | null | undefined): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of value) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

function groupByPrimaryTeam(options: MemberOption[]): MemberGroup[] {
  const map = new Map<string, MemberOption[]>();
  for (const o of options) {
    const key = primaryTeamGroupKey(o);
    const list = map.get(key);
    if (list) list.push(o);
    else map.set(key, [o]);
  }
  const groups: MemberGroup[] = [...map.entries()].map(([key, members]) => {
    const sorted = [...members].sort((a, b) => a.name.localeCompare(b.name));
    return {
      key,
      label: primaryTeamGroupLabel(sorted[0]),
      members: sorted,
    };
  });
  groups.sort((a, b) => {
    if (a.key === NO_PRIMARY_TEAM_KEY) return 1;
    if (b.key === NO_PRIMARY_TEAM_KEY) return -1;
    return a.label.localeCompare(b.label);
  });
  return groups;
}

/** Public alias for tests / callers that need the same grouping rules. */
export function groupMembersByPrimaryTeam(options: MemberOption[]): MemberGroup[] {
  return groupByPrimaryTeam(options);
}

function memberMatchesQuery(o: MemberOption, q: string): boolean {
  if (!q) return true;
  const hay = [
    o.name,
    o.primary_workspace_name || "",
    o.role?.name || "",
    o.role?.slug || "",
  ].join(" ").toLowerCase();
  return hay.includes(q);
}

// Multi-member picker: selected members render as removable chips; a searchable
// dropdown toggles membership. Used by the task create + detail modals + bulk bar.
// Project create / guest editors can pass `groupByPrimaryTeam` for collapsible
// Primary Team sections (task callers stay flat when they omit it).
export function MemberMultiSelect({
  value,
  onChange,
  options,
  placeholder,
  disabled,
  preferOpenUpward,
  chipColumns,
  splitLabel,
  groupByPrimaryTeam: groupByPrimaryTeamProp = false,
  showSelectedCount,
  lockedIds,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  options: MemberOption[];
  placeholder?: string;
  disabled?: boolean;
  /** Open the menu above the trigger (bulk bar sits at the viewport bottom). */
  preferOpenUpward?: boolean;
  /** When set (e.g. 2), chips lay out in a fixed-column grid instead of a tall stack. */
  chipColumns?: number;
  /** When selected: keep placeholder as a left label, chips/value on the right. */
  splitLabel?: boolean;
  /**
   * When true, list options under collapsible Primary Team headings with
   * per-group counts. Each person appears once under their primary team only.
   * Task assignee pickers should leave this false.
   */
  groupByPrimaryTeam?: boolean;
  /**
   * Sticky "N selected" bar in the dropdown. Defaults to on when grouping.
   * Count stays visible while the option list scrolls.
   */
  showSelectedCount?: boolean;
  /**
   * Ids that cannot be deselected (e.g. project creator on Selected Members).
   * Still shown as selected chips / checked rows; toggle and chip × are no-ops.
   */
  lockedIds?: string[];
}) {
  const tr = useTr();
  const groupMode = !!groupByPrimaryTeamProp;
  const stickyCount = showSelectedCount ?? groupMode;

  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => new Set());
  const ref = useRef<HTMLDivElement>(null);
  // Same reason as CustomSelect: the menu is portaled to <body> with
  // position:fixed off the trigger's rect. An absolute menu gets clipped by any
  // ancestor with overflow:auto/hidden — e.g. the New/Edit project modal card,
  // which is maxHeight:90vh + overflowY:auto.
  const popoverRef = useRef<HTMLDivElement>(null);
  const [popoverPos, setPopoverPos] = useState<{
    top: number; left: number; width: number; maxHeight: number;
  } | null>(null);

  const preferredMaxHeight = groupMode ? 340 : 260;

  // Chips + sticky count share this list so they cannot diverge (duplicate ids
  // in `value` would otherwise make React chip keys collide while length lied).
  const selectedIds = useMemo(() => uniqueSelectedIds(value), [value]);
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const lockedIdSet = useMemo(
    () => new Set((lockedIds || []).filter(Boolean)),
    [lockedIds],
  );

  useLayoutEffect(() => {
    if (!open || !ref.current) {
      setPopoverPos(null);
      return;
    }
    const gap = 4;
    const searchHeight = stickyCount ? 68 : 35;
    // Group mode rows are single-line (name | team · role); match flat row height.
    const estimatedRowHeight = 31;

    function updatePos() {
      if (!ref.current) return;
      const r = ref.current.getBoundingClientRect();
      const measuredHeight = popoverRef.current?.offsetHeight;
      const menuHeight =
        measuredHeight ??
        Math.min(options.length * estimatedRowHeight + searchHeight, preferredMaxHeight);
      const spaceBelow = window.innerHeight - r.bottom - gap;
      const spaceAbove = r.top - gap;
      const openUpward = preferOpenUpward || (menuHeight > spaceBelow && spaceAbove > spaceBelow);
      const availableSpace = (openUpward ? spaceAbove : spaceBelow) - 8;
      const maxHeight = Math.min(preferredMaxHeight, Math.max(availableSpace, 160));
      // Keep the menu inside the viewport horizontally (mobile create modal).
      const width = Math.min(r.width, window.innerWidth - 16);
      const left = Math.min(Math.max(8, r.left), window.innerWidth - width - 8);
      const top = openUpward ? r.top - Math.min(menuHeight, maxHeight) - gap : r.bottom + gap;
      setPopoverPos({ top, left, width, maxHeight });
    }
    updatePos();
    requestAnimationFrame(updatePos);
    window.addEventListener("scroll", updatePos, true);
    window.addEventListener("resize", updatePos);
    return () => {
      window.removeEventListener("scroll", updatePos, true);
      window.removeEventListener("resize", updatePos);
    };
  }, [open, options.length, preferOpenUpward, preferredMaxHeight, groupMode, stickyCount]);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      if (ref.current && ref.current.contains(t)) return;
      if (popoverRef.current && popoverRef.current.contains(t)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
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

  useEffect(() => {
    if (!open) {
      setQ("");
      setCollapsedGroups(new Set());
    }
  }, [open]);

  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  const byId = useMemo(() => new Map(options.map((o) => [o.id, o])), [options]);
  // Keep chips for every selected id even when the option list is still
  // loading or the person is not on the board-scoped roster — otherwise the
  // control flashes "Unassigned" despite a non-empty `value` (deep-link open
  // before members arrive, orphaned assignees, etc.).
  const selected: MemberOption[] = useMemo(
    () => selectedIds.map((id) => byId.get(id) ?? { id, name: "Unknown user" }),
    [selectedIds, byId],
  );

  const qNorm = q.trim().toLowerCase();
  const filtered = useMemo(
    () => options.filter((o) => memberMatchesQuery(o, qNorm)),
    [options, qNorm],
  );

  const groups = useMemo(
    () => (groupMode ? groupByPrimaryTeam(filtered) : []),
    [groupMode, filtered],
  );

  function toggle(id: string) {
    if (disabled) return;
    if (selectedIdSet.has(id)) {
      if (lockedIdSet.has(id)) return;
      onChange(selectedIds.filter((x) => x !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  }

  function toggleGroupCollapsed(key: string) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const cols = chipColumns && chipColumns > 0 ? chipColumns : null;
  const useSplit = !!(splitLabel && selected.length > 0 && placeholder);
  const triggerStyle: CSSProperties = useSplit
    ? {
        ...controlStyle,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 10,
        paddingRight: 28,
        height: "100%",
        boxSizing: "border-box",
        position: "relative",
      }
    : cols
    ? {
        ...controlStyle,
        display: "grid",
        gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
        alignItems: "center",
        alignContent: "center",
        paddingRight: 28,
        height: "100%",
        boxSizing: "border-box",
      }
    : { ...controlStyle, height: "100%", boxSizing: "border-box" };

  function renderRow(o: MemberOption) {
    const on = selectedIdSet.has(o.id);
    const fullLabel = formatMemberRowLabel(o);
    const meta = groupMode ? formatMemberRowMeta(o) : null;
    return (
      <button
        key={o.id}
        type="button"
        onClick={() => toggle(o.id)}
        aria-pressed={on}
        aria-label={groupMode ? fullLabel : o.name}
        title={groupMode ? fullLabel : undefined}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          width: "100%",
          textAlign: "left",
          padding: "7px 10px",
          fontSize: 13,
          cursor: "pointer",
          borderWidth: 0,
          background: on ? "var(--green-wash)" : "transparent",
          color: on ? "var(--green-deep)" : "var(--ink-soft)",
          fontWeight: on ? 600 : 400,
          fontFamily: "var(--sans)",
          minWidth: 0,
          boxSizing: "border-box",
        }}
      >
        <span
          aria-hidden="true"
          style={{
            width: 14,
            height: 14,
            flexShrink: 0,
            borderRadius: 3,
            borderWidth: 1,
            borderStyle: "solid",
            borderColor: on ? "var(--green-deep)" : "var(--rule-strong)",
            background: on ? "var(--green-deep)" : "transparent",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {on && (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
              <path d="M2 5l2 2 4-4" stroke="var(--avatar-fg)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </span>
        <span
          style={{
            flex: 1,
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {o.name}
        </span>
        {meta && (
          <span
            style={{
              flexShrink: 1,
              maxWidth: "48%",
              marginLeft: 4,
              fontSize: 11,
              fontWeight: 400,
              color: "var(--ink-mute)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              textAlign: "right",
              lineHeight: 1.3,
            }}
          >
            {meta}
          </span>
        )}
      </button>
    );
  }

  return (
    <div
      ref={ref}
      style={{
        position: "relative",
        height: "100%",
        opacity: disabled ? 0.45 : 1,
        pointerEvents: disabled ? "none" : "auto",
        minWidth: 0,
        maxWidth: "100%",
      }}
    >
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        onClick={() => { if (!disabled) setOpen((o) => !o); }}
        onKeyDown={(e) => {
          if (disabled) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen((o) => !o);
          }
        }}
        style={triggerStyle}
        aria-disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        title={useSplit ? `${placeholder}: ${selected.map((s) => s.name).join(", ")}` : undefined}
      >
        {useSplit ? (
          <>
            <span style={{
              color: "var(--ink-mute)", fontSize: 13, fontWeight: 500,
              flexShrink: 0, whiteSpace: "nowrap", paddingTop: 4,
            }}>
              {placeholder}
            </span>
            <div style={{
              display: "flex", flexWrap: "wrap", gap: 5, justifyContent: "flex-end",
              minWidth: 0, flex: 1,
            }}>
              {selected.map((s) => (
                <span key={s.id} style={{ ...chipStyle, minWidth: 0, maxWidth: "100%" }}>
                  <span style={dotStyle} />
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}>{s.name}</span>
                  {!lockedIdSet.has(s.id) && (
                    <span
                      role="button"
                      tabIndex={0}
                      aria-label={`Remove ${s.name}`}
                      onClick={(e) => { e.stopPropagation(); toggle(s.id); }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          e.stopPropagation();
                          toggle(s.id);
                        }
                      }}
                      style={chipRemoveStyle}
                    >×</span>
                  )}
                </span>
              ))}
            </div>
          </>
        ) : (
          <>
            {selected.length === 0 && (
              <span style={{
                color: "var(--ink-mute)", fontSize: 13,
                ...(cols ? { gridColumn: "1 / -1" } : null),
              }}>
                {placeholder || tr("Unassigned")}
              </span>
            )}
            {selected.map((s) => (
              <span key={s.id} style={{ ...chipStyle, minWidth: 0, maxWidth: "100%" }}>
                <span style={dotStyle} />
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}>{s.name}</span>
                {!lockedIdSet.has(s.id) && (
                  <span
                    role="button"
                    tabIndex={0}
                    aria-label={`Remove ${s.name}`}
                    onClick={(e) => { e.stopPropagation(); toggle(s.id); }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        e.stopPropagation();
                        toggle(s.id);
                      }
                    }}
                    style={chipRemoveStyle}
                  >×</span>
                )}
              </span>
            ))}
          </>
        )}
        <svg
          width="10" height="6" viewBox="0 0 10 6" fill="none" aria-hidden="true"
          style={useSplit || cols
            ? { position: "absolute", right: 10, top: 14, flexShrink: 0 }
            : { marginLeft: "auto", flexShrink: 0 }}
        >
          <path d="M1 1l4 4 4-4" stroke="var(--ink-mute)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      {open && popoverPos && typeof document !== "undefined" && createPortal(
        <div
          ref={popoverRef}
          className="custom-select-dropdown"
          role="listbox"
          aria-multiselectable="true"
          aria-label={tr("Members")}
          style={{
            ...dropdownStyle,
            top: popoverPos.top,
            left: popoverPos.left,
            width: popoverPos.width,
            maxHeight: popoverPos.maxHeight,
            maxWidth: "calc(100vw - 16px)",
          }}
        >
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={tr("Search members…")}
            autoFocus
            aria-label={tr("Search members")}
            style={searchStyle}
          />
          {stickyCount && (
            <div
              aria-live="polite"
              aria-label={`Selected ${selectedIds.length}`}
              style={selectedCountStyle}
            >
              <span style={{ fontFamily: "var(--mono)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase" }}>
                {tr("Selected")}
              </span>
              <span style={{ fontWeight: 600, color: "var(--ink-soft)" }}>
                {selectedIds.length}
              </span>
            </div>
          )}
          <div className="custom-select-dropdown" style={{ overflowY: "auto", overflowX: "hidden", minHeight: 0 }}>
            {filtered.length === 0 && (
              <div style={{ padding: "8px 10px", fontSize: 12, color: "var(--ink-mute)" }}>{tr("No members")}</div>
            )}
            {groupMode
              ? groups.map((g) => {
                  // While searching, force groups open so matches are reachable.
                  const collapsed = !qNorm && collapsedGroups.has(g.key);
                  const selectedInGroup = g.members.reduce(
                    (n, m) => n + (selectedIdSet.has(m.id) ? 1 : 0),
                    0,
                  );
                  return (
                    <div key={g.key} style={{ borderBottom: "1px solid var(--rule)" }}>
                      <button
                        type="button"
                        onClick={() => toggleGroupCollapsed(g.key)}
                        aria-expanded={!collapsed}
                        style={groupHeaderStyle}
                      >
                        <svg
                          width="10" height="10" viewBox="0 0 24 24" fill="none"
                          stroke="var(--ink-mute)" strokeWidth="2"
                          strokeLinecap="round" strokeLinejoin="round"
                          aria-hidden="true"
                          style={{
                            flexShrink: 0,
                            transform: collapsed ? "rotate(0deg)" : "rotate(90deg)",
                            transition: "transform 160ms ease-out",
                          }}
                        >
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
                        <span style={{
                          flex: 1, minWidth: 0, overflow: "hidden",
                          textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>
                          {g.label}
                        </span>
                        <span style={groupCountStyle} title={`${g.members.length} people`}>
                          {g.members.length}
                          {selectedInGroup > 0 ? ` · ${selectedInGroup}` : ""}
                        </span>
                      </button>
                      {!collapsed && g.members.map(renderRow)}
                    </div>
                  );
                })
              : filtered.map(renderRow)}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}

const controlStyle: CSSProperties = {
  display: "flex", alignItems: "center", flexWrap: "wrap", gap: 5,
  minHeight: 38, padding: "5px 10px", cursor: "pointer",
  background: "var(--page)", borderWidth: 1, borderStyle: "solid", borderColor: "var(--rule-strong)",
  borderRadius: "var(--r-sm)",
  minWidth: 0,
  maxWidth: "100%",
};

const chipStyle: CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 5,
  padding: "2px 4px 2px 8px", borderRadius: 999,
  background: "var(--surface-sunk)", color: "var(--ink-soft)",
  fontSize: 12, fontFamily: "var(--sans)", whiteSpace: "nowrap",
};

const dotStyle: CSSProperties = {
  width: 6, height: 6, borderRadius: "50%", background: "var(--green-deep)", flexShrink: 0,
};

const chipRemoveStyle: CSSProperties = {
  display: "inline-flex", alignItems: "center", justifyContent: "center",
  width: 16, height: 16, borderRadius: "50%", cursor: "pointer",
  color: "var(--ink-mute)", fontSize: 13, lineHeight: 1,
};

const dropdownStyle: CSSProperties = {
  position: "fixed",
  // Matches CustomSelect so a member menu opened over a select menu wins.
  zIndex: 2600,
  boxSizing: "border-box",
  display: "flex", flexDirection: "column",
  background: "var(--surface)", borderWidth: 1, borderStyle: "solid", borderColor: "var(--rule)",
  borderRadius: "var(--r-sm)", boxShadow: "var(--shadow-md)", overflow: "hidden",
};

const searchStyle: CSSProperties = {
  width: "100%", flexShrink: 0, boxSizing: "border-box",
  padding: "8px 10px", fontSize: 13, border: "none",
  borderBottom: "1px solid var(--rule)", background: "var(--page)", color: "var(--ink)",
  outline: "none", fontFamily: "var(--sans)",
};

const selectedCountStyle: CSSProperties = {
  flexShrink: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
  padding: "6px 10px",
  borderBottom: "1px solid var(--rule)",
  background: "var(--surface-sunk)",
  color: "var(--ink-mute)",
  fontSize: 12,
  fontFamily: "var(--sans)",
};

const groupHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  width: "100%",
  textAlign: "left",
  padding: "7px 10px",
  borderWidth: 0,
  cursor: "pointer",
  background: "var(--page)",
  color: "var(--ink-mute)",
  fontFamily: "var(--mono)",
  fontSize: 10,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  boxSizing: "border-box",
  minWidth: 0,
};

const groupCountStyle: CSSProperties = {
  flexShrink: 0,
  minWidth: 18,
  textAlign: "center",
  fontFamily: "var(--mono)",
  fontSize: 10,
  lineHeight: 1.6,
  padding: "0 6px",
  borderRadius: 999,
  background: "var(--surface-sunk)",
  color: "var(--ink-mute)",
};
