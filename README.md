# OmniDel — Shared Components, Shell & Product Screens

An **isolated** frontend workspace: shared UI components, the application
shell, Home, the complete admin area, OmniPulse, OmniMart and OmniVarsity —
every screen on demo data — plus a set of Vercel Functions for Vercel Blob:
images, video, audio and documents, public and private.

It is developed in the main OmniDel repository as a standalone folder
(`frontend/`) that the Next.js application does not import and was not modified
to accommodate, and published here so it can be worked on on its own.

## What is in here

**40 screens**, in the application's own order, all on demo data:

| | Screens | Built from |
|---|---|---|
| **Home** | Your work so far | `src/home/` |
| **OmniMart** | Pipeline · Operations · Missions · Schedule & Sites · Store | `src/omnimart/` + `src/lists/` |
| **OmniPulse** | Teams · Projects · Board · Review queue | `src/omnipulse/` |
| **OmniVarsity** | Acharyas · Acharya Dashboard · Kaarigars | `src/omnivarsity/` + `src/lists/` |
| **Admin** | 23 masters + Business Details + the dashboard | `src/admin/` |
| **Components** | the playground — every shared component in every state | `src/playground/` |
| **Media & files** | five Vercel Functions for Blob — images, video, audio, documents — and the fields that use them | `api/` + `src/lib/blob.ts` |

**OmniMart** is the sales and delivery side. Four of its five screens are work
lists and share **one component**, `ListPage`: views in the page header, a
search-with-FILTERS strip beneath, Export CSV beside the add button, and the
row actions the application offers — View · Next stage · Archive. Store opens
on a grid of KPI tiles instead of a table, and Missions is its own screen,
because a promise with a pace is not a row. Money is written the way the app
writes it: **25.8L, 29K** — lakh and thousand, not million.

**OmniVarsity** is the teaching side — the mentors and the kaarigar network.
Acharyas and Kaarigars are two more descriptors handed to the same `ListPage`,
so nothing in `src/omnivarsity/` renders a table; they needed one new cell
type, `person` — a portrait, the name underlined as the link to the record,
and what they are in the muted line under it. The **Acharya Dashboard** is the
one screen with a shape of its own: six counters over four activity panels,
with the period (1D · 7D · 30D) beside the sections (Overview · Chats · Rating
· Quiz). Its counters are the shared `StatTile` in a washed, borderless dress
and its panels the shared `Panel` with a coloured left edge — two variants on
components that already existed, not two new components.

That is the whole arrangement in one line: **one layout per family, many
descriptors.** `AdminPage` for reference data, `ListPage` for work in flight,
`SettingsPage` for a single record. Adding a screen is usually adding JSON.

```
OmniDel/                    ← existing Next.js app, untouched
├── src/ app/ …
└── frontend/               ← this project
    ├── api/                ← Vercel Functions: Blob upload, view, public, list
    ├── src/
    │   ├── components/     ← 1. shared UI components
    │   │   └── acharya-app/   ← reference copy, excluded from the build
    │   ├── shell/          ← 2. shell components (sidebar, topbar, …)
    │   ├── data/            ← 3. demo data (demo.json + masters.json)
    │   ├── admin/          ← 5. the admin screens, two layouts
    │   ├── omnipulse/      ← teams, projects, review queue, board
    │   ├── lists/          ← the shared work-list screen (ListPage)
    │   ├── omnimart/       ← pipeline, operations, missions, schedule, store
    │   ├── omnivarsity/    ← acharyas, acharya dashboard, kaarigars
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

The brief called this folder `shared-components/`; it is `frontend/` because
that is what was asked for in the session that started it. Nothing else about
the arrangement changed.

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
6. Product screens     src/home/            ✅  Home
                       src/omnipulse/       ✅  teams, projects, board, review
                       src/omnimart/        ✅  pipeline → store
                       src/omnivarsity/     ✅  acharyas, dashboard, kaarigars
7. Testing & polish    typecheck · lint · build · smoke · playground
          ↓
       STOP — backend split lands first
          ↓
     then: connect real APIs
```

