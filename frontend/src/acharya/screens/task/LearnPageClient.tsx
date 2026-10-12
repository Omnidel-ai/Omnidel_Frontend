"use client";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { useSearchParams } from "next/navigation";
import { useInstantNav } from "@/components/acharya/shell/instant-nav";
import { LearnSkeleton } from "@/components/acharya/shell/nav-skeletons";
import type { KarigarTask } from "@/acharya/lib/api/tasks";
import { useStore } from "@/acharya/lib/store";
import { useStrings } from "@/acharya/lib/i18n/useLang";
import { statusLabelFor } from "@/acharya/lib/i18n/strings";
import { displayTaskTitle } from "@/acharya/lib/task-text";
import { useAcharyaShell } from "@/components/acharya/shell/AcharyaShell";
import { useStartTask } from "@/acharya/lib/useStartTask";

const loadTaskQuizTab = () =>
  import("@/components/acharya/learn/TaskQuizTab").then((m) => ({ default: m.TaskQuizTab }));
const loadTaskChatTab = () =>
  import("@/components/acharya/learn/TaskChatTab").then((m) => ({ default: m.TaskChatTab }));
const loadTaskLearnTab = () =>
  import("@/components/acharya/learn/TaskLearnTab").then((m) => ({ default: m.TaskLearnTab }));

const TaskQuizTab = dynamic(loadTaskQuizTab, { loading: () => <LearnSkeleton /> });
const TaskChatTab = dynamic(loadTaskChatTab, { loading: () => <LearnSkeleton /> });
const TaskLearnTab = dynamic(loadTaskLearnTab, { loading: () => <LearnSkeleton /> });

// ── LearnPageClient ───────────────────────────────────────────────────────────
// Per-task secondary surfaces: Chat | Quiz | Learn tabbed view.
//
// Tab state is synced to the ?tab= URL param without a server navigation, so
// deep-links (e.g. /tasks/[id]/learn?tab=quiz) open directly and tab taps stay instant.
// Default: "learn".

type LearnTab = "chat" | "quiz" | "learn";
type StatusTone = "doing" | "planned" | "done" | "muted";
const DEBUG_LEARN_TABS = process.env.NODE_ENV !== "production";

const STATUS_TONE: Record<string, StatusTone> = {
  planned: "planned",
  open: "planned",
  doing: "doing",
  in_progress: "doing",
  done: "done",
};

const BODY_STATUS_STYLE: Record<StatusTone, CSSProperties> = {
  doing: { background: "var(--ochre-wash)", color: "var(--ochre)" },
  planned: { background: "var(--terra-wash)", color: "var(--terracotta)" },
  done: { background: "var(--ok-wash)", color: "var(--ok)" },
  muted: { background: "var(--surface-sunk)", color: "var(--ink-mute)" },
};

interface Props {
  task: KarigarTask;
  workspaceSlug: string;
  /** Acharya slug from the route params — owns all in-shell navigation. */
  acharyaSlug: string;
}

