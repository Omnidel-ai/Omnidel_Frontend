# Syncing the two apps' code into `frontend/`

`src/acharya/` + `src/components/acharya/` come from omnidel-acharya, and
`src/components/omnidel/` from the OmniDel app. Both were placed by these
scripts, which move each file and rewrite every import that points at another
moved file (`@/…` stays `@/…`, relative stays relative).

| Script | Does |
|---|---|
| `closure.mjs` | Lists every file reachable from some entry files by `@/` and relative imports, stopping at `lib/server/`. Used to find the PR's client-side footprint. |
| `relocate.mjs` | Copies a file list to new paths from a mapping, rewriting imports. Refuses to overwrite. |
| `map-acharya.mjs` | PR path → frontend path for the Acharya app (component groups, screens, lib, hooks). |
| `map-omnidel.mjs` | OmniDel `src/components/*` → `src/components/omnidel/<group>/*`. |

## Acharya, from a newer PR head

Run from `frontend/`, with a scratch folder `$S` outside the repo:

```bash
git -C ../../omnidel-acharya fetch origin pull/207/head:refs/remotes/origin/pr-207
git -C ../../omnidel-acharya archive origin/pr-207 | tar -x -C "$S/pr"

# 1. what the client side needs
(cd "$S/pr" && LIST=1 node "$OLDPWD/scripts/sync/closure.mjs" . \
   $(find "src/app/(app)" src/app/auth -name "*.tsx" ! -name page.tsx ! -name layout.tsx ! -name loading.tsx) \
   "src/app/(app)/acharyas/[slug]/tasks/[taskId]/active/page.tsx" \
   $(find src/components -name "*.ts" -o -name "*.tsx")) | grep '^src/' | grep -v lib/server/ > "$S/list.txt"
printf 'src/app/globals.css\nsrc/app/work-journey.css\n' >> "$S/list.txt"
(cd "$S/pr" && find src/components -type f) >> "$S/list.txt"; sort -u -o "$S/list.txt" "$S/list.txt"

# 2. the two server modules client code imports types from: use the stand-ins
mkdir -p "$S/pr/src/lib/server"
cp src/acharya/lib/server/acharyas.ts src/acharya/lib/server/omnidel-client.ts "$S/pr/src/lib/server/"
sed -i 's#@/acharya/lib/#@/lib/#' "$S/pr/src/lib/server/"*.ts
printf 'src/lib/server/acharyas.ts\nsrc/lib/server/omnidel-client.ts\n' >> "$S/list.txt"

# 3. move the old copy aside, then place the new one
node scripts/sync/relocate.mjs "$S/pr" . scripts/sync/map-acharya.mjs "$S/list.txt"
```

Then re-apply the frontend's two edits upstream does not have — the `@source`
lines at the top of `styles/globals.css` — and run `npm run typecheck`. A new
top-level component fails loudly in `map-acharya.mjs` ("no component group"):
add it to a group there.
