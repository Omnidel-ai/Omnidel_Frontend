import type { CSSProperties, ReactNode } from "react";

interface Props {
  children: ReactNode;
  /** Optional inner card styling */
  card?: boolean;
}

export function LearnPanelShell({ children, card = false }: Props) {
  return (
    <div style={shellStyle}>
      <div style={card ? cardStyle : innerStyle}>{children}</div>
    </div>
  );
}

const shellStyle: CSSProperties = {
  width: "100%",
  maxWidth: 780,
  margin: "0 auto",
  padding: "16px 16px 40px",
  boxSizing: "border-box",
};

const innerStyle: CSSProperties = {
  width: "100%",
};

const cardStyle: CSSProperties = {
  width: "100%",
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "var(--rule)",
  borderRadius: "var(--r-md)",
  background: "color-mix(in srgb, var(--surface) 94%, #fff 6%)",
  boxShadow: "0 10px 32px color-mix(in srgb, var(--ink) 7%, transparent)",
  padding: "16px 16px 20px",
};

export function LearnSectionHeader({ label, subtitle }: { label: string; subtitle?: string }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <p
        style={{
          fontFamily: "var(--mono)",
          fontSize: 10,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "var(--ink-mute)",
          margin: "0 0 4px",
        }}
      >
        {label}
      </p>
      {subtitle ? (
        <p style={{ fontSize: 12, color: "var(--ink-mute)", margin: 0, lineHeight: 1.45 }}>{subtitle}</p>
      ) : null}
    </div>
  );
}
