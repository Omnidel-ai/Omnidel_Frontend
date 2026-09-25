"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { TaskCardLink } from "@/components/task-card";
import { getLanes, type LaneId } from "@/lib/lanes";
import { BOARD_LANE_PAGE_SIZE } from "@/lib/acharya-tasks";
import { useStrings } from "@/lib/i18n/useLang";
import { laneFromTab } from "@/lib/lane-ids";
import type { KarigarTask } from "@/lib/api/tasks";

export type Lane = ReturnType<typeof getLanes>[number];

export function GlobalProgressBar({
  tasks,
  completedOverride,
  totalOverride,
}: {
  tasks: KarigarTask[];
  /** When the painted list is still a seed, pass full-board counts from the server. */
  completedOverride?: number;
  totalOverride?: number;
}) {
  const s = useStrings();
  const total = totalOverride ?? tasks.length;
  const completed =
    completedOverride ?? tasks.filter((t) => t.statusSlug === "done").length;
  const pct = total === 0 ? 0 : Math.round((completed / total) * 100);

  return (
    <div
      style={{
        padding: "10px 16px 14px",
        borderBottomWidth: 1,
        borderBottomStyle: "solid",
        borderBottomColor: "var(--rule)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 6,
        }}
      >
        <span
          style={{
            fontFamily: "var(--mono)",
            fontSize: 10,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "var(--ink-mute)",
          }}
        >
          {s.overallProgress}
        </span>
        <span
          style={{
            fontFamily: "var(--mono)",
            fontSize: 11,
            color: "var(--ink-soft)",
            fontWeight: 500,
          }}
        >
          {completed} / {total}
        </span>
      </div>
      <div
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={s.progressCompleted(pct)}
        style={{
          height: 5,
          borderRadius: 999,
          background: "var(--surface-sunk)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${pct}%`,
            borderRadius: 999,
            background: "var(--green-deep)",
            transition: "width 400ms cubic-bezier(0.23,1,0.32,1)",
          }}
        />
      </div>
    </div>
  );
}

