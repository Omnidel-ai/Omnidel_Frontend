import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react";

/** Standard row action button — Edit / Archive / Restore on a table row. */
export const tableActBtnStyle: CSSProperties = {
  padding: "4px 8px",
  fontSize: 11,
  fontWeight: 500,
  background: "var(--surface-sunk)",
  border: "1px solid var(--rule-strong)",
  borderRadius: "var(--r-sm)",
  cursor: "pointer",
  color: "var(--ink)",
  fontFamily: "var(--sans)",
};

export const tableActBtnDangerStyle: CSSProperties = {
  ...tableActBtnStyle,
  color: "var(--crit)",
};

export const tableActBtnRestoreStyle: CSSProperties = {
  ...tableActBtnStyle,
  color: "var(--green-deep)",
};

export const tableActBtnDisabledStyle: CSSProperties = {
  ...tableActBtnStyle,
  opacity: 0.45,
  cursor: "not-allowed",
  color: "var(--ink-mute)",
};

export interface TableActionProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: "default" | "danger" | "restore";
}

/** One action button, sized for a table row. */
export function TableAction({ tone = "default", disabled, style, ...rest }: TableActionProps) {
  const base = disabled
    ? tableActBtnDisabledStyle
    : tone === "danger"
      ? tableActBtnDangerStyle
      : tone === "restore"
        ? tableActBtnRestoreStyle
        : tableActBtnStyle;
  return <button type="button" disabled={disabled} style={{ ...base, ...style }} {...rest} />;
}

export interface TableRowActionsProps {
  children: ReactNode;
  /** Keep the buttons on one line even in a narrow cell. */
  nowrap?: boolean;
}

/** Right-aligned action cluster for the last column of a row. */
export function TableRowActions({ children, nowrap = false }: TableRowActionsProps) {
  return (
    <div
      style={{
        display: "flex",
        gap: 6,
        justifyContent: "flex-end",
        alignItems: "center",
        flexWrap: nowrap ? "nowrap" : "wrap",
        whiteSpace: nowrap ? "nowrap" : undefined,
      }}
    >
      {children}
    </div>
  );
}
