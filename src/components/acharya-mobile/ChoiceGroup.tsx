import { useRef, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { MobileIcon } from "./Icon";

export interface Choice<V extends string = string> {
  value: V;
  label: string;
  /** Large sample above the label — the "Aa" of a text-size option. */
  preview?: ReactNode;
  previewStyle?: CSSProperties;
  /** A short code on the right of a list option — "HI", "EN". */
  code?: string;
}

export interface ChoiceGroupProps<V extends string = string> {
  options: Choice<V>[];
  value: V;
  onChange: (value: V) => void;
  ariaLabel: string;
  /**
   * `list` — one option per row with a tick (language, in both apps).
   * `grid` — equal tiles with a preview (text size, in both apps).
   * `pill` — a single pill track, the selected option filled (Kaarigar's settings, PR #207).
   */
  layout?: "list" | "grid" | "pill";
  /** Columns for `grid`. Defaults to the number of options. */
  columns?: number;
}

/**
 * Pick exactly one — a real `radiogroup`.
 *
 * Both apps' Settings pick text size and language this way. Contractor uses
 * three "Aa" tiles plus a list of languages. Kaarigar (PR #207) uses a
 * pill-track text size and, for language, its `SearchableSelect pill`. Only the
 * shape varies, so the shape is `layout`. Arrow keys move the selection, as in
 * a native radio group.
 */
export function ChoiceGroup<V extends string = string>({ options, value, onChange, ariaLabel, layout = "list", columns }: ChoiceGroupProps<V>) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const selectedIndex = Math.max(0, options.findIndex((o) => o.value === value));

  const onKey = (e: KeyboardEvent, index: number) => {
    const forward = e.key === "ArrowRight" || e.key === "ArrowDown";
    const back = e.key === "ArrowLeft" || e.key === "ArrowUp";
    if (!forward && !back) return;
    e.preventDefault();
    const next = (index + (forward ? 1 : -1) + options.length) % options.length;
    onChange(options[next].value);
    refs.current[next]?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={`am-choices am-choices--${layout}`}
      style={layout === "grid" ? ({ "--am-cols": columns ?? options.length } as CSSProperties) : undefined}
    >
      {options.map((o, i) => {
        const checked = o.value === value;
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={i === selectedIndex ? 0 : -1}
            className="am-choice am-press"
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => onKey(e, i)}
          >
            {o.preview !== undefined && <span className="am-choice__preview" style={o.previewStyle}>{o.preview}</span>}
            <span className="am-choice__label">{o.label}</span>
            {layout === "list" && (o.code || checked) && (
              <span className="am-choice__code">
                {o.code}
                {checked && <MobileIcon name="check" size={16} strokeWidth={2.2} />}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
