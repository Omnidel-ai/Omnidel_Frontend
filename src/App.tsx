import { useState } from "react";
import { Toaster } from "./components";
import { ShellLayout } from "./shell";
import { AdminPage, SettingsPage } from "./admin";
import { Playground } from "./playground/Playground";
import { DashboardHome } from "./dashboard";
import { BoardPage, ProjectsPage, ReviewPage, TeamsPage } from "./omnipulse";
import { HomePage } from "./playground/HomePage";
import { PlaceholderPage } from "./playground/PlaceholderPage";
import demo from "./data/demo.json";
import masters from "./data/masters.json";
import omnipulse from "./data/omnipulse.json";
import type { DemoData, DemoMaster } from "./data/types";
import type { OmniPulseData } from "./omnipulse";

// One cast at the edge: JSON has no types, and everything downstream reads the
// declared shapes. The shell's content and the admin descriptors are separate
// files because they answer to different people — when the real API lands,
// these are the lines that change.
const DATA = { ...demo, masters: masters as DemoMaster[] } as DemoData;
const PULSE = omnipulse as OmniPulseData;

/** /admin/<key> → the master or the settings record with that key. */
function adminKey(href: string): string | null {
  return href.startsWith("/admin/") ? href.slice("/admin/".length) : null;
}

/**
 * Demo application.
 *
 * The shell, the admin screens and the playground, wired to `demo.json` and
 * nothing else — no API, no router, no database. `activeHref` is the whole
 * routing layer: the sidebar reports where to go, and this switch decides what
 * to render.
 */
export function App() {
  const [activeHref, setActiveHref] = useState("/home");
  const [search, setSearch] = useState("");
  // OmniPulse's own navigation state: which team narrows Projects, and which
  // board is open. In the app these are route params.
  const [teamId, setTeamId] = useState("");
  const [boardId, setBoardId] = useState<string | null>(null);

  const key = adminKey(activeHref);
  const master = key ? DATA.masters.find((m) => m.key === key) : undefined;
  const settings = key ? DATA.settings.find((s) => s.key === key) : undefined;

  return (
    <>
      <ShellLayout
        data={DATA}
        activeHref={activeHref}
        onNavigate={(href) => {
          setActiveHref(href);
          setBoardId(null);
          if (!href.startsWith("/omnipulse")) setTeamId("");
          setSearch("");
        }}
        search={search}
        onSearchChange={setSearch}
      >
        {master ? (
          // The topbar search reaches the admin table so the shell's search is
          // not decorative; the page keeps its own box too.
          <AdminPage key={master.key} master={master} externalSearch={search} />
        ) : settings ? (
          <SettingsPage key={settings.key} settings={settings} />
        ) : activeHref === "/admin/dashboard" ? (
          // Admin's own dashboard is the dashboard — one component, two routes.
          <DashboardHome data={DATA} onNavigate={setActiveHref} />
        ) : activeHref === "/omnipulse/boards" ? (
          <TeamsPage
            data={PULSE.teams}
            onOpen={(team) => {
              setTeamId(team.id);
              setActiveHref("/omnipulse/projects");
            }}
          />
        ) : activeHref === "/omnipulse/projects" ? (
          boardId ? (
            <BoardPage
              board={PULSE.boards.find((b) => b.id === boardId) ?? PULSE.boards[0]}
              data={PULSE}
              onBack={() => setBoardId(null)}
            />
          ) : (
            <ProjectsPage
              data={PULSE.projects}
              teams={PULSE.teams.rows}
              teamId={teamId}
              onTeamChange={setTeamId}
              onOpen={(project) => {
                // Only one board carries demo lists; the rest open it too
                // rather than showing an empty kanban.
                setBoardId(PULSE.boards.find((b) => b.id === project.id)?.id ?? PULSE.boards[0].id);
              }}
            />
          )
        ) : activeHref === "/omnipulse/review" ? (
          <ReviewPage data={PULSE.review} />
        ) : activeHref === "/playground" ? (
          <Playground />
        ) : activeHref === "/home" ? (
          <DashboardHome data={DATA} onNavigate={setActiveHref} />
        ) : activeHref === "/about" ? (
          <HomePage data={DATA} onNavigate={setActiveHref} />
        ) : (
          <PlaceholderPage href={activeHref} onNavigate={setActiveHref} />
        )}
      </ShellLayout>
      <Toaster />
    </>
  );
}
