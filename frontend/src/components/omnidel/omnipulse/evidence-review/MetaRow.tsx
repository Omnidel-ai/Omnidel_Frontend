"use client";

export function MetaRow({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
      <span style={{
        fontFamily: "var(--mono)",
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: "var(--ink-mute)",
      }}>
        {label}
      </span>
      <span
        style={{
          fontFamily: "var(--sans)",
          fontSize: 13,
          fontWeight: 500,
          color: "var(--ink)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          lineHeight: 1.3,
        }}
        title={value}
      >
        {value}
      </span>
      {sub ? (
        <span
          style={{
            fontFamily: "var(--mono)",
            fontSize: 10,
            color: "var(--ink-mute)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            lineHeight: 1.3,
          }}
          title={sub}
        >
          {sub}
        </span>
      ) : null}
    </div>
  );
}
