# Kaarigar ↔ Contractor: common components

Companion to the earlier Omnidel ↔ Acharya component maps.
Those compared **Omnidel ↔ Acharya**. This one compares the **two phone
apps with each other**:

* **Kaarigar app** (Acharya). The Kaarigar uses it to start and run tasks.
* **Contractor app** (OmniPulse). The supervisor uses it to approve the Kaarigar's work and assign tasks.

The goal: list the UI components the two apps share, then build each shared
component **once** in this repo. Today both apps carry their own copy (two
bottom navs, two task cards, two stat tiles…), and porting both as they stand
would give the new kit two of everything.

| | |
|---|---|
| Kaarigar source | `E:\Projects\acharya-app\omnidel-acharya` at **PR #207** head `3b9a1a3` ([feat(ui): unified Acharya redesign from #202 and #207](https://github.com/Omnidel-ai/omnidel-acharya/pull/207), open), the whole app as of that commit, not just the diff |
| Contractor source | `E:\Projects\Omnipulse Shubham` — branch `fix/voice-mahacharya-prompt`, `773cd1e` (24 Sep 2026; newest branch, 1 commit off `dev`) |
| Omnidel target | `E:\Projects\Omnidel Frontend` — `src/components/acharya-mobile/` (beside `common/`, `acharya/` and `omnidel/`), screens in `src/mobile/` |
| Prepared | 3 Nov 2026 |

Legend:

| Mark | Meaning |
|---|---|
| ✅ **Same** | Same component in both apps, near line-for-line. Built once. |
| 🔀 **Same job, two designs** | Same role and structure, different paint. Built once; the difference is a prop or a look token. |
| ♻️ **Reuse** | Omnidel's desktop kit already has it. Used as-is, not rebuilt. |
| — | Only one app has it. Not in the kit (yet). |

---

## 1. Summary

* **23 shared pieces, built once** in `src/components/acharya-mobile/`: 21
  components plus two helpers (the mic-level bus and the connecting dots), in 17
  files and one stylesheet. 3 more are **reused** from the desktop kit
  (`EmptyState`, `Skeleton`, `Button`) instead of being rebuilt.
* **Shubham's example holds across the board.** The bottom nav plus mic is one
  component drawn twice: same five-column grid, mic in the wider middle column,
  same mic colours per state. The same goes for task cards, stat tiles, tags,
  avatars, section cards and the Settings controls.
