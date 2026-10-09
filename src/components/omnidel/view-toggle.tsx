"use client";
import { useTr } from "@/lib/client/language";

interface ViewToggleProps<T extends string> {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}

/** Segmented Card / Table control used across OmniDEL list surfaces. */
export function ViewToggle<T extends string>({
  value,
  onChange,
  options,
}: ViewToggleProps<T>) {
  const tr = useTr();
  const baseBtn: React.CSSProperties = {
    padding: "6px 14px",
    fontSize: 12,
    fontFamily: "var(--mono)",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    background: "var(--surface)",
    color: "var(--ink-soft)",
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: "var(--rule)",
    cursor: "pointer",
  };
  const activeBtn: React.CSSProperties = {
    background: "var(--green-deep)",
    color: "var(--surface)",
    borderColor: "var(--green-deep)",
  };

  return (
    <div
      style={{ display: "inline-flex", borderRadius: "var(--r-sm)", overflow: "hidden" }}
      role="tablist"
      aria-label={tr("View mode")}
    >
      {options.map((opt, i) => {
        const isActive = value === opt.value;
        const isFirst = i === 0;
        const isLast = i === options.length - 1;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(opt.value)}
            style={{
              ...baseBtn,
              ...(isActive ? activeBtn : {}),
              borderLeftWidth: isFirst ? 1 : 0,
              borderTopLeftRadius: isFirst ? "var(--r-sm)" : 0,
              borderBottomLeftRadius: isFirst ? "var(--r-sm)" : 0,
              borderTopRightRadius: isLast ? "var(--r-sm)" : 0,
              borderBottomRightRadius: isLast ? "var(--r-sm)" : 0,
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
