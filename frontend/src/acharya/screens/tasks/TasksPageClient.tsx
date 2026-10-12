"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { fetchAllTasks, TasksApiError, type KarigarTask } from "@/acharya/lib/api/tasks";
import { LaneTabs } from "@/components/acharya/tasks/task-board";
import AcharyaAvatar from "@/components/acharya/persona/acharya-avatar";
import { journeyStrings } from "@/acharya/lib/i18n/journey-strings";
import { useInstantNav } from "@/components/acharya/shell/instant-nav";
import { openTaskCount, rollupTasksByAcharya } from "@/acharya/lib/acharya-tasks";
import { pickFeatureAcharya } from "@/acharya/lib/feature-acharya";
import { getLanes } from "@/acharya/lib/lanes";
import { laneForTask } from "@/acharya/lib/lane-ids";
import { useLang, useStrings } from "@/acharya/lib/i18n/useLang";
import type { AcharyaListItem } from "@/acharya/lib/server/acharyas";

interface Props {
  initialTasks: KarigarTask[];
  /** For the feature card + naming the acharya on the resume card. */
  acharyas: AcharyaListItem[];
  /** Bucket for tasks with no explicit acharya (matches home). */
  defaultSlug: string;
  /** `is_platform_default` from OmniDel admin — see lib/feature-acharya. */
  pinnedSlug?: string | null;
}

function TasksPageClientInner({ initialTasks, acharyas, defaultSlug, pinnedSlug = null }: Props) {
  const router = useRouter();
  const nav = useInstantNav();
  const searchParams = useSearchParams();
  const lang = useLang();
  const s = useStrings();
  const LANES = getLanes(lang);
  const shouldFreshLoad = searchParams.get("fresh") === "1";
  const [tasks, setTasks] = useState<KarigarTask[]>(initialTasks);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef<number>(0);
  const PTR_THRESHOLD = 72;

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const data = await fetchAllTasks(isRefresh);
      setTasks(data.items);
      setError(null);
    } catch (err) {
      if (err instanceof TasksApiError && err.status === 401) {
        router.push("/auth/phone/request-otp");
        return;
      }
      const msg = err instanceof Error ? err.message : s.couldNotLoadTasks;
      setError(msg);
    } finally {
      if (isRefresh) setRefreshing(false);
      else setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    if (shouldFreshLoad) void load(true);
  }, [shouldFreshLoad, load]);

  function onTouchStart(e: React.TouchEvent) {
    touchStartY.current = e.touches[0].clientY;
  }
  function onTouchEnd(e: React.TouchEvent) {
    const delta = e.changedTouches[0].clientY - touchStartY.current;
    const el = scrollRef.current;
    if (delta > PTR_THRESHOLD && el && el.scrollTop === 0 && !refreshing && !loading) {
      void load(true);
    }
  }

  // Same rule as the acharya board: Review is a lane of its own, decided by
  // reviewStatus rather than the (unchanged) status slug.
  const byLane = LANES.map((lane) => ({
    lane,
    tasks: tasks.filter((t) => laneForTask(t) === lane.id),
  }));

  // Keep the same featured guide shortcut as Home; voice lives in the dock.
  const rollups = rollupTasksByAcharya(tasks, defaultSlug);
  const byOpenTasks = [...acharyas].sort((a, b) => {
    const delta = openTaskCount(rollups.get(b.slug)) - openTaskCount(rollups.get(a.slug));
    return delta !== 0 ? delta : a.displayName.localeCompare(b.displayName);
  });
  const featured = pickFeatureAcharya(acharyas, pinnedSlug, byOpenTasks);
  const showWorkspaceChip = new Set(tasks.map((t) => t.workspaceId)).size > 1;

  return (
    <div className="journey-work-page" style={{ display: "flex", flexDirection: "column" }}>
      <header className="journey-work-toolbar">
        <h1>{journeyStrings(lang).work}</h1>
        <div className="journey-toolbar-actions">
          {featured && <>
            <button type="button" className="press journey-toolbar-avatar" aria-label={`${s.openAcharya}: ${featured.displayName}`} onClick={() => nav.push(`/acharyas/${featured.slug.trim().toLowerCase()}`)}>
              <AcharyaAvatar slug={featured.slug} name={featured.displayName} imageUrl={featured.avatarUrl} size={36} />
            </button>
          </>}
          <button type="button" className="press journey-refresh" onClick={() => void load(true)} disabled={refreshing || loading} aria-label={refreshing ? s.refreshing : journeyStrings(lang).refresh} aria-busy={refreshing}>
            {/* One arc and one arrowhead. The old glyph drew two arrowheads and
                two overlapping arcs, which at 20px collapsed into a tangle
                rather than reading as "refresh". */}
            <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={refreshing ? { animation: "spin .8s linear infinite" } : undefined}><path d="M20.5 12a8.5 8.5 0 1 1-2.49-6.01" /><path d="M20.5 4.2v4.6h-4.6" /></svg>
          </button>
        </div>
      </header>

      {loading ? (
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          aria-live="polite"
          aria-label={s.loadingTasks}
        >
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: "50%",
              borderWidth: 2,
              borderStyle: "solid",
              borderColor: "var(--green)",
              borderTopColor: "transparent",
              animation: "spin 0.7s linear infinite",
            }}
          />
        </div>
      ) : error ? (
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "0 24px",
            textAlign: "center",
          }}
          role="alert"
        >
          <p
            style={{
              fontFamily: "var(--serif)",
              fontStyle: "italic",
              fontSize: 17,
              color: "var(--ink)",
              margin: 0,
            }}
          >
            {s.couldNotLoadTasks}
          </p>
          <p style={{ fontSize: 13, color: "var(--ink-mute)", marginTop: 6 }}>{error}</p>
          <button
            type="button"
            onClick={() => void load(true)}
            style={{
              marginTop: 16,
              padding: "9px 20px",
              borderRadius: "var(--r-md)",
              background: "var(--green-deep)",
              color: "#f4efdf",
              fontFamily: "var(--sans)",
              fontSize: 13,
              fontWeight: 600,
              border: "1px solid var(--green-deep)",
              cursor: "pointer",
              minHeight: 44,
            }}
          >
            {s.tryAgain}
          </button>
        </div>
      ) : (
        <div
          ref={scrollRef}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          className="hide-scrollbar"
          style={{
            flex: 1,
            overflowY: "auto",
            paddingBottom: "max(env(safe-area-inset-bottom), 16px)",
          }}
        >
          {tasks.length === 0 ? (
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
                <span
                  style={{
                    fontFamily: "var(--serif)",
                    fontStyle: "italic",
                    fontSize: 24,
                    color: "var(--ink-soft)",
                  }}
                >
                  आ
                </span>
              </div>
              <p
                style={{
                  fontFamily: "var(--serif)",
                  fontStyle: "italic",
                  fontSize: 16,
                  color: "var(--ink)",
                  margin: 0,
                }}
              >
                {s.noTasksYet}
              </p>
              <p style={{ fontSize: 13, color: "var(--ink-mute)", marginTop: 6, lineHeight: 1.5 }}>
                {s.noTasksAssigned}
              </p>
            </div>
          ) : (
            // No initialTab prop: LaneTabs reads `?tab=` itself, so this board
            // and the acharya boards resume on the same lane the same way.
            <LaneTabs byLane={byLane} showWorkspaceChip={showWorkspaceChip} />
          )}
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export default function TasksPageClient(props: Props) {
  return (
    <Suspense fallback={null}>
      <TasksPageClientInner {...props} />
    </Suspense>
  );
}
