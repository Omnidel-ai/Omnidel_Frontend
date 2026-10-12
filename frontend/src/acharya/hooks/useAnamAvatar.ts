"use client";

import type { Lang } from "@/acharya/lib/i18n/registry";
import { useCallback, useEffect, useRef, useState } from "react";
import { createClient, AnamEvent, ClientError, type AnamClient } from "@anam-ai/js-sdk";
import {
  isAnamConcurrencyError,
  prepareAnamConnect,
  releaseGlobalAnamClient,
  releaseInsideLock,
  runExclusiveAnam,
  setGlobalAnamClient,
  waitForAnamSlot,
} from "@/acharya/lib/anam-global-client";

export type AnamAvatarState = "idle" | "connecting" | "ready" | "speaking" | "error" | "stopped";

function waitForVideoElement(elementId: string, timeoutMs = 8000): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const tick = () => {
      const el = document.getElementById(elementId);
      if (el instanceof HTMLVideoElement) return resolve(el);
      if (Date.now() - start > timeoutMs) return reject(new Error(`Video element #${elementId} not found`));
      requestAnimationFrame(tick);
    };
    tick();
  });
}

function formatAnamError(err: unknown): string {
  if (err instanceof ClientError) {
    const msg = err.message;
    if (/concurrency limit/i.test(msg)) {
      return "Anam session limit reached. Close other browser tabs, tap Stop, wait 2 minutes, then tap Start.";
    }
    return msg;
  }
  if (err && typeof err === "object" && "status" in err) {
    const e = err as { status: number; message?: string };
    if (e.status === 503) return "Live avatar is not enabled for this Acharya.";
    if (e.status === 429) return "Too many session attempts. Wait a minute, then try again.";
    return e.message || `HTTP ${e.status}`;
  }
  if (err instanceof Error) return err.message;
  return "Failed to connect to live avatar.";
}

