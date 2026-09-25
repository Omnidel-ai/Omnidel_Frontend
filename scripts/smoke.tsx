/**
 * Render smoke test.
 *
 * Builds the workspace for the server and renders its three screens — the
 * shell, the playground and a generated admin master — to strings. Every
 * component mounts at least once, so a broken import, a bad hook call or a
 * crash in a render path fails here instead of in the browser. It is not a
 * substitute for looking at the page; it checks that there is a page to look at.
 *
 *   npm run smoke
 */
import { renderToString } from "react-dom/server";
import { App } from "../src/App";
import { Playground } from "../src/playground/Playground";
import { AdminPage, SettingsPage } from "../src/admin";
import { DashboardHome } from "../src/dashboard";
import { BoardPage, ProjectsPage, ReviewPage, TeamsPage } from "../src/omnipulse";
import demo from "../src/data/demo.json";
import masters from "../src/data/masters.json";
import omnipulse from "../src/data/omnipulse.json";
import type { DemoData, DemoMaster } from "../src/data/types";
import type { OmniPulseData } from "../src/omnipulse";

const DATA = { ...demo, masters: masters as DemoMaster[] } as DemoData;
const PULSE = omnipulse as OmniPulseData;

interface Screen {
  name: string;
  html: string;
  markers: Array<[string, string]>;
}

