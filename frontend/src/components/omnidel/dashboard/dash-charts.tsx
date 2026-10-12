/**
 * Admin dashboard chart primitives.
 *
 * No charting dependency: package.json has none, and these are small enough
 * that adding one would cost more than it saves. Everything below is either
 * plain divs (bars, bar-lists, progress) or a minimal SVG (line, donut), drawn
 * with the existing CSS custom properties so it matches the rest of the app.
 *
 * Stateless and hook-free, so these render in server or client trees alike.
 *
 * Typography lives in HTML around the SVG, never inside it, so nothing distorts
 * when the chart scales to its container.
 */

import Link from "next/link";
import { useTr } from "@/lib/client/language";

/**
 * The house micro-label and metric-numeral styles.
 *
 * Exported because four copies had drifted into the ads module while these were
 * module-private — every implementation lane independently asked for this. One
 * definition, or the app develops two typographic scales by accident.
 */
export const MONO_LABEL: React.CSSProperties = {
  fontFamily: "var(--mono)",
  fontSize: 10,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "var(--ink-mute)",
};

export const SERIF_NUM: React.CSSProperties = {
  fontFamily: "var(--serif)",
  fontWeight: 400,
};

export function ChartFrame({
  label, sub, children, right,
}: {
  label: string;
  sub?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div style={{
      background: "var(--surface)",
      border: "1px solid var(--rule)",
      borderRadius: "var(--r-md)",
      display: "flex",
      flexDirection: "column",
      minWidth: 0,
    }}>
      <div style={{
        padding: "10px 16px",
        borderBottom: "1px solid var(--rule)",
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-between",
        gap: 10,
      }}>
        {/* A real heading, not a styled div: this is the accessible name of the
            panel, and a screen-reader user navigating by heading was previously
            skipping straight past every chart on the page. */}
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, minWidth: 0 }}>
          <h4 style={{ ...MONO_LABEL, fontWeight: 600, margin: 0 }}>{label}</h4>
          {sub && <span style={{ ...MONO_LABEL, fontSize: 9, letterSpacing: "0.08em" }}>{sub}</span>}
        </div>
        {right}
      </div>
      {/* A flex column, not a plain block: the body already had `flex: 1` so the
          FRAME grew inside a stretched grid cell, but a block box passes no height
          to its child, so the chart stayed its natural size and left dead space
          under it. As a column with minHeight:0, a child that opts into filling
          (BarChart with `fill`) can actually take the room. */}
      <div style={{
        padding: "16px", flex: 1, minWidth: 0, minHeight: 0,
        display: "flex", flexDirection: "column",
      }}>
        {children}
      </div>
    </div>
  );
}

export function EmptyChart({ message, hint }: { message: string; hint?: string }) {
  return (
    <div style={{ padding: "18px 4px", textAlign: "center" }}>
      <div style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: hint ? 6 : 0 }}>{message}</div>
      {hint && (
        <div style={{ fontSize: 11, color: "var(--ink-mute)", maxWidth: "44ch", margin: "0 auto", lineHeight: 1.5 }}>
          {hint}
        </div>
      )}
    </div>
  );
}

/**
 * Short axis label for a bucket key.
 *
 * Handles two shapes because the same charts serve daily and hourly series:
 *   "2026-08-05"  → "5/8"
 *   "14:00"       → "14:00"   (hourly buckets, passed straight through)
 *
 * The old version parsed everything as a date and fell back to `iso.slice(5)`,
 * which assumes a 10-character ISO date. For a 5-character "14:00" that slice
 * starts past the end and returns "", so every hourly tick AND every bar tooltip
 * rendered blank — silently, with no error.
 */
