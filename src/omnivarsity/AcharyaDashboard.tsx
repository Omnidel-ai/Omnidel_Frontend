import { useEffect, useState } from "react";
import { PageHeader, Panel, PanelCount, Skeleton, StatTile, SubTabs } from "../components";
import type { AcharyaDashboardData, DashboardPanel } from "./types";

export interface AcharyaDashboardProps {
  data: AcharyaDashboardData;
}

/**
 * The Acharya Dashboard — what the mentors did in the last day, week or month.
 *
 * Six counters across the top, then the recent activity behind four of them.
 * The counters are the shared `StatTile` in its washed dress and the lists are
 * the shared `Panel` with a coloured edge, so this screen adds a layout and a
 * descriptor rather than a new set of components.
 *
 * The range buttons and the tabs change what the screen claims to show; on
 * demo data they re-run the same short skeleton and land on the same numbers,
 * which is honest about there being one snapshot behind them.
 */
export function AcharyaDashboard({ data }: AcharyaDashboardProps) {
  const [tab, setTab] = useState(data.tabs[0] ?? "Overview");
  const [range, setRange] = useState(data.defaultRange);
  const [loading, setLoading] = useState(() => typeof window !== "undefined");

  useEffect(() => {
    setLoading(true);
    const id = window.setTimeout(() => setLoading(false), 500);
    return () => window.clearTimeout(id);
  }, [tab, range]);

  // Every tab but Overview narrows to its own panel; Overview shows all four.
  const panels =
    tab === "Overview"
      ? data.panels
      : data.panels.filter((p) => p.title.toLowerCase().includes(tab.toLowerCase()));

  return (
    <div className="varsity-dash">
      <PageHeader
        crumbs={[{ label: "OmniVarsity" }, { label: data.label }, { label: tab }]}
        actions={
          <div style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
            <SubTabs tabs={data.tabs} active={tab} onChange={setTab} ariaLabel="Dashboard sections" />
            <SubTabs
              tabs={data.ranges}
              active={range}
              onChange={setRange}
              variant="pill"
              ariaLabel="Date range"
            />
          </div>
        }
      />

      <div className="varsity-dash__tiles">
        {loading
          ? data.tiles.map((t) => (
              <div key={t.key} className="stat-tile" aria-busy="true">
                <Skeleton width="55%" height={22} />
              </div>
            ))
          : data.tiles.map((t) => (
              <StatTile
                key={t.key}
                label={t.label}
                value={t.value}
                hint={t.hint ? `${t.hint.replace(/7d$/, range.toLowerCase())}` : undefined}
                tone={t.tone}
              />
            ))}
      </div>

      <div className="varsity-dash__panels">
        {panels.map((p) => (
          <ActivityPanel key={p.key} panel={p} loading={loading} />
        ))}
      </div>
    </div>
  );
}

function ActivityPanel({ panel, loading }: { panel: DashboardPanel; loading: boolean }) {
  return (
    <Panel
      title={panel.title}
      accent={panel.accent}
      flush
      actions={<PanelCount n={panel.count} />}
    >
      {loading ? (
        <div style={{ padding: 16, display: "grid", gap: 10 }}>
          <Skeleton height={10} width="70%" />
          <Skeleton height={10} width="45%" />
        </div>
      ) : panel.items.length === 0 ? (
        <p className="panel__empty">{panel.empty}</p>
      ) : (
        <>
          {panel.items.map((it) => (
            <div key={it.id} className="varsity-dash__row">
              <span className="varsity-dash__text" title={it.text}>
                {it.text}
              </span>
              <span className="varsity-dash__meta">{it.meta}</span>
            </div>
          ))}
          <button type="button" className="varsity-dash__all">
            View all →
          </button>
        </>
      )}
    </Panel>
  );
}