export function useAnamAvatar(opts: {
  videoElementId: string;
  workspaceSlug: string;
  taskId: string;
  /** Board/task Acharya slug — Vivek-only allowlist is enforced server-side. */
  acharyaSlug?: string;
  lang: Lang;
  /** When false, no session is created (user must tap Start). */
  active: boolean;
  /** Called when a speaking turn ends — caller persists user/assistant lines into the chat thread. */
  onTurnEnd?: (turn: { userText: string; modelText: string }) => void;
}) {
  const { videoElementId, workspaceSlug, taskId, acharyaSlug, lang, active, onTurnEnd } = opts;
  const [state, setState] = useState<AnamAvatarState>("stopped");
  const [error, setError] = useState("");
  const [userLine, setUserLine] = useState("");
  const [assistantLine, setAssistantLine] = useState("");
  const clientRef = useRef<AnamClient | null>(null);
  const userBufRef = useRef("");
  const assistantBufRef = useRef("");
  // Tracks the role of the most recent transcript chunk so we can detect
  // role flips (user→assistant marks a new turn beginning; assistant→user
  // marks the previous turn ending).
  const lastRoleRef = useRef<"user" | "assistant" | null>(null);
  // Wall-clock of the last chunk seen for the role currently being recorded.
  // The heartbeat uses this to detect "speaker went quiet" → flush turn.
  const lastChunkAtRef = useRef<number>(0);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const connectGenRef = useRef(0);
  const ctxKeyRef = useRef(`${lang}:${taskId}`);
  const activeRef = useRef(active);
  const onTurnEndRef = useRef(onTurnEnd);
  useEffect(() => { activeRef.current = active; }, [active]);
  useEffect(() => { onTurnEndRef.current = onTurnEnd; }, [onTurnEnd]);

  // Flush the current turn's accumulated transcripts to the caller, then
  // reset the per-turn buffers so the next user utterance starts fresh.
  function consumeTurn() {
    const userText = userBufRef.current.trim();
    const modelText = assistantBufRef.current.trim();
    if (!userText && !modelText) return;
    userBufRef.current = "";
    assistantBufRef.current = "";
    setUserLine("");
    setAssistantLine("");
    lastRoleRef.current = null;
    onTurnEndRef.current?.({ userText, modelText });
  }

  const disconnect = useCallback(async () => {
    connectGenRef.current += 1;
    if (heartbeatRef.current) { clearInterval(heartbeatRef.current); heartbeatRef.current = null; }
    consumeTurn();
    await runExclusiveAnam(async () => {
      const client = clientRef.current;
      clientRef.current = null;
      if (client) {
        try { await client.stopStreaming(); } catch { /* ignore */ }
      }
      setGlobalAnamClient(null);
      await releaseInsideLock();
      setState("stopped");
    });
  }, []);

  const connectOnce = useCallback(async (gen: number) => {
    await runExclusiveAnam(async () => {
      await releaseInsideLock();
      if (gen !== connectGenRef.current || !activeRef.current) return;
      await waitForAnamSlot();
      if (gen !== connectGenRef.current || !activeRef.current) return;
      await waitForVideoElement(videoElementId);
      if (gen !== connectGenRef.current || !activeRef.current) return;

      const r = await fetch("/api/work/anam/session-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspace: workspaceSlug, taskId, acharyaSlug, lang }),
      });
      if (!r.ok) {
        const body = await r.json().catch(() => null);
        throw { status: r.status, message: body?.error || `Token mint ${r.status}` };
      }
      const { sessionToken } = await r.json();
      if (gen !== connectGenRef.current || !activeRef.current) return;

      const client = createClient(sessionToken);
      clientRef.current = client;
      setGlobalAnamClient(client);

      client.addListener(AnamEvent.SESSION_READY, () => {
        if (gen === connectGenRef.current) setState("ready");
      });
      client.addListener(AnamEvent.MESSAGE_STREAM_EVENT_RECEIVED, (event) => {
        const rawRole = event?.role;
        const content = typeof event?.content === "string" ? event.content : "";
        if (!content || gen !== connectGenRef.current) return;
        const role: "user" | "assistant" =
          String(rawRole) === "user" || String(rawRole) === "human" ? "user" : "assistant";

        if (role === "user" && lastRoleRef.current === "assistant") {
          consumeTurn();
        }
        lastRoleRef.current = role;
        lastChunkAtRef.current = Date.now();

        if (role === "user") {
          userBufRef.current = content;
          setUserLine(content);
        } else {
          assistantBufRef.current = content;
          setAssistantLine(content);
          setState("speaking");
        }
      });

      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      heartbeatRef.current = setInterval(() => {
        if (gen !== connectGenRef.current) return;
        const hasBuffered = userBufRef.current.trim() || assistantBufRef.current.trim();
        if (!hasBuffered) return;
        if (Date.now() - lastChunkAtRef.current > 1600) {
          consumeTurn();
          setState((s) => (s === "speaking" ? "ready" : s));
        }
      }, 800);
      client.addListener(AnamEvent.CONNECTION_CLOSED, () => {
        if (gen !== connectGenRef.current) return;
        setState((s) => {
          if (s === "speaking") consumeTurn();
          return s === "speaking" ? "ready" : s;
        });
      });
      client.addListener(AnamEvent.VIDEO_PLAY_STARTED, () => {
        if (gen === connectGenRef.current) setState("ready");
      });

      await client.streamToVideoElement(videoElementId);
      if (gen === connectGenRef.current) setState("ready");
    });
  }, [workspaceSlug, taskId, acharyaSlug, lang, videoElementId]);

  const connect = useCallback(async () => {
    const gen = ++connectGenRef.current;
    setState("connecting");
    setError("");
    setUserLine("");
    setAssistantLine("");
    userBufRef.current = "";
    assistantBufRef.current = "";
    lastRoleRef.current = null;
    ctxKeyRef.current = `${lang}:${taskId}`;

    try {
      await connectOnce(gen);
    } catch (err) {
      if (gen !== connectGenRef.current) return;
      if (isAnamConcurrencyError(err)) {
        try {
          await prepareAnamConnect();
          await new Promise((resolve) => setTimeout(resolve, 2000));
          if (gen !== connectGenRef.current || !activeRef.current) return;
          await connectOnce(gen);
          return;
        } catch (retryErr) {
          if (gen !== connectGenRef.current) return;
          err = retryErr;
        }
      }
      const client = clientRef.current;
      clientRef.current = null;
      setGlobalAnamClient(null);
      if (client) { try { await client.stopStreaming(); } catch { /* ignore */ } }
      await releaseGlobalAnamClient();
      setError(formatAnamError(err));
      setState("error");
      console.error("[Anam]", err);
    }
  }, [connectOnce, lang, taskId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (cancelled) return;
      if (!active) {
        await disconnect();
        return;
      }
      await connect();
    })();
    return () => {
      cancelled = true;
      void disconnect();
    };
  }, [active, connect, disconnect]);

  useEffect(() => {
    if (!active) return;
    const key = `${lang}:${taskId}`;
    if (key !== ctxKeyRef.current && state !== "stopped" && state !== "connecting") {
      void disconnect();
    }
  }, [lang, taskId, active, state, disconnect]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "hidden" && activeRef.current) void disconnect();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [disconnect]);

  return {
    state, error, userLine, assistantLine, connect, disconnect,
    isLive: active && (state === "ready" || state === "speaking"),
  };
}

export type AnamAvatarSession = ReturnType<typeof useAnamAvatar>;
