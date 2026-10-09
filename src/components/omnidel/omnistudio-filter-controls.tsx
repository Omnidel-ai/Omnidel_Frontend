"use client";

import { DatePicker } from "@/components/omnidel/date-picker";

export {
  pruneProjectSelection,
  projectOptionsEqual,
  type TableProjectOption,
} from "@/lib/client/table-project-filters";

export function FilterSection({
  label,
  divider,
  children,
}: {
  label: string;
  divider?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 10 }}>
      {divider && (
        <div
          style={{
            borderTopWidth: 1,
            borderTopStyle: "solid",
            borderTopColor: "var(--rule)",
            margin: "0 -14px 10px -14px",
          }}
        />
      )}
      <div
        style={{
          fontFamily: "var(--mono)",
          fontSize: 10,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--ink-mute)",
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      {children}
    </div>
  );
}

export function FilterDateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label style={{ display: "grid", gap: 4 }}>
      <span
        style={{
          fontFamily: "var(--mono)",
          fontSize: 10,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "var(--ink-mute)",
        }}
      >
        {label}
      </span>
      <DatePicker value={value} onChange={onChange} placeholder="dd-mm-yyyy" />
    </label>
  );
}

export function FilterMultiSelectList({
  allLabel,
  values,
  onChange,
  options,
  emptyMessage = "No options yet",
  containScroll = true,
}: {
  allLabel: string;
  values: string[];
  onChange: (v: string[]) => void;
  options: { value: string; label: string }[];
  emptyMessage?: string;
  /** When false, list grows with the parent panel scroll (avoids nested scrollbars). */
  containScroll?: boolean;
}) {
  const allSelected = options.length > 0 && options.every((o) => values.includes(o.value));
  const someSelected = values.length > 0 && !allSelected;

  function toggleAll() {
    if (allSelected) onChange([]);
    else onChange(options.map((o) => o.value));
  }

  return (
    <div style={{ display: "grid", gap: 2 }}>
      <FilterCheckboxRow
        label={allLabel}
        checked={allSelected}
        indeterminate={someSelected}
        onClick={toggleAll}
      />
      {options.length === 0 ? (
        <div style={{ padding: "6px 8px", fontSize: 12, color: "var(--ink-mute)" }}>{emptyMessage}</div>
      ) : containScroll ? (
        <div className="themed-scroll-y picker-list-scroll" style={{ maxHeight: 160, overflowY: "auto" }}>
          <FilterCheckList values={values} onChange={onChange} options={options} scrollable={false} />
        </div>
      ) : (
        <FilterCheckList values={values} onChange={onChange} options={options} scrollable={false} />
      )}
    </div>
  );
}

export function FilterCheckboxRow({
  label,
  checked,
  indeterminate,
  onClick,
}: {
  label: string;
  checked: boolean;
  indeterminate?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        width: "100%",
        textAlign: "left",
        padding: "6px 8px",
        fontSize: 12,
        fontFamily: "var(--sans)",
        background: checked || indeterminate ? "var(--green-wash)" : "transparent",
        color: checked || indeterminate ? "var(--green-deep)" : "var(--ink-soft)",
        fontWeight: checked || indeterminate ? 600 : 500,
        borderWidth: 0,
        cursor: "pointer",
      }}
    >
      <span
        style={{
          width: 14,
          height: 14,
          flexShrink: 0,
          borderWidth: 1,
          borderStyle: "solid",
          borderColor: checked || indeterminate ? "var(--green-deep)" : "var(--rule-strong)",
          background: checked ? "var(--green-deep)" : "transparent",
          borderRadius: 3,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {checked && (
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
            <path
              d="M2 5l2 2 4-4"
              stroke="var(--surface)"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
        {indeterminate && !checked && (
          <span style={{ width: 8, height: 2, background: "var(--green-deep)", borderRadius: 1 }} />
        )}
      </span>
      <span className="picker-truncate">{label}</span>
    </button>
  );
}

export function FilterCheckList({
  values,
  onChange,
  options,
  scrollable = true,
}: {
  values: string[];
  onChange: (v: string[]) => void;
  options: { value: string; label: string }[];
  scrollable?: boolean;
}) {
  function toggle(v: string) {
    if (values.includes(v)) onChange(values.filter((x) => x !== v));
    else onChange([...values, v]);
  }

  return (
    <div
      className={scrollable ? "themed-scroll-y picker-list-scroll" : undefined}
      style={{
        display: "grid",
        gap: 2,
        ...(scrollable ? { maxHeight: 160, overflowY: "auto" } : {}),
      }}
    >
      {options.map((opt) => {
        const isSelected = values.includes(opt.value);
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => toggle(opt.value)}
            title={opt.label}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              width: "100%",
              textAlign: "left",
              padding: "6px 8px",
              fontSize: 12,
              fontFamily: "var(--sans)",
              background: isSelected ? "var(--green-wash)" : "transparent",
              color: isSelected ? "var(--green-deep)" : "var(--ink-soft)",
              fontWeight: isSelected ? 600 : 400,
              borderWidth: 0,
              cursor: "pointer",
              minWidth: 0,
            }}
          >
            <span
              style={{
                width: 14,
                height: 14,
                flexShrink: 0,
                borderWidth: 1,
                borderStyle: "solid",
                borderColor: isSelected ? "var(--green-deep)" : "var(--rule-strong)",
                background: isSelected ? "var(--green-deep)" : "transparent",
                borderRadius: 3,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {isSelected && (
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                  <path
                    d="M2 5l2 2 4-4"
                    stroke="var(--surface)"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </span>
            <span className="picker-truncate">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export const omnistudioFilterPanelStyle: React.CSSProperties = {
  boxSizing: "border-box",
  background: "var(--surface)",
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "var(--rule)",
  borderRadius: "var(--r-sm)",
  boxShadow: "var(--shadow-md)",
  zIndex: 1000,
  maxHeight: 520,
  overflowY: "auto",
  padding: "12px 14px",
};

export const omnistudioFilterTriggerStyle = (activeCount: number): React.CSSProperties => ({
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "8px 12px",
  fontSize: 11,
  fontFamily: "var(--mono)",
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  background: activeCount > 0 ? "var(--green-wash)" : "var(--surface-sunk)",
  color: activeCount > 0 ? "var(--green-deep)" : "var(--ink-soft)",
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "var(--rule)",
  borderRadius: "var(--r-sm)",
  cursor: "pointer",
});
