"use client";
import { useTr } from "@/lib/client/language";

// Swatch palette for the admin masters' colour fields, so operators pick a colour
// instead of typing one. Two different value spaces need this, hence `options`
// carrying both the stored value and the colour to paint:
//
//   Lead Sources  icon_hint  stores a TOKEN NAME ("green", "crit", "mute") --
//                            the seeded set is green/terracotta/ochre/ink/crit/mute.
//   Lanes         color      stores a HEX string ("#4a7c59").
//
// Passing the swatch colour in (rather than deriving it from the value) keeps the
// component honest: a token whose CSS var does not exist can't silently render as
// a transparent square.

export interface ColorOption {
  /** Value persisted to the column. */
  value: string;
  /** CSS colour painted on the swatch, e.g. "var(--green-deep)" or "#4a7c59". */
  swatch: string;
  /** Human label for the tooltip / accessible name. */
  label: string;
}

export function ColorPalettePicker({ label, value, onChange, options, allowNone = true }: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  options: ColorOption[];
  /** Show a "None" chip that clears the field. Colour is optional on every master. */
  allowNone?: boolean;
}) {
  const tr = useTr();
  const selected = options.find((o) => o.value === value);

  return (
    <div>
      <label style={{
        display: "block", fontFamily: "var(--mono)", fontSize: 10, letterSpacing: "0.1em",
        textTransform: "uppercase", color: "var(--ink-mute)", marginBottom: 8,
      }}>
        {label}
      </label>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        {allowNone && (
          <button
            type="button"
            onClick={() => onChange("")}
            aria-pressed={!value}
            title={tr("No colour")}
            style={{
              height: 28, padding: "0 10px", fontSize: 11, fontFamily: "var(--sans)",
              borderRadius: "var(--r-sm)", cursor: "pointer",
              background: "var(--surface-sunk)",
              color: !value ? "var(--ink)" : "var(--ink-mute)",
              border: `2px solid ${!value ? "var(--ink)" : "var(--rule-strong)"}`,
            }}
          >
            {tr("None")}
          </button>
        )}
        {options.map((opt) => {
          const active = opt.value === value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              aria-pressed={active}
              aria-label={opt.label}
              title={opt.label}
              style={{
                width: 28, height: 28, borderRadius: "50%", cursor: "pointer", padding: 0,
                background: opt.swatch,
                // Selected ring sits outside the swatch so the colour stays readable.
                border: `2px solid ${active ? "var(--ink)" : "var(--rule-strong)"}`,
                boxShadow: active ? "0 0 0 2px var(--surface)" : "none",
                flexShrink: 0,
              }}
            />
          );
        })}
        <span style={{ fontSize: 11, fontFamily: "var(--mono)", color: "var(--ink-mute)", marginLeft: 2 }}>
          {selected ? selected.label : value || tr("None")}
        </span>
      </div>
    </div>
  );
}

/**
 * Token-name palette for Lead Sources' `icon_hint`. Values match the rows seeded in
 * 20260426000000_admin_masters.sql, so existing data keeps rendering as a known chip
 * instead of falling through to "None".
 */
export const LEAD_SOURCE_COLORS: ColorOption[] = [
  { value: "green", swatch: "var(--green-deep)", label: "green" },
  { value: "terracotta", swatch: "var(--terracotta)", label: "terracotta" },
  { value: "ochre", swatch: "var(--ochre)", label: "ochre" },
  { value: "ink", swatch: "var(--ink)", label: "ink" },
  { value: "crit", swatch: "var(--crit)", label: "crit" },
  { value: "mute", swatch: "var(--ink-mute)", label: "mute" },
];
