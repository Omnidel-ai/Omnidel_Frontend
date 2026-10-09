import { useEffect, useMemo, useRef, useState } from "react";
import { Checkbox } from "../Input/Checkbox";

export interface MultiSelectOption {
  value: string;
  label: string;
  /** Second line under the label — a role, an email, a code. */
  sublabel?: string;
  /** Leading dot / avatar colour. */
  color?: string;
  disabled?: boolean;
}

export interface MultiSelectProps {
  options: MultiSelectOption[];
  /** Selected values, owned by the caller. */
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  /** Show a search box above the list once there are this many options. */
  searchThreshold?: number;
  /** Cap the selection; extra options are disabled once it is reached. */
  max?: number;
  disabled?: boolean;
  /** Chips under the field for what is selected. */
  showChips?: boolean;
}

/**
 * Multi-select field: a trigger, a searchable option list, and removable chips.
 *
 * The app uses this shape for members, labels and tags. Here it is a plain
 * `{value,label}` list — the component never loads people or knows what a
 * member is, which is exactly what makes it shared rather than a feature.
 *
 * States: empty · some selected · at max · searching · no matches · disabled.
 */
export function MultiSelect({
  options,
  value,
  onChange,
  placeholder = "Select…",
  searchThreshold = 8,
  max,
  disabled = false,
  showChips = true,
}: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);

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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) || (o.sublabel ?? "").toLowerCase().includes(q),
    );
  }, [options, query]);

  const atMax = max != null && value.length >= max;
  const selectedOptions = options.filter((o) => value.includes(o.value));

  function toggle(v: string) {
    if (value.includes(v)) onChange(value.filter((x) => x !== v));
    else if (!atMax) onChange([...value, v]);
  }

  const triggerLabel =
    value.length === 0
      ? placeholder
      : value.length === 1
        ? (selectedOptions[0]?.label ?? `${value.length} selected`)
        : `${value.length} selected`;

  return (
    <div className="picker-field" ref={wrapRef}>
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => !disabled && setOpen((o) => !o)}
        style={{
          width: "100%",
          padding: "10px 12px",
          fontSize: 13,
          fontFamily: "var(--sans)",
          color: value.length ? "var(--ink-soft)" : "var(--ink-mute)",
          background: "var(--page)",
          border: "1px solid var(--rule-strong)",
          borderRadius: "var(--r-sm)",
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.6 : 1,
          textAlign: "left",
        }}
      >
        <span className="picker-truncate">{triggerLabel}</span>
      </button>

      {open && (
        <div
          role="listbox"
          aria-multiselectable="true"
          className="custom-select-dropdown"
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            zIndex: 20,
            background: "var(--surface)",
            border: "1px solid var(--rule-strong)",
            borderRadius: "var(--r-sm)",
            boxShadow: "var(--shadow-md)",
            maxHeight: 240,
            overflowY: "auto",
          }}
        >
          {options.length >= searchThreshold && (
            <div style={{ padding: 8, borderBottom: "1px solid var(--rule)" }}>
              <input
                autoFocus
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search…"
                aria-label="Search options"
                className="form-input"
                style={{ padding: "6px 10px", fontSize: 12, background: "var(--surface)" }}
              />
            </div>
          )}

          {filtered.length === 0 ? (
            <div style={{ padding: "12px", fontSize: 12, color: "var(--ink-mute)" }}>
              No matches
            </div>
          ) : (
            filtered.map((o) => {
              const checked = value.includes(o.value);
              return (
                <div
                  key={o.value}
                  className="picker-option"
                  style={{ padding: "8px 12px", transition: "background .1s" }}
                >
                  <Checkbox
                    checked={checked}
                    disabled={o.disabled || (!checked && atMax)}
                    onChange={() => toggle(o.value)}
                    hint={o.sublabel}
                    label={
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                        {o.color && (
                          <span
                            aria-hidden="true"
                            style={{
                              width: 18,
                              height: 18,
                              borderRadius: "50%",
                              background: o.color,
                              color: "var(--surface)",
                              fontSize: 9,
                              fontFamily: "var(--mono)",
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              flexShrink: 0,
                            }}
                          >
                            {o.label.slice(0, 2).toUpperCase()}
                          </span>
                        )}
                        {o.label}
                      </span>
                    }
                  />
                </div>
              );
            })
          )}

          {atMax && (
            <div
              style={{
                padding: "8px 12px",
                fontSize: 11,
                color: "var(--ink-mute)",
                borderTop: "1px solid var(--rule)",
              }}
            >
              Limit of {max} reached.
            </div>
          )}
        </div>
      )}

      {showChips && selectedOptions.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
          {selectedOptions.map((o) => (
            <span
              key={o.value}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                padding: "3px 8px",
                fontSize: 11,
                fontFamily: "var(--mono)",
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                background: "var(--green-wash)",
                color: "var(--green-deep)",
                borderRadius: "var(--r-sm)",
              }}
            >
              {o.label}
              <button
                type="button"
                onClick={() => toggle(o.value)}
                aria-label={`Remove ${o.label}`}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--ink-mute)",
                  fontSize: 14,
                  lineHeight: 1,
                  padding: "0 2px",
                }}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
