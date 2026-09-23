# OmniDel — Shared Components, Shell & Admin UI

An **isolated** frontend workspace: shared UI components, the application
shell, a dashboard home page and the complete admin area — all running on demo
data. There is no API, no database and no auth here, by design.

It is developed in the main OmniDel repository as a standalone folder
(`frontend/`) that the Next.js application does not import and was not modified
to accommodate, and published here so it can be worked on on its own.

```
Omnidel_Frontend/
├── src/
│   ├── components/     ← 1. shared UI components
│   ├── shell/          ← 2. shell components (sidebar, topbar, …)
│   ├── data/           ← 3. demo data (demo.json + masters.json)
│   ├── admin/          ← 5. the admin screens, one layout
│   ├── dashboard/      ← dashboard home page
│   ├── hooks/
│   ├── playground/     ← demo screens + component harness
│   ├── styles/global.css
│   ├── App.tsx         ← 4. shell layout wired to the data
│   └── main.tsx
├── scripts/smoke.tsx
├── package.json  tsconfig.json  vite.config.ts  eslint.config.js  index.html
└── README.md
```

---

## Where this sits in the plan

```
Existing Next.js app → inspect only → current UI / design
          ↓
1. Shared components   src/components/      ✅
2. Shell components    src/shell/           ✅
3. Demo data           src/data/demo.json   ✅
4. Shell layout        src/App.tsx          ✅
5. Generic admin UI    src/admin/           ✅
   Dashboard home      src/dashboard/       ✅
   Empty & loading     EmptyState, Skeleton ✅
6. Testing & polish    typecheck · lint · build · smoke · playground
          ↓
       STOP — backend split lands first
          ↓
     then: connect real APIs
```

