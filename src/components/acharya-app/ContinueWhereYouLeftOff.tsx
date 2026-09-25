"use client";

/**
 * "Continue where you left off" — the resume offer, delivered as a NOTIFICATION.
 *
 * Two halves:
 *  - `<LastScreenTracker />` sits in the (app) layout and records every
 *    non-home screen the karigar lands on, INCLUDING its `?tab=` lane.
 *  - `useResumeNotice()` + `<ResumeNoticeCard />` put the offer at the top of
 *    the home bell's dropdown, counted in its badge like any other notice.
 *
 * **Why it moved out of the page.** It was a card at the top of home and of the
 * work list, i.e. above the acharyas on every single open, for a trip the
 * karigar may well have finished with. A resume offer is news about the past —
 * that is what the notifications bell is for. Once there, it also gets the one
 * thing a page card cannot have: it is gone until you ask for it.
 *
 * **Once per session.** Resuming or dismissing marks it done in `sessionStorage`
 * (see `markDone`), so it does not come back on this tab — not even after a
 * reload, which is exactly when a page card used to reappear. A new session
 * starts with a fresh trail and a fresh offer.
 *
 * Why persisted (see store.lastScreen): the case this exists for is the karigar
 * being pulled away mid-task and reopening the app later — often after the tab
 * was evicted. A session-only memory would be empty exactly then.
 *
 * Why two slots (lastScreen + prevScreen): the trail records the screen the
 * karigar is STANDING on. Home is never in the trail, so home reads `lastScreen`
 * directly; the work list is, so there it would offer the karigar the screen
 * they are already looking at. `pickResumeTarget` skips that entry and falls to
 * the step before it.
 *
 * The offer dismisses itself once the trail is stale (a week).
 */

import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useSyncExternalStore, type CSSProperties } from "react";
import AcharyaAvatar from "@/components/acharya-avatar";
import { useInstantNav } from "@/components/instant-nav";
import { useStrings } from "@/lib/i18n/useLang";
import { laneFromPath, laneFromTab, type LaneId } from "@/lib/lane-ids";
import { useStore } from "@/lib/store";
import type { AcharyaListItem } from "@/lib/server/acharyas";
import { SETTINGS_PATH, LEGACY_SETTINGS_PATH } from "@/lib/voice-nav-targets";

/** Older than this and "continue" is a guess about a different day's work. */
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/** Enough of a task for the card to name it — home and /tasks both hold these. */
export interface ResumeTaskLike {
  id: string;
  title: string;
}

interface Trail {
  path: string;
  at: number;
}

function pathOnly(path: string): string {
  const q = path.indexOf("?");
  return q === -1 ? path : path.slice(0, q);
}

/** Home itself, and the screens it makes no sense to send someone back into. */
function isResumable(path: string): boolean {
  const bare = pathOnly(path);
  if (!bare.startsWith("/")) return false;
  if (bare === "/" || bare === "/acharyas") return false;
  if (bare.startsWith("/auth")) return false;
  return true;
}

export function LastScreenTracker() {
  // useSearchParams needs a Suspense boundary to be safe anywhere it is
  // mounted; this component lives in the (app) layout, above every route.
  return (
    <Suspense fallback={null}>
      <LastScreenTrackerInner />
    </Suspense>
  );
}

function LastScreenTrackerInner() {
  const pathname = usePathname();
  // The lane tab is a search param, so pathname alone loses it — and "the tab
  // I was on" is half of what makes a resume land where the karigar left.
  const tab = useSearchParams().get("tab");

  useEffect(() => {
    if (!pathname) return;
    // Written through getState, not a subscribed setter: this component only
    // ever WRITES the trail, and subscribing would re-render the whole (app)
    // tree every time the path changes.
    const store = useStore.getState();
    // Staleness is pruned here rather than checked when the card renders — a
    // clock read during render is impure, and the trail has to be judged
    // against "now" exactly once, on arrival.
    const last = store.lastScreen;
    if (last && Date.now() - last.at > MAX_AGE_MS) store.setLastScreen(null);
    // Home is not a destination to resume — but it must not wipe the trail
    // either, or landing on home would erase the very thing the card offers.
    if (!isResumable(pathname)) return;
    const laneTab = laneFromTab(tab);
    // Arriving on a screen with no lane in the URL must not ERASE the lane
    // already recorded for that same screen. The lane reaches this component
    // through the router, and a board writes it a beat AFTER it mounts, so a
    // laneless arrival and the lane itself can land in either order — losing
    // that race is what reopened a resumed board on Planned when the karigar
    // had left from Review. A screen the karigar is standing on can only gain
    // lane detail here, never lose it; the next lane write replaces it.
    // Read again rather than off `store`: the staleness prune above may just
    // have cleared the trail, and a pruned lane must not come back.
    const known = useStore.getState().lastScreen;
    const keptLane =
      !laneTab && known && pathOnly(known.path) === pathname ? laneFromPath(known.path) : null;
    const lane = laneTab ?? keptLane;
    store.setLastScreen(lane ? `${pathname}?tab=${lane}` : pathname);
  }, [pathname, tab]);

  return null;
}

