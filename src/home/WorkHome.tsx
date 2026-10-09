import { useEffect, useState, type ReactNode } from "react";
import { Panel, PanelCount, PanelExpand, Skeleton, StatTile, SubTabs } from "../components/common";
import { DonutRing } from "./DonutRing";
import type { HomeData, HomeRow } from "./types";

const TONE: Record<string, string> = {
  planned: "var(--rule-strong)",
  doing: "var(--ochre)",
  done: "var(--ok)",
  blocked: "var(--crit)",
};

export interface WorkHomeProps {
  data: HomeData;
}

/**
 * Home — "Your work so far".
 *
 * The screen the application opens on: four counts, then the four things that
 * are actually yours to act on (assigned to me, assigned by me, mentions,
 * announcements), then the two rings that say where the work sits.
 *
 * Every panel is the shared `Panel`, and every table inside one is a plain
 * header strip and rows — a full `Table` would bring pagination and horizontal
 * scrolling that a five-row panel does not want.
 */
export function WorkHome({ data }: WorkHomeProps) {
  const [loading, setLoading] = useState(() => typeof window !== "undefined");
  const [mineTab, setMineTab] = useState("Open");
  const [byMeTab, setByMeTab] = useState("Open");
  // Which panel, if any, has been widened to the full row.
  const [expanded, setExpanded] = useState<string | null>(null);

  const expand = (key: string) => ({
    className: expanded === key ? "home__wide" : undefined,
    control: (
      <PanelExpand expanded={expanded === key} onToggle={() => setExpanded((e) => (e === key ? null : key))} />
    ),
  });

  useEffect(() => {
    const id = window.setTimeout(() => setLoading(false), 600);
    return () => window.clearTimeout(id);
  }, []);

  const mine = mineTab === "Open" ? data.assignedToMe.open : data.assignedToMe.done;
  const byMe = byMeTab === "Open" ? data.assignedByMe.open : data.assignedByMe.done;

  return (
    <div className="home">
      <header>
        <p className="home__eyebrow">
          Overview · {data.today}
        </p>
        <h1 className="home__title">{data.title}</h1>
        <p className="home__subtitle">{data.subtitle}</p>
      </header>

      <div className="home__kpis">
        {loading
          ? [0, 1, 2, 3].map((i) => (
              <div key={i} className="stat-tile" aria-busy="true">
                <Skeleton width="60%" height={20} />
              </div>
            ))
          : data.stats.map((s) => (
              <StatTile key={s.label} label={s.label} value={s.value} icon={<StatGlyph name={s.icon} />} />
            ))}
      </div>

      <div className="home__duo">
        <Panel
          className={expand("mine").className}
          title="Tasks Assigned to Me"
          icon={<StatGlyph name="task" />}
          flush
          actions={
            <>
              <SubTabs
                tabs={["Open", "Done"]}
                active={mineTab}
                onChange={setMineTab}
                variant="pill"
                ariaLabel="Assigned to me"
              />
              <PanelCount n={mine.length} />
              {expand("mine").control}
            </>
          }
        >
          <MiniTable
            columns={["#", "Task", mineTab === "Open" ? "Due" : "Completed"]}
            rows={mine}
            loading={loading}
            empty={`No ${mineTab.toLowerCase()} tasks assigned to you`}
          />
        </Panel>

        <Panel
          className={expand("byme").className}
          title="Tasks Assigned by Me"
          icon={<StatGlyph name="task" />}
          flush
          actions={
            <>
              <SubTabs
                tabs={["Open", "Done"]}
                active={byMeTab}
                onChange={setByMeTab}
                variant="pill"
                ariaLabel="Assigned by me"
              />
              <PanelCount n={byMe.length} />
              {expand("byme").control}
            </>
          }
        >
          <MiniTable
            columns={["#", "Task", "Created"]}
            rows={byMe}
            loading={loading}
            empty={`No ${byMeTab.toLowerCase()} tasks assigned by you`}
          />
        </Panel>

        <Panel
          className={expand("mentions").className}
          title="Mentions"
          icon={<StatGlyph name="comment" />}
          flush
          actions={
            <>
              <PanelCount n={data.mentions.length} />
              {expand("mentions").control}
            </>
          }
        >
          <MiniTable
            columns={["#", "Mention", "Created"]}
            rows={data.mentions}
            loading={loading}
            empty="No mentions yet"
          />
        </Panel>

        <Panel
          className={expand("announcements").className}
          title="Announcements"
          icon={<StatGlyph name="megaphone" />}
          flush
          actions={
            <>
              <PanelCount n={data.announcements.length} />
              {expand("announcements").control}
            </>
          }
        >
          <MiniTable
            columns={["#", "Announcement", "Posted"]}
            rows={data.announcements}
            loading={loading}
            empty="No announcements yet"
          />
        </Panel>
      </div>

      <div className="home__duo">
        <DonutRing
          title="Tasks by Status"
          total={data.byStatus.reduce((n, r) => n + r.value, 0)}
          rows={data.byStatus.map((r) => ({ ...r, color: TONE[r.tone] ?? "var(--ink-mute)" }))}
        />
        <DonutRing
          title="Tasks by Mission"
          total={data.byMission.reduce((n, r) => n + r.value, 0)}
          rows={data.byMission.map((r, i) => ({
            ...r,
            // One hue, stepped — these are parts of one total, not separate
            // identities, so a sequential ramp says more than four hues would.
            color: ["var(--green-deep)", "var(--green)", "var(--green-soft)", "var(--rule-strong)"][i % 4],
          }))}
        />
      </div>
    </div>
  );
}

/** A panel's table: a header strip and its rows, nothing else. */
function MiniTable({
  columns,
  rows,
  loading,
  empty,
}: {
  columns: string[];
  rows: HomeRow[];
  loading?: boolean;
  empty: string;
}) {
  const template = "48px minmax(0, 1fr) 120px";
  return (
    <div>
      <div className="mini__head" style={{ gridTemplateColumns: template }}>
        {columns.map((c) => (
          <span key={c}>{c}</span>
        ))}
      </div>
      {loading ? (
        <div style={{ padding: 16, display: "grid", gap: 10 }}>
          <Skeleton height={10} width="70%" />
          <Skeleton height={10} width="55%" />
        </div>
      ) : rows.length === 0 ? (
        <p className="panel__empty">{empty}</p>
      ) : (
        rows.map((r, i) => (
          <div key={r.id} className="mini__row" style={{ gridTemplateColumns: template }}>
            <span className="mini__seq">{i + 1}</span>
            <span className="mini__text" title={r.text}>
              {r.text}
            </span>
            <span className="mini__meta">{r.meta}</span>
          </div>
        ))
      )}
    </div>
  );
}

const GLYPHS: Record<string, ReactNode> = {
  task: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M8 12l3 3 5-6" />
    </>
  ),
  planned: (
    <>
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <path d="M3 10h18M8 2v4M16 2v4" />
    </>
  ),
  doing: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M10 8.5l6 3.5-6 3.5z" />
    </>
  ),
  done: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8.5 12.5l2.5 2.5 4.5-5" />
    </>
  ),
  comment: <path d="M21 11.5a8.4 8.4 0 0 1-9 8.3L3 21l1.2-3.6A8.4 8.4 0 1 1 21 11.5z" />,
  megaphone: (
    <>
      <path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1z" />
      <path d="M15 9a4 4 0 0 1 0 6" />
    </>
  ),
};

function StatGlyph({ name }: { name?: string }) {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {GLYPHS[name ?? "task"] ?? GLYPHS.task}
    </svg>
  );
}