Step 7's automated half is done and green. The visual half is the playground
and the shell demo, which need a browser — see [Known limitations](#known-limitations).

---

## Install and run

```bash
cd frontend
npm install
npm run dev        # http://localhost:5300
```

| Script | What it does |
|---|---|
| `npm run dev` | Vite dev server — opens on the shell |
| `npm run build` | Typecheck, then production build to `dist/` |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint (flat config, this project only) |
| `npm run smoke` | Server-renders all 40 screens — shell, Home, playground, dashboard, the four OmniPulse screens, the six work lists, the Acharya Dashboard and all 24 admin screens — and asserts the markup, including each descriptor parameter that a screen declares |
| `npm run preview` | Serve the production build |

Requirements: Node 20+ (developed on 22.17). The stylesheet pulls Fraunces,
Inter Tight and JetBrains Mono from Google Fonts; without a network the fonts
fall back to Georgia / system sans / a mono face and nothing else changes.

### What you can do in the running app

* **Home** — the screen the app opens on: four counts, the work assigned to and
  by you with Open / Done, mentions, announcements, and the two rings.
* **OmniMart** — walk Pipeline's stages from the sidebar, switch views in the
  page header, export a view to CSV, open Store on its KPI tiles, and read a
  mission's pace as a sentence rather than a percentage.
* **OmniPulse** — teams → projects → a board in card, table or calendar view,
  with the task sheet and the review queue.
* **OmniVarsity** — the acharyas with their type and description, the Acharya
  Dashboard across 1D / 7D / 30D, and the kaarigar network with its Requests
  tab.
* **Dashboard** — stat tiles, a 12-week bar chart with a
  range filter and a table view, pipeline-by-stage bars, a status breakdown and
  an activity feed. **Reload** replays the loading state so the skeletons show.
* **About this demo** — what the workspace is, with the masters one click away.
* **Admin** — one sidebar item, seven groups, 23 list screens and one settings
  screen. Every list screen is the same component with a different descriptor:
  search, filter by Active / Inactive / All / Archived, add, edit, activate,
  archive, restore, paginate. Worth opening in particular:
  * **Lead Sources / Missions / Roles** — reorder arrows
  * **Pipeline Stages** — reorder + group tabs + per-row **Fields** panel
  * **Languages** — "Make default", which clears the flag everywhere else
  * **Lanes / State Codes / Users** — **Download CSV** of what the table shows
  * **Trade Types** — no rows, so this is where the empty state lives
  * **System → Business Details** — the *other* admin layout: one record, field
    groups, save-in-place
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
| `Avatar/` | `Avatar`, `AvatarStack` — initials, colour derived from the name, +N overflow |
| `Badge/` | `Badge` — 7 tones |
| `Menu/` | `Menu` (the ⋯ actions menu, portalled), `PinButton`, `DragHandle` |
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

### `components/acharya-app/` — reference only

The Acharya karigar portal's complete `src/components` tree (64 files, 19k
lines), copied in so the shared-UI work can see what it will eventually cover.
It is written for Next.js and reaches for that app's `@/lib`, `@/hooks` and its
AI/voice packages, so it **does not compile here** and is excluded in
`tsconfig.json` and `eslint.config.js`. Nothing imports it; the build output is
byte-identical with and without it. It is the source to port *from* — see
`src/components/acharya-app/README.md` for the inventory and which 16 files are
portable as they stand.

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

## OmniPulse — `src/omnipulse/`

The module's own screens, matching the application's nav (`Teams`, `Projects`,
`Review` — "Tasks" is permission-only there and renders no row):

| Screen | Shape | Why not a master table |
|---|---|---|
| **Teams** | card grid | A team is a name, a lead and two counts — a tile, as in the app |
| **Projects** | card grid **or** table, your choice | Both views read the same descriptor; the table sorts on every column marked `sortable` |
| **Review** | queue table + tabs | Eight columns a reviewer scans; opening a row gives the submission and the two decisions |
| **Board** | kanban · table · calendar | Three views of the same lists, from one strip |