Step 6's automated half is done and green. The visual half is the playground
and the shell demo, which need a browser — see [Known limitations](#known-limitations).

---

## Install and run

```bash
npm install
npm run dev        # http://localhost:5300
```

| Script | What it does |
|---|---|
| `npm run dev` | Vite dev server — opens on the shell |
| `npm run build` | Typecheck, then production build to `dist/` |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint (flat config, this project only) |
| `npm run smoke` | Server-renders all 20 screens — shell, playground, dashboard and all 17 admin screens — and asserts the markup, including each descriptor parameter on the masters that declare it |
| `npm run preview` | Serve the production build |

Requirements: Node 20+ (developed on 22.17). The stylesheet pulls Fraunces,
Inter Tight and JetBrains Mono from Google Fonts; without a network the fonts
fall back to Georgia / system sans / a mono face and nothing else changes.

### What you can do in the running app

* **Dashboard** — the landing screen: stat tiles, a 12-week bar chart with a
  range filter and a table view, pipeline-by-stage bars, a status breakdown and
  an activity feed. **Reload** replays the loading state so the skeletons show.
* **About this demo** — what the workspace is, with the masters one click away.
* **Masters (14 screens) and Access (3 screens)** — the complete admin area,
  every screen the same component with a different descriptor: search, filter
  by Active / Inactive / All / Archived, add, edit, activate, archive, restore,
  paginate. Worth opening in particular:
  * **Lead Sources / Missions / Roles** — reorder arrows
  * **Pipeline Stages** — reorder + group tabs + per-row **Fields** panel
  * **Languages** — "Make default", which clears the flag everywhere else
  * **Lanes / State Codes / Users** — **Download CSV** of what the table shows
  * **Trade Types** — no rows, so this is where the empty state lives
  Every screen opens through a skeleton; search for nonsense anywhere to see
  the `no-results` empty state.
* **Components** — the playground, every shared component in every state.
* **Shell** — collapse the sidebar, open a section flyout from the collapsed
  rail, use the topbar search (Ctrl/Cmd+K), open notifications, switch language
  in the profile menu, ask the assistant a question, narrow the window below
  768px for the drawer.

---

## 1. Shared components — `src/components/`

Generic and reusable. A shared component owns presentation; the feature owns
the data.

| | Shared (this project) | Feature (not this project) |
|---|---|---|
| Example | `Table` | `CustomerTable`, `InvoiceTable` |
| Knows about | props | customers, invoices, payments, Postgres |
| Fetches | nothing | its own data |

| Folder | Exports |
|---|---|
| `Button/` | `Button` — 4 variants × 3 sizes, loading, icon slots |
| `Input/` | `Input`, `Textarea`, `Checkbox`, `FormField` |
| `Select/` | `CustomSelect` — portalled dropdown, keyboard nav |
| `SearchBar/` | `SearchBar` — clear button, shortcut hint, Ctrl/Cmd+K binding |
| `SubTabs/` | `SubTabs` — segmented and pill, optional counts |
| `Table/` | `Table`, `TableScroll`, `TableControls`, `Pagination`, `TableAddButton`, `TableRowActions`, `TableAction` + `usePagination`, `useTablePagination`, `useDebouncedSearch` |
| `Filters/` | `MultiFilter`, `MultiSelect`, `DatePicker` |
| `Modal/` | `Modal` — scrim, focus trap, scroll lock |
| `ConfirmDialog/` | `ConfirmDialog` — typed reason, error display, third action |
| `Toast/` | `Toaster`, `emitToast` |
| `PageHeader/` | `PageHeader`, `BreadcrumbTrail` |
| `NoAccessScreen/` | `NoAccessScreen` |
| `Badge/` | `Badge` — 7 tones |
| `EmptyState/` | `EmptyState` — `empty` / `no-results` / `error`, three sizes |
| `Skeleton/` | `Skeleton`, `SkeletonText`, `SkeletonCard`, `SkeletonRows` |
| `StatusToggle/` | `StatusToggle` |
| `Spinner/` | `Spinner` |
| `hooks/` | `useIsMobile`, `useHScrollThumb` |

The checklist came from the separation plan's shared inventory: the components
in `src/components/` that three or more modules reach. Left out deliberately as
feature-owned, not shared: `master-form`, `export-csv-modal`, `task-checklist`,
`dash-charts`, the `mahacharya/*` cards, `recurring-select`, and the
13-component Collaboration cluster (comments, mentions, rich text, share
sheet) — each carries domain knowledge or a heavy dependency.

## 2. Shell components — `src/shell/`

| Folder | Exports | What it does |
|---|---|---|
| `Sidebar/` | `Sidebar`, `NavIcon` | Collapsible rail: sections, inline children, flyouts when collapsed, tooltips, badges, mobile drawer |
| `Topbar/` | `Topbar`, `NotificationBell` | Drawer trigger, global search, notifications with unread count, profile |
| `Profile/` | `Profile` | Avatar trigger + portalled panel: role, phone, teams, language switch, sign out |
| `StatusBar/` | `StatusBar` | Ambient state strip — environment, data source, queues, build |
| `AskMache/` | `AskMache` | Assistant pill → docked chat panel: suggestions, thread, composer, expand, dock left/right |
| — | `ShellLayout` | Composes all five: only the content column scrolls |

Every one of them is data-driven. `Sidebar` has no route table, `Topbar` no
session, `Profile` no auth call, `AskMache` no model. They take props and report
events, exactly like the shared components.

## 3. Demo data — `src/data/`

Two files drive the whole workspace, because they answer to different people:

* **`demo.json`** — the shell: brand, the person in the topbar, the navigation
  tree with its badges, the status strip, the notifications, the assistant's
  canned answers, and the dashboard.
* **`masters.json`** — the 17 admin descriptors, 135 rows.

`src/data/types.ts` declares both shapes and is the only place the JSON is
described. `App.tsx` merges them in one line.

To add a master, add an entry to `masters` — a key, labels, `columns` and
`fields`. It appears in the sidebar and gets a full CRUD screen with no new
component code.

```jsonc
{
  "key": "lanes", "label": "Lanes", "singular": "Lane",
  "module": "OmniMart", "section": "Masters",
  "columns": [
    { "key": "code", "header": "Code", "width": "110px", "type": "code" },
    { "key": "cycle", "header": "Cycle", "type": "badge",
      "tones": { "Daily": "green", "Weekly": "ochre" } },
    { "key": "is_active", "header": "Status", "type": "status" }
  ],
  "fields": [
    { "key": "code", "label": "Code", "type": "text", "required": true, "readOnlyOnEdit": true },
    { "key": "cycle", "label": "Cycle", "type": "select", "options": [ /* … */ ] }
  ],
  "rows": [ /* … */ ]
}
```

Column types: `text · code · badge · flag · number · date · status`.
Field types: `text · textarea · number · select · checkbox · date`.

## 4. Shell layout — `src/App.tsx`

`activeHref` is the entire routing layer: the sidebar reports where to go, and
one switch decides what to render — an admin master, the playground, the home
screen, or a placeholder for the routes the demo does not implement. No router
dependency, because introducing one would be a decision for the real app.

The topbar search is passed into the admin screen, so the shell's search
actually filters the table rather than being decoration.

## Dashboard home — `src/dashboard/`

`DashboardHome` reads `data.dashboard` and nothing else. `StatTile` for the
headline numbers, and `charts.tsx` for the plots: `BarColumns`
(change-over-time, hover tooltip, selective labels, table view),
`BarRows` (magnitude by category), `StatusBreakdown` (state, with a label on
every mark) and `Panel` / `PanelToggle`.

Every chart is **single-series**, so it uses one hue and needs no legend — the
panel title names the series, and identity never rests on colour. The status
breakdown is the one exception and uses the reserved status tokens with a text
label beside each mark. Marks are thin, data-ends carry a 2px radius, bars are
separated by a 2px gap, and the grid is recessive.

## 5. Admin — `src/admin/AdminPage/`, 17 screens, one layout

The application has fourteen admin master pages — 3,564 lines — each
re-implementing the same table, dialog, toggle and archive flow against a
different table. This is that page written **once**, and every admin screen in
the workspace is it:

**Masters (14)** — Lanes, Languages, Locations, Missions, Task Types, Trade
Types, Acharya Types, Lead Sources, Departments, Pipeline Stages, Operation
Stages, Stage Fields, State Codes, Project Types.
**Access (3)** — Users, Roles, Workspaces.

The shared layout is: page header · optional group tabs · optional summary ·
toolbar (search + view + extra filters + export + add) · table · pagination,
with the create/edit dialog, the archive/restore confirm and the toasts behind
it.

### The extras are parameters, not forks

The real pages differ in a handful of ways. Each of those is one optional key
on the descriptor, and a master that declares none renders the plain screen:

| Parameter | What it adds | Used by |
|---|---|---|
| `reorder` | up/down arrows swapping a numeric order field | Lead Sources, Missions, Pipeline/Operation Stages, Roles |
| `singleFlag` | a flag only one row may hold, with a "Make default" action | Languages |
| `filters` | extra equality filters in the toolbar | Lanes, Locations, Task Types, Stage Fields, State Codes, Project Types, Users, Workspaces |
| `tabs` | grouping tabs with counts above the toolbar | Pipeline Stages |
| `summary` | count / sum counters over the rows in view | Lanes, Locations, Task Types, Lead Sources, Departments, Users, Workspaces |
| `exportable` | CSV download of exactly the columns on screen | Lanes, Locations, Lead Sources, State Codes, Users |
| `detail` | a per-row panel of child records, itself descriptor-driven | Pipeline/Operation Stages (fields), Roles (permissions) |

Reordering is disabled while a search, tab or filter is narrowing the list —
the arrows swap with the neighbour *in view*, so they are only meaningful when
the view is the whole ordered set. Two rows sharing an order value say so
rather than silently doing nothing, as the real screens do.

### Files

| File | Job |
|---|---|
| `AdminPage.tsx` | the layout and its state |
| `useMasterRows.ts` | rows + every write — **the seam the real API goes behind** |
| `MasterToolbar.tsx` | search, view, filters, export, add |
| `columns.tsx` | descriptor column → cell, one renderer per type |
| `MasterForm.tsx` | create/edit dialog built from `fields` |
| `DetailPanel.tsx` | child records for one row |
| `SummaryStrip.tsx` | the counters |
| `exportCsv.ts` | client-side CSV, no request |

Column types: `text · code · badge · flag · number · percent · date · status ·
color · chips · user`. Field types: `text · textarea · number · select ·
checkbox · date · color · multiselect`.

Nothing in any of it names a lane, a language or a role. Writes change
component state; reload resets everything.

---

## Usage

```tsx
import { ShellLayout } from "@/shell";
import { AdminPage } from "@/admin";
import demo from "@/data/demo.json";

<ShellLayout data={demo} activeHref={href} onNavigate={setHref}>
  <AdminPage master={demo.masters[0]} />
</ShellLayout>
```

```tsx
import { Table, TableControls, TableAddButton, Pagination, Badge } from "@/components";
import type { Column } from "@/components";

// The row type belongs to the FEATURE, not to the table.
interface Customer { id: string; name: string; status: "active" | "paused" }

const columns: Column<Customer>[] = [
  { key: "name", header: "Name", width: "minmax(180px, 2fr)" },
  { key: "status", header: "Status", width: "120px",
    render: (c) => <Badge tone={c.status === "active" ? "ok" : "amber"}>{c.status}</Badge> },
];

<Table columns={columns} data={customers} rowKey={(c) => c.id} loading={loading} />
```

Every component's props are documented in its own file, next to the code.

---

## States covered

Rendered in the playground — check them there rather than reading this list.

| Component | States |
|---|---|
| Button | default · hover · active · focus-visible · disabled · loading · icon · block |
| Input / Textarea | empty · filled · focus · hint · error · disabled · read-only · icon · counter |
| Checkbox | unchecked · checked · hint · disabled |
| SearchBar | empty · typing · clear · shortcut hint · compact |
| CustomSelect | placeholder · selected · open · keyboard highlight · compact · disabled control · disabled option · deselect |
| MultiSelect | empty · chips · search · no matches · at max · disabled |
| DatePicker | empty · selected · open · today · out of range · error · disabled · clear |
| MultiFilter | idle · N active · popover open · checklist / radio / toggle · match mode · uncheck all |
| Table | normal · loading · empty · long text · many rows · mixed widths · clickable rows · horizontal scroll |
| Pagination | first / middle / last · rows-per-page · hidden total |
| SubTabs | active · inactive · counts · pill · overflow scroll |
| Modal | closed · open · with form · long content · sizes · non-dismissible |
| ConfirmDialog | default · destructive · typed reason · in-flight · failed action · third action |
| Toast | success · info · error · stacked · auto-dismiss · manual dismiss |
| StatusToggle | on · off · busy · disabled |
| PageHeader | short trail · collapsed long trail · eyebrow · actions |
| Badge | 7 tones · with dot |
| EmptyState | empty · no-results · error · inline / card / page · action + secondary action |
| Skeleton | line · circle · block · text block · card · table rows on the real grid |
| Dashboard | loading (skeletons) · loaded · range filter · chart / table view · bar hover · empty activity feed |
| Sidebar | expanded · collapsed · section open · flyout · tooltip · badge · active route · mobile drawer |
| Topbar | desktop · mobile (hamburger + compact profile) · search focus · unread count |
| Profile | closed · open · teams · language selected · sign out |
| NotificationBell | unread count · read · empty · mark all read |
| StatusBar | tones ok / warn / crit / neutral · overflow scroll on a phone |
| AskMache | pill · panel · suggestions · thinking · thread · expanded · docked left / right |
| AdminPage | active · inactive · all · archived · search hit / miss · create · edit · toggle busy · archive · restore · empty · paginated · reorder (and its disabled state) · make default · group tabs · extra filters · summary · CSV export · detail panel (add / edit / remove child) |

---

## Design

The visual language was read from the running application — `src/app/globals.css`,
`src/components/`, `sidebar.tsx`, `topbar.tsx`, `profile-menu.tsx`,
`dashboard-shell.tsx`, the MahAcharya widget and the admin master pages — and
re-declared here in `src/styles/global.css`. Tokens, class names and values are
carried over unchanged:

* **Palette** parchment surfaces (`--page #efe9dc`, `--surface #f6f1e3`), ink
  scale, deep green primary (`--green-deep #254a33`), terracotta / ochre / crit.
* **Type** Fraunces for headings, Inter Tight for UI, JetBrains Mono for
  eyebrows, labels, counts and table headers.
* **Shape** 3px / 4px / 8px radii, 1px rules, two-layer shadows.
* **Chrome** 64px topbar and sidebar logo row (one constant, `SHELL_TOPBAR_H`),
  220px / 56px rail, green-wash active rows, 999px assistant pill.

Class names are identical to the app's (`.btn-primary`, `.form-input`,
`.table-wrap`, `.table-header`, `.table-row`, `.tag`, `.modal-card`,
`.picker-field`, `.nav-link`, `.sidebar-nav`), so a component lifted from here
looks right in the app without a restyle.

