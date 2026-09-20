import type { CSSProperties } from "react";
import { useIsMobile } from "../../hooks/useIsMobile";

export interface TableAddButtonProps {
  /** Exact desktop text, e.g. "+ Add Lane". */
  label: string;
  onClick: () => void;
  /** Accessible name for the icon variant. Defaults to `label` minus "+ ". */
  ariaLabel?: string;
  disabled?: boolean;
}

/**
 * Toolbar "+ Add …" button.
 *
 * Phones collapse it to a 38px icon so it shares the controls row with the
 * search box instead of wrapping onto a line of its own; desktop keeps the
 * labelled button.
 */
export function TableAddButton({ label, onClick, ariaLabel, disabled }: TableAddButtonProps) {
  const isMobile = useIsMobile();
  const name = ariaLabel ?? label.replace(/^\+\s*/, "");

  if (isMobile) {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        style={addIconBtnStyle}
        aria-label={name}
        title={name}
      >
        <PlusIcon />
      </button>
    );
  }

  return (
    <button type="button" onClick={onClick} disabled={disabled} style={addBtnStyle}>
      {label}
    </button>
  );
}

const addBtnStyle: CSSProperties = {
  padding: "8px 14px",
  fontSize: 12,
  fontWeight: 500,
  minWidth: 140,
  background: "var(--green-deep)",
  color: "var(--surface)",
  border: "1px solid var(--green-deep)",
  borderRadius: "var(--r-sm)",
  cursor: "pointer",
  fontFamily: "var(--sans)",
  textAlign: "center",
};

const addIconBtnStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 38,
  height: 38,
  padding: 0,
  flexShrink: 0,
  background: "var(--green-deep)",
  color: "var(--surface)",
  border: "1px solid var(--green-deep)",
  borderRadius: "var(--r-sm)",
  cursor: "pointer",
};

function PlusIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}