function dayTick(key: string): string {
  if (/^\d{1,2}:\d{2}$/.test(key)) return key;
  const d = new Date(key);
  if (Number.isNaN(d.getTime())) return key;
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

// ---------------------------------------------------------------------------
// Vertical bar chart. Plain divs so it reflows with its container.
// ---------------------------------------------------------------------------
export function BarChart({
  data, accent = "var(--green-deep)", height = 140, emptyMessage = "No activity in this period",
  fill, bucketNoun = "day",
}: {
  data: Array<{ day: string; value: number }>;
  accent?: string;
  height?: number;
  emptyMessage?: string;
  /**
   * Grow the plot to fill the parent instead of sitting at `height`. Only useful
   * inside a ChartFrame that is itself being stretched (a `.is-even` grid pair) —
   * without this the card grows and the bars stay small with space beneath them.
   */
  fill?: boolean;
  /**
   * What one bar represents. The all-zero footnote names it, and on a 1-day
   * window these buckets are hours — "Every day in this window is zero" would be
   * wrong for 24 hourly bars.
   */
  bucketNoun?: string;
}) {
  const tr = useTr();
  if (data.length === 0) return <EmptyChart message={emptyMessage} />;

  const max = Math.max(...data.map(d => d.value), 1);
  const allZero = data.every(d => d.value === 0);
  // Past ~20 bars the ticks collide, so thin them out rather than overlap.
  const tickEvery = data.length > 20 ? Math.ceil(data.length / 10) : data.length > 10 ? 2 : 1;

  return (
    <div style={fill ? { display: "flex", flexDirection: "column", flex: 1, minHeight: 0 } : undefined}>
      <div style={{
        display: "flex", alignItems: "flex-end", gap: 3, marginBottom: 6,
        ...(fill ? { flex: 1, minHeight: 80 } : { height }),
      }}>
        {data.map(d => {
          const pct = allZero ? 0 : (d.value / max) * 100;
          return (
            <div
              key={d.day}
              title={`${dayTick(d.day)}: ${d.value}`}
              style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "flex-end", height: "100%" }}
            >
              <div style={{
                height: `${Math.max(pct, d.value > 0 ? 2 : 0)}%`,
                background: accent,
                borderRadius: "var(--r-sm) var(--r-sm) 0 0",
                minHeight: d.value > 0 ? 2 : 0,
                transition: "height .3s",
              }} />
              {/* Zero days still need a visible baseline or the gap reads as missing data. */}
              {d.value === 0 && <div style={{ height: 1, background: "var(--rule)" }} />}
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 3, borderTop: "1px solid var(--rule)", paddingTop: 5 }}>
        {data.map((d, i) => (
          <div key={d.day} style={{ flex: 1, minWidth: 0, textAlign: "center" }}>
            {i % tickEvery === 0 && (
              <span style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--ink-faint)", whiteSpace: "nowrap" }}>
                {dayTick(d.day)}
              </span>
            )}
          </div>
        ))}
      </div>
      {allZero && (
        <div style={{ fontSize: 11, color: "var(--ink-mute)", marginTop: 8, textAlign: "center" }}>
          {tr("Every")} {bucketNoun} {tr("in this window is zero.")}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Multi-series line chart. non-scaling-stroke keeps line weight constant as the
// SVG stretches, so a wide container doesn't produce fat lines.
// ---------------------------------------------------------------------------
export interface LineSeries {
  /** Full name for the legend. Abbreviations belong in `abbr`, never here. */
  name: string;
  abbr?: string;
  color: string;
  points: Array<{ day: string; value: number }>;
}

export function LineChart({
  series, height = 150, emptyMessage = "No activity in this period",
}: {
  series: LineSeries[];
  height?: number;
  emptyMessage?: string;
}) {
  const tr = useTr();
  const usable = series.filter(s => s.points.length > 0);
  if (usable.length === 0) return <EmptyChart message={emptyMessage} />;

  const len = Math.max(...usable.map(s => s.points.length));
  const max = Math.max(...usable.flatMap(s => s.points.map(p => p.value)), 1);
  const W = 100;
  const H = 40;

  const path = (pts: Array<{ value: number }>) =>
    pts
      .map((p, i) => {
        const x = len === 1 ? W / 2 : (i / (len - 1)) * W;
        const y = H - (p.value / max) * H;
        return `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
      })
      .join(" ");

  const ticks = usable[0].points;
  const tickEvery = ticks.length > 20 ? Math.ceil(ticks.length / 8) : ticks.length > 10 ? 2 : 1;

  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginBottom: 10 }}>
        {usable.map(s => (
          <span key={s.name} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 14, height: 2, background: s.color, flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: "var(--ink-soft)" }}>
              {tr(s.name)}
              {s.abbr && (
                <span style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--ink-mute)", marginLeft: 4 }}>
                  {s.abbr}
                </span>
              )}
            </span>
          </span>
        ))}
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={usable.map(s => `${s.name} over time`).join(", ")}
        style={{ width: "100%", height, display: "block", overflow: "visible" }}
      >
        {[0, 0.5, 1].map(f => (
          <line
            key={f}
            x1={0} x2={W} y1={H * f} y2={H * f}
            stroke="var(--rule)" strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {usable.map(s => (
          <path
            key={s.name}
            d={path(s.points)}
            fill="none"
            stroke={s.color}
            strokeWidth={1.75}
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>

      <div style={{ display: "flex", marginTop: 5, borderTop: "1px solid var(--rule)", paddingTop: 5 }}>
        {ticks.map((p, i) => (
          <div key={p.day} style={{ flex: 1, minWidth: 0, textAlign: "center" }}>
            {i % tickEvery === 0 && (
              <span style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--ink-faint)", whiteSpace: "nowrap" }}>
                {dayTick(p.day)}
              </span>
            )}
          </div>
        ))}
      </div>
      <div style={{ ...MONO_LABEL, fontSize: 9, marginTop: 6 }}>{tr("Peak")} {max}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Donut. Square SVG so it never distorts; legend and caption in HTML.
// ---------------------------------------------------------------------------
export function DonutChart({
  data, caption, size = 132, emptyMessage = "Nothing to break down yet",
  showZeroLegend,
}: {
  data: Array<{ label: string; count: number; color: string }>;
  caption?: string;
  size?: number;
  emptyMessage?: string;
  /**
   * Keep zero-count categories in the legend (they still draw no arc).
   *
   * By default a zero slice disappears from the ring AND the legend, which is
   * right for an open-ended breakdown — an asset type nobody used is noise. It is
   * wrong for a fixed set of states: "nothing is in progress" is a fact the reader
   * needs, and silently dropping the row makes the category look nonexistent
   * rather than empty.
   */
  showZeroLegend?: boolean;
}) {
  const tr = useTr();
  const slices = data.filter(d => d.count > 0);
  const total = slices.reduce((s, d) => s + d.count, 0);
  if (total === 0) return <EmptyChart message={emptyMessage} />;
  const legend = showZeroLegend ? data : slices;

  const R = 42;
  const C = 2 * Math.PI * R;
  let offset = 0;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
      <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
        <svg
          viewBox="0 0 100 100"
          role="img"
          aria-label={legend.map(d => `${d.label}: ${d.count}`).join(", ")}
          style={{ width: size, height: size, transform: "rotate(-90deg)" }}
        >
          <circle cx={50} cy={50} r={R} fill="none" stroke="var(--surface-sunk)" strokeWidth={14} />
          {slices.map(d => {
            const len = (d.count / total) * C;
            const el = (
              <circle
                key={d.label}
                cx={50} cy={50} r={R}
                fill="none"
                stroke={d.color}
                strokeWidth={14}
                strokeDasharray={`${len} ${C - len}`}
                strokeDashoffset={-offset}
              />
            );
            offset += len;
            return el;
          })}
        </svg>
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          pointerEvents: "none",
        }}>
          <span style={{ ...SERIF_NUM, fontSize: 22, color: "var(--ink)" }}>{total}</span>
          <span style={{ ...MONO_LABEL, fontSize: 8 }}>total</span>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 7, minWidth: 0, flex: 1 }}>
        {legend.map(d => (
          <div key={d.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 10, height: 10, background: d.color, borderRadius: "var(--r-sm)", flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: "var(--ink-soft)", flex: 1, minWidth: 0 }}>{tr(d.label)}</span>
            <span style={{ fontFamily: "var(--mono)", fontSize: 11, fontWeight: 600, color: "var(--ink)" }}>
              {d.count}
            </span>
            <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-mute)", width: 34, textAlign: "right" }}>
              {Math.round((d.count / total) * 100)}%
            </span>
          </div>
        ))}
        {caption && (
          <div style={{ ...MONO_LABEL, fontSize: 9, marginTop: 4, borderTop: "1px solid var(--rule)", paddingTop: 7 }}>
            {caption}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Horizontal bar-list. Same shape as the existing Leads by Stage strip:
// label left, filled bar middle, number right.
// ---------------------------------------------------------------------------
export function BarList({
  data, accent = "var(--green-deep)", labelWidth = 110, emptyMessage = "Nothing to rank yet",
  maxHeight, translateLabels = false,
}: {
  /**
   * `note` is the trailing value (a cost, a secondary count). It replaced a
   * `suffix(row)` callback that callers implemented by `.find()`-ing the same
   * array back by label — O(n²), and worse, it returned the WRONG value whenever
   * two rows shared a display name. Carrying the note on the row removes both
   * problems: the caller already has the object when it builds the data.
   */
  data: Array<{ label: string; count: number; color?: string; note?: string | null; href?: string }>;
  accent?: string;
  labelWidth?: number;
  emptyMessage?: string;
  /** Caps the list and scrolls past it. Unset means grow to fit. */
  maxHeight?: number;
  /**
   * Off by default: four of the five call sites rank PEOPLE (top assignees,
   * top creators, leads by user), and a person's name must render as stored.
   * Opt in only where the labels are a vocabulary this app defines, like the
   * KarmYog score bands.
   */
  translateLabels?: boolean;
}) {
  const tr = useTr();
  if (data.length === 0) return <EmptyChart message={emptyMessage} />;
  const max = Math.max(...data.map(d => d.count), 1);

  return (
    <div
      className={maxHeight ? "themed-scroll-y" : undefined}
      style={{
        display: "flex", flexDirection: "column", gap: 6,
        ...(maxHeight ? { maxHeight, overflowY: "auto" as const } : null),
      }}
    >
      {data.map(d => {
        const extra = d.note ?? null;
        // A row with an href becomes the link to its own slice of the data —
        // clicking a grade band opens exactly the evaluations in that band.
        const Row = d.href
          ? ({ children }: { children: React.ReactNode }) => (
              <Link href={d.href!} className="dash-bar-row" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", color: "inherit", borderRadius: "var(--r-sm)" }}>
                {children}
              </Link>
            )
          : ({ children }: { children: React.ReactNode }) => (
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>{children}</div>
            );
        return (
          <Row key={d.label}>
            <div
              title={d.label}
              style={{
                width: labelWidth, flexShrink: 0,
                fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-soft)",
                textTransform: "uppercase",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}
            >
              {translateLabels ? tr(d.label) : d.label}
            </div>
            {/* Decorative: the count is right there as text, so a screen reader
                announcing the bar as well would just repeat it. */}
            <div aria-hidden style={{ flex: 1, height: 18, background: "var(--surface-sunk)", borderRadius: 2, overflow: "hidden", minWidth: 0 }}>
              <div style={{
                width: `${(d.count / max) * 100}%`,
                height: "100%",
                background: d.color || accent,
                borderRadius: 2,
                transition: "width .3s",
              }} />
            </div>
            {extra && (
              <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-mute)", whiteSpace: "nowrap" }}>
                {extra}
              </div>
            )}
            <div style={{ minWidth: 30, fontFamily: "var(--mono)", fontSize: 12, fontWeight: 600, textAlign: "right" }}>
              {d.count}
            </div>
          </Row>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Funnel. Same bar-list vocabulary, plus per-step drop-off.
// ---------------------------------------------------------------------------
export function FunnelChart({
  steps, accent = "var(--green-deep)",
}: {
  steps: Array<{ label: string; count: number }>;
  accent?: string;
}) {
  const tr = useTr();
  const top = Math.max(steps[0]?.count ?? 0, 1);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {steps.map((s, i) => {
        const prev = i > 0 ? steps[i - 1].count : null;
        const drop = prev != null && prev > 0 ? Math.round(((prev - s.count) / prev) * 100) : null;
        return (
          <div key={s.label}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 4, gap: 8 }}>
              <span style={{ fontSize: 12, color: "var(--ink-soft)" }}>{tr(s.label)}</span>
              <span style={{ display: "inline-flex", alignItems: "baseline", gap: 8 }}>
                {drop != null && drop > 0 && (
                  <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--terracotta)" }}>
                    -{drop}%
                  </span>
                )}
                <span style={{ ...SERIF_NUM, fontSize: 16, color: "var(--ink)" }}>{s.count}</span>
              </span>
            </div>
            <div aria-hidden style={{ height: 12, background: "var(--surface-sunk)", borderRadius: 2, overflow: "hidden" }}>
              <div style={{
                width: `${(s.count / top) * 100}%`,
                height: "100%",
                background: accent,
                borderRadius: 2,
                transition: "width .3s",
              }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Thin progress bar with a percentage, for rate-style stats.
// ---------------------------------------------------------------------------
export function ProgressStat({
  label, percent, detail, accent = "var(--ok)", warning,
}: {
  label: string;
  percent: number;
  detail?: string;
  accent?: string;
  warning?: string;
}) {
  const pct = Math.max(0, Math.min(100, percent));
  return (
    <div style={{
      background: "var(--surface)",
      border: "1px solid var(--rule)",
      borderRadius: "var(--r-md)",
      padding: "var(--card-pad)",
    }}>
      <div style={{ ...MONO_LABEL, marginBottom: 6 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 10 }}>
        <span style={{ ...SERIF_NUM, fontSize: 28, color: "var(--ink)" }}>{pct}%</span>
        {detail && <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-mute)" }}>{detail}</span>}
      </div>
      <div
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${label}: ${pct}%`}
        style={{ height: 6, background: "var(--surface-sunk)", borderRadius: 3, overflow: "hidden" }}
      >
        <div style={{ width: `${pct}%`, height: "100%", background: accent, borderRadius: 3, transition: "width .3s" }} />
      </div>
      {warning && (
        <div style={{
          marginTop: 12,
          fontSize: 11,
          lineHeight: 1.5,
          color: "var(--crit)",
          background: "var(--crit-wash)",
          border: "1px solid var(--crit)",
          borderRadius: "var(--r-sm)",
          padding: "8px 10px",
        }}>
          {warning}
        </div>
      )}
    </div>
  );
}
