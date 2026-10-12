"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ACTIVE_ATTEMPT_CHANGED_EVENT,
  notifyActiveAttemptChanged,
} from "@/acharya/lib/active-attempt-events";
import { useInstantNav } from "@/components/acharya/shell/instant-nav";
import { SESSION_DURATION_SECONDS } from "@/acharya/lib/planned-time";
import { nextTaskSegmentIndex, type AttemptSegmentRow } from "@/acharya/lib/karigar-timing-types";

export interface StartTaskOptions {
  segmentIndex?: number;
  checklistItemId?: string | null;
  /** Session slot for shared-timer carry (sessionStorage lookup). */
  sessionSlot?: number | null;
  /**
   * Leftover seconds for a shared session_slot (45:00 − work already done).
   * Prefer this when the OmniDel API still ignores shared-slot carry.
   */
  remainingSeconds?: number | null;
}

// ── One RUNNING timer at a time ──────────────────────────────────────────────
// A karigar may have exactly one attempt counting down across ALL their tasks.
// The server enforces it (409 + code ANOTHER_TASK_ACTIVE from
// /api/work/tasks/[id]/attempts/start); this hook mirrors the state so the UI
// can block the Start CTA up front and point at the session already open.
//
// A PAUSED attempt on another task is not a block. It used to be, and that made
// a break a trap: pause task A, open task B, and B offered no way to start —
// only an "Open timer" button back to A, on A's acharya. Parked tasks stay
// parked; `otherActiveTask` is therefore only ever a task whose timer is live.

export interface OtherActiveTask {
  attemptId: string;
  taskId: string;
  taskTitle: string;
  status: "running" | "paused";
}

export type StartTaskResult =
  | { ok: true; attemptId: string | null; allComplete?: false }
  | { ok: true; attemptId: null; allComplete: true }
  | { ok: false; reason: "blocked"; active: OtherActiveTask; message: string }
  | { ok: false; reason: "error"; message: string };

export function activeTaskUrl(active: OtherActiveTask): string {
  return buildActiveUrl(active.taskId, active.attemptId);
}

// Fallback copy only. The hook has no `lang`; surfaces that render this render
// their own localised string off `otherActiveTask` instead.
function blockedMessage(title: string): string {
  return title
    ? `“${title}” is running. Pause or finish it first — a paused task does not block you.`
    : "Another task is running. Pause or finish it first — a paused task does not block you.";
}

// ── useStartTask ──────────────────────────────────────────────────────────────
// Shared start-session flow used by the task detail page and Learn surface.
// POSTs to /api/work/tasks/[id]/attempts/start (proxy → OmniDel), then navigates
// to the nested /active URL when an Acharya slug is known.

export interface UseStartTaskResult {
  startTask: (opts?: StartTaskOptions | number) => Promise<StartTaskResult>;
  startingTask: boolean;
  startError: string | null;
  clearStartError: () => void;
  hasActiveAttempt: boolean;
  activeAttemptStatus: "running" | "paused" | null;
  activeBreaksRemaining: number | null;
  /**
   * Another task of this karigar has a LIVE timer — starting here is blocked
   * until they pause or finish it. Null when the other task is merely parked.
   */
  otherActiveTask: OtherActiveTask | null;
}

export interface ActiveAttemptMeta {
  id: string;
  status: "running" | "paused";
  breaksRemaining: number | null;
}

const activeAttemptRequests = new Map<string, Promise<ActiveAttemptMeta | null>>();

async function fetchActiveAttemptMeta(taskId: string): Promise<ActiveAttemptMeta | null> {
  try {
    const r = await fetch(`/api/work/tasks/${taskId}/attempts`, { cache: "no-store" });
    if (!r.ok) return null;
    const d = (await r.json()) as {
      items?: Array<{
        id: string;
        status: string;
        breaks_remaining_current_segment?: number | null;
      }>;
    };
    const active = (d.items || []).find((a) => a.status === "running" || a.status === "paused");
    if (!active) return null;
    return {
      id: active.id,
      status: active.status as "running" | "paused",
      breaksRemaining:
        typeof active.breaks_remaining_current_segment === "number"
          ? active.breaks_remaining_current_segment
          : null,
    };
  } catch {
    return null;
  }
}