`cards.tsx` is to these screens what `columns.tsx` is to the admin tables: one
small vocabulary — `Card`, `CardGrid`, `CardTitle`, `CardMeta`, `QuickToggle`,
`ViewToggle`, `TaskProgress`, `Avatars` — shared between them and knowing
nothing about what a team or a project is. Everything else comes from the
shared components.

The board carries what the application's does: a serif trail with the team
picked out, the visibility chip, the brief, the member stack, CARD / TABLE /
CALENDAR with a task count, search-with-FILTERS, and columns tinted by what
their stage means — neutral while queued, ochre while in flight, green once
ready. Cards show priority, a due chip that turns crit when overdue, comment
and attachment counts, and their assignees.

Cards move between lists with the card menu rather than by dragging: drag and
drop needs `@dnd-kit`, and a workspace that exists to show the design should
not take a dependency to fake one. The calendar likewise plots due dates but
does not reschedule by dragging.

## OmniMart — `src/omnimart/`

Five screens in the application's order — **Pipeline · Operations · Missions ·
Schedule & Sites · Store**.

Four of them are work lists and share **one component**, `ListPage` from
`src/lists/`, with a descriptor each: views in the page header (All Leads ·
Short Cycle · Long Cycle · Archived), search-with-FILTERS beneath, Export CSV
beside the add button, and the row actions the app offers — View · Next stage ·
Archive. Their cells come from the same `toColumn` the admin tables use, which
is why a lead table and a language table read as one table.

A view can be something other than a table: Store opens on **Overview**, a grid
of KPI tiles, and its Inventory view is the table. Missions is its own screen —
a promise with a pace is not a row, so each card leads with the plain sentence
("Behind — doing 0/day, needs 92/day") that a percentage alone cannot give.

Money is written the way the app writes it: **25.8L, 29K** — lakh and thousand,
not million, because the people reading these columns think in lakhs.

## OmniVarsity — `src/omnivarsity/`

Three screens — **Acharyas · Acharya Dashboard · Kaarigars**.

Two of them are work lists, so they are two more descriptors handed to the same
`ListPage` OmniMart uses; nothing in `src/omnivarsity/` renders a table. The
acharya and kaarigar cells needed one new cell type, `person`: a portrait, the
name underlined as the link to the record, and what they are in the muted line
under it — the description belongs there rather than in a column of its own,
where it would be clipped.

The **Acharya Dashboard** is the one screen with a shape of its own: six
counters over four activity panels, with the period (1D · 7D · 30D) beside the
sections (Overview · Chats · Rating · Quiz). Its counters are the shared
`StatTile` in a washed, borderless dress (`tone`) and its panels the shared
`Panel` with a coloured left edge (`accent`) — two variants on components that
already existed, not two new components. The edge is decoration over a title
that already says the same thing; it is never the only thing telling two panels
apart.

## Media, documents & uploads — `api/` and `src/lib/blob.ts`

The one part of this workspace that is not a component: five **Vercel
Functions** for Vercel Blob, mirroring the routes the application already runs,
and the fields that use them.

```
api/
├── index.ts                    GET    what these functions are, and whether they can do anything
├── blob/
│   ├── upload-token.ts         POST   token for a browser-direct upload
│   ├── upload.ts               POST   multipart through the function
│   │                           DELETE remove one blob
│   ├── view.ts                 GET    read a PRIVATE blob — the only way to show one
│   ├── public/[...path].ts     GET    read a PUBLIC blob, cached and cross-origin
│   └── list.ts                 GET    what is in a prefix
└── _lib/
    ├── media.ts                        what may be stored, what kind it is, how large
    ├── blob.ts                         where it may go, and who may put it there
    └── serve.ts                        ranges, ETags, disposition — shared by both read routes
```

### Kinds, not extensions

Every rule follows from one thing: a file's **kind**. Thirty-odd content types
map to five kinds, and the caps, the pickers, the icons and the way a file is
served are all written against the kind.

