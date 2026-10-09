# Acharya app — components (reference copy)

The complete `src/components` tree of the **Acharya karigar portal**, copied
here so both apps' components live in one repo.

| | |
|---|---|
| Source | `Omnidel-ai/omnidel-acharya` → `src/components` |
| PR | #207 "feat(ui): unified Acharya redesign from #202 and #207" |
| Commit | `3b9a1a3` (head of `codex/acharya-reviewed-bundle-20260922`), 2026-10-10 |
| Files | 74 |
| Status | **reference only. This folder does not compile here.** |

The PR is still an open draft. If it changes before merge, re-copy (see below).

## Why it does not compile

These files are written for a Next.js app and reach for `@/lib/*`, `@/hooks/*`,
`next/*`, `react-markdown`, `remark-gfm` and `@vercel/blob`, none of which this
Vite workspace has. The folder is excluded in `tsconfig.json`,
`eslint.config.js` and `.vercelignore`, and nothing imports it.

One change from upstream: the folder's own imports `@/components/X` were
rewritten to `@/components/acharya/X` so they point at this folder. `@/lib` and
`@/hooks` imports are untouched.

## Overlap with `common/` and `omnidel/`

None of these files are byte-identical to a file in either other folder. These
are the same component forked per app and are the first candidates to unify
into `common/`:

| Acharya | OmniDel | `common/` |
|---|---|---|
| `CustomSelect.tsx` ("ported from OmniDel custom-select") | `custom-select.tsx` | `Select/CustomSelect.tsx` |
| `SearchableSelect.tsx` | `searchable-select.tsx` | — |
| `nav-skeletons.tsx` | — | `Skeleton/` |
| `ProfileMenu.tsx` | `profile-menu.tsx` | — |
| `task-board.tsx` | `task-board.tsx` (different component, same name) | — |

## Keeping it current

```bash
cd D:/Omnidel/omnidel-acharya
git fetch origin pull/207/head:refs/remotes/origin/pr-207
# from D:/Omnidel/OmniDel/frontend/src/components, after moving the old acharya/ aside:
git -C D:/Omnidel/omnidel-acharya archive origin/pr-207 src/components | tar -x -C /tmp/a
cp -r /tmp/a/src/components acharya
grep -rlE "[\"']@/components/" acharya | xargs sed -i -E "s#([\"'])@/components/#\1@/components/acharya/#g"
```

Then update the commit in the table above.
