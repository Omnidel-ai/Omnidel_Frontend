import { useEffect, useMemo, useState } from "react";
import {
  Badge,
  Button,
  EmptyState,
  PageHeader,
  SearchBar,
  SkeletonCard,
  type BadgeTone,
} from "../components/common";
import { CardGrid } from "../omnipulse/cards";
import type { MartMission, MartMissionsData } from "./types";

const STATUS: Record<string, { label: string; tone: BadgeTone; ink: string }> = {
  green: { label: "On track", tone: "ok", ink: "var(--ok)" },
  amber: { label: "Behind", tone: "amber", ink: "var(--amber)" },
  red: { label: "At risk", tone: "crit", ink: "var(--crit)" },
};

export interface MissionsPageProps {
  data: MartMissionsData;
}

/**
 * Missions — the promises, and whether the current pace reaches them.
 *
 * Cards rather than a table, as in the application: each one is a headline
 * number against a target, a bar, and a sentence that says in plain words
 * whether the pace is enough. The sentence is the point — a percentage alone
 * does not tell anyone whether to worry.
 */
export function MissionsPage({ data }: MissionsPageProps) {
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(() => typeof window !== "undefined");

  useEffect(() => {
    const id = window.setTimeout(() => setLoading(false), 600);
    return () => window.clearTimeout(id);
  }, []);

  const q = search.trim().toLowerCase();
  const rows = useMemo(
    () =>
      data.rows.filter(
        (m) => !q || m.name.toLowerCase().includes(q) || m.stream.toLowerCase().includes(q),
      ),
    [data.rows, q],
  );

  const atRisk = data.rows.filter((m) => m.status !== "green").length;

  return (
    <div>
      <PageHeader
        eyebrow="OmniMart"
        crumbs={[{ label: "OmniMart" }, { label: data.label }]}
        actions={
          <span className="ui-meta" >
            {atRisk === 0 ? "all on track" : `${atRisk} needing attention`}
          </span>
        }
      />

      <p className="mart-subtitle">{data.subtitle}</p>

      <div className="opx-toolbar">
        <SearchBar value={search} onChange={setSearch} placeholder={data.searchPlaceholder} width={320} />
      </div>

      {loading ? (
        <CardGrid>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <SkeletonCard key={i} lines={3} media={28} />
          ))}
        </CardGrid>
      ) : rows.length === 0 ? (
        <EmptyState
          size="card"
          variant={q ? "no-results" : "empty"}
          title={q ? `No missions match “${q}”` : data.emptyMessage}
          description={q ? "Clear the search to see them all." : data.emptyHint}
          action={
            q ? (
              <Button variant="secondary" size="sm" onClick={() => setSearch("")}>
                Clear search
              </Button>
            ) : undefined
          }
        />
      ) : (
        <CardGrid>
          {rows.map((m) => (
            <MissionCard key={m.id} mission={m} />
          ))}
        </CardGrid>
      )}
    </div>
  );
}

function MissionCard({ mission }: { mission: MartMission }) {
  const s = STATUS[mission.status] ?? STATUS.green;
  const pct = mission.target > 0 ? Math.min(100, Math.round((mission.current / mission.target) * 100)) : 0;
  const onPace = mission.requiredPace <= 0 || mission.actualPace >= mission.requiredPace;
  const remaining = Math.max(0, mission.target - mission.current);

  // The plain-language line the application leads with: what the pace is, and
  // what it would have to be.
  const pace = onPace
    ? `Doing ${fmt(mission.actualPace)}/day`
    : `Doing ${fmt(mission.actualPace)}/day, needs ${fmt(mission.requiredPace)}/day`;

  return (
    <article className="mart-mission">
      <header style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
        <div style={{ minWidth: 0 }}>
          <div className="mart-mission__stream">{mission.stream}</div>
          <h3 style={{ fontFamily: "var(--serif)", fontSize: 18, lineHeight: 1.25 }}>{mission.name}</h3>
        </div>
        <Badge tone={s.tone} dot={s.ink}>
          {s.label}
        </Badge>
      </header>

      <p style={{ fontSize: 12, color: s.ink, fontWeight: 500, margin: "6px 0 14px", lineHeight: 1.4 }}>
        {s.label} — {pace}
      </p>

      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 7 }}>
        <span style={{ display: "flex", alignItems: "baseline", gap: 5, minWidth: 0 }}>
          <span style={{ fontFamily: "var(--serif)", fontSize: 26, lineHeight: 1 }}>
            {fmt(mission.current)}
          </span>
          <span style={{ fontSize: 13, color: "var(--ink-mute)" }}>
            of {fmt(mission.target)} {mission.unit}
          </span>
        </span>
        <span
          style={{
            fontFamily: "var(--mono)",
            fontSize: 13,
            fontWeight: 600,
            color: pct >= 50 ? s.ink : "var(--ink-soft)",
          }}
        >
          {pct}%
        </span>
      </div>

      <div className="mart-mission__track">
        <div
          className="mart-mission__fill"
          style={{ width: `${Math.max(pct, pct > 0 ? 2 : 0)}%`, background: s.ink }}
        />
      </div>

      <div style={{ display: "flex", gap: 12, marginTop: 8, flexWrap: "wrap", fontSize: 12, color: "var(--ink-soft)" }}>
        <span>
          <strong className="mart-mission__num">{fmt(remaining)}</strong> to go
        </span>
        <span>
          <strong className="mart-mission__num">{mission.daysLeft}</strong> days left
        </span>
        <span>
          <strong className="mart-mission__num">{mission.tasks.open}</strong> open tasks
        </span>
      </div>
    </article>
  );
}

/** Whole numbers plain, fractions to one place — "21.4", "6,420". */
function fmt(n: number): string {
  return Number.isInteger(n) ? n.toLocaleString("en-IN") : n.toFixed(1);
}
