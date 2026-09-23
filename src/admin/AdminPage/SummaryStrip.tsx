import type { DemoMaster, DemoRow } from "../../data/types";

/**
 * Counters above the table, computed over the rows currently in view.
 *
 * Deliberately not charts: these are single numbers, and the right form for a
 * single number is the number. A master without a `summary` renders nothing.
 */
export function SummaryStrip({ master, rows }: { master: DemoMaster; rows: DemoRow[] }) {
  const items = master.summary ?? [];
  if (items.length === 0) return null;

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 18,
        padding: "10px 14px",
        marginBottom: 10,
        background: "var(--surface)",
        border: "1px solid var(--rule)",
        borderRadius: "var(--r-md)",
      }}
    >
      {items.map((s) => {
        const matching = s.where ? rows.filter((r) => r[s.where!.field] === s.where!.value) : rows;
        const value =
          s.kind === "sum"
            ? matching.reduce((n, r) => n + (Number(r[s.field ?? ""]) || 0), 0)
            : matching.length;
        return (
          <span key={s.label} style={{ display: "inline-flex", alignItems: "baseline", gap: 7 }}>
            <span
              style={{
                fontFamily: "var(--mono)",
                fontSize: 10,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "var(--ink-mute)",
              }}
            >
              {s.label}
            </span>
            <span
              style={{
                fontFamily: "var(--serif)",
                fontSize: 17,
                color: "var(--ink)",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {value.toLocaleString()}
            </span>
          </span>
        );
      })}
    </div>
  );
}
