"use client";

import { useEffect, useRef, useState, useCallback, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { useTr } from "@/lib/client/language";

// Urgent tasks dropdown — a sibling of NotificationBell that surfaces every
// *open* task whose priority is "urgent" (done cards are excluded). Reuses
// the existing tasks list endpoint, which already scopes visibility
// server-side (global admins see all urgent tasks; everyone else sees only
// their own assigned tasks — see the GET gate in
// src/app/api/omnipulse/tasks/route.ts), so there is no new backend.

// One 401 means the session expired — stop polling, further requests are moot.
const MAX_AUTH_FAILURES = 1;
// Cap the panel list; the badge still shows the true total from the API.
const PAGE_SIZE = 50;

interface UrgentTask {
  id: string;
  title: string;
  priority: string;
  due_date: string | null;
  board_id: string | null;
  board_name?: string | null;
  project_name?: string | null;
  workspace_name?: string | null;
  list_name?: string | null;
  assigned_to_name?: string | null;
  status_label?: string | null;
  status?: string | null;
}

// Deep-link into the board with the task modal pre-opened — the same shape
// mention/assignment notifications use (see notifications service).
function taskLink(t: UrgentTask): string | null {
  if (!t.board_id) return null;
  return `/omnipulse/boards/${t.board_id}?task=${t.id}`;
}

// Due-date pill text: overdue / today / a short date. Mirrors the terse,
// mono metadata idiom used in the notification rows.
function dueLabel(iso: string | null): { text: string; overdue: boolean } | null {
  if (!iso) return null;
  try {
    const due = new Date(iso);
    if (Number.isNaN(due.getTime())) return null;
    const today = new Date();
    const startOfDue = new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime();
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    const days = Math.round((startOfDue - startOfToday) / 86_400_000);
    if (days < 0) return { text: "Overdue", overdue: true };
    if (days === 0) return { text: "Due today", overdue: true };
    if (days === 1) return { text: "Due tomorrow", overdue: false };
    return { text: `Due ${due.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`, overdue: false };
  } catch {
    return null;
  }
}

export function UrgentBell() {
  const tr = useTr();
  const [items, setItems] = useState<UrgentTask[]>([]);
  const [total, setTotal] = useState(0);
  const [open, setOpen] = useState(false);
  const [isMobilePanel, setIsMobilePanel] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const authFailures = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    // Don't poll a backgrounded tab; visibility change restarts it.
    if (typeof document !== "undefined" && document.hidden) return;
    try {
      // exclude_status=done: priority stays "urgent" after completion, so
      // without this filter finished cards with past due dates still appeared
      // as Overdue in the bell (and inflated the badge count).
      const res = await fetch(
        `/api/omnipulse/tasks?priority=urgent&exclude_status=done&per_page=${PAGE_SIZE}`,
        { cache: "no-store" },
      );
      if (res.status === 401) {
        authFailures.current += 1;
        if (authFailures.current >= MAX_AUTH_FAILURES && intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        return;
      }
      if (res.ok) {
        authFailures.current = 0;
        const d = await res.json();
        // Defense in depth: drop done rows if an older API ignores exclude_status.
        const rawItems: UrgentTask[] = Array.isArray(d.items) ? d.items : [];
        const openItems = rawItems.filter((t) => (t.status || "").toLowerCase() !== "done");
        setItems(openItems);
        const apiTotal = typeof d.total === "number" ? d.total : rawItems.length;
        // If the server already excluded done, apiTotal is correct; if not,
        // shrink by the client-filtered delta so the badge stays honest.
        const dropped = rawItems.length - openItems.length;
        setTotal(Math.max(0, apiTotal - dropped));
      }
    } catch {
      /* network error — keep stale data, interval continues */
    }
  }, []);

  useEffect(() => {
    load();
    intervalRef.current = setInterval(load, 60_000); // poll every 60s

    function onVisibilityChange() {
      if (!document.hidden && authFailures.current < MAX_AUTH_FAILURES) {
        load();
        if (!intervalRef.current) intervalRef.current = setInterval(load, 60_000);
      }
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [load]);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobilePanel(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  function openItem(t: UrgentTask) {
    const link = taskLink(t);
    setOpen(false);
    if (link) router.push(link);
  }

  const hasUrgent = total > 0;

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-flex" }}>
      <button
        type="button"
        onClick={() => { setOpen((o) => !o); if (!open) load(); }}
        aria-label={tr("Urgent tasks")}
        title={tr("Urgent tasks")}
        style={{ ...urgentBtnStyle, color: hasUrgent ? "var(--crit)" : "var(--ink-soft)" }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
        {hasUrgent && (
          <span style={badgeStyle}>{total > 9 ? "9+" : total}</span>
        )}
      </button>

      {open && (
        <div style={isMobilePanel ? mobilePanelStyle : panelStyle}>
          <div style={panelHeaderStyle}>
            <span style={{ fontFamily: "var(--mono)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--ink-mute)" }}>
              {tr("Urgent tasks")}
            </span>
            {hasUrgent && (
              <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--crit)", fontWeight: 700 }}>
                {total}
              </span>
            )}
          </div>
          <div style={{ maxHeight: 380, overflowY: "auto", overscrollBehavior: "contain" }} className="themed-scroll-y">
            {items.length === 0 && (
              <div style={{ padding: "20px 14px", fontSize: 13, color: "var(--ink-mute)", textAlign: "center" }}>
                {tr("No urgent tasks right now.")}
              </div>
            )}
            {items.map((t) => {
              // Team gets its own T: pill (matching the notification panel);
              // the project pill no longer falls back to the team name so the
              // two never collapse into one.
              const teamTag = t.workspace_name || null;
              const projectTag = t.project_name || t.board_name || t.list_name || null;
              const due = dueLabel(t.due_date);
              const clickable = !!taskLink(t);
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => openItem(t)}
                  disabled={!clickable}
                  style={{ ...rowStyle, cursor: clickable ? "pointer" : "default" }}
                >
                  <span style={urgentDotStyle} />
                  <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 6 }}>
                    <span
                      title={t.title}
                      style={{
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                        fontSize: 13,
                        color: "var(--ink)",
                        fontWeight: 600,
                        lineHeight: 1.35,
                      }}
                    >
                      {t.title}
                    </span>
                    <span style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "space-between" }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, flexWrap: "wrap" }}>
                        {t.assigned_to_name && (
                          <span style={pillStyle} title={t.assigned_to_name}>{`@ ${t.assigned_to_name}`}</span>
                        )}
                        {projectTag && (
                          <span style={pillStyle} title={projectTag}>{`P: ${projectTag}`}</span>
                        )}
                        {teamTag && (
                          <span style={pillStyle} title={teamTag}>{`T: ${teamTag}`}</span>
                        )}
                      </span>
                      {due && (
                        <span style={{ ...dueStyle, color: due.overdue ? "var(--crit)" : "var(--ink-faint)" }}>
                          {due.text}
                        </span>
                      )}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

const urgentBtnStyle: CSSProperties = {
  position: "relative", display: "inline-flex", alignItems: "center", justifyContent: "center",
  width: 34, height: 34, borderRadius: "var(--r-sm)",
  background: "transparent", border: "none", cursor: "pointer", color: "var(--ink-soft)",
};

const badgeStyle: CSSProperties = {
  position: "absolute", top: 2, right: 2, minWidth: 16, height: 16, padding: "0 4px",
  borderRadius: 999, background: "var(--crit)", color: "var(--avatar-fg)",
  fontSize: 10, fontWeight: 700, fontFamily: "var(--mono)",
  display: "inline-flex", alignItems: "center", justifyContent: "center", lineHeight: 1,
};

const panelStyle: CSSProperties = {
  position: "absolute", top: "calc(100% + 8px)", right: 0, width: 340, zIndex: "var(--z-notification)",
  background: "var(--surface)", borderWidth: 1, borderStyle: "solid", borderColor: "var(--rule)",
  borderRadius: "var(--r-md)", boxShadow: "var(--shadow-md)", overflow: "hidden",
};

const mobilePanelStyle: CSSProperties = {
  position: "fixed",
  top: 64,
  left: "50%",
  transform: "translateX(-50%)",
  width: "calc(100vw - 24px)",
  maxWidth: 340,
  zIndex: "var(--z-notification)",
  background: "var(--surface)",
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "var(--rule)",
  borderRadius: "var(--r-md)",
  boxShadow: "var(--shadow-md)",
  overflow: "hidden",
};

const panelHeaderStyle: CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "space-between",
  padding: "10px 14px", borderBottom: "1px solid var(--rule)",
};

const rowStyle: CSSProperties = {
  display: "flex", alignItems: "flex-start", gap: 8, width: "100%", textAlign: "left",
  padding: "14px 14px", border: "none", borderBottom: "1px solid var(--rule)",
  background: "transparent", fontFamily: "var(--sans)",
};

const urgentDotStyle: CSSProperties = {
  width: 7, height: 7, borderRadius: "50%", background: "var(--crit)", flexShrink: 0, marginTop: 5,
};

const pillStyle: CSSProperties = {
  display: "inline-block", maxWidth: 120,
  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
  fontFamily: "var(--mono)", fontSize: 11, lineHeight: 1.4,
  color: "var(--ink-mute)", background: "var(--surface-sunk)",
  borderWidth: 1, borderStyle: "solid", borderColor: "var(--rule)",
  borderRadius: "var(--r-sm)", padding: "1px 6px",
};

const dueStyle: CSSProperties = {
  flexShrink: 0,
  fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-faint)",
};
