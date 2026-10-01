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
import { MissionsPage } from "../src/omnimart";
import { AcharyaDashboard } from "../src/omnivarsity";
import { ListPage } from "../src/lists";
import { WorkHome } from "../src/home";
import { HomePage as AboutPage } from "../src/playground/HomePage";
import { AdminScreen } from "../src/admin/AdminScreen";
import { MartScreen } from "../src/omnimart/MartScreen";
import { VarsityScreen } from "../src/omnivarsity/VarsityScreen";
import { PulseScreen } from "../src/omnipulse/PulseScreen";
import demo from "../src/data/demo.json";
import masters from "../src/data/masters.json";
import omnipulse from "../src/data/omnipulse.json";
import omnimart from "../src/data/omnimart.json";
import omnivarsity from "../src/data/omnivarsity.json";
import type { DemoData, DemoMaster } from "../src/data/types";
import type { OmniPulseData } from "../src/omnipulse";
import type { OmniMartData } from "../src/omnimart";
import type { OmniVarsityData } from "../src/omnivarsity";

const DATA = { ...demo, masters: masters as DemoMaster[] } as DemoData;
const PULSE = omnipulse as OmniPulseData;
const MART = omnimart as OmniMartData;
const VARSITY = omnivarsity as OmniVarsityData;

interface Screen {
  name: string;
  html: string;
  markers: Array<[string, string]>;
}

// `ErrorBoundary` is not covered here on purpose: React's server renderer
// rethrows rather than letting a boundary catch, so a test of it would be a
// test of the harness. It is a browser behaviour, checked in the browser.

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
      ["a pipeline stage in the nav", "Site Visit Scheduled"],
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
      // The upload controls, which render against the mock client.
      ["dropzone", "dropzone__prompt"],
      ["dropzone policy line", "dropzone__policy"],
      ["upload field", "upload-field__count"],
      ["image field", "Upload photo"],
      ["file kind rows", "Site survey"],
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
      ["subtitle", PULSE.teams.subtitle],
      ["system-generated label", "System generated"],
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
      // Two score columns, because what the acharya said and what the reviewer
      // decided are two facts.
      ["acharya score column", "Acharya"],
      ["final score column", "Final"],
      ["a score out of ten", "/10"],
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
      ["card title opens the sheet", "opx-card-item__title"],
      ["task count", `${PULSE.boards[0].taskCount}`],
      ["add a task", "+ Add a task"],
      ["add list", "+ Add list"],
      ["drop hint", "Drop tasks here"],
      ["priority chip", "opx-chip--med"],
      ["overdue chip", "opx-chip--overdue"],
      ["members", PULSE.boards[0].members[0]],
    ],
  },
  {
    name: "home",
    html: renderToString(<WorkHome data={DATA.home} />),
    markers: [
      ["title", DATA.home.title],
      ["eyebrow", "Overview"],
      ["a stat tile", DATA.home.stats[0].label],
      ["assigned to me", "Tasks Assigned to Me"],
      ["assigned by me", "Tasks Assigned by Me"],
      ["mentions", "Mentions"],
      ["announcements", "Announcements"],
      ["tasks by status", "Tasks by Status"],
      ["tasks by mission", "Tasks by Mission"],
      ["a row", DATA.home.assignedToMe.open[0].text],
      ["donut legend", "donut__legend"],
    ],
  },
  {
    name: "omnimart/missions",
    html: renderToString(<MissionsPage data={MART.missions} />),
    markers: [
      // The subtitle carries an apostrophe, which renders escaped.
      ["subtitle", "Where each mission stands"],
      ["a mission", MART.missions.rows[0].name],
      ["stream eyebrow", MART.missions.rows[0].stream],
      ["progress track", "mart-mission__track"],
      ["pace sentence", "Doing"],
    ],
  },
  {
    // The About screen reads the masters. It was not covered here, and a change
    // that stopped handing them down crashed it in the browser instead.
    name: "about",
    html: renderToString(<AboutPage data={DATA} onNavigate={() => undefined} />),
    markers: [
      ["brand", DATA.brand.name],
      ["master count", String(DATA.masters.length)],
      ["a master listed", DATA.masters[0].label],
    ],
  },
  {
    // The module screens: each owns its data now, so each is rendered from its
    // route the way the application renders it.
    name: "screens/admin by route",
    html: renderToString(<AdminScreen masterKey="lanes" />),
    markers: [["the right master", "LN-001"], ["table", "table-wrap"]],
  },
  {
    name: "screens/omnimart by route",
    html: renderToString(<MartScreen href="/omnimart/missions" />),
    markers: [["missions", "mart-mission__track"]],
  },
  {
    name: "screens/omnivarsity by route",
    html: renderToString(<VarsityScreen href="/omnivarsity/acharyas" />),
    markers: [["the acharya list", "table-header"]],
  },
  {
    name: "screens/omnipulse by route",
    html: renderToString(<PulseScreen href="/omnipulse/review" onNavigate={() => undefined} />),
    markers: [["the review queue", "table-header"], ["a score out of ten", "/10"]],
  },
  {
    name: "omnivarsity/dashboard",
    html: renderToString(<AcharyaDashboard data={VARSITY.dashboard} />),
    markers: [
      ["crumb", VARSITY.dashboard.label],
      ["sections", VARSITY.dashboard.tabs[1]],
      ["range", VARSITY.dashboard.ranges[2]],
      ["a washed tile", "stat-tile--wash"],
      ["a counter", VARSITY.dashboard.tiles[0].value],
      ["an accented panel", "panel--accent"],
      ["a recent row", VARSITY.dashboard.panels[1].items[0].text],
      ["an empty panel", VARSITY.dashboard.panels[0].empty],
    ],
  },
  // Every work list in the workspace, through the one component — OmniMart's
  // four and OmniVarsity's two — with the pieces only some of them declare
  // asserted where they are declared.
  ...[...MART.lists, ...VARSITY.lists].map((l) => ({
    name: `${l.module.toLowerCase()}/${l.key}`,
    html: renderToString(<ListPage list={l} />),
    markers: (l.tabs?.[0]?.kind === "overview"
      ? [
          // Store opens on its KPI tiles, so that is what SSR renders.
          ["views in the header", l.tabs![1].label],
          ["overview title", l.overview!.title],
          ["a store tile", l.overview!.stores[0].name],
          ["tile track", "mart-kpi__track"],
        ]
      : [
          ["views in the header", l.tabs?.[0].label ?? l.label],
          ["table header", "table-header"],
          ["first column", l.columns[0].header],
          ["a data row", String(l.rows[0][l.columns[1].key] ?? l.rows[0].id)],
          // Placeholders carry an ampersand, which renders escaped.
          ["search", l.searchPlaceholder.replace(/&/g, "&amp;")],
          ...(l.exportable ? [["export", "Export CSV"]] : []),
          ...(l.tabs && l.tabs.length > 1 ? [["tabs", l.tabs[1].label]] : []),
          ...(l.rowActions?.length ? [["row action", l.rowActions[0]]] : []),
        ]) as Array<[string, string]>,
  })),
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
