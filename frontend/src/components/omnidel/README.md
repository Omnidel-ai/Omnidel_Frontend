# OmniDel app components (reference copy)

The complete `src/components` tree of the **OmniDel Next.js app** at the
repository root, grouped by area.

| | |
|---|---|
| Source | `OmniDel/src/components` (this repo, working tree) |
| Branch | `pr-518` at `5d9617c`, 2026-10-10, including uncommitted local edits |
| Files | 141 |
| Status | **reference only — does not compile here** |

| Folder | What is in it |
|---|---|
| `shell/` | App chrome: dashboard shell, sidebar, topbar, page header and breadcrumbs, bells, profile menu, no-access screen |
| `ui/` | Small pieces: confirm dialog, toasts, sub-tabs, toggles, pin and done buttons, lightbox, link preview, markdown |
| `forms/` | Inputs and pickers: custom/searchable select, date picker, user, member, label, lead and acharya pickers, recurrence, master form |
| `filters/` | Filter controls: multi-filter, include-inactive, mobile filter strip, workspace and OmniStudio filters |
| `table/` | Table UI, controls, scroll, add button, CSV export, and the CSV import wizard (`table/import-csv-modal/`) |
| `collaboration/` | Comments and sharing: composer, actions menu, rich text, mentions, share sheet |
| `boards/` | Tasks and boards: task board, calendar, checklist, task modals, board and column creation, stage fields |
| `teams/` | Team menus and pulse widget, worker avatar and detail |
| `dashboard/` | Dashboard primitives and charts |
| `admin/`, `mahacharya/`, `omnipulse/`, `omnistudio/`, `search/`, `whats-new/` | Feature folders, as upstream |

## Why it does not compile

These files are written for the Next.js app and reach for its `@/lib/*`,
`@/hooks/*`, `@/app/*` and `next/*`. The folder is excluded in `tsconfig.json`
and `eslint.config.js`, and nothing imports it. Its imports between its own
files were rewritten for the new folders (`scripts/sync/map-omnidel.mjs`);
imports into the app's `lib`, `hooks` and `app` are untouched.

## Overlap with `common/`

`common/` was built from this folder's most widely shared components, so
these are already covered there in a domain-free form:

| OmniDel | `common/` |
|---|---|
| `forms/custom-select.tsx` | `Select/` |
| `ui/confirm-dialog.tsx` | `ConfirmDialog/` |
| `forms/date-picker.tsx`, `filters/multi-filter.tsx` | `Filters/` |
| `shell/no-access-screen.tsx` | `NoAccessScreen/` |
| `shell/page-header.tsx`, `shell/breadcrumb-trail.tsx` | `PageHeader/` |
| `ui/status-toggle.tsx` | `StatusToggle/` |
| `ui/sub-tabs.tsx` | `SubTabs/` |
| `table/table-ui.tsx`, `table/table-controls.tsx`, `table/table-scroll.tsx`, `table/table-add-button.tsx` | `Table/` |
| `ui/toast.tsx`, `ui/toaster.tsx` | `Toast/` |

For overlap with the Acharya app, see `../acharya/README.md`.

## Keeping it current

```bash
# from frontend/, after moving the old omnidel/ aside:
(cd .. && find src/components -type f | sort) > /tmp/list.txt
node scripts/sync/relocate.mjs .. . scripts/sync/map-omnidel.mjs /tmp/list.txt
```

A new top-level component fails loudly ("no group for …"): add it to a group
in `map-omnidel.mjs`.
