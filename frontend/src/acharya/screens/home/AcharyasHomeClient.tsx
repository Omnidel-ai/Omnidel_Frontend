"use client";

import { hasIndicScript, isLatinScript } from "@/acharya/lib/i18n/registry";
import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { useSearchParams } from "next/navigation";
import { useLang, useStrings } from "@/acharya/lib/i18n/useLang";
import { useInstantNav } from "@/components/acharya/shell/instant-nav";
import {
  rollupTasksByAcharya,
  openTaskCount,
  type AcharyaTaskRollup,
} from "@/acharya/lib/acharya-tasks";
import Link from "next/link";
import WorkProgressOverview, { JourneyIcon } from "@/components/acharya/tasks/WorkProgressOverview";
import { journeyStrings } from "@/acharya/lib/i18n/journey-strings";
import { workProgress } from "@/acharya/lib/work-progress";
import { pickFocusTask } from "@/acharya/lib/acharya-tasks";
import { displayTaskTitle } from "@/acharya/lib/task-text";
import AcharyaAvatar from "@/components/acharya/persona/acharya-avatar";
import NoticeBanner from "@/components/acharya/shell/NoticeBanner";
import { MahAcharyaInlineMic, useMahAcharyaMic } from "@/components/acharya/voice/MahAcharyaMic";
import { AcharyaReelsFeed } from "@/components/acharya/persona/AcharyaReelsFeed";
import FeaturedAcharyaCard from "@/components/acharya/persona/FeaturedAcharyaCard";
import { acharyaFieldTone } from "@/acharya/lib/acharya-field-tone";
import { pickFeatureAcharya } from "@/acharya/lib/feature-acharya";
import type { KarigarTask } from "@/acharya/lib/api/tasks";
import type { AcharyaListItem } from "@/acharya/lib/server/acharyas";

interface Props {
  acharyas: AcharyaListItem[];
  tasks: KarigarTask[];
  defaultSlug: string;
  /**
   * The acharya flagged as platform default in OmniDel admin
   * (`gunakul.mst_acharyas.is_platform_default`) — normally MahAcharya'ji.
   * Always the FIRST row of the list, whatever their task count. Change the flag
   * in admin and this follows; nothing here is slug-hardcoded.
   */
  pinnedSlug?: string | null;
}

// Dominant lane tone for a rollup: in-progress > planned > done. Drives the
// list-row left accent so colour reflects the most actionable state, never just
// "some tasks exist". (The feature card owns its own chrome — see
// components/FeaturedAcharyaCard.)
function laneTone(r: AcharyaTaskRollup): { color: string; wash: string } {
  if (r.doing > 0) return { color: "var(--ochre)", wash: "var(--ochre-wash)" };
  if (r.todo > 0) return { color: "var(--terracotta)", wash: "var(--terra-wash)" };
  return { color: "var(--green)", wash: "var(--ok-wash)" };
}

