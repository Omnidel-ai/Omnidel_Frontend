import { Panel } from "../components";

export interface DonutRow {
  label: string;
  value: number;
  /** Token for this slice. Identity is carried by the legend, not the colour. */
  color: string;
}

/**
 * Part of a whole, as a ring with a total in the middle.
 *
 * A ring is only readable for a handful of slices, so the legend beneath it
 * carries every row with its own count and share — the colour is a pointer
 * between the two, never the only thing distinguishing them. Slices are
 * separated by a small gap so neighbouring segments never blur into one.
 */
export function DonutRing({
  title,
  rows,
  total,
  unit = "tasks",
}: {
  title: string;
  rows: DonutRow[];
  total: number;
  unit?: string;
}) {
  const sum = rows.reduce((n, r) => n + r.value, 0);

  return (
    <Panel
      title={title}
      actions={
        <span className="ui-meta" >
          {total} {unit}
        </span>
      }
    >
      {sum === 0 ? (
        <p className="panel__empty">No data</p>
      ) : (
        <div className="donut">
          <Ring rows={rows} total={sum} />
          <ul className="donut__legend">
            {rows.map((r) => (
              <li key={r.label}>
                <span className="donut__swatch" style={{ background: r.color }} aria-hidden="true" />
                <span className="donut__label">{r.label}</span>
                <span className="donut__value">{r.value}</span>
                <span className="donut__pct">{Math.round((r.value / sum) * 100)}%</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Panel>
  );
}

const SIZE = 132;
const STROKE = 18;
const R = (SIZE - STROKE) / 2;
const C = 2 * Math.PI * R;

function Ring({ rows, total }: { rows: DonutRow[]; total: number }) {
  let offset = 0;
  return (
    <svg
      width={SIZE}
      height={SIZE}
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      role="img"
      aria-label={rows.map((r) => `${r.label}: ${r.value}`).join(", ")}
      style={{ flexShrink: 0 }}
    >
      <circle
        cx={SIZE / 2}
        cy={SIZE / 2}
        r={R}
        fill="none"
        stroke="var(--surface-sunk)"
        strokeWidth={STROKE}
      />
      {rows.map((r) => {
        const len = (r.value / total) * C;
        // A 2px gap between segments, so two neighbouring slices never read as
        // one — the same spacer the bars use.
        const dash = `${Math.max(0, len - 2)} ${C - Math.max(0, len - 2)}`;
        const el = (
          <circle
            key={r.label}
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            fill="none"
            stroke={r.color}
            strokeWidth={STROKE}
            strokeDasharray={dash}
            strokeDashoffset={-offset}
            transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
          >
            <title>{`${r.label}: ${r.value}`}</title>
          </circle>
        );
        offset += len;
        return el;
      })}
      <text
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="middle"
        style={{ fontFamily: "var(--serif)", fontSize: 26, fill: "var(--ink)" }}
      >
        {total}
      </text>
    </svg>
  );
}