The app's own `globals.css` was **not** modified, and its Tailwind/PostCSS setup
was not touched. This project uses no Tailwind — the app's design is expressed
in CSS variables and semantic classes rather than utilities, so copying that
approach keeps the two identical and the dependency list at two packages.

---

## Assumptions

1. **Demo data only.** No API, no database, no auth, no router. Writes are in
   memory and reset on reload.
2. **The separation plan's `common/components/` grouping is the target**, so the
   folders here mirror it and the later move is a copy, not a re-think.
3. **Presentation only.** Where the app's version reads context (the module-nav
   registry, `useTr()`, permission gates), the equivalent arrives as a prop.
4. **English strings are literals.** Translation belongs to the app's i18n layer;
   labels are props wherever a caller would want to translate them.
5. **React 19 + Vite**, matching the app's React major so the components drop in.
6. **`StatusBar` is new.** The application has no direct equivalent — it is built
   from the same tokens and reads as part of the same system.

## Known limitations

* **Not verified in a browser by the author.** Typecheck, lint, production build
  and the SSR smoke render all pass, but no screenshot was taken — browser
  automation was unavailable in the sessions that built it. Open the playground
  and the shell before trusting the pixels.
* **No automated tests beyond the smoke render.** No Vitest/RTL setup yet;
  `npm run smoke` renders all seven screens and checks the markup. Interaction
  tests are the obvious next addition.