export default function AcharyasHomeClient({
  acharyas: initialAcharyas,
  tasks,
  defaultSlug,
  pinnedSlug = null,
}: Props) {
  const nav = useInstantNav();
  const search = useSearchParams();
  const s = useStrings();
  const lang = useLang();
  const copy = journeyStrings(lang);
  const nextTask = pickFocusTask(tasks);
  const progress = workProgress(tasks);
  const [acharyas, setAcharyas] = useState(initialAcharyas);
  const homePanelRef = useRef<HTMLElement | null>(null);
  const storiesPanelRef = useRef<HTMLElement | null>(null);
  const previousStoriesViewRef = useRef<boolean | null>(null);
  const storiesView = search.get("view") === "stories";

  useEffect(() => {
    if (previousStoriesViewRef.current === null) {
      previousStoriesViewRef.current = storiesView;
      return;
    }
    previousStoriesViewRef.current = storiesView;
    const activePanel = storiesView ? storiesPanelRef.current : homePanelRef.current;
    activePanel?.focus({ preventScroll: true });
  }, [storiesView]);

  // Keep SSR props when the server re-renders with a new list.
  useEffect(() => {
    setAcharyas(initialAcharyas);
  }, [initialAcharyas]);

  // hi/bn: API localizes display names + personas (Gemini), then we refresh.
  // First call awaits transliteration — may take a few seconds; poll if still Latin.
  useEffect(() => {
    if (lang === "en") return;
    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 6;
    const timers: number[] = [];

    function looksLatinName(name: string | undefined) {
      if (!name?.trim()) return false;
      // Any Indic script present (Bengali, Devanagari, Telugu) → already localized.
      if (hasIndicScript(name)) return false;
      return /[A-Za-z]/.test(name);
    }

    async function refresh() {
      attempts += 1;
      try {
        const r = await fetch(`/api/work/acharyas?lang=${encodeURIComponent(lang)}`, {
          cache: "no-store",
        });
        if (!r.ok || cancelled) return;
        const d = (await r.json()) as { items?: AcharyaListItem[] };
        if (!cancelled && Array.isArray(d.items) && d.items.length > 0) {
          setAcharyas(d.items);
          const stillLatin = d.items.some((a) => looksLatinName(a.displayName));
          if (stillLatin && !isLatinScript(lang) && attempts < maxAttempts) {
            timers.push(window.setTimeout(refresh, 2000));
          }
          return;
        }
      } catch {
        /* best-effort */
      }
      if (!cancelled && attempts < maxAttempts) {
        timers.push(window.setTimeout(refresh, 2000));
      }
    }

    // Kick off immediately (API will await name localization).
    void refresh();
    return () => {
      cancelled = true;
      for (const id of timers) window.clearTimeout(id);
    };
  }, [lang]);

  const rollups = rollupTasksByAcharya(tasks, defaultSlug);
  const byOpenTasks = [...acharyas].sort((a, b) => {
    const taskDelta = openTaskCount(rollups.get(b.slug)) - openTaskCount(rollups.get(a.slug));
    if (taskDelta !== 0) return taskDelta;
    return a.displayName.localeCompare(b.displayName);
  });

  // Feature card follows the platform-default resolver — not "whoever happens
  // to have the most open work" (the old rule, which only made sense while the
  // hero carried the active-task shortcut). See lib/feature-acharya for the
  // resolution order; the work list picks the same acharya through the helper.
  const mainAcharya = pickFeatureAcharya(acharyas, pinnedSlug, byOpenTasks);
  const mainSlug = mainAcharya?.slug ?? null;
  const mainRollup = mainSlug ? rollups.get(mainSlug) : undefined;

  // Rows: everyone except the hero, in open-task order. The hero acharya never
  // repeats below — MahAcharya'ji lives in the hero section only.
  const otherAcharyas = byOpenTasks.filter((a) => a.slug !== mainAcharya?.slug);
  /** Hero first, then the rows — the on-screen order, reused by the stories page. */
  const listOrder = mainAcharya ? [mainAcharya, ...otherAcharyas] : otherAcharyas;

  function openAcharya(slug: string) {
    // Paint board skeleton immediately — do not wrap in startViewTransition
    // (that keeps the old screen until the RSC payload is ready).
    nav.push(`/acharyas/${slug.trim().toLowerCase()}`);
  }

  function handleAcharyaKeyDown(e: KeyboardEvent<HTMLDivElement>, slug: string) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openAcharya(slug);
    }
  }

  // A definite dvh keeps both the list and vertically paged stories inside the
  // viewport. The stories feed owns its own scroller, while the Home list only
  // scrolls when its content overflows.
  return (
    <div className="journey-home" data-view={storiesView ? "stories" : "home"} style={{ display: "flex", flexDirection: "column", height: "100dvh" }}>
      <header
        className="journey-home-header"
        inert={storiesView}
        aria-hidden={storiesView}
        style={{
          position: "sticky",
          top: 0,
          zIndex: 30,
          background: "var(--page)",
          padding: storiesView ? "0 16px" : "12px 16px 10px",
          // Collapsed, not unmounted: the reels page wants the whole viewport,
          // and remounting the header would drop the notice popover.
          maxHeight: storiesView ? 0 : 200,
          opacity: storiesView ? 0 : 1,
          // Only clip while collapsing — the notice popover can overflow this
          // header by design, so `hidden` must not be its resting state.
          overflow: storiesView ? "hidden" : "visible",
          pointerEvents: storiesView ? "none" : "auto",
          transition: "max-height 220ms ease, opacity 150ms ease, padding 220ms ease",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div style={{ minWidth: 0 }}>
            <h1
              style={{
                fontFamily: "var(--serif)",
                fontStyle: "italic",
                fontSize: 22,
                fontWeight: 500,
                color: "var(--ink)",
                margin: 0,
                lineHeight: 1.2,
              }}
            >
              KarmYog
            </h1>
            {/* Tick glyph in front of the count — the line is the karigar's
                running score, so it should read as an achievement, not a label. */}
            <p
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                margin: "5px 0 0",
                fontFamily: "var(--mono)",
                fontSize: 11,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "var(--ochre)",
              }}
            >
              {copy.tagline}
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            {/* The bell carries "continue where you left off" now, so it needs
                the lists that name the destination. */}
            <NoticeBanner tone="soft" resume={{ acharyas, tasks }} />
          </div>
        </div>
      </header>

      <div
        className="hide-scrollbar"
        style={{
          flex: 1,
          minHeight: 0,
          overflow: "hidden",
        }}
      >
        <section
          ref={homePanelRef}
          tabIndex={-1}
          aria-label={copy.home}
          className="hide-scrollbar journey-home-content"
          inert={storiesView}
          style={{
            display: storiesView ? "none" : "block",
            // The height is what makes `overflowY` mean anything. Without it the
            // panel grew to its content inside a parent that clips, so the list
            // below the fold was simply cut off — no scrollbar, no scroll, and
            // the acharyas past the fourth row unreachable. The stories panel
            // beside it always carried this; the home list did not.
            height: "100%",
            minHeight: 0,
            outline: "none",
            overflowY: "auto",
            WebkitOverflowScrolling: "touch",
            overscrollBehaviorY: "contain",
            padding: "16px 16px 0",
            paddingBottom: "calc(env(safe-area-inset-bottom) + 96px)",
          }}
        >
        {acharyas.length === 0 ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "64px 24px",
              textAlign: "center",
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: "var(--r-md)",
                background: "var(--surface-sunk)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 12,
              }}
              aria-hidden
            >
              <span style={{ fontFamily: "var(--serif)", fontStyle: "italic", fontSize: 24, color: "var(--ink-soft)" }}>
                आ
              </span>
            </div>
            <p style={{ fontFamily: "var(--serif)", fontStyle: "italic", fontSize: 16, color: "var(--ink)", margin: 0 }}>
              {s.yourAcharyas}
            </p>
          </div>
        ) : (
          <>
            <div className="journey-home-top">
            <div className="journey-home-guide">
            {mainSlug && mainAcharya && (
              <FeaturedAcharyaCard
                acharya={mainAcharya}
                rollup={mainRollup}
                onOpenBoard={() => openAcharya(mainSlug)}
                  />
            )}

            {nextTask ? <Link className="journey-next-task" href={`/acharyas/${nextTask.acharyaSlug ?? defaultSlug}/tasks/${encodeURIComponent(nextTask.id)}`}><span className="journey-next-icon"><JourneyIcon name="work" /></span><span><span className="journey-eyebrow">{nextTask.statusSlug === "doing" || nextTask.statusSlug === "in_progress" ? copy.continueWork : copy.nextStep}</span><strong>{displayTaskTitle(nextTask.title, lang)}</strong></span><JourneyIcon name="arrow" /></Link> : <div className="journey-next-task journey-next-task-empty"><JourneyIcon name="review" /><span><strong>{progress.total > 0 && progress.done === progress.total ? copy.allDone : progress.review > 0 ? copy.inReview : copy.noTasks}</strong><small>{progress.review > 0 ? copy.reviewNote : copy.noTasksBody}</small></span></div>}
            </div>
            <WorkProgressOverview tasks={tasks} />
            </div>
            <div className="journey-section-heading"><h2>{copy.mentors}</h2><Link href="/tasks">{copy.seeWork}<JourneyIcon name="arrow" /></Link></div>
            <div className="journey-mentor-list" style={{ display: "flex", flexDirection: "column", gap: 10, paddingBottom: 16 }}>
              {otherAcharyas.map((a) => {
                const r = rollups.get(a.slug);
                const hasTasks = !!r && r.total > 0;
                const openCount = r ? r.todo + r.doing : 0;
                const tone = r ? laneTone(r) : null;
                return (
                      <div
                        role="link"
                        tabIndex={0}
                        onClick={() => openAcharya(a.slug)}
                        onKeyDown={(e) => handleAcharyaKeyDown(e, a.slug)}
                        className="press journey-mentor-row"
                        data-field={a.field}
                        key={a.slug}
                        style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      background: "var(--surface)",
                      borderWidth: 1,
                      borderStyle: "solid",
                      borderColor: "var(--rule)",
                      borderLeftWidth: hasTasks ? 3 : 1,
                      borderLeftColor: hasTasks && tone ? tone.color : "var(--rule)",
                          borderRadius: "var(--r-xl)",
                          padding: "12px 12px 12px 14px",
                          minHeight: 68,
                          cursor: "pointer",
                        }}
                      >
                    {/* The portrait is not its own tap target any more: there is
                        no story to play, so the whole row opens the acharya. */}
                    {/* The card's photo band, sized by work-journey.css — it is
                        full-bleed and square there, so `size` is only the
                        intrinsic hint on the <img>. */}
                    <AcharyaAvatar slug={a.slug} name={a.displayName} imageUrl={a.avatarUrl} size={240} imageStyle={avatarTransitionStyle(a.slug)} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p
                        style={{
                          fontFamily: "var(--sans)",
                          fontSize: 15,
                          fontWeight: 600,
                          color: "var(--ink)",
                          margin: 0,
                          lineHeight: 1.25,
                        }}
                      >
                        {a.displayName}
                      </p>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 7,
                          margin: "4px 0 0",
                          minWidth: 0,
                        }}
                      >
                        <span style={{ ...fieldTagStyle, ...acharyaFieldTone(a.field) }}>
                          {s.acharyaFieldLabel(a.field)}
                        </span>
                        {/* Always a line, never a gap. The counts were gated on
                            the acharya HAVING tasks, so a card with none simply
                            lost its third line and sat a row shorter than the
                            one beside it — the grid looked broken rather than
                            empty. `taskCountSummary` already answers the
                            all-zero case with "No tasks yet"; it was never
                            being asked. */}
                        <span
                          style={{
                            ...rowMetaStyle,
                            fontFamily: "var(--mono)",
                            fontSize: 11,
                            letterSpacing: "0.02em",
                            color: hasTasks && tone ? tone.color : "var(--ink-mute)",
                          }}
                        >
                          {s.taskCountSummary({
                            doing: r?.doing ?? 0,
                            planned: r?.todo ?? 0,
                            done: r?.done ?? 0,
                          })}
                        </span>
                      </div>
                    </div>
                    {/* The row matching the published home controller hosts the
                        Gemini Live mic; it renders nothing on every other row. */}
                    <MahAcharyaInlineMic slug={a.slug} size={44} />
                    {openCount > 0 && (
                      <span
                        className="journey-mentor-badge"
                        aria-hidden
                        style={{
                          flexShrink: 0,
                          minWidth: 24,
                          height: 24,
                          padding: "0 7px",
                          borderRadius: 999,
                          background: "var(--ochre)",
                          color: "#f4efdf",
                          fontFamily: "var(--mono)",
                          fontSize: 12,
                          fontWeight: 600,
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        {openCount}
                      </span>
                    )}
                    <RowChevron slug={a.slug} />
                  </div>
                );
              })}
            </div>

          </>
        )}
        </section>
        {/* Stories is an explicit dock destination. Its reels remain vertically
            paged, while the Home list itself has no horizontal swipe surface. */}
        <section
          ref={storiesPanelRef}
          tabIndex={-1}
          inert={!storiesView}
          aria-label={s.acharyaStories}
          style={{
            display: storiesView ? "flex" : "none",
            height: "100%",
            minHeight: 0,
            paddingBottom: "calc(env(safe-area-inset-bottom) + 88px)",
            // The padding reserves the dock's band; paint it the reels' night
            // tone so the dock floats over black, not over the cream page.
            background: "var(--stories-surface)",
            outline: "none",
            flexDirection: "column",
          }}
        >
          <AcharyaReelsFeed
            immersive={storiesView}
            acharyas={listOrder}
            onOpenAcharya={openAcharya}
            onBack={() => nav.replace("/acharyas")}
          />
        </section>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .journey-home[data-view="stories"] .journey-home-header { padding: 0 !important; }
      `}</style>
    </div>
  );
}

/**
 * Trailing chevron — the rows are links, so they should say so. Renders nothing
 * on the row that hosts the MahAcharya mic, where chat + mic already own that
 * slot. Subscribes to the mic context here rather than in the list so a voice
 * status change re-renders one trailing slot, not every acharya row.
 */
function RowChevron({ slug }: { slug: string }) {
  const mic = useMahAcharyaMic()?.mic ?? null;
  if (mic?.slug === slug) return null;
  return (
    <span className="journey-mentor-chevron" style={{ color: "var(--ink-soft)", display: "inline-flex", flexShrink: 0 }}>
      <ChevronIcon />
    </span>
  );
}

function ChevronIcon() {
  return (
    <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ flexShrink: 0 }}>
      <path d="M9 5l7 7-7 7" />
    </svg>
  );
}

/** Field-of-practice tag under an Acharya's name — FINANCE, BUSINESS, SALES … */
const fieldTagStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  flexShrink: 0,
  padding: "3px 8px",
  borderRadius: 7,
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "var(--rule)",
  background: "var(--surface-sunk)",
  color: "var(--ink-soft)",
  fontFamily: "var(--mono)",
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  lineHeight: 1.4,
  whiteSpace: "nowrap",
};

/** Row meta: field tag · task summary. Kept muted so the name still leads. */
const rowMetaStyle: CSSProperties = {
  fontFamily: "var(--sans)",
  fontSize: 12.5,
  color: "var(--ink-mute)",
  lineHeight: 1.35,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  minWidth: 0,
};

function avatarTransitionStyle(slug: string): CSSProperties & { viewTransitionName?: string } {
  return { viewTransitionName: `acharya-${slug}-portrait` };
}
