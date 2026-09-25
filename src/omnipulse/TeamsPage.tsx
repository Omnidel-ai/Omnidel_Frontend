import { useEffect, useMemo, useState } from "react";
import {
  Badge,
  Button,
  EmptyState,
  Menu,
  MultiFilter,
  PinButton,
  SkeletonCard,
  emitToast,
} from "../components";
import type { OmniPulseTeam, OmniPulseTeamsData } from "./types";
import { Card, CardGrid, CardIcon, CardMeta, CardTitle, QuickToggle, TeamGlyph } from "./cards";

export interface TeamsPageProps {
  data: OmniPulseTeamsData;
  /** Open a team's projects. */
  onOpen: (team: OmniPulseTeam) => void;
}

/**
 * Teams — the OmniPulse landing.
 *
 * A card grid rather than a table, because the application's is: a team is a
 * name, a lead and two counts, and that reads better as a tile than as a row.
 * The toolbar shape (search on the left, quick toggles and the action on the
 * right, one line even on a phone) comes straight from the app.
 */
export function TeamsPage({ data, onOpen }: TeamsPageProps) {
  const [search, setSearch] = useState("");
  const [toggles, setToggles] = useState<Record<string, boolean>>({});
  // Loaded on the server (the rows are already in hand); in the browser the
  // screen opens through its skeleton, which is where the read will go.
  const [pinned, setPinned] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(() => typeof window !== "undefined");

  useEffect(() => {
    const id = window.setTimeout(() => setLoading(false), 600);
    return () => window.clearTimeout(id);
  }, []);

  const showArchived = Boolean(toggles.archived);
  const onlyWithProjects = Boolean(toggles.withProjects);
  const q = search.trim().toLowerCase();

  const filtered = useMemo(
    () =>
      data.rows.filter((t) => {
        if (Boolean(t.archived) !== showArchived) return false;
        if (onlyWithProjects && t.projects === 0) return false;
        if (!q) return true;
        return t.name.toLowerCase().includes(q) || t.lead.toLowerCase().includes(q);
      }),
    [data.rows, showArchived, onlyWithProjects, q],
  );

  const narrowed = Boolean(q) || onlyWithProjects || showArchived;

  return (
    <div>
      <header style={{ marginBottom: 16 }}>
        <h1 className="opx-title">
          <span>OmniPulse</span>
          <span className="opx-title__sep">/</span>
          <span className="opx-title__current">{data.label}</span>
        </h1>
        <p className="opx-subtitle">
          {data.rows.filter((t) => !t.archived).length} teams you can open.
        </p>
      </header>

      <div className="opx-toolbar">
        <MultiFilter
          searchInput={search}
          onSearchChange={setSearch}
          searchPlaceholder={data.searchPlaceholder}
          sections={data.toggles.map((t) => ({
            kind: "toggle" as const,
            key: t.key,
            label: t.label,
            checked: Boolean(toggles[t.key]),
            onChange: (next: boolean) => setToggles((v) => ({ ...v, [t.key]: next })),
          }))}
        />
        <div className="opx-toolbar__actions">
          {data.toggles.map((t) => (
            <QuickToggle
              key={t.key}
              label={t.label}
              title={t.title}
              active={Boolean(toggles[t.key])}
              onClick={() => setToggles((v) => ({ ...v, [t.key]: !v[t.key] }))}
            />
          ))}
          <Button size="sm" onClick={() => emitToast("New team — demo", "info")}>
            + New Team
          </Button>
        </div>
      </div>

      {loading ? (
        <CardGrid>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <SkeletonCard key={i} lines={2} />
          ))}
        </CardGrid>
      ) : filtered.length === 0 ? (
        <EmptyState
          size="card"
          variant={narrowed ? "no-results" : "empty"}
          title={narrowed ? "No teams match this view" : data.emptyMessage}
          description={narrowed ? "Clear the search and the toggles to see them all." : data.emptyHint}
          action={
            narrowed ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setSearch("");
                  setToggles({});
                }}
              >
                Clear search and filters
              </Button>
            ) : (
              <Button size="sm">Add the first team</Button>
            )
          }
        />
      ) : (
        <CardGrid>
          {filtered.map((t) => (
            <Card
              key={t.id}
              onClick={() => onOpen(t)}
              muted={t.archived}
              title={`Open ${t.name}`}
              accent={t.archived ? "var(--rule-strong)" : undefined}
              actions={
                <>
                  <Menu
                    size="sm"
                    label={`${t.name} actions`}
                    items={[
                      { label: "Open projects", onClick: () => onOpen(t) },
                      { label: "Team settings", onClick: () => emitToast("Settings — demo", "info") },
                      { label: "Archive team", onClick: () => emitToast("Archive — demo", "info"), tone: "danger", separated: true },
                    ]}
                  />
                  <PinButton
                    pinned={Boolean(pinned[t.id])}
                    onToggle={(next) => setPinned((v) => ({ ...v, [t.id]: next }))}
                    label={t.name}
                    size="sm"
                  />
                </>
              }
            >
              <span style={{ display: "flex", alignItems: "center", gap: 10, paddingRight: 40 }}>
                <CardIcon>
                  <TeamGlyph />
                </CardIcon>
                <CardTitle pad={false}>{t.name}</CardTitle>
              </span>
              <CardMeta>
                <span>
                  {t.projects} {t.projects === 1 ? "project" : "projects"}
                </span>
                <span>
                  {t.members === 0 ? "No members yet" : `${t.members} ${t.members === 1 ? "member" : "members"}`}
                </span>
              </CardMeta>
              <span style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
                <Badge tone="neutral">{t.lead}</Badge>
                {t.archived && <Badge tone="amber">Archived</Badge>}
              </span>
            </Card>
          ))}
        </CardGrid>
      )}
    </div>
  );
}