/** `/acharyas/<slug>` and nothing under it — an acharya's board itself. */
function bareBoardSlug(path: string): string | null {
  const m = /^\/acharyas\/([^/]+)\/?$/.exec(pathOnly(path));
  return m ? m[1] : null;
}

/** Acharya slug + task id for any screen that sits under a task. */
function acharyaTaskOnPath(path: string): { slug: string; taskId: string } | null {
  const m = /^\/acharyas\/([^/]+)\/tasks\/([^/]+)/.exec(pathOnly(path));
  return m ? { slug: m[1], taskId: m[2] } : null;
}

/**
 * Newest trail entry that is NOT the screen the karigar is looking at, plus the
 * task that entry is really about. Returns null on home when the trail is empty,
 * and on any tracked screen whose only history is itself.
 *
 * `taskHintId` is the fix for a card that named the acharya and not the work.
 * The trail records the screen the karigar is STANDING on, and it cannot tell
 * walking forward from walking out: leaving a task is `task → board → home`, two
 * back-presses, so the board is what the trail holds even though the task is
 * what the karigar was doing. The board stays the resume target — that IS where
 * they left off — but the title has to say which piece of work is waiting there.
 */
function pickResumeTarget(
  currentPath: string | null,
  last: Trail | null,
  prev: Trail | null,
): { entry: Trail; taskHintId?: string } | null {
  const here = currentPath ? pathOnly(currentPath) : "";
  const usable = [last, prev].filter(
    (e): e is Trail => !!e && isResumable(e.path) && pathOnly(e.path) !== here,
  );
  const entry = usable[0];
  if (!entry) return null;

  const boardSlug = bareBoardSlug(entry.path);
  if (boardSlug) {
    for (const older of usable.slice(1)) {
      const task = acharyaTaskOnPath(older.path);
      // Same acharya only — the step before a board is often a different one's.
      if (task && task.slug === boardSlug) return { entry, taskHintId: task.taskId };
    }
  }
  return { entry };
}

/**
 * Session-scoped "the karigar has dealt with this offer" flag.
 *
 * sessionStorage, not the persisted store and not React state: a dismissal has
 * to survive a reload (saying no once should not have to be repeated on every
 * refresh) and must NOT survive to the next app session, where a fresh trail is
 * a fresh offer. Kept behind useSyncExternalStore so the flag can flip the badge
 * without a setState-in-an-effect, and so SSR and hydration agree.
 */
const DONE_KEY = "karigar:resume-notice-done";
const doneListeners = new Set<() => void>();

function readDone(): boolean {
  try {
    return window.sessionStorage.getItem(DONE_KEY) === "1";
  } catch {
    // Private mode / storage disabled: treat as not-yet-dealt-with. The offer
    // reappearing is a smaller failure than the offer never appearing.
    return false;
  }
}

function markDone() {
  try {
    window.sessionStorage.setItem(DONE_KEY, "1");
  } catch {
    /* nothing to do — the flag simply will not stick */
  }
  for (const fn of doneListeners) fn();
}

function subscribeDone(fn: () => void) {
  doneListeners.add(fn);
  return () => {
    doneListeners.delete(fn);
  };
}

/** Server snapshot is `true` (offer hidden) so nothing flashes before hydration. */
function useResumeDone(): boolean {
  return useSyncExternalStore(subscribeDone, readDone, () => true);
}

export interface ResumeNotice {
  /** Where Resume goes — carries its `?tab=` lane. */
  path: string;
  title: string;
  sub?: string;
  acharya?: AcharyaListItem;
}

