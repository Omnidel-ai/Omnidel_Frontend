import { useRef, type KeyboardEvent } from "react";
import { MobileIcon, type MobileIconName } from "./Icon";

export interface SegmentedTab {
  key: string;
  label: string;
  icon?: MobileIconName;
  count?: number;
}

export interface SegmentedTabsProps {
  tabs: SegmentedTab[];
  active: string;
  onChange: (key: string) => void;
  ariaLabel: string;
  /**
   * `solid` — Kaarigar's lane tabs (PR #207): the selected tab fills dark green.
   * `plate` — Contractor's task tabs: the selected tab lifts onto a light plate.
   */
  variant?: "solid" | "plate";
  /** Id prefix for `aria-controls` — pass it if the panels carry `${idPrefix}-${key}` ids. */
  idPrefix?: string;
}

/**
 * Equal-width tabs on a sunken track, with optional icon and count.
 *
 * Kaarigar: `LaneTabs` (To do / Doing / Review / Done, each with a count) and
 * the task screen's section tabs (Task / Chat / Quiz / Learn / Comments with
 * icons). Contractor: the task and approval screens' Notes / Files / Activity
 * tabs with counts. The desktop `SubTabs` takes plain strings and has no icon
 * or mobile sizing, so it is not reused here.
 *
 * Arrow keys move between tabs and Home/End jump to the ends, as a tablist
 * should.
 */
export function SegmentedTabs({ tabs, active, onChange, ariaLabel, variant = "solid", idPrefix }: SegmentedTabsProps) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  const onKey = (e: KeyboardEvent, index: number) => {
    const last = tabs.length - 1;
    const next = e.key === "ArrowRight" ? (index === last ? 0 : index + 1)
      : e.key === "ArrowLeft" ? (index === 0 ? last : index - 1)
      : e.key === "Home" ? 0
      : e.key === "End" ? last
      : -1;
    if (next < 0) return;
    e.preventDefault();
    onChange(tabs[next].key);
    refs.current[next]?.focus();
  };

  return (
    // Four or more tabs with icons can't fit icon + label + count side by side
    // on a phone, so a dense strip stacks the icon over the label.
    <div role="tablist" aria-label={ariaLabel} className={`am-tabs am-tabs--${variant}`} data-dense={tabs.length >= 5 || (tabs.length >= 4 && tabs.some((t) => t.icon)) ? "" : undefined}>
      {tabs.map((tab, i) => {
        const selected = tab.key === active;
        return (
          <button
            key={tab.key}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={idPrefix ? `${idPrefix}-tab-${tab.key}` : undefined}
            aria-controls={idPrefix ? `${idPrefix}-${tab.key}` : undefined}
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            className="am-tab am-press"
            onClick={() => onChange(tab.key)}
            onKeyDown={(e) => onKey(e, i)}
          >
            {tab.icon && <MobileIcon name={tab.icon} size={16} />}
            <span className="am-tab__label">{tab.label}</span>
            {tab.count !== undefined && <span className="am-tab__count">{tab.count}</span>}
          </button>
        );
      })}
    </div>
  );
}