export default function LearnPageClient({ task, workspaceSlug, acharyaSlug }: Props) {
  const nav = useInstantNav();
  const searchParams = useSearchParams();
  const storeLang = useStore((s) => s.lang);
  const taskTitle = displayTaskTitle(task.title, storeLang);
  const statusTone = STATUS_TONE[task.statusSlug] ?? "muted";
  const statusText = statusLabelFor(task.statusSlug, storeLang);
  const isDone = task.statusSlug === "done";
  const s = useStrings();
  const { setHeader, setScreenHandlers, notify } = useAcharyaShell();
  const learnHref = `/acharyas/${acharyaSlug}/tasks/${task.id}/learn`;
  const boardHref = `/acharyas/${acharyaSlug}`;

  const TABS: Array<{ key: LearnTab; label: string }> = [
    { key: "chat", label: s.chat },
    { key: "quiz", label: s.quiz },
    { key: "learn", label: s.learnTab },
  ];

  // Read active tab from URL param; fall back to "chat".
  const initialTab = (searchParams.get("tab") as LearnTab | null) ?? "chat";
  const validTabs = new Set<string>(TABS.map((t) => t.key));
  const initialActiveTab = validTabs.has(initialTab) ? initialTab : "chat";
  const [activeTab, setActiveTab] = useState<LearnTab>(initialActiveTab);
  const [visitedTabs, setVisitedTabs] = useState<ReadonlySet<LearnTab>>(
    () => new Set([initialActiveTab])
  );

  const handleTabChange = useCallback(
    (key: LearnTab) => {
      if (DEBUG_LEARN_TABS) {
        console.info("[acharya-tabs] switch", {
          taskId: task.id,
          from: activeTab,
          to: key,
          urlBefore: window.location.href,
        });
      }
      setActiveTab(key);
      setVisitedTabs((prev) => new Set(prev).add(key));
      const params = new URLSearchParams(window.location.search);
      params.set("tab", key);
      window.history.replaceState(null, "", `${learnHref}?${params.toString()}`);
      if (DEBUG_LEARN_TABS) {
        console.info("[acharya-tabs] url-replaced-without-next-navigation", {
          taskId: task.id,
          tab: key,
          urlAfter: window.location.href,
        });
      }
    },
    [activeTab, learnHref, task.id]
  );

  const { startTask } = useStartTask(task.id, { returnTo: learnHref, doneReturnTo: boardHref });

  // Header text is shell state → updates without the persistent header remounting.
  useEffect(() => {
    setHeader({ showBack: true });
  }, [setHeader]);

  useEffect(() => {
    if (DEBUG_LEARN_TABS) {
      console.info("[acharya-tabs] mount", {
        taskId: task.id,
        initialActiveTab,
        currentUrl: window.location.href,
      });
    }
    const timer = window.setTimeout(() => {
      if (DEBUG_LEARN_TABS) {
        console.info("[acharya-tabs] preload-start", { taskId: task.id });
      }
      void Promise.all([loadTaskChatTab(), loadTaskQuizTab(), loadTaskLearnTab()]);
    }, 120);
    return () => {
      window.clearTimeout(timer);
      if (DEBUG_LEARN_TABS) {
        console.info("[acharya-tabs] unmount", { taskId: task.id });
      }
    };
    // Mount/unmount instrumentation should run once per page instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Learn tools layer onto the shell base tools (open_task/go_back/
  // end_conversation). switch_tab + start_task are declared for the "acharya"
  // context. Swapping them does NOT re-mint the acharya session.
  useEffect(() => {
    setScreenHandlers({
      switch_tab: async (args) => {
        const tab = typeof args.tab === "string" ? args.tab : "";
        if (tab === "comments" || tab === "task") {
          nav.push(
            `/acharyas/${acharyaSlug}/tasks/${task.id}${tab === "comments" ? "?tab=comments" : ""}`,
          );
          return { ok: true };
        }
        if (validTabs.has(tab)) handleTabChange(tab as LearnTab);
        return { ok: true };
      },
      start_task: async () => {
        try {
          const res = await startTask();
          // One task at a time — never tell the karigar a start succeeded when
          // the server blocked it because another task is still running.
          if (!res.ok) return { ok: false, error: res.message };
          return { ok: true };
        } catch (e) {
          return { ok: false, error: String(e) };
        }
      },
    });
    return () => setScreenHandlers(null);
    // validTabs is a stable Set built from the constant TABS list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setScreenHandlers, handleTabChange, startTask, nav, acharyaSlug, task.id]);

  // Tell the live acharya the screen changed — no re-mint (same acharya key).
  useEffect(() => {
    notify(`(context: opened Learn for ${taskTitle})`);
  }, [notify, taskTitle]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        // Fill the shell's remaining height (not minHeight) so the chat tab's
        // internal scroll area can fill the gap exactly, avoiding a second
        // page-level scroll bar on top of the chat's own.
        flex: 1,
        minHeight: 0,
        overflow: "hidden",
        background: "var(--page)",
      }}
    >
      {/* Header + voice live in the persistent AcharyaShell. */}

      <div
        style={{
          flexShrink: 0,
          padding: "20px 20px 14px",
          background: "var(--page)",
        }}
      >
        <nav
          role="tablist"
          aria-label="Task sections"
          style={taskTabRail}
        >
          <button
            type="button"
            role="tab"
            aria-selected={false}
            onClick={() => nav.push(`/acharyas/${acharyaSlug}/tasks/${task.id}`)}
            className="press"
            style={taskTabButton}
          >
            {s.task}
          </button>
          {TABS.map(({ key, label }) => {
            const isActive = key === activeTab;
            return (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-controls={`learn-panel-${key}`}
                id={`learn-tab-${key}`}
                onClick={() => handleTabChange(key)}
                className="press"
                style={{ ...taskTabButton, ...(isActive ? taskTabActive : null) }}
              >
                {label}
              </button>
            );
          })}
        </nav>

        <h1
          style={{
            fontFamily: "var(--serif)",
            fontStyle: "italic",
            fontSize: 24,
            fontWeight: 500,
            color: "var(--ink)",
            lineHeight: 1.2,
            margin: "0 0 10px",
          }}
        >
          {taskTitle}
        </h1>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              minHeight: 30,
              padding: "0 10px",
              borderRadius: "var(--r-sm)",
              fontFamily: "var(--mono)",
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              ...BODY_STATUS_STYLE[statusTone],
            }}
          >
            {isDone ? s.completed : statusText}
          </span>
          {(task.workspaceName || task.boardName) && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                minHeight: 30,
                padding: "0 10px",
                borderRadius: "var(--r-sm)",
                background: "var(--surface-sunk)",
                border: "1px solid var(--rule)",
                color: "var(--ink-mute)",
                fontFamily: "var(--mono)",
                fontSize: 10,
                letterSpacing: "0.04em",
              }}
            >
              <BoardIcon />
              {[task.workspaceName, task.boardName].filter(Boolean).join("  ·  ")}
            </span>
          )}
        </div>
        <div aria-hidden style={taskTitleDivider} />
      </div>

      {/* ── Tab panels stay mounted after first visit so loaded content stays warm. */}
      <main
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          overflow: "auto",
          minHeight: 0,
        }}
      >
        {TABS.map(({ key }) => {
          if (!visitedTabs.has(key)) return null;
          const isActive = key === activeTab;
          return (
            <section
              key={key}
              id={`learn-panel-${key}`}
              role="tabpanel"
              aria-labelledby={`learn-tab-${key}`}
              hidden={!isActive}
              style={{
                display: isActive ? "flex" : "none",
                flexDirection: "column",
                flex: 1,
                minHeight: 0,
                // Chat and Quiz pad themselves; the lesson view deliberately
                // does not (see TaskCourseView), so on this screen — whose
                // <main> is flush — the inset is applied here, matching the
                // 20px chrome above.
                ...(key === "learn" ? { paddingInline: 20 } : null),
              }}
            >
              {key === "chat" && (
                <TaskChatTab
                  task={task}
                  workspaceSlug={workspaceSlug}
                  lang={storeLang}
                  returnTo={learnHref}
                  doneReturnTo={boardHref}
                />
              )}
              {key === "quiz" && (
                <TaskQuizTab
                  task={task}
                  workspaceSlug={workspaceSlug}
                  acharyaSlug={acharyaSlug}
                  lang={storeLang}
                />
              )}
              {key === "learn" && (
                <TaskLearnTab
                  task={task}
                  workspaceSlug={workspaceSlug}
                  acharyaSlug={acharyaSlug}
                  lang={storeLang}
                />
              )}
            </section>
          );
        })}
      </main>
    </div>
  );
}

function BoardIcon() {
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
      <line x1="9" x2="9" y1="3" y2="21" />
      <line x1="15" x2="15" y1="3" y2="21" />
    </svg>
  );
}

const taskTabRail: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
  gap: 6,
  padding: 4,
  borderRadius: "var(--r-md)",
  background: "var(--surface-sunk)",
  border: "1px solid var(--rule)",
  marginBottom: 16,
};

const taskTabButton: CSSProperties = {
  minHeight: 36,
  borderRadius: "var(--r-sm)",
  border: "none",
  background: "transparent",
  color: "var(--ink-mute)",
  fontFamily: "var(--sans)",
  fontSize: 12,
  fontWeight: 700,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  textDecoration: "none",
};

const taskTabActive: CSSProperties = {
  background: "var(--surface)",
  color: "var(--green-deep)",
  boxShadow: "0 1px 0 color-mix(in srgb, var(--ink) 8%, transparent)",
};

const taskTitleDivider: CSSProperties = {
  height: 1,
  margin: "6px 12px 16px",
  background: "color-mix(in srgb, var(--rule) 82%, transparent)",
};
