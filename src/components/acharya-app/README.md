# Acharya app — components (reference copy)

The complete `src/components` tree of the **Acharya karigar portal**, copied
here so the shared-UI work can see everything it will eventually cover.

| | |
|---|---|
| Source | `D:\Omnidel\omnidel-acharya` → `src/components` |
| Commit | `c91584d` on `fix/voice-beep-playback-and-session-order`, 2026-09-25 |
| Files | 64 (19,032 lines) |
| Status | **reference only — this folder does not compile here** |

## Why it does not compile

These files are written for a Next.js app and reach for things this workspace
does not have: `@/lib/*` (106 imports), `@/hooks/*` (11), `next/navigation`,
`next/link`, `next/image`, `next/font`, plus `react-markdown`, `remark-gfm` and
`@vercel/blob`. The workspace is a Vite SPA on demo data with two dependencies.

So the folder is **excluded from the build**, in two places:

* `tsconfig.json` → `"exclude": ["src/components/acharya-app"]`
* `eslint.config.js` → added to `ignores`

Nothing imports it, so Vite never bundles it either. `npm run typecheck`,
`npm run lint`, `npm run build` and `npm run smoke` all behave exactly as they
did before it arrived — that is the point of a reference drop.

**Do not import from this folder.** It is the source to port *from*, not a
library to build on. Ported components belong beside the others in
`src/components/`, written against this workspace's tokens and primitives.

## What can be ported without the app

16 of the 64 files import nothing beyond React and their
siblings — those are the presentational ones, and the obvious first candidates:

* `SearchableSelect.tsx` — 300 lines
* `CustomSelect.tsx` — 250 lines
* `AcharyaHeaderMorph.tsx` — 246 lines
* `nav-skeletons.tsx` — 221 lines
* `learn/learn-resource-cards.tsx` — 219 lines
* `timer-ring.tsx` — 214 lines
* `voice/MahAcharyaMic.tsx` — 183 lines
* `AcharyaPortrait.tsx` — 170 lines
* `learn/LearnFullscreenSheet.tsx` — 156 lines
* `learn/LearnBrowseSheet.tsx` — 122 lines
* `auth/AuthShell.tsx` — 114 lines
* `auth/MahAcharyaHelpCard.tsx` — 80 lines
* `learn/YouTubePlayerModal.tsx` — 80 lines
* `ghost-icon-button.ts` — 72 lines
* `learn/LearnPanelShell.tsx` — 61 lines
* `voice/TavusVideoTile.tsx` — 60 lines

Everything else needs the app behind it: a route, a store, an API call, a model
or a media session. Those are ports that only make sense once this workspace
has something to stand in for the server.

## Inventory

### (root)  ·  33 files

Screens and widgets of the karigar portal — task board, task card, headers, chat entry points.

