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
import { AdminPage } from "../src/admin";
import demo from "../src/data/demo.json";
import type { DemoData } from "../src/data/types";

const DATA = demo as DemoData;

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
    ],
  },
  ...DATA.masters.map((m) => ({
    name: `admin/${m.key}`,
    html: renderToString(<AdminPage master={m} />),
    markers: [
      ["toolbar", "table-toolbar"],
      ["table card", "table-wrap"],
      ["table header", "table-header"],
      ["table row", "table-row"],
      ["first column header", m.columns[0].header],
      ["add button", m.singular.toLowerCase()],
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