export async function resolveActiveAttemptMeta(taskId: string): Promise<ActiveAttemptMeta | null> {
  const existing = activeAttemptRequests.get(taskId);
  if (existing) return existing;
  const request = fetchActiveAttemptMeta(taskId).finally(() => {
    if (activeAttemptRequests.get(taskId) === request) {
      activeAttemptRequests.delete(taskId);
    }
  });
  activeAttemptRequests.set(taskId, request);
  return request;
}

export async function resolveRunningAttemptId(taskId: string): Promise<string | null> {
  const active = await resolveActiveAttemptMeta(taskId);
  return active?.id || null;
}

/**
 * The karigar's newest OPEN attempt across every task (running or parked), or
 * null. Callers decide what that means: only a `running` one conflicts with
 * starting other work.
 */
export async function fetchKarigarActiveTask(): Promise<OtherActiveTask | null> {
  try {
    const r = await fetch("/api/work/active-attempt", { cache: "no-store" });
    if (!r.ok) return null;
    const d = (await r.json()) as {
      item?: {
        attemptId?: string;
        taskId?: string;
        taskTitle?: string;
        status?: string;
      } | null;
    };
    const item = d.item;
    if (!item?.attemptId || !item?.taskId) return null;
    return {
      attemptId: item.attemptId,
      taskId: item.taskId,
      taskTitle: item.taskTitle || "",
      status: item.status === "paused" ? "paused" : "running",
    };
  } catch {
    return null;
  }
}

function buildActiveUrl(
  taskId: string,
  attemptId?: string | null,
  returnTo?: string,
  doneReturnTo?: string,
  acharya?: { name?: string | null; slug?: string | null },
) {
  const params = new URLSearchParams();
  if (attemptId) params.set("attemptId", attemptId);
  if (returnTo) params.set("returnTo", returnTo);
  if (doneReturnTo) params.set("doneReturnTo", doneReturnTo);
  if (acharya?.name) params.set("acharyaName", acharya.name);
  if (acharya?.slug) params.set("acharyaSlug", acharya.slug);
  const qs = params.toString();
  if (acharya?.slug) {
    return `/acharyas/${acharya.slug}/tasks/${taskId}/active${qs ? `?${qs}` : ""}`;
  }
  return `/tasks/${taskId}/active${qs ? `?${qs}` : ""}`;
}

/**
 * Next segment to request for a task-level multi-session task, read from the
 * attempt ledger (the only place that progress exists for those tasks).
 *
 * Best effort by contract: any failure falls back to 1, which is exactly what
 * the old unconditional default did — a start must never be blocked because the
 * ledger was briefly unreachable.
 */
async function resolveNextTaskSegment(taskId: string): Promise<number> {
  try {
    const r = await fetch(`/api/work/tasks/${taskId}/attempts`, { cache: "no-store" });
    if (!r.ok) return 1;
    const d = (await r.json()) as { items?: AttemptSegmentRow[] };
    return nextTaskSegmentIndex(d.items);
  } catch {
    return 1;
  }
}