export function LaneTabs({
  byLane,
  showWorkspaceChip,
  initialTab,
  acharyaSlug,
  fullListReady = true,
}: {
  byLane: Array<{ lane: Lane; tasks: KarigarTask[]; totalCount?: number }>;
  showWorkspaceChip: boolean;
  initialTab?: LaneId;
  /** When set, task cards deep-link to the nested acharya route. */
  acharyaSlug?: string;
  /** False while background prefetch of remaining tasks is still in flight. */
  fullListReady?: boolean;
}) {
  const s = useStrings();
  const searchParams = useSearchParams();
  const urlTab = laneFromTab(searchParams.get("tab"));
  const firstNonEmpty = byLane.find((b) => (b.totalCount ?? b.tasks.length) > 0)?.lane.id ?? "todo";
  /** Set only by a tap. See the precedence note below. */
  const [tapped, setTapped] = useState<LaneId | null>(null);

  /**
   * Lane precedence, strongest first: this session's tap, then `?tab=`, then the
   * caller's suggestion, then the first lane that has anything in it.
   *
   * A tap has to sit above the URL even though the effect below writes the tap
   * INTO the URL — the write lands after paint, so reading the URL first would
   * make every tab tap wait a frame for its own side effect, and would make the
   * tabs inert entirely on a browser that does not reflect `replaceState` back
   * through `useSearchParams`. Nothing changes the URL's lane behind this
   * component's back within one mount, so the tap cannot go stale.
   *
   * `?tab=` above `initialTab` is what fixes Resume. On the acharya board that
   * prop is derived from the FOCUS TASK, which only exists once the background
   * task prefetch resolves — so it used to arrive a beat AFTER a resumed board
   * had opened on the right lane, and quietly drag it back to Planned. That is
   * why QA saw the tab remembered on one run and forgotten on the next: it came
   * down to whether the prefetch beat the render. A guess must never overrule a
   * choice.
   *
   * Derived, not held in state, so there is nothing to keep in sync.
   */
  const active: LaneId = tapped ?? urlTab ?? initialTab ?? firstNonEmpty;

  /**
   * Mirror the selected lane into `?tab=`.
   *
   * The lane used to live only in component state, and that is what broke
   * "Resume takes you back to the tab you left": the resume trail records the
   * URL, so a lane the URL never carried could be neither named on the Continue
   * card nor restored by Resume. Written for every lane change, not just a tap —
   * a board can open on a lane it chose itself, and that is still the lane the
   * karigar was looking at when they walked away.
   *
   * `history.replaceState`, not `router.replace`: switching lanes is a view
   * toggle, so it must not push a history entry (Back would then walk back
   * through the tabs) and must not re-run the server render of a board that
   * already holds every lane's tasks.
   *
   * The state argument MUST be `null` — passing `window.history.state` is what
   * left Resume on the wrong lane a second time. Next patches replaceState to
   * dispatch the new URL into the router (that is what updates `usePathname` /
   * `useSearchParams`), but it skips that dispatch entirely when the state it is
   * handed already carries `__NA` — its own marker, present on EVERY app-router
   * entry — because a state that already looks like Next's is assumed to come
   * from Next itself (app-router.js: `if (data?.__NA || data?._N) return
   * originalReplaceState(...)`). So the address bar changed and nothing else
   * did: `LastScreenTracker` reads the lane through `useSearchParams`, never saw
   * it, and the trail kept whatever lane the URL carried on arrival. Next copies
   * `__NA` and its internals tree onto a null state itself
   * (`copyNextJsInternalHistoryState`), so nothing is lost by passing null —
   * which is also what LearnPageClient / ProfileClient / TaskDetailClient pass.
   */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("tab") === active) return;
    url.searchParams.set("tab", active);
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }, [active]);

  const activeLane = byLane.find((b) => b.lane.id === active) ?? byLane[0];

  return (
    <div>
      <div
        role="tablist"
        aria-label={s.taskLanes}
        style={{
          display: "flex",
          // Four lanes now (Planned / Doing / Review / Done) — the row has to
          // fit a 360px phone, so the gaps and type below are tighter than the
          // three-tab version and long labels ellipsis rather than wrap.
          gap: 4,
          padding: "12px 12px 4px",
          marginBottom: 4,
        }}
      >
        {byLane.map(({ lane, tasks, totalCount }) => {
          const isActive = lane.id === active;
          const badge = totalCount ?? tasks.length;
          return (
            <button
              key={lane.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setTapped(lane.id)}
              className="press"
              style={{
                flex: "1 1 0",
                minWidth: 0,
                minHeight: 44,
                padding: "8px 6px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 5,
                borderRadius: "var(--r-md)",
                background: isActive ? lane.accentBg : "transparent",
                color: isActive ? lane.accentColor : "var(--ink-mute)",
                fontFamily: "var(--sans)",
                fontSize: 12,
                fontWeight: 600,
                letterSpacing: "0.02em",
                borderWidth: 1,
                borderStyle: "solid",
                borderColor: isActive ? lane.accentColor : "var(--rule)",
                transition: "background-color .15s, color .15s, border-color .15s",
              }}
            >
              <span
                style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
              >
                {lane.label}
              </span>
              <span
                aria-hidden
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: 10,
                  flexShrink: 0,
                  minWidth: 16,
                  height: 16,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "0 5px",
                  borderRadius: 999,
                  background: isActive ? "color-mix(in srgb, currentColor 12%, transparent)" : "var(--surface-sunk)",
                  color: isActive ? "currentColor" : "var(--ink-mute)",
                  fontWeight: 600,
                }}
              >
                {badge}
              </span>
            </button>
          );
        })}
      </div>

      {activeLane ? (
        (activeLane.totalCount ?? activeLane.tasks.length) > 0 ? (
          <LaneSection
            key={activeLane.lane.id}
            lane={activeLane.lane}
            tasks={activeLane.tasks}
            totalCount={activeLane.totalCount}
            fullListReady={fullListReady}
            showWorkspaceChip={showWorkspaceChip}
            acharyaSlug={acharyaSlug}
            hideHeader
          />
        ) : (
          <p
            style={{
              padding: "32px 24px",
              textAlign: "center",
              fontSize: 13,
              color: "var(--ink-mute)",
              fontFamily: "var(--sans)",
            }}
          >
            {s.nothingInLane(activeLane.lane.label)}
          </p>
        )
      ) : null}
    </div>
  );
}

