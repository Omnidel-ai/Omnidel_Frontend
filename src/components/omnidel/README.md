# OmniDel app — components (reference copy)

The complete `src/components` tree of the **OmniDel Next.js app** at the
repository root, copied here so both apps' components live side by side.

| | |
|---|---|
| Source | `OmniDel/src/components` (this repo, working tree) |
| Branch | `pr-518` at `5d9617c`, 2026-10-10, including uncommitted local edits |
| Files | 141 |
| Status | **reference only. This folder does not compile here.** |

## Why it does not compile

These files are written for the Next.js app and reach for its `@/lib/*`,
`@/hooks/*` and `next/*`. The folder is excluded in `tsconfig.json`,
`eslint.config.js` and `.vercelignore`, and nothing imports it.

One change from upstream: the folder's own imports `@/components/X` were
rewritten to `@/components/omnidel/X` so they point at this folder.

## Overlap with `common/`

`common/` was built from this folder's most widely shared components, so
these are already covered there in a domain-free form:

| OmniDel | `common/` |
|---|---|
| `custom-select.tsx` | `Select/` |
| `confirm-dialog.tsx` | `ConfirmDialog/` |
| `date-picker.tsx`, `multi-filter.tsx` | `Filters/` |
| `no-access-screen.tsx` | `NoAccessScreen/` |
| `page-header.tsx`, `breadcrumb-trail.tsx` | `PageHeader/` |
| `status-toggle.tsx` | `StatusToggle/` |
| `sub-tabs.tsx` | `SubTabs/` |
| `table-ui.tsx`, `table-controls.tsx`, `table-scroll.tsx`, `table-add-button.tsx` | `Table/` |
| `toast.tsx`, `toaster.tsx` | `Toast/` |

For overlap with the Acharya app, see `../acharya/README.md`.

## Keeping it current

```bash
# from D:/Omnidel/OmniDel/frontend/src/components, after moving the old omnidel/ aside:
cp -r ../../../src/components omnidel
grep -rlE "[\"']@/components/" omnidel | xargs sed -i -E "s#([\"'])@/components/#\1@/components/omnidel/#g"
```