const screens: Screen[] = [
  {
    name: "shell + home",
    html: renderToString(<App />),
    markers: [
      ["sidebar nav", "sidebar-nav"],
      ["nav rows", "nav-link"],
      ["status bar", "shell-statusbar"],
      ["assistant pill", "Ask MahAcharya"],
      ["brand", DATA.brand.name],
      ["masters listed", DATA.masters[0].label],
      // The Admin tree is three levels deep: item → group → page. The group
      // labels carry an ampersand, which renders escaped.
      ["admin group (sales)", "Sales &amp; Pipeline"],
      ["admin group (people)", "People &amp; Access"],
      ["a page inside a group", "Pipeline Stages"],
    ],
  },
  {
    name: "playground",
    html: renderToString(<Playground />),
    markers: [
      ["primary button", "btn-primary"],
      ["form input", "form-input"],
      ["table card", "table-wrap"],
      ["table header", "table-header"],
      ["badge", 'class="tag"'],
      ["picker field", "picker-field"],
      ["empty state", "No trade types yet"],
      ["no-results empty state", "No lanes match"],
      ["skeleton", "skeleton-bar"],
      // A real data row, since the admin screens SSR in their loading state.
      ["rendered data row", "LN-001"],
    ],
  },
  {
    // Renders in its loading state, which is what SSR sees — so this asserts
    // the skeleton path as well as the panels.
    name: "dashboard (loading)",
    html: renderToString(<DashboardHome data={DATA} onNavigate={() => undefined} />),
    markers: [
      ["greeting", DATA.dashboard.greeting],
      ["stat skeletons", "skeleton-bar"],
      ["weekly panel", DATA.dashboard.weekly.label],
      ["stages panel", DATA.dashboard.stages.label],
      ["status panel", "Work by status"],
      ["activity panel", "Recent activity"],
      ["range filter", "12 weeks"],
    ],
  },
  // Every master, through the one shared page — and each optional parameter
  // asserted on the masters that declare it, so the layout staying shared does
  // not mean the extras quietly stopped rendering.
  {
    // OmniPulse renders in its loading state on the server, like the admin
    // screens did before their rows were ready — so these assert the chrome
    // and the skeletons.
    name: "omnipulse/teams",
    html: renderToString(<TeamsPage data={PULSE.teams} onOpen={() => undefined} />),
    markers: [
      ["toolbar", "opx-toolbar"],
      ["search", PULSE.teams.searchPlaceholder],
      ["quick toggle", PULSE.teams.toggles[0].label],
      ["new team", "+ New Team"],
      ["a team card", PULSE.teams.rows[0].name],
      ["member count", "members"],
    ],
  },
  {
    name: "omnipulse/projects",
    html: renderToString(
      <ProjectsPage
        data={PULSE.projects}
        teams={PULSE.teams.rows}
        onTeamChange={() => undefined}
        onOpen={() => undefined}
      />,
    ),
    markers: [
      ["toolbar", "opx-toolbar"],
      ["view toggle", "Table"],
      ["subtitle", PULSE.projects.subtitle],
      ["new project", "+ New Project"],
      ["planned/doing/done", "opx-counts"],
      ["row actions", "View"],
      ["a project row", PULSE.projects.rows[0].name],
      ["team chip", PULSE.projects.rows[0].team],
    ],
  },
  {
    name: "omnipulse/review",
    html: renderToString(<ReviewPage data={PULSE.review} />),
    markers: [
      ["queue table", "table-header"],
      ["tabs", PULSE.review.tabs[0].label],
      ["karigar column", "Karigar"],
      ["score column", "Score"],
      ["a submission", PULSE.review.rows[0].task],
    ],
  },
  {
    name: "omnipulse/board",
    html: renderToString(
      <BoardPage board={PULSE.boards[0]} data={PULSE} onBack={() => undefined} />,
    ),
    markers: [
      ["board", "opx-board"],
      ["list", "opx-list"],
      ["board name", PULSE.boards[0].name],
      ["a list", PULSE.boards[0].lists[0].title],
      ["a card", PULSE.boards[0].lists[0].cards[0].title],
      ["tinted list", "opx-list--ochre"],
      ["view tabs", "Calendar"],
      ["task count", `${PULSE.boards[0].taskCount}`],
      ["add a task", "+ Add a task"],
      ["add list", "+ Add list"],
      ["drop hint", "Drop tasks here"],
      ["priority chip", "opx-chip--med"],
      ["overdue chip", "opx-chip--overdue"],
      ["members", PULSE.boards[0].members[0]],
    ],
  },
  ...DATA.settings.map((st) => ({
    name: `admin/${st.key}`,
    html: renderToString(<SettingsPage settings={st} />),
    markers: [
      ["title", st.label],
      ["first group", st.groups[0].title],
      ["last group", st.groups[st.groups.length - 1].title],
      ["a field label", st.groups[0].fields[0].label],
      ["clean state", "No unsaved changes"],
    ] as Array<[string, string]>,
  })),
  ...DATA.masters.map((m) => ({
    name: `admin/${m.key}`,
    html: renderToString(<AdminPage master={m} />),
    markers: [
      ["toolbar", "table-toolbar"],
      ["table card", "table-wrap"],
      ["table header", "table-header"],
      ["first column header", m.columns[0].header],
      ["add button", m.singular.toLowerCase()],
      ...(m.rows.length > 0
        ? ([["a data row", String(m.rows[0][m.columns[0].key] ?? m.rows[0].id)]] as Array<[string, string]>)
        : ([["empty state", m.emptyMessage ?? "yet"]] as Array<[string, string]>)),
      ...(m.reorder ? ([["reorder arrows", "arrow-btn"]] as Array<[string, string]>) : []),
      ...(m.singleFlag ? ([["default action", m.singleFlag.action ?? "Make default"]] as Array<[string, string]>) : []),
      ...(m.detail ? ([["detail action", m.detail.action]] as Array<[string, string]>) : []),
      ...(m.exportable ? ([["csv export", "Download CSV"]] as Array<[string, string]>) : []),
      ...(m.summary?.length ? ([["summary strip", m.summary[0].label]] as Array<[string, string]>) : []),
      ...(m.tabs?.length ? ([["group tabs", m.tabs[0].label]] as Array<[string, string]>) : []),
      ...(m.filters?.length ? ([["extra filter", `Any ${m.filters[0].label.toLowerCase()}`]] as Array<[string, string]>) : []),
    ] as Array<[string, string]>,
  })),
];

let failed = 0;
for (const s of screens) {
  const missing = s.markers.filter(([, needle]) => !s.html.includes(needle));
  if (missing.length > 0) {
    failed++;
    console.error(`FAIL  ${s.name} — missing: ${missing.map(([n]) => n).join(", ")}`);
  } else {
    console.log(`ok    ${s.name} (${s.html.length} chars, ${s.markers.length} markers)`);
  }
}

if (failed > 0) {
  console.error(`\nSmoke test FAILED — ${failed} of ${screens.length} screens.`);
  process.exit(1);
}
console.log(`\nSmoke test passed — ${screens.length} screens rendered.`);
