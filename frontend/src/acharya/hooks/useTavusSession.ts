"use client";

/**
 * Tavus CVI session over Daily — the video counterpart to `useGeminiLiveSession`.
 *
 * WHY DAILY AND NOT AN IFRAME. The first cut embedded `conversation_url` in an
 * iframe. That is a black box: no participant events, no join errors (our first
 * real call failed inside it and the reason was unreadable cross-origin), no
 * video track to place in our own layout, and — the one that decides it — no way
 * to receive tool calls. `conversation_url` is a Daily room, so we join it
 * ourselves and get all four.
 *
 * THE TOOL LOOP is deliberately the same shape as the Gemini hook's, because it
 * feeds the SAME handler map:
 *
 *   Gemini  ws `toolCall`            -> handlers[name](args) -> toolResponse
 *   Tavus   app-message `tool_call`  -> handlers[name](args) -> `tool_result`
 *
 * The caller passes `AcharyaShell`'s `mergedHandlers` untouched, so every tool
 * the mic can drive the video drives too, through one implementation — including
 * the base/screen/overlay precedence the shell already resolves.
 *
 * Handlers live in a REF, not in state or a dep array: the shell rebuilds that
 * object on every render, and re-binding a live call each time would be pointless
 * churn. Same reason the Gemini hook keeps `handlersRef`.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { DailyCall, DailyEventObjectAppMessage, DailyParticipant } from "@daily-co/daily-js";
import type { ToolHandlers, ToolResult } from "@/acharya/hooks/useGeminiLiveSession";

export type TavusStatus = "idle" | "starting" | "connecting" | "live" | "error";

/**
 * Tavus caps an app message at 4 KB and, over that, the message can be dropped
 * IN TRANSIT WITH NO ERROR. A `search_memory` result is document text, so an
 * unbounded handler payload is a silent stall waiting to happen. Every result is
 * clamped before it is sent — tighter than the voice path's 700-char trim,
 * because this budget covers the whole envelope rather than one field.
 */
const MAX_TOOL_RESULT_CHARS = 2_400;

function clampToolResult(result: ToolResult): unknown {
  let json = JSON.stringify(result);
  if (json.length <= MAX_TOOL_RESULT_CHARS) return result;

  // Trim the biggest string fields first — that is where the document text is —
  // rather than dropping keys, which would remove the ok/error flags the model
  // reasons about.
  const copy: Record<string, unknown> = { ...result };
  const byLength = Object.entries(copy)
    .filter((e): e is [string, string] => typeof e[1] === "string")
    .sort((a, b) => b[1].length - a[1].length);
  for (const [key] of byLength) {
    const room = MAX_TOOL_RESULT_CHARS - (json.length - String(copy[key]).length);
    copy[key] = room > 40 ? `${String(copy[key]).slice(0, room - 20)}…` : "…";
    json = JSON.stringify(copy);
    if (json.length <= MAX_TOOL_RESULT_CHARS) break;
  }
  if (json.length > MAX_TOOL_RESULT_CHARS) {
    return { ok: (result as { ok?: boolean }).ok ?? true, note: "result_too_large" };
  }
  return copy;
}

interface TavusAppMessage {
  message_type?: string;
  event_type?: string;
  conversation_id?: string;
  properties?: { name?: string; arguments?: string; tool_call_id?: string };
}

export interface TavusSession {
  status: TavusStatus;
  error: string;
  /** The PAL's video track, once it has joined. */
  replicaTrack: MediaStreamTrack | null;
  /**
   * The PAL's AUDIO track. Separate from the video track and rendered by its own
   * element: `createCallObject()` — unlike the prebuilt iframe — creates NO media
   * elements, so remote audio is only heard if we play it ourselves.
   */
  replicaAudioTrack: MediaStreamTrack | null;
  /** Which acharya the live call belongs to — a screen shows video only for its own. */
  liveSlug: string | null;
  start: () => void;
  end: () => void;
}

/** What the currently-registered screen wants a call bound to. */
export interface TavusBinding {
  acharyaSlug: string;
  handlers: ToolHandlers;
}

