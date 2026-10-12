# Acharya components

The Acharya karigar app's components, from **omnidel-acharya PR #207**
(head `3b9a1a3`, "unified Acharya redesign"). They are built and run by the
Acharya app in `src/acharya/` (`npm run dev:acharya`); its `/components` page
renders the self-contained ones live.

| Folder | What is in it |
|---|---|
| `auth/` | Sign-in chrome: the hero shell, OTP boxes, back buttons, help card and sheet, register support |
| `chat/` | Talking to a guide: the thread, the board and home chats, the MahAcharya guide, quick prompts |
| `learn/` | The task's Learn, Quiz, Chat, Video and Comments tabs, lessons and article reader |
| `persona/` | The guides themselves: avatar, portrait, featured card, reels feed |
| `shell/` | App chrome: the per-guide shell and headers, work frame, instant navigation and skeletons, notices, profile menu, fonts |
| `tasks/` | Work: task board and card, description, timer ring, update capture, progress, continue-where-you-left-off |
| `ui/` | Generic controls: custom and searchable select, ghost icon button |
| `voice/` | The voice and avatar layer: mic, waveform, picture-in-picture, Tavus and voice session providers |

Upstream these sat flat in `src/components/` (with only `auth/`, `learn/` and
`voice/` as folders). They were grouped here with every import rewritten; the
mapping is `scripts/sync/map-acharya.mjs`. Inside the code, `@/acharya/lib/…`
and `@/acharya/hooks/…` are the app's own `lib` and `hooks`.

## Overlap with `common/` and `omnidel/`

No file here is byte-identical to one in the other sets. These are the same
component forked per app, and the first candidates to merge into `common/`:

| Acharya | OmniDel | `common/` |
|---|---|---|
| `ui/CustomSelect.tsx` ("ported from OmniDel custom-select") | `forms/custom-select.tsx` | `Select/CustomSelect.tsx` |
| `ui/SearchableSelect.tsx` | `forms/searchable-select.tsx` | — |
| `shell/nav-skeletons.tsx` | — | `Skeleton/` |
| `shell/ProfileMenu.tsx` | `shell/profile-menu.tsx` | — |
| `tasks/task-board.tsx` | `boards/task-board.tsx` (different component, same name) | — |