* **The assistant is canned.** Keyword-matched replies from `demo.json`, with a
  550ms delay so the pending state is visible. No model, no streaming, no tools.
* **The sidebar has no permissions.** The app hides rows by permission and module
  access; here every row shows. Filtering is a prop away when it matters.
* **`DatePicker` is single-date** — no range, no time, no presets.
* **`MultiFilter`** has checklist / radio / toggle sections; the app also has a
  date-range section type, not ported.
* **Dropdowns reposition on scroll but do not flip mid-scroll.**
* **No dark theme.** The app has none either; the tokens are structured so one
  could be added in a single block.
* **Fonts load from Google Fonts** rather than being self-hosted as the app does
  with `next/font`.
* **`StatusToggle` is squared off**, unlike the app's pill-shaped one. That was a
  deliberate change to match the 3–4px radius language of everything around it;
  if the pill is wanted back it is two values in one file.
* **The dashboard's "Reload" button** is a demo affordance for showing the
  skeletons. A real screen takes its loading state from the request.

---

## Integrating later

Not yet — by design. When the backend split lands:

1. Copy `src/components/` and `src/hooks/` to `apps/web/src/common/`, and
   `src/shell/` to `apps/web/src/app/(dashboard)/_shell/`.
2. Add `"use client"` at the top of each component file (Next.js App Router).
3. Drop `src/styles/global.css` — the app's `globals.css` already defines every
   token and class these components use.
4. Replace `demo.json` with the real contracts: nav from the module registry,
   user from the session, notifications and master rows from their endpoints.
   `AdminPage` keeps its descriptor shape; only where the rows come from changes.
5. Re-point imports and wrap user-facing labels in `tr()`.

Step 3 is the reason the class names were kept identical.
