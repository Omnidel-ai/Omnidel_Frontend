import type { DemoStat } from "../data/types";

const DELTA_COLOR: Record<string, string> = {
  ok: "var(--ok)",
  warn: "var(--amber)",
  crit: "var(--crit)",
  neutral: "var(--ink-mute)",
};

/**
 * A headline number.
 *
 * The right form for one measure is not a chart — it is the number, large,
 * with what it is and what it did. The delta carries a sign in the text as
 * well as a tone, so direction never rests on colour alone.
 */
export function StatTile({ stat }: { stat: DemoStat }) {
  const color = DELTA_COLOR[stat.deltaTone] ?? DELTA_COLOR.neutral;
  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--rule)",
        borderRadius: "var(--r-md)",
        padding: "14px 16px",
        minWidth: 0,
      }}
    >
      <div
        style={{
          fontFamily: "var(--mono)",
          fontSize: 10,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "var(--ink-mute)",
        }}
      >
        {stat.label}
      </div>
      <div
        style={{
          fontFamily: "var(--serif)",
          fontSize: 30,
          lineHeight: 1.1,
          marginTop: 8,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {stat.value}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 6 }}>
        {stat.delta && (
          <span style={{ fontFamily: "var(--mono)", fontSize: 11.5, color, fontWeight: 600 }}>
            {stat.delta}
          </span>
        )}
        {stat.hint && (
          <span style={{ fontSize: 11.5, color: "var(--ink-mute)" }}>{stat.hint}</span>
        )}
      </div>
    </div>
  );
}