/**
 * The resume offer as ONE notification, or null when there is nothing to offer:
 * empty trail, a path we cannot name, or an offer the karigar already resumed or
 * dismissed this session.
 *
 * `input` is what naming the destination needs. Callers that do not have the
 * acharya list pass nothing and get no notice — the offer belongs to the home
 * bell, not to every header that happens to show notices.
 */
export function useResumeNotice(input?: {
  acharyas: AcharyaListItem[];
  tasks?: ResumeTaskLike[];
}): ResumeNotice | null {
  const s = useStrings();
  const pathname = usePathname();
  const lastScreen = useStore((st) => st.lastScreen);
  const prevScreen = useStore((st) => st.prevScreen);
  const done = useResumeDone();

    if (!input || done) return null;
    const resume = pickResumeTarget(pathname, lastScreen, prevScreen);
    if (!resume) return null;
    const { entry, taskHintId } = resume;

    const target = describeScreen(entry.path, input.acharyas, input.tasks ?? [], s, taskHintId);
  if (!target) return null;
  return { path: entry.path, ...target };
}

/**
 * The offer, rendered inside the notifications dropdown. Keeps the acharya's
 * face: at 320px wide, recognising WHO the work belongs to is most of what makes
 * the line legible, and it is what separates this from a task assignment notice.
 */
export function ResumeNoticeCard({
  notice,
  onDone,
}: {
  notice: ResumeNotice;
  /** Lets the panel react (usually close) once the offer is gone. */
  onDone?: () => void;
}) {
  const s = useStrings();
  const nav = useInstantNav();
  const setLastScreen = useStore((st) => st.setLastScreen);

  function dismiss() {
    // Clearing the whole trail as well: the karigar said "not this", and
    // offering the step before it reads as the notice refusing to go away.
    markDone();
    setLastScreen(null);
    onDone?.();
  }

  function resume() {
    markDone();
    onDone?.();
    nav.push(notice.path);
  }

  return (
    <section style={card} aria-label={s.continueWhereYouLeftOff}>
      {/* Eyebrow owns its own full-width row. Inline beside the avatar it wrapped
          to two lines in a 320px panel and shoved the title out of the card. */}
      <div style={headRow}>
        <span style={eyebrow}>
          <ResumeIcon />
          {s.continueWhereYouLeftOff}
        </span>
        <button
          type="button"
          className="press"
          onClick={dismiss}
          aria-label={s.noticeDismiss}
          title={s.noticeDismiss}
          style={dismissBtn}
        >
          <CloseIcon />
        </button>
      </div>

      <div style={bodyRow}>
        {/* Glyph, not an avatar, when the screen has no acharya: AcharyaAvatar
            with a bare name goes looking one up over the network, and "Your
            work" is not an acharya to look up. */}
        {notice.acharya ? (
          <AcharyaAvatar
            slug={notice.acharya.slug}
            name={notice.acharya.displayName}
            imageUrl={notice.acharya.avatarUrl}
            size={36}
          />
        ) : (
          <span style={glyphWrap} aria-hidden>
            <WorkIcon />
          </span>
        )}

        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={label}>{notice.title}</span>
          {notice.sub ? <span style={subLabel}>{notice.sub}</span> : null}
        </span>

        <button type="button" className="press" onClick={resume} style={resumeBtn}>
          {s.resume}
        </button>
      </div>
    </section>
  );
}

/** Lane tab in the stored path → the label the karigar sees on that tab. */
function laneLabel(path: string, s: ReturnType<typeof useStrings>): string | null {
  const lane = laneFromPath(path);
  if (!lane) return null;
  const labels: Record<LaneId, string> = {
    todo: s.planned,
    doing: s.doing,
    review: s.review,
    done: s.done,
  };
  return labels[lane];
}

function joinMeta(parts: Array<string | null | undefined>): string | undefined {
  const kept = parts.filter((p): p is string => !!p?.trim());
  return kept.length > 0 ? kept.join(" · ") : undefined;
}

/**
 * Human name for a stored path. Returns null for anything unrecognised — a
 * card that says "Continue: /acharyas/x/tasks/9f2…" is worse than no card.
 */