* **Most differences are type and radii, not structure.** Kaarigar (PR #207)
  sets every font to the sans and rounds harder. Contractor keeps the serif
  title, mono uppercase labels and tighter corners. Those are two **looks**
  (CSS tokens on `MobileScreen look=…`), not two component sets.
* **Real structural differences are props**, and there are six:
  `BottomDock tone` (light glass vs dark floor), `SectionHeader variant` (icon
  disc vs mono label + rule), `StatTile layout` (stacked vs row), `SegmentedTabs
  variant` (solid vs plate), `ProfileHero tone` (forest vs ochre) and
  `ChoiceGroup layout` (list / grid / pill).
* **Where the two implementations disagreed, the kit keeps the better one**,
  not both. OTP uses one real input (Kaarigar's), not six (Contractor's).
  Overlays are bottom sheets (Kaarigar), not centred dialogs (Contractor). §4
  lists every such call.
* **Nothing is fetched, routed or spoken inside the kit.** Voice sessions,
  strings and data stay in each app; components take state and report events,
  the same rule as the desktop kit.
* **Verified:** `tsc`, `eslint`, `npm run build` and `npm run smoke` (40
  screens) all pass. The new Playground tab was screenshotted in headless
  Chrome at both looks.

---

## 2. The common components

### 2.1 Navigation and voice

| # | Kit component | Kaarigar (PR #207) | Contractor (OmniPulse) | | How it was merged |
|---:|---|---|---|---|---|
| 1 | `BottomDock` | `WorkAppFrame` → private `WorkNavigation` (Home · Work · mic · Stories · Profile) + `.journey-navigation` CSS | `voice/mic-dock.tsx` → `MicDock` + `NavItem` (Review · Projects · mic · Teams · Profile) | 🔀 | Same 5-column grid (`1fr 1fr 1.2fr 1fr 1fr`) with the mic in the middle, and the plate wrapping both icon and label. `tone="light"`: Kaarigar's cream glass capsule, green-wash plate, mic raised in a page-colour ring with a label under it. `tone="dark"`: Contractor's solid green floor (the same SVG scoop path), cream plate. Also carries Contractor's live **caption**, **status** line and **alert** toast above the bar. |
| 2 | `MicButton` | `voice/MahAcharyaMic.tsx` → `MahAcharyaInlineMic`, `MahAcharyaDockMic`, `MicGlyph` | `MicDock`'s centre button | ✅ | The colours were already identical: green at rest, crit while live, ochre on error, muted while connecting. One `status` (`idle · connecting · live · speaking · error · denied`), with the waveform when live, a stop square while the agent speaks, mic-off when denied and retry on error. `text` turns it into Kaarigar's labelled pill ("Talk now"). |
| 3 | `ConnectingDots` | `MicConnectingDots` | `ConnectingDots` | ✅ | Same three dots, same 0/150/300 ms stagger. |
| 4 | `VoiceWaveform` | `voice/VoiceWaveform.tsx` | `voice/voice-waveform.tsx` | ✅ | Line-for-line the same rAF meter with no React state. Only the default `height` / `gap` differed. It now takes a `source`, so the playground (and tests) can drive it. |
| 5 | `micLevel`, `createLevelBus`, `frameRms` | `lib/voice-level.ts` | `lib/client/voice-level.ts` | ✅ | Identical code; only the comments differ. Not UI, but the waveform depends on it. |
| 6 | `MobileIcon` | `JourneyIcon` (14) + 5 more inline sets (`network-icons`, `QuickPrompts`, `IdentityCard`, `TaskQuizTab`, `ChatBubbleIcon`) | lucide (app-wide) + `voice/nav-glyph.tsx` (3 Material outlined/filled pairs) | 🔀 | One registry, 37 names. It has Kaarigar's 14 journey glyphs, the lucide glyphs Contractor uses on these screens, and Contractor's 3 Material pairs (`inbox`, `projects`, `teams`), which take `filled` because a selected dock tab turns **solid**. |

### 2.2 Screen frame

| # | Kit component | Kaarigar | Contractor | | How it was merged |
|---:|---|---|---|---|---|
| 7 | `MobileScreen` | `.journey-app` frame (`WorkAppFrame`), bottom padding for the nav | `app-chrome.tsx` → `AppChrome` (560px column, `--dock-h` padding) | 🔀 | Page ground, centred 560px column, 16px gutters, room under the last row when a dock is present. `look` switches the type and radius tokens (§3). |
| 8 | `ScreenHeader` | `.journey-work-toolbar` (title + acharya avatar + refresh); Profile toolbar (back on the right) | `pulse/chrome.tsx` → `PageHeader` (sticky serif title) + `BackRow` | 🔀 | Title, optional back, trailing actions. `sticky` gives Contractor's blurred, ruled bar. |
| 9 | `IconButton` | `.journey-refresh`, `.journey-round-link`, `ghost-icon-button.ts` | ghost `Button size="icon"` uses | ✅ | 44px round, framed or ghost, with a `busy` spinner for refresh. |

### 2.3 Surfaces and content

| # | Kit component | Kaarigar | Contractor | | How it was merged |
|---:|---|---|---|---|---|
| 10 | `Card` | `IdentityCard` → `DetailGroup` card (`sage · ochre · terracotta · slate` washes); `.journey-overview`; settings section cards | `pulse/chrome.tsx` → `Panel` (`ochre · green · slate`) | 🔀 | Both tint the **whole card** with a wash, so that is what `tone` does. Kaarigar's `sage` becomes `green`; `forest` is Kaarigar's solid identity card. `flush` gives Contractor's `p-0` panels. |
| 11 | `SectionHeader` | `ProfileTab` → `SettingsHeading` (icon in a wash disc); `DetailGroup` header | `pulse/chrome.tsx` → `SectionHead` (mono uppercase label + rule) | 🔀 | `variant="disc"` / `variant="rule"`, plus a `right` slot for counts and sort toggles. |
| 12 | `Tag` (+ `colorTagStyle`) | `profile/HistoryTags.tsx` chips; `task-card` chips (habit, score, reviewing, board, sessions, due) | `pulse/pill.tsx` → `Pill` (7 tones × 3 sizes), `PriorityPill`; `TaskRow` list tag | 🔀 | One mono pill with 9 tones and 3 sizes. Corners follow the look: round on Kaarigar, square on Contractor. `colorTagStyle(color)` covers Contractor's list tag painted from a data colour. |
| 13 | `PersonAvatar` (+ `PersonAvatarStack`) | `TaskCommentsTab` → `NoteAvatar`; the fallback half of `acharya-avatar.tsx` | `pulse/avatar.tsx` → `PersonAvatar`, `AvatarStack` | ✅ | Both hash the name into the same palette (green-deep, ochre, terracotta, slate, + plum). Adds an `imageUrl` that falls back to initials, and `colorKey` so a transliterated name keeps its colour. Uses the desktop kit's `initials()`. |
| 14 | `StatTile` + `StatRow` | `ReportTab` → `StatTile` (`.journey-profile-stat`); `WorkProgressOverview` status grid | `ui/stat-tile.tsx` → `StatTile`, `StatRow` | 🔀 | Both use three tiles, green / ochre / slate, on Home and Profile. `layout="stack"` (Kaarigar: centred disc, big number) or `layout="row"` (Contractor: icon left, mono number right, wave). `onClick` / `href` make it a link, as the Kaarigar status counts are. |
| 15 | `TaskCard` | `task-card.tsx` → `TaskCardLink` | `task-row.tsx` → `TaskRow` | 🔀 | Both: title first, 2 lines max, then a row of facts with the date on the right. Each app's extras are optional props. Kaarigar: `leading` (trade symbol), `description`, `progress` (segments), `tint` by lane. Contractor: `code`, `comments`, `attachments`, `assignee` in a fixed slot. `due.tone` covers Kaarigar's `DUE_TONE`. |
| 16 | `ListRow` + `RowList` | `RequestsTab` org rows, Home mentor list, history rows | Home `ProjectRows`, `TeamRow`, Profile → Settings link, `.rowlist` / `.row` | ✅ | Leading slot, title, subtitle, trailing slot, chevron. `accent` is Contractor's project colour bar; `card` is a standalone row. |
| 17 | `DetailList` | `DetailGroup` → `<dl>` rows with a "Not added" placeholder | Profile → Account `<dl>` grid | ✅ | Label over value, 1 or 2 columns, dimmed `emptyValue`. The label follows the look: sentence case vs mono uppercase. |
| 18 | `ProfileHero` | `IdentityCard` (dark green, PR #207) | `ProfileScreen` hero (`Panel tone="ochre"` + `PersonAvatar xl` + phone + role pill) | 🔀 | Big avatar, name, meta line, tag, optional action. `tone="forest"` or `tone="ochre"`. |

### 2.4 Controls

| # | Kit component | Kaarigar | Contractor | | How it was merged |
|---:|---|---|---|---|---|
| 19 | `SegmentedTabs` | `task-board.tsx` → `LaneTabs` (counts, `.journey-lane-tabs`); `TaskDetailClient` section tabs (icons) | `task-screen.tsx` / `approval-screen.tsx` tabs (`ui/tabs`: Notes · Files · Activity, icons + counts) | 🔀 | Equal-width tabs on a sunk track, with icon and count. `variant="solid"` (selected fills green) or `variant="plate"` (selected lifts onto a plate). A real tablist with arrow / Home / End keys. The desktop `SubTabs` takes only strings and has no icons, so it didn't fit. |
| 20 | `ChoiceGroup` | `ProfileTab` text-size radiogroup (pill track); the language picker | `settings-screen.tsx` text size (3 "Aa" tiles) + language list | 🔀 | Both apps' Settings pick text size and language. `layout="grid"` (Aa tiles), `"list"` (language with code and tick) or `"pill"` (Kaarigar's track). A real `radiogroup` with arrow keys. |
| 21 | `PhoneInput` | `RequestOtpClient` phone field | `LoginClient` phone step | ✅ | +91 prefix, digits only, 16px+ text (no iOS zoom). |
| 22 | `OtpInput` (+ `formatIndianPhone`) | `auth/OtpBoxes.tsx` — **one** input under 6 boxes | `LoginClient` OTP step: **six** inputs with focus juggling | ✅ | Kaarigar's approach kept: one input keeps SMS autofill, paste and backspace working for free. `onComplete` fires on the last digit. |
| 23 | `BottomSheet` | `ProfilePhotoActionSheet`, `RegisterHelpSheet`, `update-capture-sheet`, `request-time-button` | `new-task-dialog`, `edit-task-dialog`, the photo viewer (centred `ui/dialog`) | 🔀 | Same job, different shape. The sheet is kept because a thumb reaches it. Scrim and Escape close it, the page underneath stops scrolling, focus moves in and back out, and `busy` blocks closing during a save. |

### 2.5 ♻️ Reused from Omnidel's desktop kit — not rebuilt

| Desktop component | Kaarigar | Contractor | Note |
|---|---|---|---|
| `EmptyState` | `RequestsTab` empty states (icon + text) | `pulse/chrome.tsx` → `EmptyState` (dashed card, icon, title, hint) | `size="inline"` covers both. |
| `Skeleton`, `SkeletonText`, `SkeletonCard` | `nav-skeletons.tsx` → private `SkeletonBlock` (4 skeletons) | `ui/skeleton` + every `loading.tsx` | Build the per-screen skeletons from these. |
| `Button` | inline `btnPrimaryStyle` / `logoutButtonStyle` etc. | `ui/button` (shadcn) | `size="lg" block` for the 48px full-width actions; `variant="danger"` for Sign out. |
| `TimerRing`, `CustomSelect` | `timer-ring.tsx`, `CustomSelect.tsx` | — | Already ported from Acharya in the earlier map. Contractor doesn't use them, so they are not in this kit. |

---

## 3. The two looks

The palette (`--page`, `--surface`, `--ink*`, `--green*`, `--ochre*`,
`--terracotta`, `--crit`, `--slate`…) has the **same hex values in both apps**.
OmniPulse's `globals.css` says it was copied from omnidel-acharya. What differs
is set per screen by `MobileScreen look`:

| Token | `kaarigar` (default) | `contractor` | From |
|---|---|---|---|
| `--am-title-font` | sans, 650 | serif (Fraunces), 500 | PR #207 `.journey-app { --serif: var(--sans) }` vs OmniPulse `.page-title` |
| `--am-label-font` / case | sans, none | mono, uppercase, tracked | `.journey-app { --mono: var(--sans) }` vs `Eyebrow` / `SectionHead` |
| `--am-radius` | 16px | 12px | `.journey-*` cards vs `rounded-xl` |
| `--am-tag-radius` | 999px | 3px | `HistoryTags`, task chips vs `Pill` |

Tokens both apps use that Omnidel's `global.css` did not define are added
by the kit stylesheet: `--slate`, `--slate-wash`, `--plum`, `--r-xl`,
`--shadow-lg`, `--ease-out`, `--ease-drawer` and `--cream` (`#f4efdf`).

---

## 4. Where the two disagreed — and which way the kit went

| Thing | Kaarigar | Contractor | Kit |
|---|---|---|---|
| OTP entry | 1 input, 6 drawn boxes | 6 inputs | **Kaarigar's** — autofill, paste and backspace work with no extra code |
| Overlays | bottom sheets | centred dialogs | **Bottom sheet** — reachable one-handed |
| Selected dock tab | stroke icon on green-wash plate | Material icon turns solid on a cream plate | **Both**, via `tone`. In the dark tone the three Material glyphs go solid; stroke glyphs thicken |
| Profile tab in the dock | person glyph | reader's own initials | **Either**: a `DockItem` takes `icon` *or* `avatarName` |
| Stat tile | stacked, wave removed (PR #207) | row, with wave | **Both**, via `layout` |
| Avatar palette | 4 tones | 5 tones (adds plum) | **5**: a superset, so the same name keeps the same colour in both apps |
| Language picker | `SearchableSelect pill` | radio list | **`ChoiceGroup list`**: three languages don't need search |
| Mic while connecting | `disabled` | live, so the tap abandons a hung connect | **Contractor's**: enabled by default; `disableWhileConnecting` to opt in |

---

## 5. Not common: stays in one app (for now)

These are what the **screens** will need beyond the kit. Each one is used by only
one app today, so it isn't in the kit.

**Kaarigar only (PR #207)**

* `WorkSymbol` + `lib/task-category.ts`: a trade illustration per task. Plugs into `TaskCard leading`.
* `WorkProgressOverview` → `ProgressDial` (24-tick ring) and `task-board` → `GlobalProgressBar`.
* `QuickPrompts`, `LessonCardDeck`, quiz `Celebration` / `SparkBurst`, and the learn tabs (`TaskCourseView`, `TaskQuizTab`, `TaskVideoTab`, …).
* `AuthHeroShell`, `AuthHeroBackButton` (portrait sign-in layout). The *fields* inside are in the kit.
* The Acharya persona surfaces: `AcharyaShell`, `AcharyaHeader(Morph)`, `AcharyaPortrait`, `AcharyaReelsFeed`, `FeaturedAcharyaCard`, `HomeMahAcharyaGuide`, the chats and thread.
* Voice video: `AcharyaPip`, `LiveAcharyaPip`, `DraggableDock`, Tavus / Anam panels.
* `update-capture-sheet`, `request-time-button`, `NoticeBanner`, `HistoryTab` timeline, `OrgIdentity`.

**Contractor only (OmniPulse)**

* `pulse/error-state.tsx` → `ErrorState` (centred, retry + home). Kaarigar has no `(app)/error.tsx`, so this is a candidate to share once it does.
* `pulse/expandable.tsx` → `Expandable` (measured "show more") and `pulse/section.tsx` → `Collapsible`.
* `pulse/photo-swiper.tsx` → `PhotoGallery` / `PhotoSwiper` (review evidence). Desktop `ImageField` / `MediaPlayer` is the nearest match.
* `pulse/rich-text.tsx` → `RichText`. Kaarigar's `TaskDescription` / `ArticleMarkdown` do the same job with `react-markdown`, which this repo doesn't have. **Shared once a markdown dependency is agreed.**
* `new-task-dialog` / `edit-task-dialog` forms, the approval decision bar, and `ListDot`.
* shadcn primitives with no Kaarigar use: `calendar`, `command`, `popover`, `dropdown-menu`, `tooltip`.

---

## 6. Where it lives and how to see it

```
src/components/acharya-mobile/
  index.ts                 public surface (imports the stylesheet)
  acharya-mobile.css       all am-* classes + the two looks + missing tokens
  Icon.tsx                 MobileIcon
  MobileScreen.tsx         MobileScreen, ScreenHeader, IconButton
  BottomDock.tsx           BottomDock
  MicButton.tsx            MicButton, ConnectingDots
  VoiceWaveform.tsx        VoiceWaveform
  micLevel.ts              micLevel, createLevelBus, frameRms
  PersonAvatar.tsx         PersonAvatar, PersonAvatarStack
  Card.tsx                 Card, SectionHeader
  Tag.tsx                  Tag, colorTagStyle
  StatTile.tsx             StatTile, StatRow
  DetailList.tsx           DetailList, ProfileHero
  ListRow.tsx              ListRow, RowList
  TaskCard.tsx             TaskCard
  SegmentedTabs.tsx        SegmentedTabs
  ChoiceGroup.tsx          ChoiceGroup
  SignInFields.tsx         PhoneInput, OtpInput, formatIndianPhone
  BottomSheet.tsx          BottomSheet
  README.md
src/playground/AcharyaMobileSection.tsx   Playground → "Acharya mobile" tab
```

Run `npm run dev`, then go to **Playground → Acharya mobile**. The top of the tab
shows a Kaarigar phone and a Contractor phone side by side, both built from these
components. A mic-state switch drives both docks at once, and each component is
shown in every state below that.

---

## 7. The screens, built on the kit

Both apps now run in this workspace on demo data. In the sidebar, open
**Mobile apps → Kaarigar app** or **Contractor app**. Each shows a phone with
the app inside and a list of its screens beside it. The phone is
`transform`ed, so the docked mic and the bottom sheets pin to the phone's
edges, with no preview mode in any component.

| App | Screens | Interactive |
|---|---|---|
| **Kaarigar** (`src/mobile/kaarigar/`, PR #207) | Sign in · Home (guide + inline mic, next step, journey dial, lane counts, guides) · My work (overall progress, lane tabs, task cards with trade symbols) · Task (5 icon sections, sessions, steps) · Stories · Profile (About / Report / History / Requests) · Settings | Start work → finish sessions → submit for review moves the task across lanes; accept or decline an invite; the mic connects, listens and answers |
| **Contractor** (`src/mobile/contractor/`, OmniPulse) | Sign in · Review (counts, search, person chips, queue) · Approval (Details / Notes / Proof / Score + decision bar, photo viewer) · Projects · Project board (lane chips, New task sheet) · Task (Notes / Files / Activity) · Teams (rosters open in place) · Profile · Settings | Theek hai / Send back takes the approval off the queue with a notice; New task adds to the board; sort and filter |

What the screens needed beyond the kit stayed **one-app** and lives beside them:
`WorkSymbol` (ported unchanged), `ProgressDial` and the board progress bar
for Kaarigar; the decision bar and the photo grid and viewer for Contractor.
Kaarigar's Chat, Quiz, Learn and Stories player are placeholders that say they
aren't ported, rather than imitations.

One fix went back into the kit while building them. `SegmentedTabs` truncated
labels when 4+ tabs carried icons (the Kaarigar task screen, the Contractor
approval), so a dense strip now stacks icon over label.

Not done yet: Hindi / Bengali strings (the screens are English; the language
choice is shown but doesn't switch the text), and real data / voice.

---

## 8. QA

Tested end to end with Playwright in Chrome from `omnidel-e2e`
(`tests/omnidel-frontend/mobile-kit/`, run with `npm run mobile-kit`): 35 tests covering
every flow in both apps, number checks across screens, keyboard use, the mic
states, sheets, sign-in, and the generic page audit on 18 screens × 5 widths.

The first pass found 3 medium and 4 low findings. All three medium and three of the
low ones are fixed in this work, and each has a regression check:

* **M1:** guide task counts are counted from the tasks, with correct plurals.
* **M2:** "Oldest" is computed from what is still waiting.
* **M3:** `BottomSheet` traps Tab and Shift+Tab.
* **L1:** `ListRow` gets `expanded`, which sets `aria-expanded`.
* **L2:** one `h1` per page.
* **L3:** at phone width the phone ends above the shell's Ask MahAcharya pill.

**Still open, L4:** Language and Text size don't change the demo yet. That is a
product decision.

The re-test passed 35 / 35 on two consecutive runs. The report, with screenshots, is
`omnidel-e2e/reports/mobile-kit/Acharya-Mobile-Kit-QA-Test-Report.pdf`.
