# Acharya mobile kit

The components the two phone apps share, built **once**:

* **Kaarigar app**: `omnidel-acharya` as of [PR #207](https://github.com/Omnidel-ai/omnidel-acharya/pull/207), the unified redesign. This is the reference for new Kaarigar screens.
* **Contractor app**: OmniPulse (`E:\Projects\Omnipulse Shubham`), the supervisor's voice-first app.

Each app had its own copy of the same things: a bottom nav with the mic in the
middle, task cards, stat tiles, tags, avatars and so on. Here each one exists
once, with a prop or a look token where the two designs really differ.

Full map, with what came from where and what was left out:
[`docs/ACHARYA_OMNIPULSE_COMMON_COMPONENTS.md`](../../../docs/ACHARYA_OMNIPULSE_COMMON_COMPONENTS.md).

Unlike `../acharya/` (a reference copy that doesn't compile), this folder
is real code. It typechecks, lints, builds and renders in the smoke test.

## Use

```tsx
import { MobileScreen, BottomDock, MicButton, TaskCard } from "@/components/acharya-mobile";

<MobileScreen look="contractor" dock={<BottomDock tone="dark" … mic={<MicButton … />} />}>
  …
</MobileScreen>
```

See it all: run `npm run dev`, open **Playground**, then the **Acharya mobile** tab.
The two phone frames there are the same components wearing the two looks.

## Two looks, not two kits

| | `look="kaarigar"` (default) | `look="contractor"` |
|---|---|---|
| Titles | sans 650 | serif (Fraunces) 500 |
| Small labels | sans, sentence case | mono, uppercase, tracked |
| Card radius | 16px | 12px |
| Tag corners | round | 3px square |

Structural differences are props, not looks: `BottomDock tone`, `SectionHeader variant`,
`StatTile layout`, `SegmentedTabs variant`, `ProfileHero tone`, `ChoiceGroup layout`.

## Rules

* **Presentation only.** No fetching, no routing, no voice session, no i18n. Each app
  keeps those and passes state and strings in. For example, the dock takes
  `items` and a `mic` node, and `MicButton` takes a `status`.
* **Don't re-add what the desktop kit has.** `EmptyState`, `Skeleton` and `Button`
  come from `src/components/common`. `PersonAvatar` reuses its `initials()`.
* **Prefixed CSS.** Every class is `am-*`, in `acharya-mobile.css`, which is imported by
  `index.ts`. It adds the tokens both apps use that `global.css` lacks: `--slate`,
  `--slate-wash`, `--plum`, `--r-xl`, `--shadow-lg`, `--ease-out`, `--ease-drawer`, `--cream`.
