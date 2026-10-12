"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * useInactivityTimeout
 *
 * Keeps an active session alive while the karigar is working, and closes it
 * once they have been gone for the grace window (30 min past the session
 * deadline). Two jobs, both deliberately thin:
 *
 *   1. HEARTBEAT — stamp last_activity_at on real interaction.
 *   2. POLL — ask the server whether the close is due, and if it says yes, ask
 *      it to close.
 *
 * THE CLIENT NEVER DECIDES. It reports interaction and relays a verdict; the
 * route re-derives whether the window has actually run out. A handset clock is
 * not trustworthy enough to destroy a work session on — field phones drift,
 * and a background tab's timers are throttled hard — so the same mistake that
 * would end a session early here is caught server-side and answered with a 409.
 *
 * The polling cadence is coarse on purpose. The grace is THIRTY MINUTES, so
 * minute-resolution is plenty, and this app has to stay cheap on a low-end
 * Android with a bad connection.
 */

/** At most one heartbeat per this interval, however much the karigar taps. */
const HEARTBEAT_MIN_GAP_MS = 30_000;
/** Status poll cadence once the session deadline has passed. */
const POLL_MS = 60_000;
/** Slower poll while the session clock is still running. */
const POLL_IDLE_MS = 5 * 60_000;

export interface InactivityStatus {
  attemptNumber: number;
  status: string;
  open: boolean;
  wasAutoClosed: boolean;
  deadlineAt: string;
  deadlinePassed: boolean;
  closeDueAt: string;
  msUntilAutoClose: number;
  autoCloseDue: boolean;
  extensionUsedMinutes: number;
  extensionRemainingMinutes: number;
}

export function useInactivityTimeout({
  taskId,
  attemptId,
  enabled = true,
  onAutoClosed,
}: {
  taskId: string;
  attemptId: string;
  /** Pass false to stand down — e.g. while a completion sheet is open. */
  enabled?: boolean;
  /** Fired once, after the server confirms the close. */
  onAutoClosed?: (info: { attemptNumber: number; retriesLeft: number; canRetry: boolean }) => void;
}) {
  const [status, setStatus] = useState<InactivityStatus | null>(null);
  const [autoClosed, setAutoClosed] = useState(false);

  const lastBeatRef = useRef(0);
  const closingRef = useRef(false);
  const closedRef = useRef(false);
  // Held in a ref so the poll effect does not re-subscribe on every render just
  // because the caller passed a fresh closure. Written in an effect, not during
  // render — a ref assignment in the render body is not safe under StrictMode's
  // double-invoke or a discarded concurrent render.
  const onAutoClosedRef = useRef(onAutoClosed);
  useEffect(() => {
    onAutoClosedRef.current = onAutoClosed;
  }, [onAutoClosed]);

  const base = `/api/work/tasks/${taskId}/attempts/${attemptId}`;

  const heartbeat = useCallback(async () => {
    if (!enabled || closedRef.current) return;
    const now = Date.now();
    if (now - lastBeatRef.current < HEARTBEAT_MIN_GAP_MS) return;
    lastBeatRef.current = now;
    try {
      const res = await fetch(`${base}/activity`, { method: "POST" });
      // 409 means the attempt is no longer open; stop beating at a dead session.
      if (res.status === 409) closedRef.current = true;
    } catch {
      // Offline is normal in a Vatika. The next beat retries; meanwhile the
      // server simply sees no activity, which is the honest state.
      lastBeatRef.current = 0;
    }
  }, [base, enabled]);

  const closeNow = useCallback(async () => {
    if (closingRef.current || closedRef.current) return;
    closingRef.current = true;
    try {
      const res = await fetch(`${base}/auto-close`, { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        attemptNumber?: number;
        retriesLeft?: number;
        canRetry?: boolean;
        msUntilAutoClose?: number;
      };
      if (res.ok && data.ok) {
        closedRef.current = true;
        setAutoClosed(true);
        onAutoClosedRef.current?.({
          attemptNumber: data.attemptNumber ?? 1,
          retriesLeft: data.retriesLeft ?? 0,
          canRetry: data.canRetry ?? false,
        });
      }
      // A 409 means the server disagrees that the window has run out — its
      // clock wins, and the next poll will pick up the corrected timing.
    } catch {
      // Retry on the next poll.
    } finally {
      closingRef.current = false;
    }
  }, [base]);

  const refresh = useCallback(async () => {
    if (!enabled || closedRef.current) return;
    try {
      const res = await fetch(`${base}/activity`, { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as InactivityStatus;
      setStatus(data);

      if (data.wasAutoClosed && !closedRef.current) {
        // Closed by something else — another tab, or a server-side sweep.
        closedRef.current = true;
        setAutoClosed(true);
        onAutoClosedRef.current?.({
          attemptNumber: data.attemptNumber ?? 1,
          retriesLeft: 0,
          canRetry: false,
        });
        return;
      }
      if (data.autoCloseDue) void closeNow();
    } catch {
      // Keep the last known status rather than blanking the UI on one failure.
    }
  }, [base, enabled, closeNow]);

  // Interaction listeners → heartbeat.
  useEffect(() => {
    if (!enabled) return;
    const beat = () => void heartbeat();
    // Passive: these must never delay a scroll on a low-end handset.
    const opts: AddEventListenerOptions = { passive: true };
    window.addEventListener("pointerdown", beat, opts);
    window.addEventListener("keydown", beat, opts);
    window.addEventListener("scroll", beat, opts);
    return () => {
      window.removeEventListener("pointerdown", beat, opts);
      window.removeEventListener("keydown", beat, opts);
      window.removeEventListener("scroll", beat, opts);
    };
  }, [enabled, heartbeat]);

  // Poll, and re-check on wake. A phone that has been locked comes back with
  // its interval long since throttled, so visibilitychange/pageshow are what
  // actually keep this honest — the same reason the timer re-anchors there.
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const tick = async () => {
      if (cancelled || closedRef.current) return;
      await refresh();
      if (cancelled || closedRef.current) return;
      const gap = status?.deadlinePassed ? POLL_MS : POLL_IDLE_MS;
      timer = setTimeout(tick, gap);
    };

    void tick();

    const onWake = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onWake);
    window.addEventListener("pageshow", onWake);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onWake);
      window.removeEventListener("pageshow", onWake);
    };
    // status?.deadlinePassed only switches the cadence once, at the deadline.
  }, [enabled, refresh, status?.deadlinePassed]);

  /** Call after an extension so the countdown re-anchors immediately. */
  const noteExtended = useCallback(() => {
    lastBeatRef.current = 0;
    void refresh();
  }, [refresh]);

  return { status, autoClosed, refresh, heartbeat, noteExtended };
}
