"use client";

import { useCallback, useEffect, useState } from "react";
import type { Lang } from "@/lib/store";
import { resolveTaskText } from "@/lib/task-text";

interface TaskShape {
  id: string;
  title: string;
  description: string | null;
}

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
  | { status: "ready"; modules: LessonModule[] }
  | { status: "error"; message: string };

interface Props {
  task: TaskShape;
  workspaceSlug: string;
  lang: Lang;
  active: boolean;
}

export function TaskLearnLessonView({ task, workspaceSlug, lang, active }: Props) {
  const [state, setState] = useState<LessonState>({ status: "idle" });
  const taskDescription = resolveTaskText(task.description, lang);
  const hasDescription = Boolean(taskDescription.trim());

  const loadLesson = useCallback(async () => {
    setState({ status: "loading" });
    try {
      const res = await fetch("/api/work/lesson", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspace: workspaceSlug, taskId: task.id, lang }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? `Lesson API error: ${res.status}`);
      }
      const data = (await res.json()) as { modules?: unknown };
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
        setState({ status: "ready", modules: modules as LessonModule[] });
      } else {
        throw new Error("Invalid lesson format returned by server.");
      }
    } catch (err) {
      setState({
        status: "error",
        message: err instanceof Error ? err.message : "Could not build the lesson.",
      });
    }
  }, [workspaceSlug, task.id, lang]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (active && hasDescription && state.status === "idle") void loadLesson();
  }, [active, hasDescription, loadLesson, state.status]);

  if (!hasDescription) {
    return (
      <EmptyState
        title="No lesson notes yet"
        body="Ask your Acharya in the Chat tab — they can walk you through the task step by step."
      />
    );
  }

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

  if (state.status === "error") {
    return <RawDescription description={taskDescription} onRetry={() => void loadLesson()} error={state.message} />;
  }

  return (
    <div style={{ padding: "4px 0 0" }}>
      <div style={{ maxWidth: 640, display: "flex", flexDirection: "column", gap: 28 }}>
        {state.modules.map((mod, mi) => (
          <section key={mi}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 4 }}>
              <span
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: 12,
                  fontWeight: 700,
                  color: "var(--green-deep)",
                  flexShrink: 0,
                }}
              >
                {String(mi + 1).padStart(2, "0")}
              </span>
              <h3
                style={{
                  fontFamily: "var(--serif)",
                  fontSize: 18,
                  fontWeight: 600,
                  color: "var(--ink)",
                  margin: 0,
                  lineHeight: 1.3,
                }}
              >
                {mod.title}
              </h3>
            </div>
            {mod.summary && (
              <p
                style={{
                  fontSize: 13,
                  color: "var(--ink-mute)",
                  lineHeight: 1.5,
                  margin: "0 0 14px 28px",
                }}
              >
                {mod.summary}
              </p>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 16, marginLeft: 28 }}>
              {mod.sections.map((sec, si) => (
                <div
                  key={si}
                  style={{
                    padding: "14px 16px",
                    background: "var(--surface)",
                    borderRadius: "var(--r-md)",
                    borderWidth: 1,
                    borderStyle: "solid",
                    borderColor: "var(--rule)",
                  }}
                >
                  <h4
                    style={{
                      fontFamily: "var(--sans)",
                      fontSize: 14,
                      fontWeight: 700,
                      color: "var(--ink)",
                      margin: "0 0 6px",
                    }}
                  >
                    {sec.heading}
                  </h4>
                  <p
                    style={{
                      fontFamily: "var(--serif)",
                      fontSize: 14,
                      lineHeight: 1.7,
                      color: "var(--ink)",
                      margin: 0,
                    }}
                  >
                    {sec.body}
                  </p>
                  {Array.isArray(sec.keyPoints) && sec.keyPoints.length > 0 && (
                    <ul
                      style={{
                        margin: "10px 0 0",
                        paddingLeft: 0,
                        listStyle: "none",
                        display: "flex",
                        flexDirection: "column",
                        gap: 6,
                      }}
                    >
                      {sec.keyPoints.map((kp, ki) => (
                        <li
                          key={ki}
                          style={{
                            display: "flex",
                            gap: 8,
                            fontSize: 13,
                            lineHeight: 1.5,
                            color: "var(--ink)",
                          }}
                        >
                          <span aria-hidden style={{ color: "var(--green-deep)", flexShrink: 0, marginTop: 1 }}>
                            <CheckIcon />
                          </span>
                          <span>{kp}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      <button
        type="button"
        onClick={() => void loadLesson()}
        style={{
          marginTop: 28,
          minHeight: 40,
          padding: "8px 18px",
          borderRadius: "var(--r-md)",
          background: "transparent",
          color: "var(--ink-mute)",
          fontFamily: "var(--sans)",
          fontSize: 13,
          fontWeight: 600,
          borderWidth: 1,
          borderStyle: "solid",
          borderColor: "var(--rule)",
          cursor: "pointer",
        }}
      >
        Regenerate lesson
      </button>
    </div>
  );
}

function RawDescription({
  description,
  onRetry,
  error,
}: {
  description: string;
  onRetry: () => void;
  error: string;
}) {
  const paragraphs = description
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <div style={{ padding: "4px 0 0" }}>
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
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