function describeScreen(
  path: string,
  acharyas: AcharyaListItem[],
  tasks: ResumeTaskLike[],
  s: ReturnType<typeof useStrings>,
  /** Task the karigar stepped out of on their way to this screen — see pickResumeTarget. */
  taskHintId?: string,
): { title: string; sub?: string; acharya?: AcharyaListItem } | null {
  const bare = pathOnly(path);
  const lane = laneLabel(path, s);

  if (bare.startsWith(SETTINGS_PATH) || bare.startsWith(LEGACY_SETTINGS_PATH)) return { title: s.settings };
  if (bare.startsWith("/profile")) return { title: s.profileTabProfile };
  if (bare.startsWith("/tasks")) return { title: s.yourWork, sub: lane ?? undefined };

  const acharyaMatch = /^\/acharyas\/([^/]+)(\/.*)?$/.exec(bare);
  if (acharyaMatch) {
    const slug = acharyaMatch[1];
    const rest = acharyaMatch[2] || "";
    const acharya = acharyas.find((a) => a.slug === slug);
    const who = acharya?.displayName ?? slug;

    // A task screen: name the task if the caller handed us the list it is in.
    const taskMatch = /\/tasks\/([^/]+)/.exec(rest);
    if (taskMatch) {
      const kind = rest.includes("/active")
        ? s.session
        : rest.includes("/learn")
          ? s.learn
          : s.task;
      const task = tasks.find((t) => t.id === taskMatch[1]);
      return {
        title: task?.title?.trim() || kind,
        sub: joinMeta([who, task ? kind : null]),
        acharya,
      };
    }

    // The board, reached by backing out of a task: name the task, because
    // "Soumyajit Acharya / Acharya" tells the karigar nothing about which piece
    // of work Resume returns them to. The lane rides along in the sub, so the
    // card says both what is waiting and where.
    const hinted = taskHintId ? tasks.find((t) => t.id === taskHintId) : undefined;
    const hintedTitle = hinted?.title?.trim();
    if (hintedTitle) return { title: hintedTitle, sub: joinMeta([who, lane]), acharya };

    return { title: who, sub: joinMeta([s.acharya, lane]), acharya };
  }

  return null;
}

function ResumeIcon() {
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1" />
      <path d="M3.2 4.4v4.4h4.4" />
      <path d="M12 8.5v4l2.6 1.6" />
    </svg>
  );
}

/** Stand-in for a portrait on the screens that belong to no acharya. */
function WorkIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="7" width="18" height="13" rx="2.5" />
      <path d="M8.5 7V5.4A1.4 1.4 0 0 1 9.9 4h4.2a1.4 1.4 0 0 1 1.4 1.4V7M3 12h18" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

const card: CSSProperties = {
  display: "block",
  // Tighter than a page card and on the dropdown's rhythm — it sits in a list of
  // notices now, not at the top of a screen.
  marginBottom: 6,
  padding: "7px 9px 9px 10px",
  borderRadius: "var(--r-xl)",
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "var(--rule)",
  background: "color-mix(in srgb, var(--ochre-wash) 45%, var(--surface))",
};

const headRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
  minWidth: 0,
};

const bodyRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  marginTop: 6,
  minWidth: 0,
};

const eyebrow: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  minWidth: 0,
  fontFamily: "var(--mono)",
  fontSize: 10,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "var(--ink-mute)",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const glyphWrap: CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: "50%",
  flexShrink: 0,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  background: "var(--surface)",
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "var(--rule)",
  color: "var(--ochre)",
};

const label: CSSProperties = {
  display: "block",
  fontFamily: "var(--sans)",
  fontSize: 13.5,
  fontWeight: 700,
  color: "var(--ink)",
  lineHeight: 1.25,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const subLabel: CSSProperties = {
  display: "block",
  marginTop: 2,
  fontFamily: "var(--sans)",
  fontSize: 12,
  color: "var(--ink-mute)",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const resumeBtn: CSSProperties = {
  flexShrink: 0,
  minHeight: 32,
  padding: "0 12px",
  borderRadius: 999,
  border: "none",
  background: "var(--green-deep)",
  color: "#f4efdf",
  fontFamily: "var(--sans)",
  fontSize: 12.5,
  fontWeight: 700,
  whiteSpace: "nowrap",
  cursor: "pointer",
};

const dismissBtn: CSSProperties = {
  flexShrink: 0,
  width: 28,
  height: 28,
  padding: 0,
  borderRadius: 999,
  border: "none",
  background: "transparent",
  color: "var(--ink-soft)",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
};