export function useTavusSession(opts: {
  /**
   * Read at START time, not at render time. The session is a singleton in the
   * (app) layout while the BINDING belongs to whichever screen is showing — the
   * board's merged handlers, or home's nav handlers — so it is pulled through a
   * getter rather than passed as a prop that would churn the hook.
   */
  getBinding: () => TavusBinding | null;
  /** Called once the call is really up, so the caller can stand the mic down. */
  onLive?: () => void;
  onEnded?: () => void;
}): TavusSession {
  const { getBinding, onLive, onEnded } = opts;

  const [status, setStatus] = useState<TavusStatus>("idle");
  const [error, setError] = useState("");
  const [replicaTrack, setReplicaTrack] = useState<MediaStreamTrack | null>(null);
  const [replicaAudioTrack, setReplicaAudioTrack] = useState<MediaStreamTrack | null>(null);

  const callRef = useRef<DailyCall | null>(null);
  const conversationIdRef = useRef<string | null>(null);
  const bindingRef = useRef<(() => TavusBinding | null)>(getBinding);
  // State, not a ref: consumers RENDER off this (a card shows video only for its
  // own acharya), and a ref read during render is both a lint error and a stale
  // read on the paint that matters.
  const [liveSlug, setLiveSlug] = useState<string | null>(null);
  const startingRef = useRef(false);
  const onLiveRef = useRef(onLive);
  const onEndedRef = useRef(onEnded);

  useEffect(() => { bindingRef.current = getBinding; }, [getBinding]);
  useEffect(() => { onLiveRef.current = onLive; }, [onLive]);
  useEffect(() => { onEndedRef.current = onEnded; }, [onEnded]);

  /** Tell Tavus the room is finished. Idempotent by design — see the end route. */
  const releaseConversation = useCallback((useBeacon = false) => {
    const id = conversationIdRef.current;
    if (!id) return;
    conversationIdRef.current = null;
    const path = `/api/work/tavus/conversation/${encodeURIComponent(id)}/end`;
    // During teardown a normal fetch is routinely killed; a beacon survives.
    if (useBeacon && navigator.sendBeacon?.(path, new Blob([], { type: "text/plain" }))) return;
    void fetch(path, { method: "POST", keepalive: true }).catch(() => {});
  }, []);

  const teardown = useCallback((opts2: { beacon?: boolean } = {}) => {
    const call = callRef.current;
    callRef.current = null;
    if (call) {
      try { call.leave(); } catch { /* already gone */ }
      try { call.destroy(); } catch { /* already gone */ }
    }
    setReplicaTrack(null);
    setReplicaAudioTrack(null);
    releaseConversation(opts2.beacon);
  }, [releaseConversation]);

  const end = useCallback(() => {
    startingRef.current = false;
    teardown();
    setLiveSlug(null);
    setStatus("idle");
    setError("");
    onEndedRef.current?.();
  }, [teardown]);

  const handleAppMessage = useCallback((ev: DailyEventObjectAppMessage | undefined) => {
    const msg = ev?.data as TavusAppMessage | undefined;
    if (msg?.message_type !== "conversation" || msg.event_type !== "conversation.tool_call") return;

    const name = msg.properties?.name;
    const toolCallId = msg.properties?.tool_call_id;
    if (!name || !toolCallId) return;

    let args: Record<string, unknown> = {};
    try {
      args = msg.properties?.arguments ? JSON.parse(msg.properties.arguments) : {};
    } catch {
      // A malformed argument string is still a tool call the model is waiting on.
      args = {};
    }

    const reply = (output: unknown, ok: boolean) => {
      callRef.current?.sendAppMessage(
        {
          message_type: "conversation",
          event_type: "conversation.tool_result",
          conversation_id: msg.conversation_id,
          // Must echo verbatim or Tavus cannot correlate the reply.
          properties: { tool_call_id: toolCallId, output, status: ok ? "success" : "error" },
        },
        "*",
      );
    };

    const handler = bindingRef.current()?.handlers[name];
    if (!handler) {
      // Answer, never ignore. An unanswered tool is what these models stall on —
      // the same lesson as the unhandled `search_memory` in AcharyaShell.
      console.warn("[tavus-tools] unhandled", { name, args });
      reply({ ok: false, error: "unhandled" }, false);
      return;
    }

    console.info("[tavus-tools] toolCall", { name, args });
    void handler(args)
      .then((result) => reply(clampToolResult(result), result.ok !== false))
      .catch((err: unknown) => {
        console.warn("[tavus-tools] handler threw", { name, err });
        reply({ ok: false, error: "handler_failed" }, false);
      });
  }, []);

  const start = useCallback(() => {
    if (startingRef.current || callRef.current) return;
    const binding = bindingRef.current();
    if (!binding) return;
    const acharyaSlug = binding.acharyaSlug;
    setLiveSlug(acharyaSlug);
    startingRef.current = true;
    setError("");
    setStatus("starting");

    void (async () => {
      try {
        const res = await fetch("/api/work/tavus/conversation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ acharyaSlug }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          conversationId?: string;
          conversationUrl?: string;
          error?: string;
        };
        if (!startingRef.current) {
          // Ended while the room was being created — do not strand it.
          if (data.conversationId) {
            conversationIdRef.current = data.conversationId;
            releaseConversation();
          }
          return;
        }
        if (!res.ok || !data.conversationUrl) {
          startingRef.current = false;
          setError(data.error || "Could not start the video call.");
          setStatus("error");
          return;
        }
        conversationIdRef.current = data.conversationId ?? null;

        // Imported lazily: daily-js is heavy and only founders ever load it.
        const Daily = (await import("@daily-co/daily-js")).default;
        if (!startingRef.current) { releaseConversation(); return; }

        setStatus("connecting");
        const call = Daily.createCallObject();
        callRef.current = call;

        call.on("app-message", handleAppMessage);
        const absorb = (p?: DailyParticipant) => {
          const v = trackOf(p, "video");
          if (v) setReplicaTrack(v);
          const a = trackOf(p, "audio");
          if (a) setReplicaAudioTrack(a);
        };
        call.on("participant-joined", (e) => absorb(e?.participant));
        call.on("participant-updated", (e) => absorb(e?.participant));
        call.on("participant-left", () => {
          setReplicaTrack(null);
          setReplicaAudioTrack(null);
        });
        call.on("error", (e) => {
          // The thing the iframe could never tell us.
          console.error("[tavus] daily error", e);
          setError(e?.errorMsg || "The video call dropped.");
          setStatus("error");
          teardown();
        });
        call.on("left-meeting", () => {
          if (callRef.current) end();
        });

        // startVideoOff: the karigar's CAMERA is not wanted — the PAL does not
        // look at them. startAudioOff false keeps the MIC on, which is the whole
        // input path; `setLocalAudio(true)` after join is belt-and-braces because
        // a device that was busy at join time can come back muted.
        await call.join({ url: data.conversationUrl, startVideoOff: true, startAudioOff: false });
        if (!startingRef.current) { teardown(); return; }
        try { call.setLocalAudio(true); } catch { /* device may be unavailable */ }

        // Anyone already in the room when we joined never fires participant-joined.
        for (const p of Object.values(call.participants() || {})) absorb(p);

        const local = call.participants()?.local;
        console.info("[tavus] joined", {
          localAudio: local?.audio ?? null,
          participants: Object.keys(call.participants() || {}).length,
        });

        startingRef.current = false;
        setStatus("live");
        onLiveRef.current?.();
      } catch (err) {
        startingRef.current = false;
        console.error("[tavus] join failed", err);
        setError(err instanceof Error ? err.message : "Could not start the video call.");
        setStatus("error");
        teardown();
      }
    })();
  }, [handleAppMessage, releaseConversation, teardown, end]);

  // A live conversation bills and holds a concurrency slot until ended, and a
  // phone backgrounding the tab never runs a normal cleanup.
  useEffect(() => {
    function onPageHide() { teardown({ beacon: true }); }
    window.addEventListener("pagehide", onPageHide);
    return () => {
      window.removeEventListener("pagehide", onPageHide);
      teardown();
    };
  }, [teardown]);

  return { status, error, replicaTrack, replicaAudioTrack, liveSlug, start, end };
}

/** A remote participant's track, whichever shape this daily-js version reports. */
function trackOf(
  p: DailyParticipant | undefined,
  kind: "video" | "audio",
): MediaStreamTrack | null {
  if (!p || p.local) return null;
  const t = p.tracks?.[kind];
  if (!t || t.state !== "playable") return null;
  return t.persistentTrack ?? t.track ?? null;
}
