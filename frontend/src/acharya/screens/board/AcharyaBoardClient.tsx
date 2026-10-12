"use client";

import { displayTaskTitle } from "@/acharya/lib/task-text";

/**
 * Client-side board for a single acharya.
 *
 * SSR sends a slim seed (first 10 tasks per lane) + lane totals. This client
 * paints that immediately, then prefetches the full karigar task list in the
 * background so "Show more" can reveal the next 10 instantly.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { GlobalProgressBar, LaneTabs } from "@/components/acharya/tasks/task-board";
import { BoardAcharyaChat } from "@/components/acharya/chat/BoardAcharyaChat";
import { getLanes, type LaneId } from "@/acharya/lib/lanes";
import {
  countTasksByLane,
  pickFocusTask,
  sortTasksNewestFirst,
  type BoardLaneTotals,
} from "@/acharya/lib/acharya-tasks";
import { laneForTask } from "@/acharya/lib/lane-ids";
import { fetchAllTasks, type KarigarTask } from "@/acharya/lib/api/tasks";
import { useLang, useStrings } from "@/acharya/lib/i18n/useLang";
import { useAcharyaShell } from "@/components/acharya/shell/AcharyaShell";
import { FALLBACK_ACHARYA_SLUG } from "@/acharya/lib/default-acharya";
import type { AcharyaListItem } from "@/acharya/lib/server/acharyas";
import boardChrome from "@/components/acharya/shell/AcharyaBoardChrome.module.css";

const DEFAULT_ACHARYA_SLUG_FALLBACK = FALLBACK_ACHARYA_SLUG;

interface Props {
  acharya: AcharyaListItem;
  /** First 10 per Planned/Doing/Done — enough to paint the first screen. */
  seedTasks: KarigarTask[];
  laneTotals: BoardLaneTotals;
  progressTotal: number;
  progressCompleted: number;
  workspaceSlug?: string;
  /** Tasks with no acharyaSlug fall under this (mirrors server DEFAULT_ACHARYA_SLUG). */
  defaultAcharyaSlug?: string;
}

function EmptyBoardState({
  acharya,
  workspaceSlug,
}: {
  acharya: AcharyaListItem;
  workspaceSlug: string;
}) {
  const { setBoardChatInline } = useAcharyaShell();
  const onActiveChange = useCallback(
    (active: boolean) => setBoardChatInline(active),
    [setBoardChatInline],
  );

  // No tasks on this board → the chat IS the screen, linked or not. No "No tasks"
  // block, no Register CTA, no modal sheet, no sticky Chat CTA.
  return (
    <BoardAcharyaChat
      acharyaSlug={acharya.slug}
      acharyaName={acharya.displayName}
      acharyaAvatarUrl={acharya.avatarUrl}
      workspaceSlug={workspaceSlug}
      hint={`Tasks appear here when ${acharya.displayName} assigns them.`}
      onActiveChange={onActiveChange}
    />
  );
}

function withBoardAcharya(task: KarigarTask, acharya: AcharyaListItem): KarigarTask {
  const acharyaName = task.acharyaName?.trim() || acharya.displayName;

  return {
    ...task,
    acharyaSlug: task.acharyaSlug || acharya.slug,
    acharyaName,
    acharyaInitial: task.acharyaInitial || acharyaName.trim()[0]?.toUpperCase() || "·",
    acharyaAvatarUrl: task.acharyaAvatarUrl || acharya.avatarUrl,
  };
}

function needsBackgroundPrefetch(seedLen: number, totals: BoardLaneTotals): boolean {
  const full = totals.todo + totals.doing + totals.done;
  return full > seedLen;
}

