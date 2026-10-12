# Acharya app — `src/acharya/`

The KarmYog karigar app from **omnidel-acharya PR #207** ("unified Acharya
redesign", head `3b9a1a3`), running in this repo on demo data.

```bash
npm run dev:acharya     # http://localhost:5301
npm run build:acharya   # → dist-acharya/
```

Sign in with any 10-digit mobile number starting 6–9 and any six-digit code,
or tap a **Quick demo login** chip. `/components` shows the component gallery.

## What is upstream and what is new

| Path | What | Source |
|---|---|---|
| `screens/` | The pages' client components — home, board, task (+ active session, learn), my work, profile, settings, sign-in | PR #207 `src/app/**`, unchanged but for import paths |
| `lib/`, `hooks/` | The client code those screens use | PR #207 `src/lib`, `src/hooks`, unchanged but for import paths |
| `../components/acharya/` | The app's components, grouped by purpose | PR #207 `src/components` |
| `styles/` | `globals.css` (Tailwind v4 + tokens), `work-journey.css` | PR #207 `src/app/*.css`; `@source` lines added |
| `lib/server/acharyas.ts`, `lib/server/omnidel-client.ts` | Type-only stand-ins: the two types client code imports from server modules | types copied verbatim |
| `public/audio/` | The voice player's PCM worklet | PR #207 `public/audio` |
| `App.tsx` | Routes and layouts — what Next's file-system router did | new |
| `pages.tsx` | One component per server `page.tsx`, same props, from demo data | new |
| `next/` | `next/link`, `next/navigation`, `next/image`, `next/dynamic`, `next/font/google` for Vite | new |
| `demo/` | Demo content and the in-browser `/api` | new |
| `gallery/` | The `/components` page | new |

Only the PR's client side is here. Its `src/app/api/**` route handlers and
`src/lib/server/**` (Supabase, OmniDel, AI providers) are not; `demo/api.ts`
answers the same endpoints in the browser instead.

## How it runs without Next.js

- **Routing.** The screens read `window.location.pathname` directly in about
  twenty places, so the URL is real (`/acharyas/neeranjan/tasks/…`), not a
  hash. `next/router.tsx` keeps the URL as the source of truth and also picks
  up direct `history.pushState` calls, as Next does. `App.tsx` mounts the
  layouts in Next's order — root, `(app)`, `acharyas/[slug]` — and keeps each
  mounted while you move beneath it, so the MahAcharya guide and voice
  session survive navigation as they do upstream.
- **Data.** `pages.tsx` gives each screen the props its server page computed.
  `demo/api.ts` replaces `window.fetch` for same-origin `/api/*` and keeps
  state in memory: starting a session, taking a break, finishing a task and
  posting a comment all show up on the next read, until reload. Unknown
  endpoints answer 501 and log `[acharya demo]` to the console.
- **AI and voice.** Chat streams a canned reply; Learn and Quiz serve one
  hand-written lesson and quiz. Gemini Live, Anam, Tavus and ElevenLabs answer
  the way production does when the provider is not configured.
- **Build.** Its own Vite config (`vite.acharya.config.ts`) and tsconfig
  (`tsconfig.acharya.json`, the upstream compiler options), so Tailwind and
  the PR's code style never touch the OmniDel workspace.

## Portraits

`demo/portraits.ts`. Neeranjan, Subhas and Vivek load from the public Supabase
bucket. MahAcharya'ji, Dr Swapan, Lakshman and Soumyajit live in a private
Vercel Blob store behind the preview's SSO, which a page on another origin
cannot load, so those guides show their initial until local copies are added
under `public/acharya/portraits/`.

## Updating from upstream

The relocation is scripted: it copies the PR's client files, moves each to its
place here and rewrites every import. Re-run it against a newer PR head rather
than editing paths by hand — steps in `scripts/sync/README.md`; the folder
mapping is one table in `scripts/sync/map-acharya.mjs`.
