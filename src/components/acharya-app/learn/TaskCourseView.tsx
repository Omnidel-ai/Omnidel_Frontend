"use client";

import { useCallback, useEffect, useState } from "react";
import type { Lang } from "@/lib/store";
import { t } from "@/lib/i18n/strings";
import { displayTaskTitle, resolveTaskText } from "@/lib/task-text";

// Loose task shape — accepts both server KarigarTask and client KarigarTask.
interface TaskShape {
  id: string;
  title: string;
  description: string | null;
  workspaceSlug?: string;
}

// ── TaskCourseView ─────────────────────────────────────────────────────────────
// "Course" sub-tab of the Learn surface. Fetches an AI-generated RAG course
// (modules → sections → key points) from /api/work/course, grounded in the
// resolved acharya's document memory (OmniDel.task_courses). Falls back to the
// raw task notes when the task has no acharya / generation fails.

interface LessonSection {
  heading: string;
  body: string;
  keyPoints: string[];
}
interface LessonModule {
  title: string;
  summary: string;
  sections: LessonSection[];
}

type LessonState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "pending" }
  | { status: "empty"; message: string }
  | { status: "ready"; modules: LessonModule[] }
  | { status: "error"; message: string };

type CachedLessonState = Extract<LessonState, { status: "ready" }>;

const COURSE_CACHE_MS = 5 * 60 * 1000;
const DEBUG_COURSE = process.env.NODE_ENV !== "production";
const courseStateCache = new Map<string, { expiresAt: number; state: CachedLessonState }>();
const courseRequestCache = new Map<string, Promise<LessonState>>();

function courseCacheKey(taskId: string, acharyaSlug: string, lang: Lang) {
  return `${taskId}:${acharyaSlug}:${lang}`;
}

function debugCourse(event: string, data: Record<string, unknown>) {
  if (DEBUG_COURSE) {
    console.info(`[acharya-course] ${event}`, data);
  }
}

async function fetchCourseState(
  taskId: string,
  acharyaSlug: string,
  lang: Lang,
  regenerate: boolean,
): Promise<LessonState> {
  const startedAt = performance.now();
  debugCourse("fetch-start", { taskId, acharyaSlug, lang, regenerate });
  const res = await fetch("/api/work/course", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ taskId, acharyaSlug, lang, regenerate }),
  });
  debugCourse("fetch-response", {
    taskId,
    acharyaSlug,
    lang,
    regenerate,
    ok: res.ok,
    status: res.status,
    ms: Math.round(performance.now() - startedAt),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(data?.error ?? `Course API error: ${res.status}`);
  }
  const data = (await res.json()) as { modules?: unknown; status?: string };

  if (data.status === "none") {
    return { status: "empty", message: "No course available for this task." };
  }
  if (data.status === "pending") {
    return { status: "pending" };
  }

  const modules = data.modules;
  if (
    Array.isArray(modules) &&
    modules.length >= 1 &&
    modules.every(
      (m) =>
        m !== null &&
        typeof m === "object" &&
        typeof (m as LessonModule).title === "string" &&
        Array.isArray((m as LessonModule).sections)
    )
  ) {
    return { status: "ready", modules: modules as LessonModule[] };
  }

  throw new Error("Invalid course format returned by server.");
}

interface Props {
  task: TaskShape;
  acharyaSlug: string;
  lang: Lang;
}

