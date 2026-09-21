import { useEffect, useState } from "react";
import {
  Badge,
  Button,
  EmptyState,
  PageHeader,
  Skeleton,
  SkeletonCard,
  SkeletonText,
  SubTabs,
} from "../components";
import type { DemoActivity, DemoData } from "../data/types";
import { StatTile } from "./StatTile";
import { BarColumns, BarRows, Panel, PanelToggle, PointTable, StatusBreakdown } from "./charts";

const RANGES = ["12 weeks", "6 weeks", "4 weeks"];
const RANGE_SIZE: Record<string, number> = { "12 weeks": 12, "6 weeks": 6, "4 weeks": 4 };

/**
 * Dashboard home — the screen the shell opens on.
 *
 * It reads `data.dashboard` and nothing else. The range filter sits in one row
 * above the charts, as a filter should, and it slices the series rather than
 * refetching, because there is nothing to fetch.
 *
 * "Reload" replays the loading state so the skeletons can be seen in place;
 * that button is a demo affordance and would not survive contact with a real
 * API, which has its own loading state.
 */
export function DashboardHome({
  data,
  onNavigate,
}: {
  data: DemoData;
  onNavigate: (href: string) => void;
}) {
  const d = data.dashboard;
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState(RANGES[0]);
  const [weeklyView, setWeeklyView] = useState("Chart");

  // First paint shows skeletons briefly, so the loaded state is never the only
  // thing anyone sees.
  useEffect(() => {
    const id = window.setTimeout(() => setLoading(false), 900);
    return () => window.clearTimeout(id);
  }, []);

  function replay() {
    setLoading(true);
    window.setTimeout(() => setLoading(false), 1200);
  }

  const points = d.weekly.points.slice(-RANGE_SIZE[range]);

  return (
    <div>
      <PageHeader
        eyebrow={d.subtitle}
        crumbs={[{ label: data.brand.name }, { label: "Dashboard" }]}
        actions={
          <>
            <Button variant="ghost" size="sm" onClick={replay}>
              Reload
            </Button>
            <Button variant="secondary" size="sm" onClick={() => onNavigate("/admin/lanes")}>
              Masters
            </Button>
          </>
        }
      />

      <h2 style={{ fontSize: 26, marginBottom: 18 }}>{d.greeting}</h2>

      {/* Stat row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
          gap: 14,
          marginBottom: 18,
        }}
      >
        {loading
          ? Array.from({ length: d.stats.length }).map((_, i) => (
              <div
                key={i}
                aria-busy="true"
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--rule)",
                  borderRadius: "var(--r-md)",
                  padding: "14px 16px",
                }}
              >
                <Skeleton width="45%" height={9} />
                <Skeleton width="65%" height={24} style={{ marginTop: 10 }} />
                <Skeleton width="55%" height={9} style={{ marginTop: 10 }} />
              </div>
            ))
          : d.stats.map((s) => <StatTile key={s.key} stat={s} />)}
      </div>

      {/* Filters in one row above the charts. */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 14,
          flexWrap: "wrap",
        }}
      >
        <span
          style={{
            fontFamily: "var(--mono)",
            fontSize: 10,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "var(--ink-mute)",
          }}
        >
          Range
        </span>
        <SubTabs variant="pill" tabs={RANGES} active={range} onChange={setRange} ariaLabel="Range" />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.6fr) minmax(0, 1fr)",
          gap: 18,
          marginBottom: 18,
        }}
        className="dash-split"
      >
        <Panel
          title={d.weekly.label}
          subtitle={`${d.weekly.unit} · ${range}`}
          actions={
            !loading && (
              <PanelToggle options={["Chart", "Table"]} value={weeklyView} onChange={setWeeklyView} />
            )
          }
        >
          {loading ? (
            <Skeleton shape="block" height={190} />
          ) : weeklyView === "Chart" ? (
            <BarColumns points={points} unit="deliveries" />
          ) : (
            <PointTable points={points} valueHeader="Deliveries" />
          )}
        </Panel>

        <Panel title="Work by status" subtitle="open items">
          {loading ? <SkeletonText lines={4} height={12} /> : <StatusBreakdown items={d.statuses} />}
        </Panel>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
          gap: 18,
        }}
        className="dash-split"
      >
        <Panel title={d.stages.label} subtitle="deals in each stage">
          {loading ? <SkeletonText lines={6} height={10} /> : <BarRows points={d.stages.points} />}
        </Panel>

        <Panel
          title="Recent activity"
          subtitle="last 48 hours"
          actions={
            !loading && (
              <Button variant="ghost" size="sm" onClick={() => onNavigate("/omnipulse/tasks")}>
                All activity
              </Button>
            )
          }
        >
          {loading ? (
            <SkeletonCard avatar lines={2} style={{ border: "none", padding: 0 }} />
          ) : d.activity.length === 0 ? (
            <EmptyState
              variant="empty"
              title="Nothing has happened yet"
              description="Actions taken in the workspace show up here."
            />
          ) : (
            <ActivityFeed items={d.activity} />
          )}
        </Panel>
      </div>
    </div>
  );
}

const TONE: Record<string, { color: string; label: string }> = {
  ok: { color: "var(--ok)", label: "Done" },
  warn: { color: "var(--amber)", label: "Changed" },
  crit: { color: "var(--crit)", label: "Attention" },
  info: { color: "var(--ink-mute)", label: "Note" },
};

function ActivityFeed({ items }: { items: DemoActivity[] }) {
  return (
    <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column" }}>
      {items.map((a, i) => {
        const tone = TONE[a.tone] ?? TONE.info;
        return (
          <li
            key={a.id}
            style={{
              display: "flex",
              gap: 10,
              alignItems: "flex-start",
              padding: "10px 0",
              borderTop: i === 0 ? "none" : "1px solid var(--rule)",
            }}
          >
            <span
              aria-hidden="true"
              style={{
                width: 7,
                height: 7,
                borderRadius: 2,
                background: tone.color,
                marginTop: 6,
                flexShrink: 0,
              }}
            />
            <span style={{ flex: 1, minWidth: 0, fontSize: 13, lineHeight: 1.5 }}>
              <strong style={{ fontWeight: 600 }}>{a.who}</strong> {a.what}
              <span
                style={{
                  display: "block",
                  fontFamily: "var(--mono)",
                  fontSize: 10,
                  color: "var(--ink-faint)",
                  marginTop: 3,
                }}
              >
                {a.at}
              </span>
            </span>
            <Badge tone={a.tone === "ok" ? "ok" : a.tone === "warn" ? "amber" : a.tone === "crit" ? "crit" : "neutral"}>
              {tone.label}
            </Badge>
          </li>
        );
      })}
    </ul>
  );
}