| Kind | Types | Through a function | Browser-direct |
|---|---|---|---|
| image | JPEG, PNG, WebP, GIF, AVIF, SVG | 4 MB | 25 MB |
| document | PDF, Word, Excel, PowerPoint, RTF | 4 MB | 50 MB |
| data | text, Markdown, CSV, JSON | 4 MB | 25 MB |
| audio | MP3, M4A, WAV, OGG, WebM, FLAC | 4 MB | 200 MB |
| video | MP4, WebM, QuickTime, Matroska | 4 MB | 1 GB |

The two columns are two routes, not two opinions: a Vercel function body caps
around 4.5 MB, so anything larger **has** to go browser → Blob directly with a
token. That is what makes a video storable at all.

### Two stores, split by prefix

Which store a file lands in is decided by its prefix, never by the caller, and
each prefix takes only the kinds that belong there — a knowledge base has no
use for a video, a storefront none for a spreadsheet.

| Prefix | Store | Takes |
|---|---|---|
| `omnivarsity/acharya/` · `omnivarsity/kaarigar/` | private | image |
| `omnivarsity/kb/` | private | document, data |
| `omnimart/pipeline/` · `omnipulse/task/` | private | image, document, data |
| `omnistudio/media/` | private | image, video, audio |
| `omnimart/store/` | **public** | image |
| `omnistudio/brand/` | **public** | image, document |

A private blob's own URL needs an Authorization header, and no element can send
one — so a private file is readable only through `view`, which holds the token
and streams the bytes back. A public blob keeps its own URL, caches for a day in
the CDN and answers cross-origin.

### Serving is where the care goes

* **Byte ranges.** A `<video>` opens a file by asking for its last few hundred
  bytes, then its first, then seeks. Without `Range` it downloads the whole
  thing before it can play and the scrub bar does nothing, so both read routes
  forward the header and answer 206 with `Content-Range`. The range goes to the
  store rather than being applied in the function — slicing there would mean
  paying for the whole file to serve a fragment of it.
* **Conditional requests.** The ETag goes out, `If-None-Match` comes back, an
  unchanged file answers 304 with no body.
* **The content type comes from the key's extension**, never from what was
  stored under it, so a file uploaded with a lying type is not served back with
  it. Unrecognised types download.
* **SVG never renders inline** — it is a document that can carry script, and
  this origin also serves the workspace. **PDF does**, because previewing one
  without downloading it is most of the point, but under a `sandbox` CSP.
  `?download=1` forces the save dialog for either.
* Private reads are `Cache-Control: private`, so a shared cache never holds one
  viewer's file.

### Authentication, and what stands in for it

In the application every one of these routes sits behind a session and a
permission slug. **This workspace has no users**, so the same handlers would be
an open door onto a real Blob store. Two things keep it shut:

* with no `BLOB_READ_WRITE_TOKEN` the handlers refuse and the workspace runs in
  demo mode — which is how it is normally deployed;
* with a token but no `BLOB_UPLOAD_SECRET`, **writes still refuse**, so wiring a
  store up is not by itself enough to open one.

With both set, a write must carry the secret in `x-upload-secret`. That is a
shared secret, not a session: enough for a demo behind a link, and deliberately
not what the application does. Anything real gets a session and a permission per
route before it gets users.

### In the browser

| Component | For |
|---|---|
| `ImageField` | one picture on a record — the application's avatar field |
| `ImagePreview` | showing one, with its loading, empty and failed states |
| `FileField` | attachments: many files, any kind the prefix allows |
| `FileRow` | one attached file — glyph, name, size, download, remove |
| `MediaPlayer` | video and audio, played in place |
| `FileKindIcon` | one glyph per kind |

`ImageField` **replaces before it deletes**, so a failed delete leaves a stray
blob rather than a record pointing at nothing. `FileField` offers only the types
its prefix accepts, reports real progress on the browser-direct route — a 200 MB
recording gets a bar, not a spinner — and gives video and audio a player,
because those are the two kinds you cannot judge from a name.