export function TaskCourseView({ task, acharyaSlug, lang }: Props) {
  const [state, setState] = useState<LessonState>({ status: "idle" });
  const s = t(lang);

  const taskTitle = displayTaskTitle(task.title, lang) || task.title;
  const readableDescription = resolveTaskText(task.description, lang);
  const hasDescription = Boolean(readableDescription.trim());

  const loadLesson = useCallback(
    async (regenerate = false) => {
      const key = courseCacheKey(task.id, acharyaSlug, lang);
      if (!regenerate) {
        const cached = courseStateCache.get(key);
        if (cached && cached.expiresAt > Date.now()) {
          debugCourse("cache-hit", { taskId: task.id, acharyaSlug, lang });
          setState(cached.state);
          return;
        }
        const inFlight = courseRequestCache.get(key);
        if (inFlight) {
          debugCourse("join-inflight", { taskId: task.id, acharyaSlug, lang });
          setState({ status: "loading" });
          const next = await inFlight;
          setState(next);
          return;
        }
      } else {
        debugCourse("cache-bust", { taskId: task.id, acharyaSlug, lang });
        courseStateCache.delete(key);
      }

      setState({ status: "loading" });
      const request = fetchCourseState(task.id, acharyaSlug, lang, regenerate)
        .catch((err): LessonState => {
          const message = err instanceof Error ? err.message : "Could not build the course.";
          debugCourse("fetch-error", { taskId: task.id, acharyaSlug, lang, message });
          return { status: "error", message };
        })
        .then((next) => {
          if (next.status === "ready") {
            debugCourse("cache-store", {
              taskId: task.id,
              acharyaSlug,
              lang,
              status: next.status,
              moduleCount: next.modules.length,
            });
            courseStateCache.set(key, {
              expiresAt: Date.now() + COURSE_CACHE_MS,
              state: next,
            });
          }
          return next;
        })
        .finally(() => {
          if (courseRequestCache.get(key) === request) {
            courseRequestCache.delete(key);
          }
        });
      if (!regenerate) courseRequestCache.set(key, request);
      setState(await request);
    },
    [task.id, acharyaSlug, lang]
  );

  // Auto-load the course on mount. The course is RAG-grounded in the acharya's
  // memory, so it can exist even when the task has no description. This is a
  // legitimate fetch-on-mount; loadLesson sets a loading state up front.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadLesson();
  }, [loadLesson]);

  // If upstream is still generating (prebuild / warm), poll until ready so the
  // user does not stay stuck on "pending" after a short first response.
  useEffect(() => {
    if (state.status !== "pending") return;
    let cancelled = false;
    const tick = window.setInterval(() => {
      if (cancelled) return;
      void loadLesson(false);
    }, 2000);
    return () => {
      cancelled = true;
      window.clearInterval(tick);
    };
  }, [state.status, loadLesson]);

  // ── Pending → generation still running upstream ────────────────────────
  if (state.status === "pending") {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "64px 24px",
          gap: 16,
          textAlign: "center",
        }}
      >
        <p style={{ fontSize: 13, color: "var(--ink-mute)", margin: 0, maxWidth: 300 }}>
          Your Acharya is still preparing this course. Check back in a moment.
        </p>
        <button
          type="button"
          onClick={() => void loadLesson()}
          style={{
            minHeight: 40,
            padding: "8px 18px",
            borderRadius: "var(--r-md)",
            background: "var(--green-deep)",
            color: "#f4efdf",
            fontFamily: "var(--sans)",
            fontSize: 13,
            fontWeight: 700,
            border: "none",
            cursor: "pointer",
          }}
        >
          Check again
        </button>
      </div>
    );
  }

  // ── Loading ────────────────────────────────────────────────────────────
  if (state.status === "loading" || state.status === "idle") {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "64px 24px",
          gap: 16,
        }}
      >
        <div
          aria-label="Building your lesson"
          style={{
            width: 32,
            height: 32,
            borderRadius: "50%",
            borderWidth: 2,
            borderStyle: "solid",
            borderColor: "var(--green-deep)",
            borderTopColor: "transparent",
            animation: "lesson-spin 0.7s linear infinite",
          }}
        />
        <p style={{ fontSize: 13, color: "var(--ink-mute)", margin: 0 }}>Building your lesson…</p>
        <style>{`@keyframes lesson-spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // ── Empty/error → fall back to raw description, or quiet empty state if none.
  if (state.status === "empty" || state.status === "error") {
    if (!hasDescription) {
      return (
        <EmptyState
          title={s.noCourseYet}
          body={s.noCourseYetBody}
        />
      );
    }
    return (
      <RawDescription
        title={taskTitle}
        description={readableDescription}
        onRetry={() => void loadLesson(true)}
        error={state.message}
      />
    );
  }

  // ── Ready → render modules + sections ──────────────────────────────────
  return (
    <div style={{ padding: "20px 20px 48px" }}>
      {/* Lesson header */}
      <div
        style={{
          marginBottom: 24,
          paddingBottom: 16,
          borderBottomWidth: 1,
          borderBottomStyle: "solid",
          borderBottomColor: "var(--rule)",
        }}
      >
        <p
          style={{
            fontFamily: "var(--mono)",
            fontSize: 10,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "var(--ink-mute)",
            margin: "0 0 6px",
          }}
        >
          Lesson
        </p>
        <h2
          style={{
            fontFamily: "var(--serif)",
            fontStyle: "italic",
            fontSize: 28,
            fontWeight: 500,
            color: "var(--ink)",
            margin: 0,
            lineHeight: 1.3,
          }}
        >
          {taskTitle}
        </h2>
      </div>

      <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 14 }}>
        {state.modules.map((mod, mi) => (
          <ModuleItem key={mi} mod={mod} index={mi} />
        ))}
      </div>
    </div>
  );
}

// ── Collapsible module (collapsed by default) ─────────────────────────────────

function ModuleItem({ mod, index }: { mod: LessonModule; index: number }) {
  const [open, setOpen] = useState(false);
  return (
    <section
      style={{
        borderWidth: 1,
        borderStyle: "solid",
        borderColor: "var(--rule)",
        borderRadius: "var(--r-md)",
        background: "var(--surface)",
        overflow: "hidden",
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "18px 20px",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
          minHeight: 60,
        }}
      >
        <span
          style={{
            fontFamily: "var(--mono)",
            fontSize: 15,
            fontWeight: 700,
            color: "var(--green-deep)",
            flexShrink: 0,
          }}
        >
          {String(index + 1).padStart(2, "0")}
        </span>
        <h3
          style={{
            flex: 1,
            fontFamily: "var(--serif)",
            fontSize: 22,
            fontWeight: 600,
            color: "var(--ink)",
            margin: 0,
            lineHeight: 1.3,
          }}
        >
          {mod.title}
        </h3>
        <Chevron open={open} />
      </button>

      {open && (
        <div style={{ padding: "0 20px 18px" }}>
          {mod.summary && (
            <p style={{ fontSize: 16, color: "var(--ink-mute)", lineHeight: 1.55, margin: "0 0 14px" }}>
              {mod.summary}
            </p>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {mod.sections.map((sec, si) => (
              <SectionItem key={si} sec={sec} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

// ── Collapsible section (collapsed by default) ────────────────────────────────

function SectionItem({ sec }: { sec: LessonSection }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      style={{
        borderWidth: 1,
        borderStyle: "solid",
        borderColor: "var(--rule)",
        borderRadius: "var(--r-sm)",
        background: "var(--surface-sunk)",
        overflow: "hidden",
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "14px 18px",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
          minHeight: 52,
        }}
      >
        <h4
          style={{
            flex: 1,
            fontFamily: "var(--sans)",
            fontSize: 17,
            fontWeight: 700,
            color: "var(--ink)",
            margin: 0,
          }}
        >
          {sec.heading}
        </h4>
        <Chevron open={open} />
      </button>

      {open && (
        <div style={{ padding: "0 18px 16px" }}>
          <p style={{ fontFamily: "var(--serif)", fontSize: 16.5, lineHeight: 1.75, color: "var(--ink)", margin: 0 }}>
            {sec.body}
          </p>
          {Array.isArray(sec.keyPoints) && sec.keyPoints.length > 0 && (
            <ul style={{ margin: "12px 0 0", paddingLeft: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
              {sec.keyPoints.map((kp, ki) => (
                <li key={ki} style={{ display: "flex", gap: 10, fontSize: 15, lineHeight: 1.55, color: "var(--ink)" }}>
                  <span aria-hidden style={{ color: "var(--green-deep)", flexShrink: 0, marginTop: 1 }}>
                    <CheckIcon />
                  </span>
                  <span>{kp}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

// ── Chevron (rotates when open) ───────────────────────────────────────────────

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="none"
      stroke="var(--ink-mute)"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      style={{ flexShrink: 0, transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s ease" }}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

// ── Fallback: raw description (used on generation error) ──────────────────────

function RawDescription({
  title,
  description,
  onRetry,
  error,
}: {
  title: string;
  description: string;
  onRetry: () => void;
  error: string;
}) {
  const paragraphs = description
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <div style={{ padding: "20px 20px 48px" }}>
      <div
        style={{
          marginBottom: 16,
          padding: "10px 14px",
          background: "var(--terra-wash)",
          borderRadius: "var(--r-md)",
          borderWidth: 1,
          borderStyle: "solid",
          borderColor: "color-mix(in srgb, var(--terracotta) 25%, transparent)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <p style={{ fontSize: 12, color: "var(--terracotta)", margin: 0, lineHeight: 1.4 }}>
          Couldn’t build the lesson ({error}). Showing the task notes instead.
        </p>
        <button
          type="button"
          onClick={onRetry}
          style={{
            flexShrink: 0,
            minHeight: 32,
            padding: "5px 12px",
            borderRadius: "var(--r-sm)",
            background: "var(--green-deep)",
            color: "#f4efdf",
            fontFamily: "var(--sans)",
            fontSize: 12,
            fontWeight: 700,
            border: "none",
            cursor: "pointer",
          }}
        >
          Retry
        </button>
      </div>

      <h2
        style={{
          fontFamily: "var(--serif)",
          fontStyle: "italic",
          fontSize: 24,
          fontWeight: 500,
          lineHeight: 1.25,
          color: "var(--ink)",
          margin: "0 0 14px",
        }}
      >
        {title}
      </h2>

      <div style={{ maxWidth: 620, display: "flex", flexDirection: "column", gap: 16 }}>
        {paragraphs.map((para, i) => (
          <p
            key={i}
            style={{
              fontFamily: "var(--serif)",
              fontSize: 15,
              lineHeight: 1.75,
              color: "var(--ink)",
              margin: 0,
              whiteSpace: "pre-line",
            }}
          >
            {para}
          </p>
        ))}
      </div>
    </div>
  );
}

// ── Shared empty state ────────────────────────────────────────────────────────

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "48px 24px",
        gap: 16,
        textAlign: "center",
      }}
    >
      <div
        aria-hidden
        style={{
          width: 56,
          height: 56,
          borderRadius: 12,
          background: "var(--surface-sunk)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <BookIcon />
      </div>
      <div>
        <p
          style={{
            fontFamily: "var(--serif)",
            fontStyle: "italic",
            fontSize: 18,
            fontWeight: 500,
            color: "var(--ink)",
            margin: "0 0 8px",
          }}
        >
          {title}
        </p>
        <p style={{ fontSize: 13, color: "var(--ink-mute)", lineHeight: 1.5, margin: 0, maxWidth: 280 }}>
          {body}
        </p>
      </div>
    </div>
  );
}

// ── Icons ────────────────────────────────────────────────────────────────────

function BookIcon() {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="var(--ink-mute)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