export function LaneSection({
  lane,
  tasks,
  totalCount,
  fullListReady = true,
  showWorkspaceChip,
  hideHeader = false,
  acharyaSlug,
}: {
  lane: Lane;
  tasks: KarigarTask[];
  /** Full lane size (may be > tasks.length while the rest are still prefetching). */
  totalCount?: number;
  fullListReady?: boolean;
  showWorkspaceChip: boolean;
  hideHeader?: boolean;
  acharyaSlug?: string;
}) {
  const s = useStrings();
  const laneTotal = totalCount ?? tasks.length;
  const [visibleCount, setVisibleCount] = useState(BOARD_LANE_PAGE_SIZE);
  const [pendingMore, setPendingMore] = useState(false);

  useEffect(() => {
    setVisibleCount(BOARD_LANE_PAGE_SIZE);
    setPendingMore(false);
  }, [lane.id]);

  // When background prefetch lands and the user already tapped Show more, reveal the next page.
  useEffect(() => {
    if (!pendingMore) return;
    if (tasks.length <= visibleCount) return;
    setVisibleCount((n) => Math.min(n + BOARD_LANE_PAGE_SIZE, tasks.length));
    setPendingMore(false);
  }, [pendingMore, tasks.length, visibleCount]);

  const visible = tasks.slice(0, visibleCount);
  const hasMore = visibleCount < laneTotal;
  const waitingForPrefetch = hasMore && visibleCount >= tasks.length && !fullListReady;

  return (
    <section aria-label={`${lane.label} tasks`} style={{ padding: "0 0 4px" }}>
      {!hideHeader && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "14px 16px 8px",
          }}
        >
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: lane.accentColor,
              flexShrink: 0,
            }}
            aria-hidden
          />
          <h2
            style={{
              fontFamily: "var(--sans)",
              fontSize: 13,
              fontWeight: 600,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              color: "var(--ink-soft)",
              margin: 0,
              flex: 1,
            }}
          >
            {lane.label}
          </h2>
          <span
            style={{
              fontFamily: "var(--mono)",
              fontSize: 11,
              padding: "1px 7px",
              borderRadius: 999,
              background: lane.accentBg,
              color: lane.accentColor,
              fontWeight: 500,
            }}
          >
            {laneTotal}
          </span>
        </div>
      )}

      {laneTotal === 0 ? (
        <p
          style={{
            margin: "0 16px 12px",
            fontSize: 13,
            color: "var(--ink-faint)",
            fontStyle: "italic",
          }}
        >
          {s.noTasksHere}
        </p>
      ) : (
        <div
          className="stagger"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            padding: "0 16px 4px",
          }}
        >
          {visible.map((task) => (
            <TaskCardLink
              key={task.id}
              task={task}
              showWorkspaceChip={showWorkspaceChip}
              acharyaSlug={acharyaSlug}
            />
          ))}
          {hasMore ? (
            <button
              type="button"
              className="press"
              disabled={waitingForPrefetch || pendingMore}
              onClick={() => {
                if (visibleCount < tasks.length) {
                  setVisibleCount((n) => Math.min(n + BOARD_LANE_PAGE_SIZE, tasks.length));
                  return;
                }
                setPendingMore(true);
              }}
              style={{
                marginTop: 4,
                marginBottom: 8,
                minHeight: 44,
                borderRadius: "var(--r-md)",
                borderWidth: 1,
                borderStyle: "solid",
                borderColor: "var(--rule)",
                background: "var(--surface)",
                color: "var(--green-deep)",
                fontFamily: "var(--sans)",
                fontSize: 14,
                fontWeight: 650,
                cursor: waitingForPrefetch ? "wait" : "pointer",
                opacity: waitingForPrefetch ? 0.7 : 1,
              }}
            >
              {waitingForPrefetch || pendingMore
                ? s.loadingTasks
                : `${s.showMore} · ${laneTotal - visibleCount}`}
            </button>
          ) : null}
        </div>
      )}
    </section>
  );
}