**With no store, nothing is hidden.** Files are shown from an object URL and the
line under the field says they went nowhere, rather than letting them look
saved. Open **Components → Media & files** to see all of it.

### Running them

`npm run dev` does not run functions — Vite serves the SPA only, and answers
`/api/*` with the same 501 a store-less deployment gives, so development behaves
like the normal deployment. For the real thing, see the next section.

`npm run typecheck` covers `api/` too, through `tsconfig.api.json` — the
functions run on Node, not in the browser, and are deliberately not part of the
SPA's build. `@vercel/blob` is loaded through a dynamic import in the browser, so
it is a separate chunk and never enters the main bundle.

## Deploying to Vercel

The workspace deploys as a Vite static build plus the functions in `api/`.

```bash
npm install -g vercel
vercel link                       # pick or create the project
vercel                            # preview deployment
vercel --prod                     # production
```

Uploads need a Blob store, which is optional — without one everything runs in
demo mode:

```bash
vercel blob store add             # writes BLOB_READ_WRITE_TOKEN into the project
vercel env add BLOB_UPLOAD_SECRET # a long random string; see .env.example
vercel env pull .env.local        # to run them locally
vercel dev                        # SPA + functions together, on one port
```

`vercel.json` sets the build (`npm run build` → `dist`), a duration per function
— 60s for the ones that stream or receive a file, 5s for the manifest — and the
static headers: `nosniff`, `strict-origin-when-cross-origin`, `SAMEORIGIN`, and a
year of immutable caching for the fingerprinted assets. `.vercelignore` keeps the
acharya-app reference copy and the smoke harness out of the deployment.
`engines.node` pins Node 20 or newer.

Everything else is Vercel's defaults on purpose: the Vite preset already knows
the output directory and the SPA fallback, and configuration that only restates
a default is configuration that goes stale.

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

## 5. Admin — `src/admin/`, 24 screens, two layouts

The sidebar is the application's: one **Admin** item, seven groups, pages
inside them.

```
Admin
├── Dashboard                 → the dashboard component, reused
├── Reports
├── Sales & Pipeline          → Pipeline Stages · Operation Stages · Lead Sources ·
│                               Lanes · Missions · Stage Fields · Project Types
├── Tasks & Workflow          → Task Types · Trade Types · Acharya Types
├── Teams & Sections          → Teams · Sections · Departments
├── Branches & Inventory      → Branches · Inventory & Pricing · Vatika Inventory
├── People & Access           → Users & Access · Pending setup · Roles & Perms · Workspaces
└── System                    → Languages · Business Details · State Codes
```

### The master layout

The application has fourteen admin master pages — 3,564 lines — each
re-implementing the same table, dialog, toggle and archive flow against a
different table. This is that page written **once**, and every admin screen in
the workspace is it:

23 of the 24 screens are it. The shared layout is: page header · optional group tabs · optional summary ·
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
| `../fields.tsx` | **one control per field type** — shared by the master dialog, the child panel and the settings pages |

### The settings layout

`SettingsPage` is the other shape: one record, groups of fields, saved in
place, with the save bar appearing only once something has changed. Business
Details uses it — 19 fields in 4 groups. It shares `fields.tsx` with the master
dialog, so a new field type appears in both at once.

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

1. **Demo data only.** No application API, no database, no auth, no router.
   Writes are in memory and reset on reload. The exception is deliberate and
   narrow: the Vercel Functions in `api/` put files in a Blob store, and with
   no store configured they refuse and the fields say so.
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

* **No automated tests beyond the smoke render.** No Vitest/RTL setup yet;
  `npm run smoke` renders all 40 screens and checks the markup. Interaction
  tests are the obvious next addition.
* **The product screens were compared against the running application by eye**,
  in a browser, screen by screen — they were not diffed pixel by pixel, and the
  demo data behind them is invented. The shape, the wording and the controls are
  the application's; the numbers are not.
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