export function useStartTask(
  taskId: string,
  opts: {
    redirectIfActive?: boolean;
    returnTo?: string;
    doneReturnTo?: string;
    navigateOnStart?: boolean;
    acharyaName?: string | null;
    acharyaSlug?: string | null;
  } = {},
): UseStartTaskResult {
  const redirectIfActive = opts.redirectIfActive;
  const returnTo = opts.returnTo;
  const doneReturnTo = opts.doneReturnTo;
  const navigateOnStart = opts.navigateOnStart;
  const acharyaName = opts.acharyaName;
  const acharyaSlug = opts.acharyaSlug;
  const nav = useInstantNav();

  const [startingTask, setStartingTask] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [hasActiveAttempt, setHasActiveAttempt] = useState(false);
  const [activeAttemptStatus, setActiveAttemptStatus] = useState<"running" | "paused" | null>(null);
  const [activeBreaksRemaining, setActiveBreaksRemaining] = useState<number | null>(null);
  const [otherActiveTask, setOtherActiveTask] = useState<OtherActiveTask | null>(null);
  const otherActiveRef = useRef<OtherActiveTask | null>(null);

  const clearStartError = useCallback(() => setStartError(null), []);

  const applyOtherActive = useCallback((next: OtherActiveTask | null) => {
    otherActiveRef.current = next;
    setOtherActiveTask(next);
  }, []);

  // Mirror the karigar-wide active attempt so the Start CTA can be blocked
  // before the POST. Re-checked whenever any surface reports a change.
  //
  // `status === "running"` is the whole fix on the client side: the endpoint
  // reports the newest OPEN attempt, parked ones included, and treating those as
  // a conflict is what stopped a karigar from working on anything else.
  useEffect(() => {
    let cancelled = false;
    const sync = () => {
      void fetchKarigarActiveTask().then((active) => {
        if (cancelled) return;
        const blocking =
          active && active.taskId !== taskId && active.status === "running" ? active : null;
        applyOtherActive(blocking);
      });
    };
    sync();
    window.addEventListener(ACTIVE_ATTEMPT_CHANGED_EVENT, sync);
    return () => {
      cancelled = true;
      window.removeEventListener(ACTIVE_ATTEMPT_CHANGED_EVENT, sync);
    };
  }, [taskId, applyOtherActive]);

  useEffect(() => {
    let cancelled = false;
    void resolveActiveAttemptMeta(taskId).then((attempt) => {
      if (cancelled || !attempt) return;
      setHasActiveAttempt(true);
      setActiveAttemptStatus(attempt.status);
      setActiveBreaksRemaining(attempt.breaksRemaining);
      if (redirectIfActive) {
        nav.push(
          buildActiveUrl(taskId, attempt.id, returnTo, doneReturnTo, {
            name: acharyaName,
            slug: acharyaSlug,
          }),
        );
      }
    });
    return () => {
      cancelled = true;
    };
  }, [taskId, redirectIfActive, returnTo, doneReturnTo, acharyaName, acharyaSlug, nav]);

  const startTask = useCallback(
    async (startOpts?: StartTaskOptions | number): Promise<StartTaskResult> => {
      if (startingTask) return { ok: false, reason: "error", message: "Already starting" };

      // Fast local guard — the server 409 below is the authority, this just
      // avoids a round-trip when we already know another task is live.
      // `startError` is deliberately not set for blocks — surfaces render their
      // own localised "another task is running" banner off `otherActiveTask`.
      const knownOther = otherActiveRef.current;
      if (knownOther) {
        return {
          ok: false,
          reason: "blocked",
          active: knownOther,
          message: blockedMessage(knownOther.taskTitle),
        };
      }

      const requestedSegment =
        typeof startOpts === "number" ? startOpts : startOpts?.segmentIndex ?? null;
      const checklistItemId =
        typeof startOpts === "number" ? null : startOpts?.checklistItemId ?? null;
      const sessionSlot =
        typeof startOpts === "number" ? null : startOpts?.sessionSlot ?? null;
      const explicitRemaining =
        typeof startOpts === "number" ? null : startOpts?.remainingSeconds ?? null;

      setStartError(null);
      setStartingTask(true);

      try {
        // Task-level multi-session tasks (session_count > 1, no checklist) carry
        // NO progress in the task payload — buildTimingRollup is null for them —
        // so a caller that did not name a segment fell back to 1. That restarted
        // session 1 forever and stacked duplicate segment-1 attempt rows, which
        // then poisoned OmniDel's previous-segment lookup and left the task
        // permanently uncompletable. Resolving HERE rather than at each call
        // site means every door gets it: the task-detail tap, the learn
        // screen's voice `start_task` (which calls startTask() with no
        // arguments at all), and anything added later.
        let segmentIndex = requestedSegment;
        if (segmentIndex == null && !checklistItemId) {
          segmentIndex = await resolveNextTaskSegment(taskId);
        }
        const body: Record<string, unknown> = { segment_index: segmentIndex ?? 1 };
        if (checklistItemId) body.checklist_item_id = checklistItemId;
        let remainingToSend: number | null =
          typeof explicitRemaining === "number" && explicitRemaining > 0
            ? Math.min(SESSION_DURATION_SECONDS, Math.floor(explicitRemaining))
            : null;
        if (
          remainingToSend == null
          && typeof sessionSlot === "number"
          && sessionSlot >= 1
          && typeof window !== "undefined"
        ) {
          try {
            const key = `acharya:sharedSessionRemaining:${taskId}:${sessionSlot}`;
            const raw = sessionStorage.getItem(key);
            const n = raw ? Math.floor(Number(raw)) : 0;
            if (Number.isFinite(n) && n > 0) remainingToSend = n;
          } catch {
            /* ignore */
          }
        }
        if (remainingToSend != null && remainingToSend > 0) {
          body.remaining_seconds = remainingToSend;
        }

        const r = await fetch(`/api/work/tasks/${taskId}/attempts/start`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (!r.ok) {
          const data = (await r.json().catch(() => null)) as {
            error?: string;
            code?: string;
            active?: {
              attemptId?: string;
              taskId?: string;
              taskTitle?: string;
              status?: string;
            };
          } | null;

          // Another task of this karigar is live — never navigate into this
          // task's timer, send them back to the one already running.
          if (r.status === 409 && data?.code === "ANOTHER_TASK_ACTIVE" && data?.active?.taskId) {
            const active: OtherActiveTask = {
              attemptId: String(data.active.attemptId || ""),
              taskId: String(data.active.taskId),
              taskTitle: String(data.active.taskTitle || ""),
              status: data.active.status === "paused" ? "paused" : "running",
            };
            applyOtherActive(active);
            return {
              ok: false,
              reason: "blocked",
              active,
              message: data?.error || blockedMessage(active.taskTitle),
            };
          }

          if (r.status === 409) {
            const message = data?.error || `Error ${r.status}`;
            // Wrong subtask / not current — do NOT open a stale Active Session
            // (often 00:00 + Mark Done from an older expired attempt).
            if (/not the current active subtask/i.test(message)) {
              setStartError(
                "Finish the current subtask first — this one is not next in the session order.",
              );
              return { ok: false, reason: "error", message };
            }

            setHasActiveAttempt(true);
            setActiveAttemptStatus("running");
            notifyActiveAttemptChanged();
            const active = await resolveActiveAttemptMeta(taskId);
            if (navigateOnStart !== false) {
              nav.push(
                buildActiveUrl(taskId, active?.id, returnTo, doneReturnTo, {
                  name: acharyaName,
                  slug: acharyaSlug,
                }),
              );
            }
            return { ok: true, attemptId: active?.id ?? null };
          }

          const message = data?.error || `Error ${r.status}`;
          // Stale UI after tab switch: server says nothing left to start.
          if (r.status === 400 && /all subtasks.*complete/i.test(message)) {
            setStartError(null);
            return { ok: true, attemptId: null, allComplete: true };
          }

          setStartError(message);
          return { ok: false, reason: "error", message };
        }

        setHasActiveAttempt(true);
        setActiveAttemptStatus("running");
        notifyActiveAttemptChanged();

        if (typeof sessionSlot === "number" && sessionSlot >= 1 && typeof window !== "undefined") {
          try {
            sessionStorage.removeItem(`acharya:sharedSessionRemaining:${taskId}:${sessionSlot}`);
          } catch {
            /* ignore */
          }
        }

        const data = (await r.json().catch(() => null)) as { item?: { id?: string } } | null;
        const attemptId = data?.item?.id ?? null;
        if (navigateOnStart !== false) {
          nav.push(
            buildActiveUrl(taskId, attemptId, returnTo, doneReturnTo, {
              name: acharyaName,
              slug: acharyaSlug,
            }),
          );
        }
        return { ok: true, attemptId };
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        setStartError(message);
        return { ok: false, reason: "error", message };
      } finally {
        setStartingTask(false);
      }
    },
    [
      taskId,
      startingTask,
      returnTo,
      doneReturnTo,
      navigateOnStart,
      acharyaName,
      acharyaSlug,
      applyOtherActive,
      nav,
    ],
  );

  return {
    startTask,
    startingTask,
    startError,
    clearStartError,
    hasActiveAttempt,
    activeAttemptStatus,
    activeBreaksRemaining,
    otherActiveTask,
  };
}