| File | Lines | Needs |
|---|---:|---|
| `AcharyaHeader.tsx` | 621 | lib |
| `AcharyaHeaderMorph.tsx` | 246 | — |
| `AcharyaPortrait.tsx` | 170 | — |
| `AcharyaReelsFeed.tsx` | 676 | lib |
| `AcharyaShell.tsx` | 996 | hooks, lib |
| `AcharyaThread.tsx` | 579 | lib, react-markdown, remark-gfm |
| `ActiveTaskSession.tsx` | 2 | app |
| `AnamAvatarPanel.tsx` | 302 | hooks, lib |
| `AppBootstrap.tsx` | 55 | lib, next/navigation |
| `BoardAcharyaChat.tsx` | 542 | lib, react-markdown, remark-gfm |
| `CommentRichBody.tsx` | 295 | lib, react-markdown, remark-gfm |
| `ContinueWhereYouLeftOff.tsx` | 546 | lib, next/navigation |
| `CustomSelect.tsx` | 250 | — |
| `FeaturedAcharyaCard.tsx` | 438 | lib |
| `HomeMahAcharyaChat.tsx` | 729 | lib, react-markdown, remark-gfm |
| `HomeMahAcharyaGuide.tsx` | 568 | hooks, lib, next/navigation |
| `HomeMahAcharyaGuideLazy.tsx` | 19 | next/dynamic |
| `IndicFontScope.tsx` | 48 | lib, next/font/google |
| `NoticeBanner.tsx` | 512 | lib, next/link |
| `ProfileMenu.tsx` | 153 | lib, next/link |
| `RegisterHelpSheet.tsx` | 463 | lib |
| `SearchableSelect.tsx` | 300 | — |
| `TaskDescription.tsx` | 107 | lib, react-markdown, remark-gfm |
| `acharya-avatar.tsx` | 159 | lib |
| `attempt-info-badge.tsx` | 66 | lib |
| `ghost-icon-button.ts` | 72 | — |
| `instant-nav.tsx` | 316 | next/navigation |
| `nav-skeletons.tsx` | 221 | — |
| `request-time-button.tsx` | 386 | lib |
| `task-board.tsx` | 447 | lib, next/navigation |
| `task-card.tsx` | 313 | lib, next/link |
| `timer-ring.tsx` | 214 | — |
| `update-capture-sheet.tsx` | 831 | hooks, lib, @vercel/blob/client |

### auth  ·  4 files

Registration and sign-in shells.

| File | Lines | Needs |
|---|---:|---|
| `AuthBackButton.tsx` | 40 | next/link |
| `AuthShell.tsx` | 114 | — |
| `MahAcharyaHelpCard.tsx` | 80 | — |
| `RegisterAcharyaSupport.tsx` | 644 | hooks, lib |

### learn  ·  16 files

The learning surface: articles, lessons, quizzes, video, comments.

| File | Lines | Needs |
|---|---:|---|
| `ArticleMarkdown.tsx` | 95 | react-markdown, remark-gfm |
| `ArticleReaderSheet.tsx` | 245 | lib |
| `LearnBrowseSheet.tsx` | 122 | — |
| `LearnFullscreenSheet.tsx` | 156 | — |
| `LearnPanelShell.tsx` | 61 | — |
| `TaskChatTab.tsx` | 229 | lib, next/dynamic, next/navigation |
| `TaskCommentsTab.tsx` | 912 | lib |
| `TaskCourseView.tsx` | 675 | lib |
| `TaskLearnLessonView.tsx` | 408 | lib |
| `TaskLearnTab.tsx` | 27 | lib |
| `TaskLearnWebView.tsx` | 430 | lib |
| `TaskQuizTab.tsx` | 913 | lib |
| `TaskVideoTab.tsx` | 88 | lib |
| `VideoPickListModal.tsx` | 125 | lib, next/image |
| `YouTubePlayerModal.tsx` | 80 | — |
| `learn-resource-cards.tsx` | 219 | — |

### voice  ·  11 files

The voice/avatar layer — mic, waveform, PiP, session providers.

| File | Lines | Needs |
|---|---:|---|
| `AcharyaPip.tsx` | 256 | lib |
| `DraggableDock.tsx` | 260 | lib |
| `LiveAcharyaPip.tsx` | 204 | lib, a photo parked on the screen |
| `MahAcharyaMic.tsx` | 183 | — |
| `ProofConversationMic.tsx` | 35 | hooks |
| `TavusSessionProvider.tsx` | 170 | hooks |
| `TavusVideoTile.tsx` | 60 | — |
| `VoiceSessionProvider.tsx` | 161 | hooks |
| `VoiceToggle.tsx` | 136 | hooks, lib |
| `VoiceWaveform.tsx` | 102 | lib |
| `voice-nav-actions.ts` | 160 | hooks, lib |

## Keeping it current

This is a point-in-time copy, not a link — the Acharya app moves on without it.
Re-copy when that matters:

```bash
rm -rf frontend/src/components/acharya-app
cp -r D:/Omnidel/omnidel-acharya/src/components frontend/src/components/acharya-app
```

and update the commit in the table above.
