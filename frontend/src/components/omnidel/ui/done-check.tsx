"use client";

// Round tick-in-circle button used as a "Mark done" toggle. Sits beside a
// task title in: tasks list, board card, modal header. Inline SVG only —
// no emoji, follows the design rule of CSS-variable colors.

interface Props {
  done: boolean;
  onToggle: () => void;
  size?: number;
  disabled?: boolean;
}

export function DoneCheck({ done, onToggle, size = 18, disabled = false }: Props) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={(e) => { e.stopPropagation(); if (!disabled) onToggle(); }}
      title={done ? "Mark not done" : "Mark done"}
      aria-label={done ? "Mark not done" : "Mark done"}
      style={{
        width: size, height: size, borderRadius: "50%", padding: 0,
        background: done ? "var(--ok)" : "transparent",
        borderWidth: 1.5, borderStyle: "solid",
        borderColor: done ? "var(--ok)" : "var(--rule-strong)",
        cursor: disabled ? "default" : "pointer",
        flexShrink: 0,
        opacity: disabled ? 0.5 : 1,
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        transition: "background .15s, border-color .15s",
      }}
    >
      {done && (
        <svg
          width={Math.max(10, size - 8)}
          height={Math.max(10, size - 8)}
          viewBox="0 0 24 24"
          fill="none"
          stroke="#ffffff"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      )}
    </button>
  );
}
