import { useState, type ReactNode } from "react";
import { Table, type Column } from "../components";
import type { DemoPoint } from "../data/types";

/**
 * Charts for the dashboard.
 *
 * Form first: a headline number is a stat tile, not a chart; change-over-time
 * is a bar column chart; magnitude-by-category is a horizontal bar list; state
 * is a labelled status list.
 *
 * Colour last, and deliberately boring: every chart here is SINGLE-SERIES, so
 * it uses one hue (the brand green) and needs no categorical palette, no
 * legend and no colourblind-safety trade-off — the title names the series. The
 * status list is the one exception, and it uses the reserved status tokens with
 * a text label beside every mark, never colour alone.
 *
 * Marks are thin, data-ends carry a 2px radius (the system's radius language,
 * not a capsule), bars are separated by a 2px surface gap, the grid is
 * recessive, and labels are selective — the peak and the latest value are
 * printed, not every bar. Hover gives the rest.
 */

const BAR_COLOR = "var(--green-deep)";

export function Panel({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      style={{
        background: "var(--surface)",
        border: "1px solid var(--rule)",
        borderRadius: "var(--r-md)",
        padding: "var(--card-pad)",
        minWidth: 0,
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 10,
          marginBottom: 14,
          flexWrap: "wrap",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <h3 style={{ fontSize: 16, fontFamily: "var(--serif)" }}>{title}</h3>
          {subtitle && (
            <p
              style={{
                fontFamily: "var(--mono)",
                fontSize: 10,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "var(--ink-mute)",
                marginTop: 4,
              }}
            >
              {subtitle}
            </p>
          )}
        </div>
        {actions}
      </header>
      {children}
    </section>
  );
}

/** Small text button for a panel's header — "Table" / "Chart". */
export function PanelToggle({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div style={{ display: "inline-flex", gap: 4, flexShrink: 0 }}>
      {options.map((o) => {
        const active = o === value;
        return (
          <button
            key={o}
            type="button"
            onClick={() => onChange(o)}
            aria-pressed={active}
            style={{
              padding: "3px 9px",
              fontFamily: "var(--mono)",
              fontSize: 10,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              background: active ? "var(--green-deep)" : "transparent",
              color: active ? "var(--surface)" : "var(--ink-mute)",
              border: `1px solid ${active ? "var(--green-deep)" : "var(--rule)"}`,
              borderRadius: "var(--r-sm)",
              cursor: "pointer",
            }}
          >
            {o}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Change over time, as columns. One series, so no legend — the panel title
 * names it. A table view is available for anyone who needs the numbers.
 */
export function BarColumns({
  points,
  unit,
  height = 168,
}: {
  points: DemoPoint[];
  unit?: string;
  height?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(...points.map((p) => p.value), 1);
  const peakIndex = points.findIndex((p) => p.value === max);
  const lastIndex = points.length - 1;

  return (
    <div>
      {/* Plot area. Gridlines sit behind the bars at 50% and 100% of the
          scale — two is enough to read against, more is noise. */}
      <div style={{ position: "relative", height, marginBottom: 6 }}>
        {[0, 0.5, 1].map((f) => (
          <div
            key={f}
            aria-hidden="true"
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: `${f * 100}%`,
              height: 1,
              background: f === 0 ? "var(--rule-strong)" : "var(--rule)",
              opacity: f === 0 ? 1 : 0.6,
            }}
          />
        ))}

        <div
          role="img"
          aria-label={`${points.length} periods, from ${points[0]?.label} to ${points[lastIndex]?.label}. Peak ${max} at ${points[peakIndex]?.label}.`}
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "flex-end",
            gap: 2,
          }}
        >
          {points.map((p, i) => {
            const isHot = hover === i;
            const labelled = i === peakIndex || i === lastIndex;
            return (
              <div
                key={p.label}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                style={{
                  flex: 1,
                  minWidth: 0,
                  height: "100%",
                  display: "flex",
                  alignItems: "flex-end",
                  position: "relative",
                  // A hit target taller than the mark: the whole column reacts,
                  // not just the painted part.
                  cursor: "default",
                }}
              >
                <div
                  style={{
                    width: "100%",
                    height: `${(p.value / max) * 100}%`,
                    background: BAR_COLOR,
                    opacity: isHot ? 1 : 0.88,
                    // Rounded data-end only, anchored to the baseline.
                    borderRadius: "2px 2px 0 0",
                    transition: "opacity 120ms ease",
                  }}
                />
                {(labelled || isHot) && (
                  <span
                    style={{
                      position: "absolute",
                      bottom: `calc(${(p.value / max) * 100}% + 4px)`,
                      left: "50%",
                      transform: "translateX(-50%)",
                      fontFamily: "var(--mono)",
                      fontSize: 10,
                      color: isHot ? "var(--ink)" : "var(--ink-mute)",
                      whiteSpace: "nowrap",
                      pointerEvents: "none",
                    }}
                  >
                    {p.value}
                  </span>
                )}
                {isHot && (
                  <span
                    role="tooltip"
                    style={{
                      position: "absolute",
                      bottom: "calc(100% + 6px)",
                      left: "50%",
                      transform: "translateX(-50%)",
                      background: "var(--ink)",
                      color: "var(--page)",
                      fontFamily: "var(--sans)",
                      fontSize: 11.5,
                      padding: "4px 8px",
                      borderRadius: "var(--r-sm)",
                      whiteSpace: "nowrap",
                      pointerEvents: "none",
                      zIndex: 2,
                      boxShadow: "var(--shadow-sm)",
                    }}
                  >
                    {p.label}: {p.value}
                    {unit ? ` ${unit}` : ""}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Category axis — every other label on a narrow strip would collide, so
          only the ends and the peak are printed. */}
      <div style={{ display: "flex", gap: 2 }}>
        {points.map((p, i) => (
          <span
            key={p.label}
            style={{
              flex: 1,
              minWidth: 0,
              textAlign: "center",
              fontFamily: "var(--mono)",
              fontSize: 9.5,
              color: i === hover ? "var(--ink)" : "var(--ink-faint)",
              overflow: "hidden",
              whiteSpace: "nowrap",
            }}
          >
            {i === 0 || i === lastIndex || i === peakIndex || i === hover ? p.label : ""}
          </span>
        ))}
      </div>
    </div>
  );
}

/** The same series as numbers — the chart's table view. */
export function PointTable({ points, valueHeader }: { points: DemoPoint[]; valueHeader: string }) {
  const columns: Column<DemoPoint>[] = [
    { key: "label", header: "Period", width: "1fr" },
    { key: "value", header: valueHeader, width: "1fr", align: "right" },
  ];
  return (
    <Table
      columns={columns}
      data={points}
      rowKey={(p) => p.label}
      minHeight={120}
      minWidth={240}
    />
  );
}

/** Magnitude by category: horizontal bars, longest first, direct-labelled. */
export function BarRows({ points }: { points: DemoPoint[] }) {
  const max = Math.max(...points.map((p) => p.value), 1);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {points.map((p) => (
        <div key={p.label} style={{ display: "grid", gridTemplateColumns: "96px 1fr 44px", gap: 10, alignItems: "center" }}>
          <span
            style={{
              fontSize: 12.5,
              color: "var(--ink-soft)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
            title={p.label}
          >
            {p.label}
          </span>
          <span
            style={{
              display: "block",
              height: 10,
              background: "var(--surface-sunk)",
              borderRadius: 2,
              overflow: "hidden",
            }}
          >
            <span
              style={{
                display: "block",
                width: `${(p.value / max) * 100}%`,
                height: "100%",
                background: BAR_COLOR,
                borderRadius: 2,
              }}
            />
          </span>
          <span
            style={{
              fontFamily: "var(--mono)",
              fontSize: 11.5,
              color: "var(--ink)",
              textAlign: "right",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {p.value}
          </span>
        </div>
      ))}
    </div>
  );
}

const STATUS_COLOR: Record<string, string> = {
  ok: "var(--ok)",
  warn: "var(--amber)",
  crit: "var(--crit)",
  neutral: "var(--ink-mute)",
};

/**
 * State, as a labelled stacked bar plus rows.
 *
 * Status colour is reserved and never stands alone: every segment has a row
 * underneath with its name and its count.
 */
export function StatusBreakdown({
  items,
}: {
  items: { label: string; value: number; tone: string }[];
}) {
  const total = items.reduce((n, i) => n + i.value, 0) || 1;
  return (
    <div>
      <div style={{ display: "flex", gap: 2, height: 12, marginBottom: 14 }}>
        {items.map((i) => (
          <span
            key={i.label}
            title={`${i.label}: ${i.value}`}
            style={{
              width: `${(i.value / total) * 100}%`,
              background: STATUS_COLOR[i.tone] ?? STATUS_COLOR.neutral,
              borderRadius: 2,
            }}
          />
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {items.map((i) => (
          <div key={i.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              aria-hidden="true"
              style={{
                width: 8,
                height: 8,
                borderRadius: 2,
                background: STATUS_COLOR[i.tone] ?? STATUS_COLOR.neutral,
                flexShrink: 0,
              }}
            />
            <span style={{ flex: 1, fontSize: 13, color: "var(--ink-soft)" }}>{i.label}</span>
            <span
              style={{
                fontFamily: "var(--mono)",
                fontSize: 11.5,
                color: "var(--ink)",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {i.value}
            </span>
            <span
              style={{
                fontFamily: "var(--mono)",
                fontSize: 10,
                color: "var(--ink-faint)",
                width: 34,
                textAlign: "right",
              }}
            >
              {Math.round((i.value / total) * 100)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