export default function AcharyaBoardClient({
  acharya,
  seedTasks,
  laneTotals,
  progressTotal,
  progressCompleted,
  workspaceSlug = "",
  defaultAcharyaSlug = DEFAULT_ACHARYA_SLUG_FALLBACK,
}: Props) {
  const lang = useLang();
  const s = useStrings();
  const { setHeader, setScreenHandlers } = useAcharyaShell();
  const acharyaSlug = acharya.slug;

  const [tasks, setTasks] = useState(() =>
    seedTasks.map((task) => withBoardAcharya(task, acharya)),
  );
  const [fullListReady, setFullListReady] = useState(
    () => !needsBackgroundPrefetch(seedTasks.length, laneTotals),
  );
  const [totals, setTotals] = useState(laneTotals);

  // Always re-fetch with ?fresh=1 after paint. Seed may come from the 45s
  // process cache (warmed at login), so a task just created in OmniDel would
  // otherwise stay missing — especially when the seed already covers every
  // lane and we used to skip the background fetch entirely.
  useEffect(() => {
    setTasks(seedTasks.map((task) => withBoardAcharya(task, acharya)));
    setTotals(laneTotals);

    let cancelled = false;
    const needsMorePages = needsBackgroundPrefetch(seedTasks.length, laneTotals);
    if (needsMorePages) setFullListReady(false);
    else setFullListReady(true);

    async function refreshBoard(fresh: boolean) {
      try {
        const res = await fetchAllTasks(fresh);
        if (cancelled) return;
        const scoped = (res.items ?? [])
          .filter((t) => (t.acharyaSlug ?? defaultAcharyaSlug) === acharyaSlug)
          .map((t) => withBoardAcharya(t, acharya));
        setTasks(scoped);
        setTotals(countTasksByLane(scoped));
      } catch {
        // Keep seed + server totals; Show more still works up to seeded rows.
      } finally {
        if (!cancelled) setFullListReady(true);
      }
    }

    void refreshBoard(true);

    function onVisible() {
      if (document.visibilityState === "visible") void refreshBoard(true);
    }
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [acharya, acharyaSlug, defaultAcharyaSlug, laneTotals, seedTasks]);

  const byLane = useMemo(() => {
    const lanes = getLanes(lang);
    // laneForTask, not slug membership: a submitted task keeps its old status
    // slug while it waits on the manager, and it belongs in Review.
    return lanes.map((lane) => ({
      lane,
      tasks: sortTasksNewestFirst(tasks.filter((t) => laneForTask(t) === lane.id)),
      totalCount: totals[lane.id],
    }));
  }, [lang, tasks, totals]);

  useEffect(() => {
    setHeader({ showBack: false });
    setScreenHandlers(null);
  }, [setHeader, setScreenHandlers]);

  const focus = pickFocusTask(tasks);
  const initialTab: LaneId | undefined = focus ? laneForTask(focus) ?? undefined : undefined;
  const activeTask = useMemo(
    () => tasks.find((task) => laneForTask(task) === "doing") ?? null,
    [tasks],
  );

  const empty = progressTotal === 0 && tasks.length === 0;

  return (
    <div
      className={boardChrome.boardContent}
      style={{
        flex: 1,
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        overflowY: empty ? "hidden" : "auto",
        // Clears the floating Start-conversation dock (AcharyaShell) so the last
        // card can always be scrolled out from under it.
        paddingBottom: empty ? 0 : "calc(max(env(safe-area-inset-bottom), 14px) + 62px)",
      }}
    >
      {!empty ? (
        <GlobalProgressBar
          tasks={tasks}
          completedOverride={progressCompleted}
          totalOverride={progressTotal}
        />
      ) : null}

      {!empty && activeTask ? (
        <Link
          href={`/acharyas/${acharya.slug}/tasks/${encodeURIComponent(activeTask.id)}`}
          className={boardChrome.activeTaskLink}
          aria-label={s.openTask(displayTaskTitle(activeTask.title, lang))}
        >
          <span className={boardChrome.activeTaskKicker}>{s.activeTask}</span>
          <span className={boardChrome.activeTaskTitle}>{displayTaskTitle(activeTask.title, lang)}</span>
          <span className={boardChrome.activeTaskArrow} aria-hidden>
            →
          </span>
        </Link>
      ) : null}

      {empty ? (
        <EmptyBoardState acharya={acharya} workspaceSlug={workspaceSlug} />
      ) : (
        <LaneTabs
          byLane={byLane}
          showWorkspaceChip={false}
          initialTab={initialTab}
          acharyaSlug={acharya.slug}
          fullListReady={fullListReady}
        />
      )}
    </div>
  );
}
